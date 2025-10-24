import type {
  Action, ActionResult, ConditionSpec, PageDefinition, Registry,
  SelectorSpec, Settings, WorkflowDefinition, GlobalSource, SourceSpec
} from './types';
import { findOne, findAll } from './selector';
import { Store } from './storage';
import { copy } from './clipboard';
import { onDocumentReady, waitForElement } from './wait';
import { sleep } from './utils';
import { MenuUI } from './ui';
import { deepRenderTemplates } from './templating';
import { extractListData, takeFromElement } from './data';
import {
  getActiveProfile,
  getProfileValues,
  profileLabel,
  saveProfileValues,
  setActiveProfile,
  type ProfileId
} from './profiles';

function isGlobalSource(s: SourceSpec): s is GlobalSource {
  return (s as any)?.global != null;
}

function readGlobal(g: GlobalSource): string {
  switch (g.global) {
    case 'document.title': return document.title || '';
    case 'location.href': return location.href;
    case 'location.host': return location.host;
    case 'location.pathname': return location.pathname;
    case 'navigator.userAgent': return navigator.userAgent;
    case 'timestamp': return new Date().toISOString();
    default: return '';
  }
}

export class Engine {
  private store: Store;
  private registry: Registry;
  private settings: Settings;
  private ui: MenuUI;
  private currentPage?: PageDefinition;
  private running = false;

  constructor(registry: Registry, store: Store){
    this.store = store;
    this.registry = registry;
    this.settings = store.get<Settings>('settings', {
      theme: { primary:'#1f7a8c', background:'#0b0c10e6', text:'#f5f7fb', accent:'#ffbd59' },
      interActionDelayMs: 120
    });
    this.ui = new MenuUI(registry, store);

    window.addEventListener('cv-menu:run-workflow' as any, (ev: any) => {
      const { workflowId, profileId } = ev.detail || {};
      const id = workflowId as string;
      if (!this.currentPage) return;
      const wf = this.currentPage.workflows.find(w => w.id === id);
      if (!wf) return;
      if (profileId) {
        setActiveProfile(this.store, wf.id, profileId as ProfileId);
        this.ui.markActiveProfile(wf.id, profileId as ProfileId);
      }
      this.runWorkflow(wf).catch(err => console.error(err));
    });

    window.addEventListener('cv-menu:save-options' as any, (ev: any) => {
      const { workflowId, values, profileId } = ev.detail || {};
      if (!workflowId) return;
      const targetProfile = (profileId as ProfileId) || getActiveProfile(this.store, workflowId);
      saveProfileValues(this.store, workflowId, targetProfile, values || {});
      this.ui.markActiveProfile(workflowId, targetProfile);
      alert(`Saved ${profileLabel(targetProfile)} for ${workflowId}`);
    });
  }

  async boot(){
    await onDocumentReady();
    await this.reDetect();            // initial detection
    this.setupSpaDetection();         // NEW: keep page detection fresh on SPA route changes

    if (typeof GM_registerMenuCommand !== 'undefined') {
      GM_registerMenuCommand('CV: Toggle Menu', () => (this.ui as any)['toggle']?.());
      GM_registerMenuCommand('CV: Detect Page', async () => {
        await this.reDetect();
      });
    }
  }

  // NEW: centralized re-detect helper
  private async reDetect(){
    const page = await this.detectPage();
    this.currentPage = page;
    this.ui.setPage(page);
  }

  // NEW: watch history & hash navigation (common in Oracle/Jira SPAs)
  private setupSpaDetection() {
    const recheck = () => {
      setTimeout(() => this.reDetect().catch(() => void 0), 50);
    };

    // Bind originals so we don't depend on `this` inside our wrappers
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    try {
      // Strongly-typed wrappers (no implicit `this`, correct tuple params)
      history.pushState = function (
        this: History,
        data: any,
        unused: string,
        url?: string | URL | null
      ): void {
        const ret = origPush(data, unused, url as any);
        recheck();
        return ret as unknown as void;
      } as typeof history.pushState;

      history.replaceState = function (
        this: History,
        data: any,
        unused: string,
        url?: string | URL | null
      ): void {
        const ret = origReplace(data, unused, url as any);
        recheck();
        return ret as unknown as void;
      } as typeof history.replaceState;
    } catch {
      // Some environments lock these methods; we still have popstate/hashchange below
    }

    window.addEventListener('popstate', recheck);
    window.addEventListener('hashchange', recheck);
  }

