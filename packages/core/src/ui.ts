import type { PageDefinition, Registry, Settings, ThemeConfig, WorkflowDefinition, WorkflowOption } from './types';
import { Store } from './storage';
import { highlight, findAll } from './selector';
import {
  PROFILE_SLOTS,
  type ProfileId,
  getActiveProfile,
  getProfileValues,
  getProfilesEnabled,
  profileLabel,
  setActiveProfile,
  setProfilesEnabled
} from './profiles';
import { getRunPrefs, updateRunPrefs, type WorkflowRunPrefs } from './autorun';
import { WorkflowPreferencesService, type WorkflowVisibilityLists } from './menu/workflow-preferences';
import { DragController, type DragAnnouncement, type DragReorderDetail } from './menu/drag-controller';

type MenuHandlers = {
  'run-workflow'?: (detail: any) => void;
  'save-options'?: (detail: any) => void;
  'run-prefs-updated'?: (detail: any) => void;
};

type MenuLogLevel = 'info' | 'debug';

interface MenuLogEntry {
  timestamp: number;
  message: string;
  level: MenuLogLevel;
}

const DEFAULT_THEME: ThemeConfig = {
  primary: '#1f7a8c',
  background: '#0b0c10',
  text: '#f5f7fb',
  accent: '#ffbd59',
  panelOpacity: 0.95
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
  private optionsProfileId: ProfileId | null = null;
  private logs: MenuLogEntry[] = [];
  private showDebugLogs = false;
  private handlers?: MenuHandlers;
  private workflowList: HTMLElement | null = null;
  private workflowAnnouncer: HTMLElement | null = null;
  private hiddenList: HTMLElement | null = null;
  private hiddenEmpty: HTMLElement | null = null;
  private hiddenCountBadge: HTMLElement | null = null;
  private hiddenFilterInput: HTMLInputElement | null = null;
  private dragController: DragController | null = null;
  private workflowPreferences: WorkflowPreferencesService | null = null;
  private workflowPreferencesPageId: string | null = null;
  private hiddenWorkflowsCache: WorkflowDefinition[] = [];
  private visibleWorkflowsCache: WorkflowDefinition[] = [];
  private hiddenFilterValue = '';
  private hiddenAutoPrompted = new Set<string>();
  private focusAfterRenderWorkflowId: string | null = null;
  private pendingReorderDetail: { id: string; toIndex: number } | null = null;
  private pendingReorderTimer: number | null = null;
  private readonly reorderPersistDelayMs = 200;

  constructor(registry: Registry, store: Store, handlers?: MenuHandlers){
    this.registry = registry;
    this.store = store;
    this.handlers = handlers;
    const storedSettings = store.get<Settings>('settings', { theme: DEFAULT_THEME, interActionDelayMs: 120 });
    const normalizedTheme = this.normalizeTheme(storedSettings?.theme);
    this.settings = { ...storedSettings, theme: normalizedTheme };
    if (!storedSettings?.theme || typeof storedSettings.theme.panelOpacity !== 'number') {
      this.store.set('settings', this.settings);
    }

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

    this.workflowList = this.shadow.getElementById('cv-wf-list') as HTMLElement | null;
    if (this.workflowList) {
      this.workflowList.setAttribute('role', 'list');
    }
    this.workflowAnnouncer = this.shadow.getElementById('cv-wf-announcer') as HTMLElement | null;
    this.hiddenList = this.shadow.getElementById('cv-hidden-list') as HTMLElement | null;
    if (this.hiddenList) {
      this.hiddenList.setAttribute('role', 'list');
    }
    this.hiddenEmpty = this.shadow.getElementById('cv-hidden-empty') as HTMLElement | null;
    this.hiddenCountBadge = this.shadow.getElementById('cv-hidden-count') as HTMLElement | null;
    this.hiddenFilterInput = this.shadow.getElementById('cv-hidden-search') as HTMLInputElement | null;
    if (this.hiddenFilterInput) {
      this.hiddenFilterInput.setAttribute('aria-label', 'Search hidden workflows');
    }

    this.gear = document.createElement('button');
    this.gear.className = 'cv-gear';
    this.gear.title = 'Carvana Automations';
    this.gear.textContent = '⚙️';
    this.gear.addEventListener('click', () => this.toggle());
    this.shadow.appendChild(this.gear);

    this.bind();
    this.applyTheme();
    this.renderLogs();
  }

  setPage(page?: PageDefinition){
    this.currentPage = page;
    if (page) {
      this.ensureWorkflowPreferences(page);
    } else {
      this.workflowPreferences = null;
      this.workflowPreferencesPageId = null;
    }
    this.hiddenAutoPrompted.clear();
    this.hiddenFilterValue = '';
    if (this.hiddenFilterInput) {
      this.hiddenFilterInput.value = '';
    }
    this.cancelPendingPersistence();
    this.clearDropIndicator();
    this.renderWorkflows();
    this.appendLog(`Detected page: ${page?.label ?? 'Unknown'}`);
  }

  setCurrentWorkflow(wf?: WorkflowDefinition){
    if (wf?.internal) return;
    const previousId = this.currentWorkflow?.id;
    this.currentWorkflow = wf;
    if (!wf) {
      this.optionsProfileId = null;
    } else if (!this.profilesEnabled(wf)) {
      this.optionsProfileId = null;
    } else if (wf.id !== previousId || !this.optionsProfileId) {
      this.optionsProfileId = getActiveProfile(this.store, wf.id);
    }
    this.renderOptions();
  }

  appendLog(message: string, level: MenuLogLevel = 'info'){
    const entry: MenuLogEntry = { timestamp: Date.now(), message, level };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.length = 200;
    this.renderLogs();
  }

  private getLogFilter(): string {
    const filterInput = this.shadow.getElementById('cv-logs-filter') as HTMLInputElement | null;
    return filterInput?.value ?? '';
  }

  private renderLogs(filter?: string){
    const el = this.shadow.getElementById('cv-logs') as HTMLTextAreaElement | null;
    if (!el) return;
    const criteria = (filter ?? this.getLogFilter()).trim().toLowerCase();
    const entries = (this.showDebugLogs ? this.logs : this.logs.filter(log => log.level === 'info'))
      .filter(log => !criteria || log.message.toLowerCase().includes(criteria));
    el.value = entries
      .map(log => `${new Date(log.timestamp).toLocaleTimeString()} ${log.message}`)
      .join('\n');
  }

  private profilesEnabled(wf: WorkflowDefinition): boolean {
    const defaultEnabled = wf?.profiles?.enabled ?? true;
    return getProfilesEnabled(this.store, wf.id, { enabled: defaultEnabled });
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
      const opacityEl = this.shadow.getElementById('cv-theme-opacity') as HTMLInputElement | null;
      const panelOpacity = opacityEl ? parseFloat(opacityEl.value) : this.settings.theme.panelOpacity;
      this.settings.theme = this.normalizeTheme({ primary, background: bg, text, accent, panelOpacity });
      this.applyTheme();
      this.store.set('settings', this.settings);
    });

    this.shadow.getElementById('cv-theme-reset')?.addEventListener('click', () => {
      this.settings.theme = { ...DEFAULT_THEME };
      this.applyTheme();
      this.store.set('settings', this.settings);
    });

    const opacityInput = this.shadow.getElementById('cv-theme-opacity') as HTMLInputElement | null;
    if (opacityInput) {
      opacityInput.addEventListener('input', () => {
        const value = parseFloat(opacityInput.value);
        this.updateOpacityLabel(value);
      });
    }

    const colorIds = ['cv-theme-primary', 'cv-theme-bg', 'cv-theme-text', 'cv-theme-accent'];
    let activeColorInput: HTMLInputElement | null = null;

    const handleFocusRequest = (input: HTMLInputElement) => {
      if (activeColorInput && activeColorInput !== input) {
        activeColorInput.blur();
      }
    };

    colorIds.forEach(id => {
      const input = this.shadow.getElementById(id) as HTMLInputElement | null;
      if (!input) return;
      const onFocusRequest = () => handleFocusRequest(input);
      input.addEventListener('pointerdown', onFocusRequest);
      input.addEventListener('mousedown', onFocusRequest);
      input.addEventListener('focus', () => { activeColorInput = input; });
      input.addEventListener('blur', () => { if (activeColorInput === input) activeColorInput = null; });
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

    const debugToggle = this.shadow.getElementById('cv-logs-debug-toggle') as HTMLInputElement | null;
    if (debugToggle) {
      debugToggle.checked = this.showDebugLogs;
      debugToggle.addEventListener('change', () => {
        this.showDebugLogs = debugToggle.checked;
        this.renderLogs(this.getLogFilter());
      });
    }
    this.shadow.getElementById('cv-logs-clear')?.addEventListener('click', () => {
      this.logs = [];
      this.renderLogs(this.getLogFilter());
    });
    this.shadow.getElementById('cv-logs-copy')?.addEventListener('click', () => {
      const logs = this.shadow.getElementById('cv-logs') as HTMLTextAreaElement | null;
      if (!logs) return;
      navigator.clipboard.writeText(logs.value).catch(err => console.error('copy logs failed', err));
    });
    const filterInput = this.shadow.getElementById('cv-logs-filter') as HTMLInputElement | null;
    if (filterInput) {
      filterInput.addEventListener('input', () => {
        this.renderLogs(filterInput.value);
      });
    }

    if (this.hiddenFilterInput) {
      this.hiddenFilterInput.addEventListener('input', this.handleHiddenFilterInput);
    }
  }

  private renderWorkflows(){
    const list = this.workflowList;
    if (!list) return;

    this.dragController?.detach();
    this.dragController = null;
    list.innerHTML = '';
    this.clearDropIndicator();
    this.announceWorkflowStatus('');

    const page = this.currentPage;
    if (!page){
      list.innerHTML = '<div class="cv-empty">No page detected yet</div>';
      this.visibleWorkflowsCache = [];
      this.hiddenWorkflowsCache = [];
      this.updateHiddenBadge(0);
      this.renderHiddenWorkflows();
      return;
    }

    const partition = this.partitionWorkflows(page);
    const workflows = partition.ordered;
    this.visibleWorkflowsCache = [...workflows];
    this.hiddenWorkflowsCache = [...partition.hidden];
    this.updateHiddenBadge(this.hiddenWorkflowsCache.length);
    this.renderHiddenWorkflows();

    if (!workflows.length){
      list.innerHTML = this.hiddenWorkflowsCache.length
        ? '<div class="cv-empty">All workflows are hidden. Use the Hidden tab to manage them.</div>'
        : '<div class="cv-empty">No workflows available</div>';
      this.focusWorkflowAfterRender();
      return;
    }

    for (const wf of workflows){
      const item = document.createElement('div');
      item.className = 'cv-wf-item';
      item.setAttribute('data-drag-item', '');
      item.setAttribute('role', 'listitem');
      item.dataset.dragId = wf.id;

      const profilesEnabled = this.profilesEnabled(wf);
      const activeProfile = profilesEnabled ? getActiveProfile(this.store, wf.id) : 'p1';
      const profilesHtml = profilesEnabled
        ? PROFILE_SLOTS.map(slot => {
            const activeClass = slot.id === activeProfile ? ' active' : '';
            const hint = `Click to activate ${slot.label}${slot.id === activeProfile ? ' (active)' : ''}. Ctrl/Cmd/Alt+Click to run immediately.`;
            return `<button class="cv-profile${activeClass}" data-profile="${slot.id}" title="${hint}">${slot.shortLabel}</button>`;
          }).join('')
        : '';

      let runPrefs: WorkflowRunPrefs = getRunPrefs(this.store, wf.id);

      item.innerHTML = `
        <div class="cv-wf-row">
          <button type="button" class="cv-wf-handle" data-drag-handle title="Drag to reorder">
            <span aria-hidden="true">⋮⋮</span>
          </button>
          <div class="cv-wf-main">
            <div class="cv-wf-title">${wf.label}</div>
            <div class="cv-wf-desc">${wf.description || ''}</div>
          </div>
        </div>
        <div class="cv-wf-meta">
          <div class="cv-wf-switches">
            <label class="cv-switch" title="Run automatically when this page is detected">
              <input type="checkbox" data-wf-auto="${wf.id}" ${runPrefs.auto ? 'checked' : ''}>
              <span>Auto run</span>
            </label>
            <label class="cv-switch" title="Re-run automatically even if this page has already run">
              <input type="checkbox" data-wf-repeat="${wf.id}" ${runPrefs.repeat ? 'checked' : ''} ${runPrefs.auto ? '' : 'disabled'}>
              <span>Repeat</span>
            </label>
          </div>
        </div>
        <div class="cv-wf-footer${profilesEnabled ? '' : ' cv-no-profiles'}">
          ${profilesEnabled ? `<div class="cv-wf-profiles" data-wf-profiles="${wf.id}">${profilesHtml}</div>` : ''}
          <div class="cv-wf-actions">
            <button class="cv-btn cv-run" data-wf="${wf.id}" data-wf-run="${wf.id}">Run</button>
            <button class="cv-btn cv-edit" data-wf="${wf.id}">Selectors</button>
            <button class="cv-btn cv-opt" data-wf="${wf.id}">Options</button>
            <button type="button" class="cv-btn secondary cv-hide" data-wf-hide="${wf.id}">Hide</button>
          </div>
        </div>
      `;

      const handleBtn = item.querySelector('.cv-wf-handle') as HTMLButtonElement | null;
      if (handleBtn) {
        handleBtn.setAttribute('aria-label', `Drag to reorder ${wf.label}`);
      }

      const runBtn = item.querySelector('[data-wf-run="' + wf.id + '"]') as HTMLButtonElement | null;
      if (runBtn) {
        runBtn.textContent = profilesEnabled ? `Run (${profileLabel(activeProfile)})` : 'Run';
        runBtn.addEventListener('click', () => {
          this.dispatch('run-workflow', { workflowId: wf.id });
        });
      }

      const autoToggle = item.querySelector(`[data-wf-auto="${wf.id}"]`) as HTMLInputElement | null;
      const repeatToggle = item.querySelector(`[data-wf-repeat="${wf.id}"]`) as HTMLInputElement | null;

      if (autoToggle) {
        repeatToggle && (repeatToggle.disabled = !runPrefs.auto);
        autoToggle.addEventListener('change', () => {
          const prev = runPrefs;
          runPrefs = updateRunPrefs(this.store, wf.id, { auto: autoToggle.checked });
          if (repeatToggle) {
            repeatToggle.disabled = !runPrefs.auto;
            if (!runPrefs.auto) repeatToggle.checked = false;
          }
          this.dispatch('run-prefs-updated', { workflowId: wf.id, prefs: runPrefs, prev });
        });
      }

      if (repeatToggle) {
        repeatToggle.disabled = !runPrefs.auto;
        repeatToggle.addEventListener('change', () => {
          const prev = runPrefs;
          runPrefs = updateRunPrefs(this.store, wf.id, { repeat: repeatToggle.checked });
          repeatToggle.checked = runPrefs.repeat;
          this.dispatch('run-prefs-updated', { workflowId: wf.id, prefs: runPrefs, prev });
        });
      }
      item.querySelector('.cv-edit')!.addEventListener('click', () => {
        this.showSelectorEditor(wf);
      });
      item.querySelector('.cv-opt')!.addEventListener('click', () => {
        this.setCurrentWorkflow(wf);
        const tabBtn = this.shadow.querySelector('[data-tab="cv-tab-options"]') as HTMLElement;
        tabBtn.click();
        this.renderOptions();
      });

      if (profilesEnabled) {
        item.querySelectorAll<HTMLButtonElement>('.cv-profile').forEach(btn => {
          const rawProfile = btn.getAttribute('data-profile');
          if (!rawProfile) return;
          const profileId = rawProfile as ProfileId;
          btn.addEventListener('click', (event) => {
            const mouse = event as MouseEvent;
            const quickRun = !!(mouse.metaKey || mouse.ctrlKey || mouse.altKey);
            setActiveProfile(this.store, wf.id, profileId);
            this.markActiveProfile(wf.id, profileId);
            if (this.currentWorkflow?.id === wf.id) {
              this.optionsProfileId = profileId;
              this.renderOptions();
            }
            if (quickRun) {
              this.dispatch('run-workflow', { workflowId: wf.id, profileId });
            }
          });
        });
      }

      const hideBtn = item.querySelector(`[data-wf-hide="${wf.id}"]`) as HTMLButtonElement | null;
      if (hideBtn) {
        hideBtn.setAttribute('aria-label', `Hide ${wf.label}`);
        hideBtn.addEventListener('click', () => this.handleHideWorkflow(wf, item));
      }

      list.appendChild(item);
    }

    if (workflows.length > 1) {
      this.dragController = new DragController({
        list,
        root: this.shadow,
        onPreview: this.handleDragPreview,
        onReorder: this.handleDragReorder,
        announce: this.handleDragAnnounce
      });
      this.dragController.attach();
    }

    this.focusWorkflowAfterRender();
  }

  private renderHiddenWorkflows(){
    const list = this.hiddenList;
    const empty = this.hiddenEmpty;
    if (!list || !empty) return;

    const hidden = this.hiddenWorkflowsCache;
    this.promptHiddenAutoRunIfNeeded(hidden);

    const searchInput = this.hiddenFilterInput;
    if (searchInput) {
      if (!hidden.length) {
        if (!searchInput.disabled) searchInput.disabled = true;
        if (searchInput.value !== '') searchInput.value = '';
        this.hiddenFilterValue = '';
      } else {
        if (searchInput.disabled) searchInput.disabled = false;
        if (searchInput.value !== this.hiddenFilterValue) searchInput.value = this.hiddenFilterValue;
      }
    }

    list.innerHTML = '';
    if (!hidden.length) {
      empty.hidden = false;
      empty.textContent = 'Hidden workflows appear here after you hide them from the Workflows tab.';
      return;
    }

    const query = this.hiddenFilterValue.trim().toLowerCase();
    const filtered = hidden.filter(wf => {
      if (!query) return true;
      const haystack = `${wf.label} ${(wf.description ?? '')} ${wf.id}`.toLowerCase();
      return haystack.includes(query);
    });

    if (!filtered.length) {
      empty.hidden = false;
      empty.textContent = 'No hidden workflows match your search.';
      return;
    }

    empty.hidden = true;

    for (const wf of filtered) {
      const prefs = getRunPrefs(this.store, wf.id);
      const item = document.createElement('div');
      item.className = 'cv-hidden-item';
      item.setAttribute('role', 'listitem');
      item.innerHTML = `
        <div class="cv-hidden-main">
          <div class="cv-hidden-title">${wf.label}</div>
          <div class="cv-hidden-desc">${wf.description ?? ''}</div>
          <div class="cv-hidden-meta">
            ${prefs.auto ? '<span class="cv-hidden-badge">Auto-run enabled</span>' : ''}
          </div>
        </div>
        <div class="cv-hidden-actions">
          <button type="button" class="cv-btn secondary cv-hidden-unhide" data-hidden-unhide="${wf.id}">Unhide</button>
        </div>
      `;
      const unhideBtn = item.querySelector<HTMLButtonElement>('[data-hidden-unhide]');
      if (unhideBtn) {
        unhideBtn.setAttribute('aria-label', `Unhide ${wf.label}`);
        unhideBtn.addEventListener('click', () => this.handleUnhideWorkflow(wf));
      }
      list.appendChild(item);
    }
  }

  private updateHiddenBadge(count: number){
    const badge = this.hiddenCountBadge;
    if (badge) {
      badge.textContent = count > 0 ? String(count) : '0';
      badge.classList.toggle('cv-tab-badge-active', count > 0);
    }
    const tab = this.shadow.querySelector('[data-tab="cv-tab-hidden"]') as HTMLElement | null;
    if (tab) {
      tab.classList.toggle('cv-tab-empty', count === 0);
      tab.setAttribute('aria-label', count > 0 ? `Hidden workflows (${count})` : 'Hidden workflows');
    }
  }

  private handleHiddenFilterInput = (event: Event) => {
    const input = event.target as HTMLInputElement | null;
    this.hiddenFilterValue = input?.value ?? '';
    this.renderHiddenWorkflows();
  };

  private promptHiddenAutoRunIfNeeded(hidden: WorkflowDefinition[]){
    for (const wf of hidden) {
      const prefs = getRunPrefs(this.store, wf.id);
      if (!prefs.auto) {
        this.hiddenAutoPrompted.delete(wf.id);
        continue;
      }
      if (this.hiddenAutoPrompted.has(wf.id)) continue;
      const keepAuto = this.requestHiddenConfirmation(`${wf.label} is hidden but auto-run is enabled. Select OK to keep auto-run active while hidden, or Cancel to disable auto-run.`, false);
      if (!keepAuto) {
        const prev = prefs;
        const next = updateRunPrefs(this.store, wf.id, { auto: false, repeat: false });
        this.dispatch('run-prefs-updated', { workflowId: wf.id, prefs: next, prev });
        this.appendLog(`Auto-run disabled for ${wf.label} while hidden.`);
        this.hiddenAutoPrompted.delete(wf.id);
      } else {
        this.appendLog(`Auto-run kept active for hidden workflow ${wf.label}.`);
        this.hiddenAutoPrompted.add(wf.id);
      }
    }
  }

  private announceWorkflowStatus(message: string){
    if (this.workflowAnnouncer) {
      this.workflowAnnouncer.textContent = message;
    }
  }

  private handleHideWorkflow(wf: WorkflowDefinition, sourceItem: HTMLElement){
    const page = this.currentPage;
    if (!page) return;
    const preferences = this.ensureWorkflowPreferences(page);
    if (!preferences) {
      this.appendLog(`Unable to hide ${wf.label}: missing workflow preferences.`);
      return;
    }

    const workflows = this.getAllDraggableWorkflows();
    if (!workflows.length) return;

    const prefs = getRunPrefs(this.store, wf.id);
    if (prefs.auto) {
      const keepAuto = this.requestHiddenConfirmation(`${wf.label} has auto-run enabled. Select OK to keep auto-run active while hiding it, or Cancel to disable auto-run before hiding.`, false);
      if (!keepAuto) {
        const prev = prefs;
        const next = updateRunPrefs(this.store, wf.id, { auto: false, repeat: false });
        this.dispatch('run-prefs-updated', { workflowId: wf.id, prefs: next, prev });
        this.hiddenAutoPrompted.delete(wf.id);
        this.appendLog(`Auto-run disabled for ${wf.label} while hiding.`);
      } else {
        this.hiddenAutoPrompted.add(wf.id);
      }
    } else {
      this.hiddenAutoPrompted.delete(wf.id);
    }

    const partition = preferences.toggleHidden(workflows, wf.id, true);
    this.visibleWorkflowsCache = [...partition.ordered];
    this.hiddenWorkflowsCache = [...partition.hidden];
    this.updateHiddenBadge(this.hiddenWorkflowsCache.length);
    this.renderHiddenWorkflows();
    this.appendLog(`Hidden ${wf.label}.`);
    this.animateWorkflowHide(sourceItem, wf);
  }

  private animateWorkflowHide(sourceItem: HTMLElement | null, wf: WorkflowDefinition){
    if (!sourceItem) {
      this.renderWorkflows();
      this.announceWorkflowStatus(`${wf.label} moved to Hidden tab.`);
      return;
    }

    sourceItem.classList.add('cv-wf-hiding');
    let settled = false;
    const finalize = () => {
      if (settled) return;
      settled = true;
      sourceItem.removeEventListener('transitionend', finalize);
      this.renderWorkflows();
      this.announceWorkflowStatus(`${wf.label} moved to Hidden tab.`);
    };
    const raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : ((cb: FrameRequestCallback) => window.setTimeout(cb, 16));
    raf(() => {
      sourceItem.classList.add('cv-wf-hiding-active');
    });
    sourceItem.addEventListener('transitionend', finalize);
    window.setTimeout(finalize, 220);
  }

  private handleUnhideWorkflow(wf: WorkflowDefinition){
    const page = this.currentPage;
    if (!page) return;
    const preferences = this.ensureWorkflowPreferences(page);
    if (!preferences) return;

    const workflows = this.getAllDraggableWorkflows();
    const partition = preferences.toggleHidden(workflows, wf.id, false);
    this.visibleWorkflowsCache = [...partition.ordered];
    this.hiddenWorkflowsCache = [...partition.hidden];
    this.updateHiddenBadge(this.hiddenWorkflowsCache.length);
    this.hiddenAutoPrompted.delete(wf.id);
    this.focusAfterRenderWorkflowId = wf.id;
    this.appendLog(`Unhid ${wf.label}.`);
    this.renderWorkflows();
    this.announceWorkflowStatus(`${wf.label} restored to Workflows tab.`);
  }

  private focusWorkflowAfterRender(){
    if (!this.focusAfterRenderWorkflowId) return;
    const workflowId = this.focusAfterRenderWorkflowId;
    const hideTarget = this.shadow.querySelector<HTMLButtonElement>(`[data-wf-hide="${workflowId}"]`);
    const fallback = this.shadow.querySelector<HTMLButtonElement>(`[data-wf-run="${workflowId}"]`);
    (hideTarget ?? fallback)?.focus({ preventScroll: true });
    this.focusAfterRenderWorkflowId = null;
  }

  private requestHiddenConfirmation(message: string, defaultDecision: boolean): boolean {
    const win: any = typeof window !== 'undefined' ? window : undefined;
    const confirmFn = typeof win?.confirm === 'function' ? win.confirm.bind(win) : null;
    if (confirmFn) {
      try {
        return confirmFn(message);
      } catch {
        return defaultDecision;
      }
    }
    return defaultDecision;
  }

  private partitionWorkflows(page: PageDefinition): WorkflowVisibilityLists {
    const workflows = page.workflows.filter(w => !(w as any).internal);
    if (!workflows.length) {
      return { ordered: [], hidden: [] };
    }
    if (!page.id) {
      return { ordered: workflows, hidden: [] };
    }
    const prefs = this.ensureWorkflowPreferences(page);
    if (!prefs) {
      return { ordered: workflows, hidden: [] };
    }
    return prefs.partition(workflows);
  }

  private getAllDraggableWorkflows(): WorkflowDefinition[] {
    const page = this.currentPage;
    if (!page) return [];
    return page.workflows.filter(w => !(w as any).internal);
  }

  private ensureWorkflowPreferences(page: PageDefinition): WorkflowPreferencesService | null {
    if (!page.id) return null;
    if (!this.workflowPreferences || this.workflowPreferencesPageId !== page.id) {
      this.workflowPreferences = new WorkflowPreferencesService(this.store, page.id);
      this.workflowPreferencesPageId = page.id;
    }
    return this.workflowPreferences;
  }

  private clearDropIndicator(){
    const list = this.workflowList;
    if (!list) return;
    list.removeAttribute('data-drop-tail');
    list.querySelectorAll<HTMLElement>('[data-drop-target]').forEach(el => el.removeAttribute('data-drop-target'));
  }

  private showDropIndicator(detail: DragReorderDetail){
    const list = this.workflowList;
    if (!list) return;
    this.clearDropIndicator();
    const items = Array.from(list.querySelectorAll<HTMLElement>('[data-drag-item]'));
    if (!items.length) return;
    const targetIndex = Math.max(0, Math.min(detail.toIndex, items.length - 1));
    const target = items[targetIndex];
    if (!target) return;
    const position = detail.toIndex > detail.fromIndex ? 'after' : 'before';
    target.setAttribute('data-drop-target', position);
  }

  private applyDomReorder(detail: DragReorderDetail){
    const list = this.workflowList;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>('[data-drag-item]'));
    const target = items.find(el => el.dataset.dragId === detail.id);
    if (!target) return;

    const siblings = items.filter(el => el !== target);
    const nextIndex = Math.max(0, Math.min(detail.toIndex, siblings.length));
    const reference = siblings[nextIndex] ?? null;

    if (reference) {
      list.insertBefore(target, reference);
    } else {
      list.appendChild(target);
    }

    const handle = target.querySelector<HTMLElement>('[data-drag-handle]');
    handle?.focus({ preventScroll: true });
    this.dragController?.refresh();
  }

  private reorderVisibleCache(detail: DragReorderDetail){
    if (!this.visibleWorkflowsCache.length) return;
    const index = this.visibleWorkflowsCache.findIndex(w => w.id === detail.id);
    if (index === -1) return;
    const [entry] = this.visibleWorkflowsCache.splice(index, 1);
    const nextIndex = Math.max(0, Math.min(detail.toIndex, this.visibleWorkflowsCache.length));
    this.visibleWorkflowsCache.splice(nextIndex, 0, entry);
  }

  private scheduleReorderPersistence(detail: DragReorderDetail){
    if (!this.currentPage || !this.workflowPreferences) return;
    this.pendingReorderDetail = { id: detail.id, toIndex: detail.toIndex };
    if (this.pendingReorderTimer !== null) {
      window.clearTimeout(this.pendingReorderTimer);
    }
    this.pendingReorderTimer = window.setTimeout(() => {
      this.pendingReorderTimer = null;
      const payload = this.pendingReorderDetail;
      this.pendingReorderDetail = null;
      if (!payload || !this.currentPage || !this.workflowPreferences) return;
      const workflows = this.getAllDraggableWorkflows();
      this.workflowPreferences.applyMove(workflows, payload.id, payload.toIndex);
      this.renderWorkflows();
    }, this.reorderPersistDelayMs);
  }

  private cancelPendingPersistence(){
    if (this.pendingReorderTimer !== null) {
      window.clearTimeout(this.pendingReorderTimer);
      this.pendingReorderTimer = null;
    }
    this.pendingReorderDetail = null;
  }

  private handleDragPreview = (detail: DragReorderDetail) => {
    this.showDropIndicator(detail);
  };

  private handleDragReorder = (detail: DragReorderDetail) => {
    this.clearDropIndicator();
    this.applyDomReorder(detail);
    this.reorderVisibleCache(detail);
    this.scheduleReorderPersistence(detail);
  };

  private handleDragAnnounce = (announcement: DragAnnouncement) => {
    if (announcement.type === 'cancel' || announcement.type === 'drop') {
      this.clearDropIndicator();
    }
    const text = this.formatDragAnnouncement(announcement);
    if (text && this.workflowAnnouncer) {
      this.workflowAnnouncer.textContent = text;
    }
  };

  private formatDragAnnouncement(announcement: DragAnnouncement): string {
    const label = this.workflowLabelFor(announcement.id);
    switch (announcement.type) {
      case 'lift':
        return `${label} lifted. Position ${announcement.index + 1} of ${announcement.total}.`;
      case 'move':
        return `${label} moved to position ${announcement.toIndex + 1} of ${announcement.total}.`;
      case 'drop':
        return `${label} dropped at position ${announcement.toIndex + 1} of ${announcement.total}.`;
      case 'cancel':
        return `${label} reorder canceled.`;
      default:
        return '';
    }
  }

  private workflowLabelFor(id: string): string {
    const fromVisible = this.visibleWorkflowsCache.find(w => w.id === id);
    if (fromVisible) return fromVisible.label;
    const fromHidden = this.hiddenWorkflowsCache.find(w => w.id === id);
    if (fromHidden) return fromHidden.label;
    const fromPage = this.currentPage?.workflows.find(w => w.id === id);
    return fromPage?.label ?? id;
  }

  markActiveProfile(workflowId: string, profileId: ProfileId){
    const wf = this.currentPage?.workflows.find(w => w.id === workflowId);
    const profilesEnabled = wf ? this.profilesEnabled(wf) : true;
    if (!profilesEnabled) {
      const runBtn = this.shadow.querySelector(`[data-wf-run="${workflowId}"]`) as HTMLButtonElement | null;
      if (runBtn) runBtn.textContent = 'Run';
      return;
    }
    const wrap = this.shadow.querySelector(`[data-wf-profiles="${workflowId}"]`);
    if (wrap) {
      wrap.querySelectorAll<HTMLButtonElement>('.cv-profile').forEach(btn => {
        const rawId = btn.getAttribute('data-profile');
        if (!rawId) return;
        const id = rawId as ProfileId;
        const slot = PROFILE_SLOTS.find(s => s.id === id);
        const base = `Click to activate ${slot?.label ?? id}`;
        btn.classList.toggle('active', id === profileId);
        btn.title = `${base}${id === profileId ? ' (active)' : ''}. Ctrl/Cmd/Alt+Click to run immediately.`;
      });
    }
    const runBtn = this.shadow.querySelector(`[data-wf-run="${workflowId}"]`) as HTMLButtonElement | null;
    if (runBtn) runBtn.textContent = `Run (${profileLabel(profileId)})`;
  }

  private profileValuesFor(wf: WorkflowDefinition, profileId: ProfileId): Record<string, any> {
    return getProfileValues(this.store, wf.id, profileId);
  }

  private renderOptions(){
    const wrap = this.shadow.getElementById('cv-options-wrap')!;
    wrap.innerHTML = '';
    const wf = this.currentWorkflow;
    if (!wf || wf.internal) {
      wrap.innerHTML = '<div class="cv-empty">Select a workflow and click Options.</div>';
      return;
    }
    const profilesEnabled = this.profilesEnabled(wf);
    const profileId = profilesEnabled
      ? (this.optionsProfileId ?? getActiveProfile(this.store, wf.id))
      : 'p1';
    this.optionsProfileId = profilesEnabled ? profileId : null;

    const toggles = document.createElement('div');
    toggles.className = 'cv-row cv-options-toggles';
    const profileSwitch = document.createElement('label');
    profileSwitch.className = 'cv-switch';
    profileSwitch.title = 'Toggle to enable per-profile options for this workflow';
    const profileCheckbox = document.createElement('input');
    profileCheckbox.type = 'checkbox';
    profileCheckbox.checked = profilesEnabled;
    const profileSpan = document.createElement('span');
    profileSpan.textContent = 'Enable profiles';
    profileSwitch.appendChild(profileCheckbox);
    profileSwitch.appendChild(profileSpan);
    toggles.appendChild(profileSwitch);
    wrap.appendChild(toggles);

    profileCheckbox.addEventListener('change', () => {
      setProfilesEnabled(this.store, wf.id, profileCheckbox.checked);
      this.appendLog(`${profileCheckbox.checked ? 'Enabled' : 'Disabled'} profiles for ${wf.label}`);
      this.optionsProfileId = profileCheckbox.checked ? getActiveProfile(this.store, wf.id) : null;
      this.renderWorkflows();
      this.renderOptions();
    });

    if (!profilesEnabled) {
      const note = document.createElement('div');
      note.className = 'cv-hint';
      note.textContent = 'Profiles disabled: options apply to all runs.';
      wrap.appendChild(note);
    }

    if (profilesEnabled) {
      const tabs = document.createElement('div');
      tabs.className = 'cv-row cv-profile-tabs';
      PROFILE_SLOTS.forEach(slot => {
        const btn = document.createElement('button');
        btn.className = 'cv-btn cv-profile-tab' + (slot.id === profileId ? ' active' : '');
        btn.textContent = slot.label;
        btn.title = `Edit ${slot.label}`;
        btn.addEventListener('click', () => {
          this.optionsProfileId = slot.id;
          this.renderOptions();
        });
        tabs.appendChild(btn);
      });
      wrap.appendChild(tabs);
    }

    if (!wf.options || wf.options.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cv-empty';
      empty.textContent = 'No options defined for this workflow yet.';
      wrap.appendChild(empty);
      return;
    }

    const saved = this.profileValuesFor(wf, profileId);
    const form = document.createElement('div');
    form.className = 'cv-form';
    (wf.options || []).forEach(opt => {
      form.appendChild(this.renderOptionField(opt, saved[opt.key]));
    });
    const row = document.createElement('div');
    row.className = 'cv-row right';
    const save = document.createElement('button');
    save.className = 'cv-btn';
    save.textContent = profilesEnabled ? `Save ${profileLabel(profileId)}` : 'Save Options';
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
      this.dispatch('save-options', { workflowId: wf.id, values, profileId });
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
        <button class="cv-tab" data-tab="cv-tab-hidden">Hidden <span id="cv-hidden-count" class="cv-tab-badge"></span></button>
        <button class="cv-tab" data-tab="cv-tab-selectors">Selectors</button>
        <button class="cv-tab" data-tab="cv-tab-options">Options</button>
        <button class="cv-tab" data-tab="cv-tab-theme">Theme</button>
        <button class="cv-tab" data-tab="cv-tab-storage">Storage</button>
        <button class="cv-tab" data-tab="cv-tab-logs">Logs</button>
      </div>
    </div>
    <div id="cv-tab-workflows" class="cv-section active">
      <div id="cv-wf-announcer" class="cv-visually-hidden" role="status" aria-live="polite" aria-atomic="true"></div>
      <div id="cv-wf-list"></div>
    </div>
    <div id="cv-tab-hidden" class="cv-section">
      <div class="cv-hidden-header">
        <label class="cv-visually-hidden" for="cv-hidden-search">Search hidden workflows</label>
        <input id="cv-hidden-search" class="cv-input" type="search" placeholder="Search hidden workflows" autocomplete="off" spellcheck="false">
      </div>
      <div id="cv-hidden-empty" class="cv-empty">Hidden workflows appear here after you hide them from the Workflows tab.</div>
      <div id="cv-hidden-list" class="cv-hidden-list" role="list"></div>
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
      <div class="cv-theme-grid">
        <label>Primary <input type="color" id="cv-theme-primary" value="#1f7a8c"></label>
        <label>Background <input type="color" id="cv-theme-bg" value="#0b0c10"></label>
        <label>Text <input type="color" id="cv-theme-text" value="#f5f7fb"></label>
        <label>Accent <input type="color" id="cv-theme-accent" value="#ffbd59"></label>
        <div class="cv-opacity">
          <span>Opacity</span>
          <input type="range" id="cv-theme-opacity" min="0.5" max="1" step="0.01" value="0.95">
          <span id="cv-theme-opacity-value">95%</span>
        </div>
        <div class="cv-theme-actions">
          <button id="cv-theme-apply" class="cv-btn">Apply</button>
          <button id="cv-theme-reset" class="cv-btn secondary">Reset</button>
        </div>
      </div>
    </div>
    <div id="cv-tab-storage" class="cv-section">
      <div class="cv-row">
        <button id="cv-export" class="cv-btn">Export Config to Clipboard</button>
        <button id="cv-import" class="cv-btn">Import Config</button>
      </div>
    </div>
    <div id="cv-tab-logs" class="cv-section">
      <div class="cv-row between">
        <label class="cv-switch" title="Toggle debug log visibility">
          <input type="checkbox" id="cv-logs-debug-toggle">
          <span>Show debug logs</span>
        </label>
        <div class="cv-row gap">
          <input id="cv-logs-filter" class="cv-input" type="text" placeholder="Filter logs" spellcheck="false">
          <button id="cv-logs-copy" class="cv-btn secondary">Copy</button>
          <button id="cv-logs-clear" class="cv-btn secondary">Clear</button>
        </div>
      </div>
      <textarea id="cv-logs" class="cv-textarea" readonly></textarea>
    </div>
    `;
  }

  private css(){
    return `
      :host { all: initial; }
      .cv-gear{
        position: fixed; bottom: 16px; right: 16px; z-index: 2147483647;
        border-radius: 50%; width: 44px; height: 44px; border: none; cursor: pointer;
        background: var(--cv-primary); color: var(--cv-text); box-shadow: 0 2px 10px rgba(0,0,0,.4);
      }
      .cv-panel{
        position: fixed; bottom: 72px; right: 16px; width: 480px; max-height: 70vh; overflow: hidden;
        background: var(--cv-panel-bg, var(--cv-bg)); color: var(--cv-text); border: 1px solid rgba(255,255,255,.08);
        border-radius: 10px; box-shadow: 0 18px 38px -24px rgba(0,0,0,.6);
        transform: translateY(12px); opacity: 0; pointer-events: none; transition: transform .22s cubic-bezier(.22,1,.36,1), opacity .18s ease;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, 'Helvetica Neue', Arial, 'Apple Color Emoji','Segoe UI Emoji';
        z-index: 2147483647;
      }
      .cv-panel.open{ transform: translateY(0); opacity: 1; pointer-events: all; }
      .cv-header{ display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px 12px; background: linear-gradient(0deg, rgba(255,255,255,.02), transparent); }
      .cv-title{ font-weight: 600; letter-spacing: .3px; font-size: 16px; width: 100%; }
      .cv-tabs{ display:flex; flex-wrap: wrap; gap:6px; width:100%; }
      .cv-tab{ position:relative; background: transparent; color: var(--cv-text); border: 1px solid rgba(255,255,255,.18); padding: 6px 10px; border-radius: 6px; cursor: pointer; flex: 0 0 auto; white-space: nowrap; transition: border-color .18s ease, color .18s ease, background .18s ease, box-shadow .18s ease; }
      .cv-tab:hover{ border-color: var(--cv-accent); color: var(--cv-accent); }
      .cv-tab.active{ border-color: var(--cv-accent); color: var(--cv-accent); background: rgba(255,255,255,.08); box-shadow: 0 0 0 1px rgba(255,255,255,.04); }
      .cv-tab.cv-tab-empty{ opacity: .78; }
      .cv-tab .cv-tab-badge{ display:inline-flex; align-items:center; justify-content:center; margin-left:6px; min-width:18px; padding:0 6px; border-radius:999px; font-size:11px; font-weight:600; background: rgba(255,255,255,.12); color: var(--cv-text); opacity:.45; transition: transform .2s ease, background .18s ease, color .18s ease, opacity .18s ease; }
      .cv-tab .cv-tab-badge:not(:empty){ opacity:1; }
      .cv-tab:hover .cv-tab-badge:not(:empty){ background: rgba(255,255,255,.2); }
      .cv-tab.active .cv-tab-badge{ background: var(--cv-accent); color: var(--cv-bg); opacity:1; }
      .cv-section{ display: none; padding: 10px; }
      .cv-section.active{ display:block; max-height: calc(70vh - 58px); overflow-y: auto; }
      #cv-tab-workflows{ display:flex; flex-direction:column; gap:10px; min-height:0; max-height: calc(70vh - 58px); }
      #cv-tab-workflows #cv-wf-list{ flex:1; min-height:0; display:flex; flex-direction:column; gap:8px; overflow-y:auto; padding-right:6px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.22) transparent; overscroll-behavior: contain; }
      #cv-tab-workflows #cv-wf-list::-webkit-scrollbar{ width:8px; }
      #cv-tab-workflows #cv-wf-list::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.24); border-radius:999px; }
      .cv-row{ display:flex; gap:10px; align-items:center; margin: 8px 0; flex-wrap: wrap; }
      .cv-row.gap{ gap:6px; }
      .cv-row.right{ justify-content:flex-end; }
      .cv-row.between{ justify-content:space-between; }
      .cv-textarea{ width: 100%; min-height: 240px; background: rgba(0,0,0,.3); color: var(--cv-text); border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px; }
      .cv-btn{ background: var(--cv-primary); color: var(--cv-text); border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: background .15s ease, color .15s ease, border-color .15s ease; }
      .cv-btn:hover{ background: var(--cv-accent); }
      .cv-btn.secondary{ background: transparent; border: 1px solid rgba(255,255,255,.2); color: var(--cv-text); }
      .cv-btn.secondary:hover{ border-color: var(--cv-accent); color: var(--cv-accent); }
      .cv-btn:focus-visible,
      .cv-tab:focus-visible,
      .cv-profile:focus-visible,
      .cv-hidden-unhide:focus-visible{
        outline: 2px solid var(--cv-focus-outline);
        outline-offset: 2px;
      }
      .cv-input{ background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.18); border-radius: 6px; padding: 6px 8px; color: var(--cv-text); font-size: 12px; min-width: 160px; }
      .cv-empty{ opacity: .7; padding: 8px; }
      .cv-wf-item{ position:relative; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 8px; margin-bottom: 8px; background: var(--cv-surface-muted); transition: background .18s ease, border-color .18s ease, transform .18s ease; }
      .cv-wf-item:hover{ border-color: rgba(255,255,255,.24); background: var(--cv-surface-hover); }
      .cv-wf-item:focus-within{ border-color: var(--cv-focus-outline); box-shadow: 0 0 0 1px var(--cv-focus-outline); }
      .cv-wf-row{ display:flex; align-items:flex-start; gap:8px; margin-bottom:6px; }
      .cv-wf-main{ flex:1; min-width:0; }
      .cv-wf-handle{ background: var(--cv-drag-handle-bg); border: 1px solid transparent; color: var(--cv-text); border-radius: 6px; width: 32px; height: 32px; display:flex; align-items:center; justify-content:center; cursor: grab; transition: opacity .18s ease, background .18s ease, border-color .18s ease, transform .18s ease; opacity:.32; will-change: transform; }
      .cv-wf-item:hover .cv-wf-handle,
      .cv-wf-item:focus-within .cv-wf-handle{ opacity:1; }
      .cv-wf-handle:hover{ border-color: var(--cv-accent); background: var(--cv-drag-handle-hover); }
      .cv-wf-handle:active{ cursor: grabbing; transform: scale(.96); }
      .cv-wf-handle:focus-visible{ outline: 2px solid var(--cv-focus-outline); outline-offset: 2px; opacity:1; }
      .cv-wf-handle span{ pointer-events:none; font-size:16px; line-height:1; transition: transform .18s ease; }
      .cv-wf-item:hover .cv-wf-handle span{ transform: translateY(-1px); }
      .cv-wf-item[data-drop-target]{ border-color: var(--cv-focus-outline); }
      .cv-wf-item[data-drop-target]::after{
        content:''; position:absolute; left:12px; right:12px; height:4px; border-radius:999px;
        background: var(--cv-drop-indicator); opacity:.9; transform: scaleX(1); transform-origin:center;
        pointer-events:none; transition: transform .14s ease, opacity .14s ease;
      }
      .cv-wf-item[data-drop-target="before"]::after{ top:-6px; }
      .cv-wf-item[data-drop-target="after"]::after{ bottom:-6px; }
      .cv-visually-hidden{ position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
      .cv-wf-title{ font-weight: 600; margin-bottom: 4px; }
      .cv-wf-meta{ display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin: 6px 0; }
      .cv-wf-switches{ display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
      .cv-switch{ display:inline-flex; align-items:center; gap:6px; font-size:12px; color: rgba(255,255,255,.85); }
      .cv-switch input{ position:relative; width:30px; height:16px; border-radius:999px; appearance:none; -webkit-appearance:none; background: rgba(255,255,255,.18); outline:none; cursor:pointer; transition: background .15s ease; }
      .cv-switch input::after{ content:''; position:absolute; top:2px; left:2px; width:12px; height:12px; border-radius:50%; background: var(--cv-bg); transition: transform .15s ease, background .15s ease; }
      .cv-switch input:checked{ background: var(--cv-primary); }
      .cv-switch input:checked::after{ transform: translateX(14px); background: var(--cv-text); }
      .cv-switch input:focus-visible{ box-shadow: 0 0 0 2px var(--cv-focus-outline); }
      .cv-switch input:disabled{ opacity:.4; cursor:not-allowed; }
      .cv-wf-footer{ display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
      .cv-wf-footer.cv-no-profiles .cv-wf-actions{ margin-left:auto; }
      .cv-wf-profiles{ display:flex; gap:6px; flex-wrap:wrap; }
      .cv-profile{ background: transparent; color: var(--cv-text); border: 1px solid rgba(255,255,255,.18); padding: 4px 10px; border-radius: 999px; cursor: pointer; font-size: 12px; line-height: 1.2; transition: border-color .15s ease, color .15s ease, background .15s ease; }
      .cv-profile:hover{ border-color: var(--cv-accent); color: var(--cv-accent); }
      .cv-profile.active{ background: rgba(255,255,255,.12); border-color: var(--cv-accent); color: var(--cv-accent); }
      .cv-wf-actions{ display:flex; gap:8px; align-items:center; }
      .cv-wf-hiding{ pointer-events:none; transition: opacity .18s ease, transform .22s cubic-bezier(.32,.08,.24,1); will-change: opacity, transform; }
      .cv-wf-hiding.cv-wf-hiding-active{ opacity:0; transform: translateY(-4px); }
      .cv-hidden-header{ display:flex; gap:8px; align-items:center; margin-bottom:10px; }
      .cv-hidden-header input{ flex:1; }
      .cv-hidden-list{ display:flex; flex-direction:column; gap:8px; }
      .cv-hidden-item{ position:relative; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 8px; display:flex; gap:8px; align-items:flex-start; justify-content:space-between; background: var(--cv-surface-muted); transition: background .18s ease, border-color .18s ease; }
      .cv-hidden-item:hover{ border-color: rgba(255,255,255,.22); background: var(--cv-surface-hover); }
      .cv-hidden-item:focus-within{ border-color: var(--cv-focus-outline); box-shadow: 0 0 0 1px var(--cv-focus-outline); }
      .cv-hidden-main{ flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
      .cv-hidden-title{ font-weight:600; }
      .cv-hidden-desc{ font-size:12px; opacity:.78; }
      .cv-hidden-meta{ display:flex; flex-wrap:wrap; gap:6px; font-size:11px; opacity:.78; align-items:center; }
      .cv-hidden-badge{ display:inline-flex; align-items:center; justify-content:center; padding:2px 8px; border-radius:999px; background: var(--cv-hidden-badge-bg); color: var(--cv-hidden-badge-text); text-transform:uppercase; letter-spacing:.5px; font-size:10px; font-weight:600; line-height:1.2; transition: background .18s ease, color .18s ease, transform .18s ease; }
      .cv-hidden-badge[data-state="new"]{ transform: scale(1.05); }
      .cv-hidden-actions{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
      .cv-hidden-unhide{ white-space:nowrap; }
      .cv-profile-tabs{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom: 8px; }
      .cv-profile-tab{ background: transparent; border: 1px solid rgba(255,255,255,.18); color: var(--cv-text); padding: 6px 14px; border-radius: 999px; cursor: pointer; transition: border-color .15s ease, color .15s ease, background .15s ease; }
      .cv-profile-tab:hover{ border-color: var(--cv-accent); color: var(--cv-accent); }
      .cv-profile-tab.active{ background: rgba(255,255,255,.1); border-color: var(--cv-accent); color: var(--cv-accent); }
      .cv-options-toggles{ margin-top: 0; }
      .cv-hint{ font-size: 12px; opacity: .75; margin: 4px 0 8px; }
      .cv-theme-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px; align-items:center; }
      .cv-theme-grid label{ display:flex; flex-direction:column; gap:6px; font-size:12px; color: var(--cv-text); }
      .cv-theme-grid input[type="color"]{ width:100%; min-width: 120px; height:34px; border:1px solid rgba(255,255,255,.2); border-radius:6px; background:transparent; padding:0; }
      .cv-opacity{ display:flex; align-items:center; gap:8px; color: var(--cv-text); font-size: 12px; grid-column: span 2; }
      .cv-opacity input{ flex:1; min-width:140px; }
      .cv-opacity span{ min-width: 44px; text-align: right; opacity: .8; }
      .cv-theme-actions{ display:flex; gap:10px; align-items:center; grid-column: span 2; }
      @media (prefers-reduced-motion: reduce){
        .cv-panel,
        .cv-tab,
        .cv-tab .cv-tab-badge,
        .cv-wf-item,
        .cv-wf-handle,
        .cv-wf-hiding,
        .cv-hidden-item,
        .cv-hidden-badge{
          transition-duration: 0ms !important;
          animation-duration: 0ms !important;
        }
      }
      /* Default CSS variables at scope root (shadow host) */
      :host{ --cv-primary: ${DEFAULT_THEME.primary}; --cv-bg: ${DEFAULT_THEME.background}; --cv-text: ${DEFAULT_THEME.text}; --cv-accent: ${DEFAULT_THEME.accent}; --cv-panel-bg: rgba(11,12,16,0.95); --cv-focus-outline: var(--cv-accent); --cv-surface-muted: rgba(255,255,255,.04); --cv-surface-hover: rgba(255,255,255,.08); --cv-drag-handle-bg: rgba(255,255,255,.05); --cv-drag-handle-hover: rgba(255,255,255,.14); --cv-drop-indicator: var(--cv-accent); --cv-hidden-badge-bg: rgba(255,255,255,.1); --cv-hidden-badge-text: var(--cv-accent); }
    `;
  }

  private applyTheme(){
    this.settings.theme = this.normalizeTheme(this.settings.theme);
    const hostEl = this.shadow.host as HTMLElement;
    const theme = this.settings.theme;
    hostEl.style.setProperty('--cv-primary', theme.primary);
    hostEl.style.setProperty('--cv-bg', theme.background);
    hostEl.style.setProperty('--cv-text', theme.text);
    hostEl.style.setProperty('--cv-accent', theme.accent);
    hostEl.style.setProperty('--cv-panel-bg', this.toRgba(theme.background, theme.panelOpacity));
    this.syncThemeControls();
  }

  private normalizeTheme(theme?: Partial<ThemeConfig>): ThemeConfig {
    const merged: ThemeConfig = {
      ...DEFAULT_THEME,
      ...(theme ?? {})
    };
    const opacity = Number.isFinite(merged.panelOpacity) ? Math.min(1, Math.max(0.5, merged.panelOpacity)) : DEFAULT_THEME.panelOpacity;
    return { ...merged, panelOpacity: opacity };
  }

  private toRgba(color: string, alpha: number): string {
    const hex = (color || '').trim();
    const match = hex.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return `rgba(11,12,16,${Math.min(1, Math.max(0, alpha)).toFixed(2)})`;
    let value = match[1];
    if (value.length === 3) {
      value = value.split('').map(ch => ch + ch).join('');
    }
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    const a = Math.min(1, Math.max(0, alpha));
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }

  private syncThemeControls(){
    const theme = this.settings.theme;
    const setInputValue = (id: string, value: string) => {
      const el = this.shadow.getElementById(id) as HTMLInputElement | null;
      if (el && el.value !== value) el.value = value;
    };
    setInputValue('cv-theme-primary', theme.primary);
    setInputValue('cv-theme-bg', theme.background);
    setInputValue('cv-theme-text', theme.text);
    setInputValue('cv-theme-accent', theme.accent);
    const opacityInput = this.shadow.getElementById('cv-theme-opacity') as HTMLInputElement | null;
    if (opacityInput) {
      const normalized = theme.panelOpacity.toFixed(2);
      if (opacityInput.value !== normalized) opacityInput.value = normalized;
    }
    this.updateOpacityLabel(theme.panelOpacity);
  }

  private updateOpacityLabel(value: number){
    const el = this.shadow.getElementById('cv-theme-opacity-value');
    if (!el) return;
    const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
    el.textContent = `${pct}%`;
  }

  private dispatch(type: string, detail: any){
    const handler = this.handlers?.[type as keyof MenuHandlers];
    if (handler) {
      handler(detail);
    } else {
      window.dispatchEvent(new CustomEvent(`cv-menu:${type}`, { detail }));
    }
  }
}
