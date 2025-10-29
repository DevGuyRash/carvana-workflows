import type {
  Action, ActionResult, CapturePattern, ConditionSpec, PageDefinition, Registry,
  SelectorSpec, Settings, WorkflowDefinition, GlobalSource, SourceSpec, WorkflowMutationWatchConfig
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
  getProfilesEnabled,
  profileLabel,
  saveProfileValues,
  setActiveProfile,
  type ProfileId
} from './profiles';
import { getRunPrefs, shouldAutoRun, markAutoRun } from './autorun';

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

type RunContext = {
  workflowId: string;
  opt: Record<string, any>;
  profile: { id: ProfileId; label: string };
  vars: Record<string, any>;
};

type CaptureDataStep = Extract<Action, { kind: 'captureData' }>;

export class Engine {
  private store: Store;
  private registry: Registry;
  private settings: Settings;
  private ui: MenuUI;
  private currentPage?: PageDefinition;
  private running = false;
  private autoRunStatuses = new Map<string, string>();
  private autoRunRetryTimers = new Map<string, number>();
  private mutationWatchers = new Map<string, MutationObserver>();
  private mutationWatchTimers = new Map<string, number>();

  constructor(registry: Registry, store: Store){
    this.store = store;
    this.registry = registry;
    this.settings = store.get<Settings>('settings', {
      theme: { primary:'#1f7a8c', background:'#0b0c10e6', text:'#f5f7fb', accent:'#ffbd59', panelOpacity: 0.95 },
      interActionDelayMs: 120
    });
    this.ui = new MenuUI(registry, store, {
      'run-workflow': (detail: any) => {
        this.handleRunWorkflowRequest(detail).catch(err => console.error(err));
      },
      'save-options': (detail: any) => {
        this.handleSaveOptionsRequest(detail).catch(err => console.error(err));
      },
      'run-prefs-updated': (detail: any) => {
        this.onRunPrefsUpdated(detail).catch(err => console.error(err));
      }
    });
  }

  private async handleRunWorkflowRequest(detail: any): Promise<void> {
    const { workflowId, profileId } = detail || {};
    const id = workflowId as string;
    if (!id || !this.currentPage) return;
    const wf = this.currentPage.workflows.find(w => w.id === id);
    if (!wf) return;
    if (profileId && this.profilesEnabled(wf)) {
      const resolved = profileId as ProfileId;
      setActiveProfile(this.store, wf.id, resolved);
      this.ui.markActiveProfile(wf.id, resolved);
    }
    await this.runWorkflow(wf);
  }

  private async handleSaveOptionsRequest(detail: any): Promise<void> {
    const { workflowId, values, profileId } = detail || {};
    if (!workflowId || !this.currentPage) return;
    const wf = this.currentPage.workflows.find(w => w.id === workflowId);
    if (!wf) return;
    const targetProfile = this.resolveProfileId(wf, profileId as ProfileId | undefined);
    saveProfileValues(this.store, workflowId, targetProfile, values || {});
    if (this.profilesEnabled(wf)) {
      this.ui.markActiveProfile(workflowId, targetProfile);
      this.ui.appendLog(`Saved ${profileLabel(targetProfile)} for ${wf.label}`);
    } else {
      this.ui.appendLog(`Saved options for ${wf.label}`);
    }
  }

  private profilesEnabled(wf: WorkflowDefinition): boolean {
    const defaultEnabled = wf?.profiles?.enabled ?? true;
    return getProfilesEnabled(this.store, wf.id, { enabled: defaultEnabled });
  }

  private updateAutoRunStatus(
    wf: WorkflowDefinition,
    status: string,
    message: string,
    level: 'info' | 'debug' = 'info'
  ): void {
    const prev = this.autoRunStatuses.get(wf.id);
    if (prev === status && level === 'info') return;
    this.autoRunStatuses.set(wf.id, status);
    this.ui.appendLog(message, level);
  }

  private clearAutoRunRetry(workflowId: string): void {
    const timer = this.autoRunRetryTimers.get(workflowId);
    if (timer != null) {
      window.clearTimeout(timer);
      this.autoRunRetryTimers.delete(workflowId);
    }
  }