  private async detectPage(): Promise<PageDefinition|undefined>{
    for (const p of this.registry.pages){
      const ok = await this.evalCondition(p.detector);
      if (ok) return p;
    }
    return undefined;
  }

  private async evalCondition(c?: ConditionSpec): Promise<boolean>{
    if (!c) return true;
    if ('exists' in c) {
      const spec = c.exists;
      const visibleOnly = spec.visible === true;
      return !!findOne(spec, { visibleOnly });
    }
    if ('notExists' in c) {
      const spec = c.notExists;
      const visibleOnly = spec.visible === true;
      return !findOne(spec, { visibleOnly });
    }
    if ('textPresent' in c) {
      const el = findOne(c.textPresent.where, { visibleOnly: true });
      if (!el) return false;
      const txt = (el.textContent || '').trim();
      const m = c.textPresent.matcher;
      if ('equals' in m) return (m.caseInsensitive ? txt.toLowerCase() === m.equals.toLowerCase() : txt === m.equals);
      if ('includes' in m) return (m.caseInsensitive ? txt.toLowerCase().includes(m.includes.toLowerCase()) : txt.includes(m.includes));
      if ('regex' in m) { try { return new RegExp(m.regex, m.flags).test(txt); } catch { return false; } }
      return false;
    }
    if ('any' in c) { for (const sub of c.any) if (await this.evalCondition(sub)) return true; return false; }
    if ('all' in c) { for (const sub of c.all) if (!(await this.evalCondition(sub))) return false; return true; }
    if ('not' in c) return !(await this.evalCondition(c.not));
    return false;
  }

  private getWorkflowOptions(wf: WorkflowDefinition, profileOverride?: ProfileId): Record<string, any> {
    const defaults: Record<string, any> = {};
    for (const opt of (wf.options || [])){
      defaults[opt.key] = (opt as any).default;
    }
    const profileId = profileOverride ?? getActiveProfile(this.store, wf.id);
    const saved = getProfileValues(this.store, wf.id, profileId);
    return { ...defaults, ...saved };
  }

  async runWorkflow(wf: WorkflowDefinition, nested = false){
    if (!wf) return;
    if (this.running && !nested) { alert('A workflow is already running.'); return; }
    const wasRunning = this.running;
    if (!nested) this.running = true;

    const activeProfile = getActiveProfile(this.store, wf.id);
    this.store.set('lastWorkflow', { id: wf.id, at: Date.now(), profileId: activeProfile });

    const ctx = {
      opt: this.getWorkflowOptions(wf, activeProfile),
      profile: { id: activeProfile, label: profileLabel(activeProfile) }
    };

    try {
      for (let i=0; i<wf.steps.length; i++){
        const rawStep = wf.steps[i];
        const step = deepRenderTemplates(rawStep, ctx) as Action;   // inject {{opt.*}}
        this.store.set('lastStep', { workflowId: wf.id, index: i });
        const res = await this.execStep(step);
        if (!res.ok) throw new Error(res.error);
        await this.afterActionWaits();
        await sleep(this.settings.interActionDelayMs);
      }
      if (!nested) alert(`Workflow "${wf.label}" completed.`);
    } catch (e: any) {
      console.error(e);
      if (!nested) alert(`Workflow "${wf.label}" failed: ${e.message}`);
    } finally {
      if (!nested) this.running = wasRunning;
    }
  }

  private async afterActionWaits(){
    const ind = this.settings.loadingIndicator;
    if (!ind) return;
    try {
      const start = Date.now();
      const timeout = 60000;
      while (Date.now() - start < timeout){
        const visible = !!findOne(ind, { visibleOnly: true });
        if (!visible) break;
        await sleep(150);
      }
    } catch { /* ignore */ }
  }

