import type { PageDefinition, Registry, Settings, ThemeConfig, WorkflowDefinition, WorkflowOption } from './types';
import { Store } from './storage';
import { highlight, findAll } from './selector';

const DEFAULT_THEME: ThemeConfig = {
  primary: '#1f7a8c',
  // Use an opaque default to avoid “transparent-looking” panel before theme apply
  background: '#0b0c10',
  text: '#f5f7fb',
  accent: '#ffbd59'
};

export class MenuUI {
  private shadow: ShadowRoot;
  private container: HTMLElement;
  private gear: HTMLButtonElement;
  private open = false;
  private store: Store;
  private settings: Settings;
  private registry: Registry;
  private currentPage?: PageDefinition;
  private currentWorkflow?: WorkflowDefinition;
  private logs: string[] = [];

  constructor(registry: Registry, store: Store){
    this.registry = registry;
    this.store = store;
    this.settings = store.get<Settings>('settings', { theme: DEFAULT_THEME, interActionDelayMs: 120 });

    // --- Single-instance guard: remove any previous host (e.g., SPA nav)
    const existing = document.getElementById('cv-menu-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'cv-menu-host';
    document.documentElement.appendChild(host);
    this.shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = this.css();
    this.shadow.appendChild(style);

    this.container = document.createElement('div');
    this.container.className = 'cv-panel';
    this.container.innerHTML = this.panelHtml();
    this.shadow.appendChild(this.container);

    this.gear = document.createElement('button');
    this.gear.className = 'cv-gear';
    this.gear.title = 'Carvana Automations';
    this.gear.textContent = '⚙️';
    this.gear.addEventListener('click', () => this.toggle());
    this.shadow.appendChild(this.gear);

    this.bind();
    this.applyTheme();
  }

  setPage(page?: PageDefinition){
    this.currentPage = page;
    this.renderWorkflows();
    this.appendLog(`Detected page: ${page?.label ?? 'Unknown'}`);
  }

  setCurrentWorkflow(wf?: WorkflowDefinition){
    this.currentWorkflow = wf;
    this.renderOptions();
  }

  appendLog(line: string){
    this.logs.unshift(`${new Date().toLocaleTimeString()} ${line}`);
    const el = this.shadow.getElementById('cv-logs') as HTMLTextAreaElement | null;
    if (el) el.value = this.logs.join('\n');
  }

  toggle(){
    this.open = !this.open;
    this.container.classList.toggle('open', this.open);
    if (this.open) {
      const firstTab = this.shadow.querySelector('[data-tab="cv-tab-workflows"]') as HTMLElement | null;
      firstTab?.click();
    }
  }

  private bind(){
    const tabs = this.shadow.querySelectorAll('[data-tab]');
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        this.shadow.querySelectorAll('.cv-tab').forEach(el => el.classList.remove('active'));
        (t as HTMLElement).classList.add('active');
        this.shadow.querySelectorAll('.cv-section').forEach(el => el.classList.remove('active'));
        const target = (t as HTMLElement).getAttribute('data-tab')!;
        (this.shadow.getElementById(target)!).classList.add('active');
      });
    });

    this.shadow.getElementById('cv-theme-apply')?.addEventListener('click', () => {
      const primary = (this.shadow.getElementById('cv-theme-primary') as HTMLInputElement).value;
      const bg = (this.shadow.getElementById('cv-theme-bg') as HTMLInputElement).value;
      const text = (this.shadow.getElementById('cv-theme-text') as HTMLInputElement).value;
      const accent = (this.shadow.getElementById('cv-theme-accent') as HTMLInputElement).value;
      this.settings.theme = { primary, background: bg, text, accent };
      this.applyTheme();
      this.store.set('settings', this.settings);
    });

    this.shadow.getElementById('cv-export')?.addEventListener('click', () => {
      const json = JSON.stringify(this.store.exportAll(), null, 2);
      navigator.clipboard.writeText(json);
      alert('Settings exported to clipboard.');
    });
    this.shadow.getElementById('cv-import')?.addEventListener('click', async () => {
      const text = prompt('Paste the exported JSON here:');
      if (!text) return;
      try {
        const obj = JSON.parse(text);
        this.store.importAll(obj);
        alert('Imported. Reload the page to take effect.');
      } catch (e) {
        alert('Invalid JSON');
      }
    });

    // Selector test button (delegated)
    this.shadow.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      if (t && t.matches('.cv-test-selectors')){
        const ta = this.shadow.getElementById('cv-selector-json') as HTMLTextAreaElement;
        try {
          const parsed = JSON.parse(ta.value);
          const wf = parsed && parsed.steps ? parsed : null;
          const spec = wf ? null : parsed; // test either a Workflow or a raw SelectorSpec
          const tryMatch = (sp: any) => {
            let els = findAll(sp, { visibleOnly: true });
            if (els.length === 0) els = findAll(sp, { visibleOnly: false }); // retry hidden (e.g., <title>)
            highlight(els);
            alert(`Matched ${els.length} element(s).`);
          };
          if (spec) {
            tryMatch(spec);
          } else if (wf) {
            const first = wf.steps.find((s: any) => s.target);
            if (first?.target) tryMatch(first.target);
            else alert('No target found in first step to test.');
          }
        } catch (e: any) {
          alert('Invalid JSON: ' + e.message);
        }
      }
    });
  }

  private renderWorkflows(){
    const list = this.shadow.getElementById('cv-wf-list')!;
    list.innerHTML = '';
    const page = this.currentPage;
    if (!page){
      list.innerHTML = '<div class="cv-empty">No page detected yet</div>';
      return;
    }
    for (const wf of page.workflows){
      const item = document.createElement('div');
      item.className = 'cv-wf-item';
      item.innerHTML = `
        <div class="cv-wf-title">${wf.label}</div>
        <div class="cv-wf-desc">${wf.description || ''}</div>
        <div class="cv-wf-actions">
          <button class="cv-btn cv-run" data-wf="${wf.id}">Run</button>
          <button class="cv-btn cv-edit" data-wf="${wf.id}">Selectors</button>
          <button class="cv-btn cv-opt" data-wf="${wf.id}">Options</button>
        </div>
      `;
      item.querySelector('.cv-run')!.addEventListener('click', () => {
        this.dispatch('run-workflow', { workflowId: wf.id });
      });
      item.querySelector('.cv-edit')!.addEventListener('click', () => {
        this.showSelectorEditor(wf);
      });
      item.querySelector('.cv-opt')!.addEventListener('click', () => {
        this.setCurrentWorkflow(wf);
        const tabBtn = this.shadow.querySelector('[data-tab="cv-tab-options"]') as HTMLElement;
        tabBtn.click();
        this.renderOptions();
      });
      list.appendChild(item);
    }
  }

  private savedOptionsFor(wf: WorkflowDefinition): Record<string, any> {
    return this.store.get(`wf:opts:${wf.id}`, {});
  }

  private renderOptions(){
    const wrap = this.shadow.getElementById('cv-options-wrap')!;
    wrap.innerHTML = '';
    const wf = this.currentWorkflow;
    if (!wf) {
      wrap.innerHTML = '<div class="cv-empty">Select a workflow and click Options.</div>';
      return;
    }
    const saved = this.savedOptionsFor(wf);
    const form = document.createElement('div');
    form.className = 'cv-form';
    (wf.options || []).forEach(opt => {
      form.appendChild(this.renderOptionField(opt, saved[opt.key]));
    });
    const row = document.createElement('div');
    row.className = 'cv-row right';
    const save = document.createElement('button');
    save.className = 'cv-btn';
    save.textContent = 'Save Options';
    save.addEventListener('click', () => {
      const values: Record<string, any> = {};
      (wf.options || []).forEach(opt => {
        const el = this.shadow.getElementById(`cv-opt-${opt.key}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        if (!el) return;
        if (opt.type === 'boolean') values[opt.key] = (el as HTMLInputElement).checked;
        else if (opt.type === 'number') values[opt.key] = parseFloat((el as HTMLInputElement).value);
        else if (opt.type === 'multi') {
          const lines = (el as HTMLTextAreaElement).value.split('\n').map(s => s.trim()).filter(Boolean);
          values[opt.key] = lines;
        } else if (opt.type === 'json') {
          try { values[opt.key] = JSON.parse((el as HTMLTextAreaElement).value || 'null'); }
          catch { alert(`Invalid JSON for ${opt.key}`); return; }
        } else {
          values[opt.key] = (el as HTMLInputElement | HTMLSelectElement).value;
        }
      });
      this.dispatch('save-options', { workflowId: wf.id, values });
    });
    row.appendChild(save);
    wrap.appendChild(form);
    wrap.appendChild(row);
  }

  private renderOptionField(opt: WorkflowOption, current: any): HTMLElement {
    const field = document.createElement('div');
    field.className = 'cv-row';
    const id = `cv-opt-${opt.key}`;
    const label = document.createElement('label');
    label.textContent = opt.label + ' ';
    let input: HTMLElement;
    const value = current ?? (opt as any).default ?? '';

    switch (opt.type) {
      case 'boolean':
        input = document.createElement('input');
        (input as HTMLInputElement).type = 'checkbox';
        (input as HTMLInputElement).checked = !!value;
        break;
      case 'number':
        input = document.createElement('input');
        (input as HTMLInputElement).type = 'number';
        (input as HTMLInputElement).value = String(value ?? '');
        break;
      case 'select':
        input = document.createElement('select');
        (opt.choices || []).forEach(c => {
          const o = document.createElement('option');
          o.value = c.value; o.textContent = c.label;
          if (c.value === value) o.selected = true;
          (input as HTMLSelectElement).appendChild(o);
        });
        break;
      case 'multi':
        input = document.createElement('textarea');
        (input as HTMLTextAreaElement).value = Array.isArray(value) ? value.join('\n') : '';
        (input as HTMLTextAreaElement).placeholder = (opt as any).hint ?? 'one item per line';
        (input as HTMLTextAreaElement).className = 'cv-textarea';
        break;
      case 'json':
        input = document.createElement('textarea');
        (input as HTMLTextAreaElement).value = JSON.stringify(value ?? null, null, 2);
        (input as HTMLTextAreaElement).className = 'cv-textarea';
        break;
      default: // string
        input = document.createElement('input');
        (input as HTMLInputElement).type = 'text';
        (input as HTMLInputElement).value = String(value ?? '');
    }

    input.id = id;
    label.htmlFor = id;
    field.appendChild(label);
    field.appendChild(input);
    return field;
  }

  private showSelectorEditor(wf: WorkflowDefinition){
    this.setCurrentWorkflow(wf);
    const tabBtn = this.shadow.querySelector('[data-tab="cv-tab-selectors"]') as HTMLElement;
    tabBtn.click();
    const ta = this.shadow.getElementById('cv-selector-json') as HTMLTextAreaElement;
    ta.value = JSON.stringify(wf, null, 2);
    (this.shadow.getElementById('cv-selector-save') as HTMLButtonElement).onclick = () => {
      try{
        const parsed = JSON.parse(ta.value) as WorkflowDefinition;
        if (this.currentPage){
          const idx = this.currentPage.workflows.findIndex(x => x.id === wf.id);
          if (idx >= 0) this.currentPage.workflows[idx] = parsed;
        }
        alert('Saved in-memory. Use Export to persist or run to test.');
      } catch (e: any){
        alert('Invalid JSON: ' + e.message);
      }
    };
  }

  private panelHtml(){
    return `
    <div class="cv-header">
      <div class="cv-title">Carvana Automations</div>
      <div class="cv-tabs">
        <button class="cv-tab active" data-tab="cv-tab-workflows">Workflows</button>
        <button class="cv-tab" data-tab="cv-tab-selectors">Selectors</button>
        <button class="cv-tab" data-tab="cv-tab-options">Options</button>
        <button class="cv-tab" data-tab="cv-tab-theme">Theme</button>
        <button class="cv-tab" data-tab="cv-tab-storage">Storage</button>
        <button class="cv-tab" data-tab="cv-tab-logs">Logs</button>
      </div>
    </div>
    <div id="cv-tab-workflows" class="cv-section active">
      <div id="cv-wf-list"></div>
    </div>
    <div id="cv-tab-selectors" class="cv-section">
      <div class="cv-row">
        <textarea id="cv-selector-json" class="cv-textarea" spellcheck="false" placeholder="Workflow JSON (editable)"></textarea>
      </div>
      <div class="cv-row right">
        <button class="cv-btn cv-test-selectors">Test Match</button>
        <button id="cv-selector-save" class="cv-btn">Save (in-memory)</button>
      </div>
    </div>
    <div id="cv-tab-options" class="cv-section">
      <div id="cv-options-wrap"></div>
    </div>
    <div id="cv-tab-theme" class="cv-section">
      <div class="cv-row">
        <label>Primary <input type="color" id="cv-theme-primary" value="#1f7a8c"></label>
        <label>Background <input type="color" id="cv-theme-bg" value="#0b0c10"></label>
        <label>Text <input type="color" id="cv-theme-text" value="#f5f7fb"></label>
        <label>Accent <input type="color" id="cv-theme-accent" value="#ffbd59"></label>
        <button id="cv-theme-apply" class="cv-btn">Apply</button>
      </div>
    </div>
    <div id="cv-tab-storage" class="cv-section">
      <div class="cv-row">
        <button id="cv-export" class="cv-btn">Export Config to Clipboard</button>
        <button id="cv-import" class="cv-btn">Import Config</button>
      </div>
    </div>
    <div id="cv-tab-logs" class="cv-section">
      <textarea id="cv-logs" class="cv-textarea" readonly></textarea>
    </div>
    `;
  }

  private css(){
    return `
      :host { all: initial; }
      .cv-gear{
        position: fixed; bottom: 16px; right: 16px; z-index: 999999999;
        border-radius: 50%; width: 44px; height: 44px; border: none; cursor: pointer;
        background: var(--cv-primary); color: var(--cv-text); box-shadow: 0 2px 10px rgba(0,0,0,.4);
      }
      .cv-panel{
        position: fixed; bottom: 72px; right: 16px; width: 480px; max-height: 70vh; overflow: hidden;
        background: var(--cv-bg); color: var(--cv-text); border: 1px solid rgba(255,255,255,.08);
        border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.45);
        transform: translateY(12px); opacity: 0; pointer-events: none; transition: all .18s ease;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, 'Helvetica Neue', Arial, 'Apple Color Emoji','Segoe UI Emoji';
      }
      .cv-panel.open{ transform: translateY(0); opacity: 1; pointer-events: all; }
      .cv-header{ display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: linear-gradient(0deg, rgba(255,255,255,.02), transparent); }
      .cv-title{ font-weight: 600; letter-spacing: .3px; }
      .cv-tabs{ display:flex; gap:6px; }
      .cv-tab{ background: transparent; color: var(--cv-text); border: 1px solid rgba(255,255,255,.18); padding: 6px 10px; border-radius: 6px; cursor: pointer; }
      .cv-tab.active{ background: rgba(255,255,255,.08); }
      .cv-section{ display: none; padding: 10px; }
      .cv-section.active{ display:block; max-height: calc(70vh - 58px); overflow-y: auto; }
      .cv-row{ display:flex; gap:10px; align-items:center; margin: 8px 0; }
      .cv-row.right{ justify-content:flex-end; }
      .cv-textarea{ width: 100%; min-height: 240px; background: rgba(0,0,0,.3); color: var(--cv-text); border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px; }
      .cv-btn{ background: var(--cv-primary); color: var(--cv-text); border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
      .cv-empty{ opacity: .7; padding: 8px; }
      .cv-wf-item{ border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 8px; margin-bottom: 8px; }
      .cv-wf-title{ font-weight: 600; margin-bottom: 4px; }
      .cv-wf-actions{ display:flex; gap:8px; }
      /* Default CSS variables at scope root (shadow host) */
      :host, .cv-panel{ --cv-primary: ${DEFAULT_THEME.primary}; --cv-bg: ${DEFAULT_THEME.background}; --cv-text: ${DEFAULT_THEME.text}; --cv-accent: ${DEFAULT_THEME.accent}; }
    `;
  }

  private applyTheme(){
    // Apply custom properties to the shadow **host**, which cascade inside the shadow tree
    const hostEl = this.shadow.host as HTMLElement;
    hostEl.style.setProperty('--cv-primary', this.settings.theme.primary);
    hostEl.style.setProperty('--cv-bg', this.settings.theme.background);
    hostEl.style.setProperty('--cv-text', this.settings.theme.text);
    hostEl.style.setProperty('--cv-accent', this.settings.theme.accent);
  }

  private dispatch(type: string, detail: any){
    window.dispatchEvent(new CustomEvent(`cv-menu:${type}`, { detail }));
  }
}