  private scheduleAutoRunRetry(wf: WorkflowDefinition, delayMs?: number): void {
    const delay = Math.max(250, delayMs ?? 1500);
    this.clearAutoRunRetry(wf.id);
    const timer = window.setTimeout(() => {
      this.autoRunRetryTimers.delete(wf.id);
      if (!this.currentPage) return;
      this.handleAutoRun(this.currentPage, {
        onlyWorkflowId: wf.id,
        force: true
      }).catch(err => console.error(err));
    }, delay);
    this.autoRunRetryTimers.set(wf.id, timer);
    this.ui.appendLog(`Auto-run retry queued for ${wf.label} in ${(delay / 1000).toFixed(1)}s.`, 'debug');
  }

  private resolveProfileId(wf: WorkflowDefinition, requested?: ProfileId | null): ProfileId {
    if (!this.profilesEnabled(wf)) return 'p1';
    if (requested) return requested;
    return getActiveProfile(this.store, wf.id);
  }

  private profileDisplayLabel(wf: WorkflowDefinition, profileId: ProfileId): string {
    return this.profilesEnabled(wf) ? profileLabel(profileId) : 'Default';
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
    this.teardownMutationWatchers();
    if (page) {
      for (const wf of page.workflows) {
        this.setupMutationWatcher(wf);
      }
    }
    await this.handleAutoRun(page);
  }

  private teardownMutationWatchers(): void {
    for (const [, observer] of this.mutationWatchers) {
      observer.disconnect();
    }
    this.mutationWatchers.clear();
    for (const [, timer] of this.mutationWatchTimers) {
      window.clearTimeout(timer);
    }
    this.mutationWatchTimers.clear();
  }