  private async execStep(step: Action): Promise<ActionResult>{
    switch (step.kind){
      case 'waitFor': {
        await waitForElement(step.target, step.wait);
        return { ok: true };
      }
      case 'delay': {
        await sleep(step.ms);
        return { ok: true };
      }
      case 'click': {
        if (step.preWait) await waitForElement(step.target, step.preWait);
        const el = findOne(step.target, { visibleOnly: true });
        if (!el) return { ok: false, error: 'click: target not found' };
        (el as HTMLElement).click();
        if (step.postWaitFor) await waitForElement(step.postWaitFor, { timeoutMs: 15000, visibleOnly: true });
        return { ok: true };
      }
      case 'type': {
        const el = findOne(step.target, { visibleOnly: true }) as HTMLInputElement | HTMLTextAreaElement | null;
        if (!el) return { ok: false, error: 'type: target not found' };
        el.focus();
        if (step.clearFirst) {
          (el as any).value = '';
          el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
        for (const ch of step.text.split('')){
          (el as any).value = ((el as any).value || '') + ch;
          el.dispatchEvent(new InputEvent('input', { bubbles: true }));
          await sleep(step.perKeystrokeDelayMs ?? 15);
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (step.postEnter){
          (el as any).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          (el as any).dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        }
        return { ok: true };
      }
      case 'selectFromList': {
        const list = await waitForElement(step.list, { timeoutMs: 10000, visibleOnly: true });
        const items = findAll(step.item, { root: list, visibleOnly: true });
        if (items.length === 0) return { ok: false, error: 'selectFromList: item not found' };
        (items[0] as HTMLElement).click();
        return { ok: true };
      }
      case 'extract': {
        const out: Record<string, any> = {};
        for (const it of step.items){
          if (isGlobalSource(it.from)) {
            out[it.intoKey] = readGlobal(it.from);
            continue;
          }
          const el = findOne(it.from as SelectorSpec, { visibleOnly: false });
          if (!el) { out[it.intoKey] = ''; continue; }
          out[it.intoKey] = takeFromElement(el, it.take);
        }
        if ((step as any).copyToClipboard) copy(JSON.stringify(out, null, 2));
        if ((step as any).present) this.present(out);
        return { ok: true, data: out };
      }
      case 'extractList': {
        const limit = Number(step.limit) || 20;
        const arr = extractListData(step.list, step.fields, limit, { visibleOnly: step.visibleOnly ?? true });
        const out: Record<string, any> = { [step.intoKey]: arr };
        if ((step as any).copyToClipboard) copy(JSON.stringify(out, null, 2));
        if ((step as any).present) this.present(out);
        return { ok: true, data: out };
      }
      case 'branch': {
        const ok = await this.evalCondition(step.condition);
        if (ok && step.thenWorkflow){
          const wf = this.findWorkflow(step.thenWorkflow);
          if (wf) await this.runWorkflow(wf, true);
          return { ok: true };
        }
        if (!ok && step.elseWorkflow){
          const wf = this.findWorkflow(step.elseWorkflow);
          if (wf) await this.runWorkflow(wf, true);
          return { ok: true };
        }
        return { ok: true };
      }
      case 'error': {
        alert(step.message);
        return { ok: true };
      }
      default:
        return { ok: false, error: `Unsupported step kind: ${(step as any).kind}` };
    }
  }

  private findWorkflow(id: string): WorkflowDefinition | undefined {
    for (const p of this.registry.pages){
      for (const w of p.workflows){
        if (w.id === id) return w;
      }
    }
    return undefined;
  }

  private present(obj: Record<string, any>){
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(obj, null, 2);
    Object.assign(pre.style, {
      position: 'fixed', right: '16px', top: '16px', background: 'rgba(0,0,0,.85)', color: '#fff',
      padding: '10px', zIndex: '99999999', maxHeight: '60vh', overflow: 'auto', borderRadius: '8px'
    } as any);
    document.body.appendChild(pre);
    setTimeout(() => pre.remove(), 4000);
  }
}