  private removeMutationWatcher(id: string): void {
    const observer = this.mutationWatchers.get(id);
    if (observer) {
      observer.disconnect();
      this.mutationWatchers.delete(id);
    }
    const timer = this.mutationWatchTimers.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      this.mutationWatchTimers.delete(id);
    }
  }

  private setupMutationWatcher(wf: WorkflowDefinition): void {
    const config = this.resolveMutationWatchConfig(wf);
    if (!config) {
      this.removeMutationWatcher(wf.id);
      return;
    }
    this.removeMutationWatcher(wf.id);
    this.bindMutationWatcher(wf, config).catch(err => console.error(err));
  }

  private async bindMutationWatcher(
    wf: WorkflowDefinition,
    config: WorkflowMutationWatchConfig
  ): Promise<void> {
    if (!config.root) return;
    try {
      const root = await waitForElement(config.root, {
        timeoutMs: 5000,
        pollIntervalMs: 250,
        visibleOnly: false
      });
      if (!root || !this.currentPage || !this.currentPage.workflows.some(w => w.id === wf.id)) {
        return;
      }
      const observeChildList = config.observeChildList !== false;
      const observeAttributes = config.observeAttributes !== false;
      const observeCharacterData = config.observeCharacterData === true;

      if (!observeChildList && !observeAttributes && !observeCharacterData) {
        return;
      }

      const observer = new MutationObserver(mutations => {
        if (!root.isConnected) {
          observer.disconnect();
          this.mutationWatchers.delete(wf.id);
          this.setupMutationWatcher(wf);
          return;
        }
        const relevant = mutations.some(m => {
          if (m.type === 'childList' && observeChildList) return true;
          if (m.type === 'attributes' && observeAttributes) return true;
          if (m.type === 'characterData' && observeCharacterData) return true;
          return false;
        });
        if (!relevant) return;
        this.queueMutationAutoRun(wf, config);
      });

      observer.observe(root, {
        subtree: true,
        childList: observeChildList,
        attributes: observeAttributes,
        characterData: observeCharacterData,
        attributeFilter: observeAttributes ? config.attributeFilter : undefined
      });

      this.mutationWatchers.set(wf.id, observer);
    } catch (err) {
      console.debug('Mutation watcher setup failed', err);
    }
  }

  private queueMutationAutoRun(
    wf: WorkflowDefinition,
    config: WorkflowMutationWatchConfig
  ): void {
    const debounce = Math.max(50, config.debounceMs ?? 200);
    const forceRun = config.forceAutoRun !== false;
    const prev = this.mutationWatchTimers.get(wf.id);
    if (prev != null) {
      window.clearTimeout(prev);
    }
    const timer = window.setTimeout(() => {
      this.mutationWatchTimers.delete(wf.id);
      if (!this.currentPage || !this.currentPage.workflows.some(w => w.id === wf.id)) return;
      this.evalCondition(wf.enabledWhen)
        .then(ok => {
          if (!ok) return;
          return this.handleAutoRun(this.currentPage, {
            onlyWorkflowId: wf.id,
            force: forceRun
          });
        })
        .catch(err => console.error(err));
    }, debounce);
    this.mutationWatchTimers.set(wf.id, timer);
  }

  private resolveMutationWatchConfig(wf: WorkflowDefinition): WorkflowMutationWatchConfig | null {
    if (wf.internal) return null;
    const watch = wf.autoRun?.watchMutations;
    if (!watch) return null;
    const base: WorkflowMutationWatchConfig = watch === true ? {} : watch;
    const root = base.root ?? this.deriveMutationRoot(wf);
    if (!root) return null;
    return { ...base, root };
  }

  private deriveMutationRoot(wf: WorkflowDefinition): SelectorSpec | undefined {
    const auto = wf.autoRun;
    if (!auto) return undefined;
    const candidates: (SelectorSpec | undefined)[] = [
      auto.waitForSelector?.within,
      auto.waitForSelector,
      auto.waitForHiddenSelector?.within,
      auto.waitForHiddenSelector,
      auto.waitForInteractableSelector?.within,
      auto.waitForInteractableSelector
    ];
    for (const spec of candidates) {
      if (spec) return spec;
    }
    return undefined;
  }

  private resolveAutoRunContext(wf: WorkflowDefinition): string | undefined {
    const ctx = wf.autoRun?.context;
    if (!ctx) return undefined;
    try {
      if (typeof ctx === 'string') {
        return ctx || undefined;
      }
      if (typeof ctx === 'function') {
        const val = ctx();
        return val && val.length > 0 ? val : undefined;
      }
      const {
        resolve,
        selector,
        attribute,
        textContent,
        trim = true,
        fallback
      } = ctx;
      if (typeof resolve === 'function') {
        const val = resolve();
        if (val && val.length > 0) {
          return val;
        }
      }
      const target = selector ? findOne(selector, { visibleOnly: false }) : null;
      if (!target) {
        return fallback;
      }
      if (attribute) {
        const attrVal = target.getAttribute(attribute);
        if (attrVal && attrVal.length > 0) {
          return attrVal;
        }
      }
      if (textContent) {
        const text = target.textContent ?? '';
        const processed = trim ? text.trim() : text;
        if (processed.length > 0) {
          return processed;
        }
      }
      return fallback;
    } catch {
      return undefined;
    }
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

  private async handleAutoRun(
    page?: PageDefinition,
    opts?: { onlyWorkflowId?: string; force?: boolean }
  ): Promise<void> {
    if (!page) return;
    const onlyId = opts?.onlyWorkflowId;
    for (const wf of page.workflows) {
      if (wf.internal) continue;
      if (onlyId && wf.id !== onlyId) continue;
      const prefs = getRunPrefs(this.store, wf.id);
      if (!prefs.auto) {
        this.updateAutoRunStatus(wf, 'disabled', `Auto-run disabled for ${wf.label}.`, 'debug');
        this.clearAutoRunRetry(wf.id);
        continue;
      }
      const hrefBefore = typeof globalThis.location?.href === 'string' ? globalThis.location.href : '';
      const contextBefore = this.resolveAutoRunContext(wf);
      const pollInterval = wf.autoRun?.pollIntervalMs;
      const conditionTimeout = wf.autoRun?.waitForConditionMs ?? wf.autoRun?.waitForMs;
      const retryDelay = wf.autoRun?.retryDelayMs ?? 1500;
      const shouldRun = shouldAutoRun(prefs, hrefBefore, {
        now: Date.now(),
        force: opts?.force === true && (!onlyId || onlyId === wf.id),
        context: contextBefore
      });
      if (!shouldRun) {
        this.updateAutoRunStatus(wf, 'cooldown', `Auto-run pending for ${wf.label}: waiting before next run.`, 'debug');
        continue;
      }
      if (this.running) {
        this.updateAutoRunStatus(wf, 'busy', `Auto-run skipped for ${wf.label}: another workflow is running.`, 'debug');
        this.scheduleAutoRunRetry(wf, retryDelay);
        continue;
      }
      const ready = await this.waitForCondition(wf.enabledWhen, {
        timeoutMs: conditionTimeout,
        intervalMs: pollInterval
      });
      if (!ready) {
        this.updateAutoRunStatus(wf, 'blocked', `Auto-run skipped for ${wf.label}: conditions not met yet.`, 'debug');
        this.scheduleAutoRunRetry(wf, retryDelay);
        continue;
      }
      const readyTimeout = wf.autoRun?.waitForReadyMs ?? wf.autoRun?.waitForMs;
      const skipReadiness = wf.autoRun?.skipReadiness === true;
      if (!skipReadiness) {
        this.updateAutoRunStatus(wf, 'waiting-ready', `Auto-run waiting for ${wf.label} to become interactive...`, 'debug');
        const interactive = await this.waitForAutoRunReadiness(wf, {
          timeoutMs: readyTimeout,
          intervalMs: pollInterval
        });
        if (!interactive) {
          this.updateAutoRunStatus(wf, 'ready-timeout', `Auto-run timed out waiting for ${wf.label} readiness.`, 'debug');
          this.scheduleAutoRunRetry(wf, retryDelay);
          continue;
        }
      }
      this.updateAutoRunStatus(wf, 'starting', `Auto-run starting ${wf.label}...`);
      const ok = await this.runWorkflow(wf, false, { silent: true });
      if (ok) {
        this.clearAutoRunRetry(wf.id);
        const contextAfter = this.resolveAutoRunContext(wf) ?? contextBefore;
        markAutoRun(this.store, wf.id, { href: hrefBefore, at: Date.now(), context: contextAfter ?? undefined });
        this.updateAutoRunStatus(wf, 'ran', `Auto-run completed ${wf.label}.`);
      } else {
        this.updateAutoRunStatus(wf, 'error', `Auto-run failed for ${wf.label}.`);
        this.scheduleAutoRunRetry(wf, retryDelay);
      }
    }
  }

  private async onRunPrefsUpdated(detail: any): Promise<void> {
    const workflowId = detail?.workflowId as string | undefined;
    if (!workflowId || !this.currentPage) return;
    const wf = this.currentPage.workflows.find(w => w.id === workflowId);
    if (!wf) return;

    const prevAuto = !!detail?.prev?.auto;
    const prevRepeat = !!detail?.prev?.repeat;
    const nextPrefs = getRunPrefs(this.store, workflowId);
    if (!nextPrefs.auto) return;

    const force = (!prevAuto && nextPrefs.auto) || (!prevRepeat && nextPrefs.repeat);
    await this.handleAutoRun(this.currentPage, {
      onlyWorkflowId: workflowId,
      force
    });
  }

  private async detectPage(): Promise<PageDefinition|undefined>{
    for (const p of this.registry.pages){
      const ok = await this.evalCondition(p.detector);
      if (ok) return p;
    }
    return undefined;
  }

  private async waitForCondition(
    condition?: ConditionSpec,
    opts?: { timeoutMs?: number; intervalMs?: number }
  ): Promise<boolean> {
    if (!condition) return true;
    const timeoutMs = Math.max(0, opts?.timeoutMs ?? 0);
    const intervalMs = Math.max(25, opts?.intervalMs ?? 150);
    const deadline = Date.now() + timeoutMs;
    while (true) {
      if (await this.evalCondition(condition)) return true;
      if (timeoutMs === 0 || Date.now() >= deadline) return false;
      await sleep(intervalMs);
    }
  }

  private selectorMatches(spec?: SelectorSpec): boolean {
    if (!spec) return true;
    try {
      const visibleOnly = spec.visible === true;
      return !!findOne(spec, { visibleOnly });
    } catch {
      return false;
    }
  }

  private selectorInteractable(spec?: SelectorSpec): boolean {
    if (!spec) return true;
    try {
      const el = findOne(spec, { visibleOnly: true });
      if (!el) return false;
      const rect = (el as HTMLElement).getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) return false;
      const ariaExpanded = el.getAttribute('aria-expanded');
      if (ariaExpanded && ariaExpanded.toLowerCase() === 'false') {
        return true;
      }
      const ariaDisabled = el.getAttribute('aria-disabled');
      if (ariaDisabled && ariaDisabled.toLowerCase() === 'true') return false;
      return true;
    } catch {
      return false;
    }
  }

  private isLoadingActive(): boolean {
    const indicator = this.settings.loadingIndicator;
    if (!indicator) return false;
    try {
      const visibleOnly = indicator.visible === true;
      return !!findOne(indicator, { visibleOnly });
    } catch {
      return false;
    }
  }

  private async waitForAutoRunReadiness(
    wf: WorkflowDefinition,
    opts?: { timeoutMs?: number; intervalMs?: number }
  ): Promise<boolean> {
    const timeoutMs = Math.max(0, opts?.timeoutMs ?? 0);
    const intervalMs = Math.max(25, opts?.intervalMs ?? wf.autoRun?.pollIntervalMs ?? 150);
    const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : 0;
    const respectLoading = wf.autoRun?.respectLoadingIndicator !== false;
    const waitFor = wf.autoRun?.waitForSelector;
    const waitForHidden = wf.autoRun?.waitForHiddenSelector;
    const waitForInteractable = wf.autoRun?.waitForInteractableSelector;

    while (true) {
      if (respectLoading && this.isLoadingActive()) {
        if (timeoutMs > 0 && Date.now() >= deadline) return false;
        await sleep(intervalMs);
        continue;
      }
      if (waitFor && !this.selectorMatches(waitFor)) {
        if (timeoutMs > 0 && Date.now() >= deadline) return false;
        await sleep(intervalMs);
        continue;
      }
      if (waitForHidden && this.selectorMatches(waitForHidden)) {
        if (timeoutMs > 0 && Date.now() >= deadline) return false;
        await sleep(intervalMs);
        continue;
      }
      if (waitForInteractable && !this.selectorInteractable(waitForInteractable)) {
        if (timeoutMs > 0 && Date.now() >= deadline) return false;
        await sleep(intervalMs);
        continue;
      }
      return true;
    }
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

  private getWorkflowOptions(wf: WorkflowDefinition, profileOverride?: ProfileId | null): Record<string, any> {
    const defaults: Record<string, any> = {};
    for (const opt of (wf.options || [])){
      defaults[opt.key] = (opt as any).default;
    }
    const profileId = this.resolveProfileId(wf, profileOverride ?? null);
    const saved = getProfileValues(this.store, wf.id, profileId);
    return { ...defaults, ...saved };
  }

  async runWorkflow(
    wf: WorkflowDefinition,
    nested = false,
    options: { silent?: boolean } = {}
  ): Promise<boolean> {
    if (!wf) return false;
    if (this.running && !nested) {
      if (!options.silent) this.ui.appendLog(`Skipped ${wf.label}: another workflow in progress.`);
      return false;
    }
    const wasRunning = this.running;
    if (!nested) this.running = true;

    const activeProfile = this.resolveProfileId(wf, null);
    const displayLabel = this.profileDisplayLabel(wf, activeProfile);
    this.store.set('lastWorkflow', { id: wf.id, at: Date.now(), profileId: activeProfile });

    const ctx: RunContext = {
      workflowId: wf.id,
      opt: this.getWorkflowOptions(wf, activeProfile),
      profile: { id: activeProfile, label: displayLabel },
      vars: Object.create(null)
    };

    let success = false;

    if (!nested && !options.silent) {
      this.ui.appendLog(`Running ${wf.label} (${displayLabel})`);
    }

    try {
      for (let i=0; i<wf.steps.length; i++){
        const rawStep = wf.steps[i];
        const step = deepRenderTemplates(rawStep, ctx) as Action;   // inject {{opt.*}}
        this.store.set('lastStep', { workflowId: wf.id, index: i });
        const res = await this.execStep(step, ctx);
        if (!res.ok) {
          const stepKind = (rawStep as any)?.kind ?? `step ${i}`;
          const reason = res.error ?? 'unknown error';
          throw new Error(`${stepKind}: ${reason}`);
        }
        await this.afterActionWaits();
        await sleep(this.settings.interActionDelayMs);
      }
      success = true;
      if (!nested && !options.silent) this.ui.appendLog(`Workflow "${wf.label}" completed successfully.`);
    } catch (e: any) {
      console.error(e);
      success = false;
      const message = e?.message ?? String(e ?? 'unknown error');
      this.ui.appendLog(`Workflow "${wf.label}" failed: ${message}`, options.silent ? 'debug' : 'info');
    } finally {
      if (!nested) this.running = wasRunning;
    }
    return success;
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

  private async execStep(step: Action, ctx: RunContext): Promise<ActionResult>{
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
        const attemptClick = async (): Promise<ActionResult> => {
          const el = findOne(step.target, { visibleOnly: true });
          if (!el) return { ok: false, error: 'click: target not found' };
          (el as HTMLElement).click();
          return { ok: true };
        };

        if (step.preWait) await waitForElement(step.target, step.preWait);

        let result = await attemptClick();
        if (!result.ok) return result;

        const postWait = step.postWaitFor;
        if (!postWait) return { ok: true };

        const timeout = step.postWaitTimeoutMs ?? 15000;
        const start = Date.now();
        const poll = step.postWaitPollMs ?? 250;

        while (Date.now() - start <= timeout) {
          try {
            await waitForElement(postWait, { timeoutMs: poll, visibleOnly: true });
            return { ok: true };
          } catch {
            result = await attemptClick();
            if (!result.ok) return result;
            await sleep(Math.min(poll, 200));
          }
        }

        return { ok: false, error: 'click: post wait timeout' };
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
      case 'captureData': {
        const patterns = this.collectCapturePatterns(step, ctx);
        const rememberKey = step.rememberKey ? `capture:last:${ctx.workflowId}:${step.rememberKey}` : `capture:last:${ctx.workflowId}:${step.id}`;
        let previous = '';
        try {
          previous = this.store.get<string>(rememberKey, '');
        } catch { previous = ''; }
        this.ui.appendLog(`captureData[${ctx.workflowId}]: awaiting input for ${step.id}`);
        const pasted = await this.promptForText(step.prompt, previous);
        if (pasted == null) {
          if (step.required === false) {
            this.ui.appendLog(`captureData[${ctx.workflowId}]: cancelled (optional)`);
            return { ok: true, data: {} };
          }
          return { ok: false, error: 'captureData: cancelled by user' };
        }
        if (rememberKey) this.store.set(rememberKey, pasted);
        const parsed = this.applyCapturePatterns(pasted, patterns);
        const data = { __raw: pasted, ...parsed };
        ctx.vars[step.id] = data;
        Object.assign(ctx.vars, parsed);
        this.ui.appendLog(`captureData[${ctx.workflowId}]: extracted keys ${Object.keys(parsed).join(', ') || '(none)'}`);
        if (step.present) this.present(data);
        if (step.copyToClipboard) copy(JSON.stringify(data, null, 2));
        return { ok: true, data };
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

  private collectCapturePatterns(step: CaptureDataStep, ctx: RunContext): CapturePattern[] {
    const patterns: CapturePattern[] = [];
    if (Array.isArray(step.patterns)) patterns.push(...this.normalizePatterns(step.patterns));
    if (step.optionKey) {
      const fromOpt = ctx.opt?.[step.optionKey];
      if (fromOpt != null) patterns.push(...this.normalizePatterns(fromOpt));
    }
    return patterns;
  }

  private normalizePatterns(raw: unknown): CapturePattern[] {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.flatMap(entry => this.normalizePatterns(entry));
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed);
          return this.normalizePatterns(parsed);
        } catch { /* fall through to simple format */ }
      }
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const into = trimmed.slice(0, eq).trim();
        const pattern = trimmed.slice(eq + 1).trim();
        if (into && pattern) return [{ type: 'regex', into, pattern }];
      }
      return [];
    }
    if (typeof raw === 'object') {
      const obj = raw as Record<string, any>;
      const explicit = obj.pattern || obj.regex || obj.selector || obj.delimiter || obj.into || obj.key || obj.name;
      if (!explicit) {
        const entries: CapturePattern[] = [];
        for (const [into, value] of Object.entries(obj)){
          if (!into) continue;
          if (typeof value === 'string') {
            entries.push({ type: 'regex', into, pattern: value });
          } else if (value != null) {
            entries.push(...this.normalizePatterns({ into, ...value }));
          }
        }
        return entries;
      }
      const into = (obj.into ?? obj.key ?? obj.name ?? '').toString().trim();
      const declaredType = (obj.type ?? obj.kind ?? (obj.selector ? 'selector' : obj.delimiter ? 'split' : 'regex')) as string;
      if (!into && declaredType !== 'split') return [];
      const trim = obj.trim !== false;
      if (declaredType === 'selector' || declaredType === 'attr' || declaredType === 'attribute') {
        const selector = obj.selector?.toString().trim();
        if (!selector) return [];
        const pattern: CapturePattern = {
          type: 'selector',
          into,
          selector,
          attribute: obj.attribute?.toString(),
          take: obj.take,
          index: obj.index != null ? Number(obj.index) : undefined,
          all: obj.all === true || obj.multiple === true,
          trim
        };
        return [pattern];
      }
      if (declaredType === 'split') {
        const delimiter = obj.delimiter != null ? String(obj.delimiter) : '';
        if (!delimiter) return [];
        const pattern: CapturePattern = {
          type: 'split',
          into: into || 'split',
          delimiter,
          index: obj.index != null ? Number(obj.index) : undefined,
          trim
        };
        return [pattern];
      }
      const patternValue = (obj.pattern ?? obj.regex);
      if (!patternValue) return [];
      const pattern: CapturePattern = {
        type: 'regex',
        into,
        pattern: patternValue.toString(),
        flags: obj.flags ? obj.flags.toString() : undefined,
        group: obj.group != null ? Number(obj.group) : obj.capture != null ? Number(obj.capture) : undefined,
        matchIndex: obj.matchIndex != null ? Number(obj.matchIndex) : obj.index != null && obj.group == null ? Number(obj.index) : undefined,
        multiple: obj.multiple === true || obj.all === true,
        trim
      };
      return [pattern];
    }
    return [];
  }

  private async promptForText(message: string, previous?: string): Promise<string | null> {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      const overlayStyle: Partial<CSSStyleDeclaration> = {
        position: 'fixed', inset: '0', background: 'rgba(15,15,20,0.65)', backdropFilter: 'blur(2px)',
        zIndex: '999999999', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
      };
      Object.assign(overlay.style, overlayStyle);

      const modal = document.createElement('div');
      const modalStyle: Partial<CSSStyleDeclaration> = {
        width: 'min(640px, 90vw)', maxHeight: '80vh', background: '#111826', color: '#f8fafc',
        borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 18px 48px rgba(0,0,0,0.45)',
        padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'ui-sans-serif, system-ui'
      };
      Object.assign(modal.style, modalStyle);

      const title = document.createElement('div');
      title.textContent = message;
      Object.assign(title.style, { fontWeight: '600', fontSize: '16px' } as Partial<CSSStyleDeclaration>);

      const textarea = document.createElement('textarea');
      textarea.spellcheck = false;
      textarea.placeholder = 'Paste data here…';
      textarea.value = previous ?? '';
      const textareaStyle: Partial<CSSStyleDeclaration> = {
        width: '100%', flex: '1 1 auto', minHeight: '180px', background: 'rgba(22,33,55,0.72)',
        borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc',
        padding: '12px', fontFamily: 'ui-monospace, Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: '13px', lineHeight: '1.45', resize: 'vertical'
      };
      Object.assign(textarea.style, textareaStyle);

      const hint = document.createElement('div');
      hint.textContent = 'Ctrl/Cmd + Enter to confirm · Esc to cancel';
      Object.assign(hint.style, { opacity: '0.7', fontSize: '12px' } as Partial<CSSStyleDeclaration>);

      const buttonRow = document.createElement('div');
      Object.assign(buttonRow.style, { display: 'flex', justifyContent: 'flex-end', gap: '10px' } as Partial<CSSStyleDeclaration>);

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      Object.assign(cancelBtn.style, this.modalButtonStyle(false));

      const okBtn = document.createElement('button');
      okBtn.textContent = 'Use Data';
      Object.assign(okBtn.style, this.modalButtonStyle(true));

      buttonRow.appendChild(cancelBtn);
      buttonRow.appendChild(okBtn);

      modal.appendChild(title);
      modal.appendChild(textarea);
      modal.appendChild(hint);
      modal.appendChild(buttonRow);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const cleanup = () => {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', onKey);
      };

      const resolveWith = (value: string | null) => {
        cleanup();
        resolve(value);
      };

      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          resolveWith(null);
        }
        if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
          ev.preventDefault();
          resolveWith(textarea.value);
        }
      };

      cancelBtn.onclick = () => resolveWith(null);
      okBtn.onclick = () => resolveWith(textarea.value);
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay) resolveWith(null); });

      document.addEventListener('keydown', onKey);
      textarea.focus({ preventScroll: true });
      textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    });
  }

  private modalButtonStyle(primary: boolean): Partial<CSSStyleDeclaration> {
    return primary
      ? {
          background: 'linear-gradient(90deg, #2563eb, #38bdf8)', color: '#fff', border: 'none',
          padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontWeight: '600'
        }
      : {
          background: 'rgba(255,255,255,0.08)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.12)',
          padding: '8px 16px', borderRadius: '999px', cursor: 'pointer'
        };
  }

  private applyCapturePatterns(source: string, patterns: CapturePattern[]): Record<string, any> {
    const out: Record<string, any> = {};
    let parsedDoc: Document | null = null;
    const ensureDoc = () => {
      if (!parsedDoc) {
        try {
          parsedDoc = new DOMParser().parseFromString(source, 'text/html');
        } catch {
          parsedDoc = null;
        }
      }
      return parsedDoc;
    };

    for (const pattern of patterns){
      if (!pattern) continue;
      if (pattern.type === 'selector') {
        const doc = ensureDoc();
        if (!doc) {
          out[pattern.into] = pattern.all ? [] : '';
          continue;
        }
        try {
          const nodes = Array.from(doc.querySelectorAll(pattern.selector));
          if (pattern.all) {
            const values = nodes.map(el => this.captureFromElement(el, pattern));
            out[pattern.into] = pattern.trim === false ? values : values.map(v => v.trim());
          } else {
            const index = Math.max(0, pattern.index ?? 0);
            const el = nodes[index];
            if (!el) {
              out[pattern.into] = '';
            } else {
              let val = this.captureFromElement(el, pattern);
              if (pattern.trim !== false) val = val.trim();
              out[pattern.into] = val;
            }
          }
        } catch (err) {
          console.warn('captureData selector pattern error', err);
          out[pattern.into] = pattern.all ? [] : '';
        }
        continue;
      }
      if (pattern.type === 'split') {
        const parts = source.split(pattern.delimiter);
        if (pattern.index != null) {
          const idx = pattern.index;
          const value = parts[idx] ?? '';
          out[pattern.into] = pattern.trim === false ? value : value.trim();
        } else {
          out[pattern.into] = pattern.trim === false ? parts : parts.map(p => p.trim());
        }
        continue;
      }
      const multiple = pattern.multiple === true;
      let flags = pattern.flags || 'gm';
      if (multiple && !flags.includes('g')) flags += 'g';
      const groupIndex = pattern.group != null ? pattern.group : 1;
      try {
        const regex = new RegExp(pattern.pattern, flags);
        if (pattern.matchIndex != null && !multiple) {
          const desired = Math.max(1, pattern.matchIndex);
          let count = 0;
          let value = '';
          let match: RegExpExecArray | null;
          while ((match = regex.exec(source))) {
            count += 1;
            if (count === desired) {
              value = (match[groupIndex] ?? match[0] ?? '').toString();
              break;
            }
            if (!flags.includes('g')) break;
          }
          out[pattern.into] = pattern.trim === false ? value : value.trim();
        } else if (multiple) {
          const values: string[] = [];
          let match: RegExpExecArray | null;
          while ((match = regex.exec(source))) {
            const captured = (match[groupIndex] ?? match[0] ?? '').toString();
            values.push(pattern.trim === false ? captured : captured.trim());
            if (!flags.includes('g')) break;
          }
          out[pattern.into] = values;
        } else {
          const match = regex.exec(source);
          const captured = match ? (match[groupIndex] ?? match[0] ?? '').toString() : '';
          out[pattern.into] = pattern.trim === false ? captured : captured.trim();
        }
      } catch (err) {
        console.warn('captureData regex pattern error', err);
        out[pattern.into] = multiple ? [] : '';
      }
    }
    return out;
  }

  private captureFromElement(el: Element, pattern: Extract<CapturePattern, { type: 'selector' }>): string {
    const take: any = pattern.attribute ? { attribute: pattern.attribute } : pattern.take ?? 'text';
    const value = takeFromElement(el, take);
    return value ?? '';
  }
}
