import type { PageDefinition, Registry, Settings, ThemeConfig, WorkflowDefinition, WorkflowOption } from './types';
import { Store } from './storage';
import { highlight, findAll, findOne } from './selector';
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
import { resolveAutoRunConfig, resolveTriggerState, isManualTriggerAvailable } from './triggers';
import { WorkflowPreferencesService, type WorkflowVisibilityLists } from './menu/workflow-preferences';
import { DragController, type DragAnnouncement, type DragReorderDetail } from './menu/drag-controller';

type MenuHandlers = {
  'run-workflow'?: (detail: any) => void;
  'save-options'?: (detail: any) => void;
  'run-prefs-updated'?: (detail: any) => void;
};

type MenuLogLevel = 'info' | 'debug';
type MenuSection = 'actions' | 'automations' | 'settings';
type SettingsSection = 'theme' | 'storage' | 'logs' | 'advanced';
type MenuMode = 'operator' | 'developer';
type MenuFilter = 'all' | 'auto' | 'options' | 'errors' | 'hidden' | 'relevant';
type MenuSort = 'custom' | 'alpha' | 'last-run';

type MenuState = {
  version: 1;
  section: MenuSection;
  settingsSection: SettingsSection;
  mode: MenuMode;
  search: string;
  filter: MenuFilter;
  sort: MenuSort;
  showArchived: boolean;
};

type AutoRunStatus = {
  status: string;
  message: string;
  at: number;
};

type WorkflowOutcome = {
  status: 'ok' | 'error' | 'warn';
  at: number;
  message?: string;
  manual?: boolean;
};

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

const escapeHtml = (value: string) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
  private menuState: MenuState;
  private searchInput: HTMLInputElement | null = null;
  private workflowAnnouncer: HTMLElement | null = null;
  private actionsList: HTMLElement | null = null;
  private actionsArchivedList: HTMLElement | null = null;
  private actionsArchivedWrap: HTMLElement | null = null;
  private automationsList: HTMLElement | null = null;
  private detailPane: HTMLElement | null = null;
  private autoRunStatuses = new Map<string, AutoRunStatus>();
  private workflowOutcomes = new Map<string, WorkflowOutcome>();
  private dragController: DragController | null = null;
  private workflowPreferences: WorkflowPreferencesService | null = null;
  private workflowPreferencesPageId: string | null = null;
  private hiddenWorkflowsCache: WorkflowDefinition[] = [];
  private visibleWorkflowsCache: WorkflowDefinition[] = [];
  private focusAfterRenderWorkflowId: string | null = null;
  private pendingReorderDetail: { id: string; toIndex: number } | null = null;
  private pendingReorderTimer: number | null = null;
  private readonly reorderPersistDelayMs = 200;
  private readonly menuStateKey = 'cv:menu:state';

  constructor(registry: Registry, store: Store, handlers?: MenuHandlers){
    this.registry = registry;
    this.store = store;
    this.handlers = handlers;
    this.menuState = this.loadMenuState();
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
    this.updateLayoutMode();
    window.addEventListener('resize', () => this.updateLayoutMode());

    this.searchInput = this.shadow.getElementById('cv-search') as HTMLInputElement | null;
    if (this.searchInput) {
      this.searchInput.setAttribute('aria-label', 'Search actions and automations');
      if (this.searchInput.value !== this.menuState.search) {
        this.searchInput.value = this.menuState.search;
      }
    }
    this.workflowAnnouncer = this.shadow.getElementById('cv-list-announcer') as HTMLElement | null;
    this.actionsList = this.shadow.getElementById('cv-actions-list') as HTMLElement | null;
    if (this.actionsList) {
      this.actionsList.setAttribute('role', 'list');
    }
    this.actionsArchivedWrap = this.shadow.getElementById('cv-actions-archived') as HTMLElement | null;
    this.actionsArchivedList = this.shadow.getElementById('cv-actions-archived-list') as HTMLElement | null;
    if (this.actionsArchivedList) {
      this.actionsArchivedList.setAttribute('role', 'list');
    }
    this.automationsList = this.shadow.getElementById('cv-automations-list') as HTMLElement | null;
    if (this.automationsList) {
      this.automationsList.setAttribute('role', 'list');
    }
    this.detailPane = this.shadow.getElementById('cv-detail-pane') as HTMLElement | null;

    this.gear = document.createElement('button');
    this.gear.className = 'cv-gear';
    this.gear.title = 'Carvana Automations';
    this.gear.textContent = '⚙️';
    this.gear.addEventListener('click', () => this.toggle());
    this.shadow.appendChild(this.gear);

    this.bind();
    this.applyTheme();
    this.renderLogs();
    this.syncMenuStateUI();
    this.renderAll();

    // Close detail pane on Escape key
    this.shadow.addEventListener('keydown', (ev: Event) => {
      const keyEvent = ev as KeyboardEvent;
      if (keyEvent.key === 'Escape' && this.container.classList.contains('cv-detail-open')) {
        keyEvent.preventDefault();
        this.closeDetail();
      }
    });
  }

  setPage(page?: PageDefinition){
    this.currentPage = page;
    if (page) {
      this.ensureWorkflowPreferences(page);
    } else {
      this.workflowPreferences = null;
      this.workflowPreferencesPageId = null;
    }
    this.cancelPendingPersistence();
    this.clearDropIndicator();
    this.renderAll();
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
    this.renderDetail();
  }

  appendLog(message: string, level: MenuLogLevel = 'info'){
    const entry: MenuLogEntry = { timestamp: Date.now(), message, level };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.length = 200;
    this.renderLogs();
  }

  setAutoRunStatus(workflowId: string, status: { status: string; message: string }){
    this.autoRunStatuses.set(workflowId, { ...status, at: Date.now() });
    this.renderAutomations();
  }

  recordWorkflowOutcome(workflowId: string, outcome: WorkflowOutcome){
    this.workflowOutcomes.set(workflowId, outcome);
    this.renderActions();
    this.renderAutomations();
    if (this.currentWorkflow?.id === workflowId) {
      this.renderDetail();
    }
  }

  private loadMenuState(): MenuState {
    const defaults: MenuState = {
      version: 1,
      section: 'actions',
      settingsSection: 'theme',
      mode: 'operator',
      search: '',
      filter: 'all',
      sort: 'custom',
      showArchived: false
    };
    const raw = this.store.get<MenuState | null>(this.menuStateKey, null);
    if (!raw || typeof raw !== 'object') return defaults;
    const section = raw.section === 'automations' || raw.section === 'settings' ? raw.section : 'actions';
    const settingsSection = raw.settingsSection === 'storage' || raw.settingsSection === 'logs' || raw.settingsSection === 'advanced'
      ? raw.settingsSection
      : 'theme';
    const mode = raw.mode === 'developer' ? 'developer' : 'operator';
    const filter = raw.filter === 'auto' || raw.filter === 'options' || raw.filter === 'errors' || raw.filter === 'hidden' || raw.filter === 'relevant'
      ? raw.filter
      : 'all';
    const sort = raw.sort === 'alpha' || raw.sort === 'last-run' ? raw.sort : 'custom';
    const search = typeof raw.search === 'string' ? raw.search : '';
    const showArchived = raw.showArchived === true;
    return {
      version: 1,
      section,
      settingsSection,
      mode,
      search,
      filter,
      sort,
      showArchived
    };
  }

  private updateMenuState(patch: Partial<MenuState>, options?: { render?: boolean }){
    const next: MenuState = { ...this.menuState, ...patch };
    if (next.section !== 'actions' && next.filter === 'hidden') {
      next.filter = 'all';
    }
    if (next.mode !== 'developer' && next.settingsSection === 'advanced') {
      next.settingsSection = 'theme';
    }
    this.menuState = next;
    try {
      this.store.set(this.menuStateKey, next);
    } catch {
      // ignore store failures
    }
    this.syncMenuStateUI();
    if (options?.render !== false) {
      this.renderAll();
    }
  }

  private syncMenuStateUI(){
    this.shadow.querySelectorAll('[data-section]').forEach(btn => {
      const el = btn as HTMLElement;
      const target = el.getAttribute('data-section') as MenuSection | null;
      const active = target === this.menuState.section;
      el.classList.toggle('active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    this.shadow.querySelectorAll('.cv-section').forEach(section => {
      const el = section as HTMLElement;
      const target = el.getAttribute('data-section-id');
      el.classList.toggle('active', target === this.menuState.section);
    });
    this.shadow.querySelectorAll('[data-settings-tab]').forEach(btn => {
      const el = btn as HTMLElement;
      const target = el.getAttribute('data-settings-tab') as SettingsSection | null;
      const active = target === this.menuState.settingsSection;
      el.classList.toggle('active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    this.shadow.querySelectorAll('.cv-settings-panel').forEach(panel => {
      const el = panel as HTMLElement;
      const target = el.getAttribute('data-settings-panel');
      el.classList.toggle('active', target === this.menuState.settingsSection);
    });
    this.shadow.querySelectorAll('[data-mode]').forEach(btn => {
      const el = btn as HTMLElement;
      const mode = el.getAttribute('data-mode') as MenuMode | null;
      const active = mode === this.menuState.mode;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (this.searchInput && this.searchInput.value !== this.menuState.search) {
      this.searchInput.value = this.menuState.search;
    }
    this.shadow.querySelectorAll<HTMLElement>('[data-filter]').forEach(btn => {
      const filter = btn.getAttribute('data-filter') as MenuFilter | null;
      const view = btn.getAttribute('data-view');
      if (view === 'actions' && this.menuState.section !== 'actions') return;
      if (view === 'automations' && this.menuState.section !== 'automations') return;
      btn.classList.toggle('active', filter === this.menuState.filter);
    });
    this.shadow.querySelectorAll<HTMLSelectElement>('[data-sort]').forEach(select => {
      if (select.value !== this.menuState.sort) select.value = this.menuState.sort;
    });
    const advancedSection = this.shadow.getElementById('cv-settings-advanced');
    if (advancedSection) {
      advancedSection.hidden = this.menuState.mode !== 'developer';
    }
    const advancedTab = this.shadow.querySelector('[data-settings-tab="advanced"]') as HTMLElement | null;
    if (advancedTab) {
      advancedTab.hidden = this.menuState.mode !== 'developer';
    }
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
      this.syncMenuStateUI();
      this.renderAll();
      this.updateLayoutMode();
    }
  }

  close(){
    if (!this.open) return;
    this.open = false;
    this.container.classList.toggle('open', false);
  }

  private bind(){
    this.shadow.querySelectorAll('[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = (btn as HTMLElement).getAttribute('data-section') as MenuSection | null;
        if (!section) return;
        this.updateMenuState({ section });
      });
    });

    this.shadow.querySelectorAll('[data-settings-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = (btn as HTMLElement).getAttribute('data-settings-tab') as SettingsSection | null;
        if (!section) return;
        if (section === 'advanced' && this.menuState.mode !== 'developer') return;
        this.updateMenuState({ settingsSection: section });
      });
    });

    this.shadow.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).getAttribute('data-mode') as MenuMode | null;
        if (!mode) return;
        this.updateMenuState({ mode });
      });
    });

    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        this.updateMenuState({ search: this.searchInput?.value ?? '' });
      });
    }

    this.shadow.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = (btn as HTMLElement).getAttribute('data-filter') as MenuFilter | null;
        if (!filter) return;
        this.updateMenuState({ filter });
      });
    });

    this.shadow.querySelectorAll<HTMLSelectElement>('[data-sort]').forEach(select => {
      select.addEventListener('change', () => {
        this.updateMenuState({ sort: select.value as MenuSort });
      });
    });

    const archivedToggle = this.shadow.getElementById('cv-archived-toggle');
    if (archivedToggle) {
      archivedToggle.addEventListener('click', () => {
        this.updateMenuState({ showArchived: !this.menuState.showArchived });
      });
    }

    this.shadow.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const back = target.closest<HTMLElement>('[data-detail-back]');
      if (back) {
        this.closeDetail();
      }
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
        const detail = this.getDetailPane();
        const ta = detail?.querySelector<HTMLTextAreaElement>('[data-selector-json]');
        if (!ta) return;
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

    this.shadow.getElementById('cv-advanced-load')?.addEventListener('click', () => {
      this.loadAdvancedJson();
    });
    this.shadow.getElementById('cv-advanced-copy')?.addEventListener('click', () => {
      this.copyAdvancedJson();
    });
    this.shadow.getElementById('cv-advanced-apply')?.addEventListener('click', () => {
      this.applyAdvancedJson();
    });

  }

  private renderAll(){
    this.renderActions();
    this.renderAutomations();
    this.renderDetail();
    this.renderSettings();
  }

  private renderActions(){
    const list = this.actionsList;
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
      this.renderArchivedSection([]);
      return;
    }

    const partition = this.partitionWorkflows(page);
    const visible = partition.ordered.filter(wf => this.isActionIntent(wf));
    const hidden = partition.hidden.filter(wf => this.isActionIntent(wf));
    this.visibleWorkflowsCache = [...visible];
    this.hiddenWorkflowsCache = [...hidden];

    const showHiddenOnly = this.menuState.filter === 'hidden';
    const filteredVisible = showHiddenOnly ? [] : this.applyFilters(visible, 'actions');
    const filteredHidden = this.applyFilters(hidden, 'actions', { includeHidden: true });
    const sortedVisible = this.applySort(filteredVisible);
    const sortedHidden = this.applySort(filteredHidden);
    const allowDrag = this.canDragReorder();
    const visibleGroups = this.splitByRelevance(sortedVisible);
    const showGroups = this.shouldShowRelevanceGroups(visibleGroups);

    if (showHiddenOnly) {
      if (!sortedHidden.length) {
        list.innerHTML = hidden.length
          ? '<div class="cv-empty">No archived actions match your filters.</div>'
          : '<div class="cv-empty">No archived actions yet.</div>';
      } else {
        this.renderActionRows(list, sortedHidden, { allowDrag: false });
      }
      this.renderArchivedSection([], true);
    } else {
      if (!sortedVisible.length) {
        list.innerHTML = visible.length
          ? '<div class="cv-empty">No actions match your filters.</div>'
          : '<div class="cv-empty">No actions available</div>';
      } else {
        if (showGroups) {
          if (visibleGroups.relevant.length) {
            this.renderGroupHeader(list, 'Relevant to this page');
            this.renderActionRows(list, visibleGroups.relevant, { allowDrag });
          }
          if (visibleGroups.other.length) {
            this.renderGroupHeader(list, 'All actions');
            this.renderActionRows(list, visibleGroups.other, { allowDrag });
          }
        } else {
          this.renderActionRows(list, sortedVisible, { allowDrag });
        }
      }
      this.renderArchivedSection(sortedHidden, false);
    }

    if (allowDrag && visible.length > 1 && !showHiddenOnly) {
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

  private renderActionRows(list: HTMLElement, workflows: WorkflowDefinition[], options: { allowDrag: boolean }){
    for (const wf of workflows){
      const prefs = getRunPrefs(this.store, wf.id);
      const triggers = resolveTriggerState(wf, prefs);
      const manualAvailable = triggers.manual.available;
      const profilesEnabled = this.profilesEnabled(wf);
      const activeProfile = profilesEnabled ? getActiveProfile(this.store, wf.id) : 'p1';
      const profileSelect = profilesEnabled ? this.renderProfileSelect(wf.id, activeProfile) : '';
      const badges = this.renderBadges(wf, prefs);
      const safeLabel = escapeHtml(wf.label);
      const safeDescription = escapeHtml(wf.description ?? '');

      const item = document.createElement('div');
      item.className = 'cv-item';
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      item.dataset.actionRow = wf.id;
      if (options.allowDrag) {
        item.setAttribute('data-drag-item', '');
        item.dataset.dragId = wf.id;
      }
      item.innerHTML = `
        <div class="cv-item-row">
          ${options.allowDrag ? `<button type="button" class="cv-drag-handle" data-drag-handle title="Drag to reorder"><span aria-hidden="true">|||</span></button>` : ''}
          <div class="cv-item-main">
            <div class="cv-item-title">${safeLabel}</div>
            <div class="cv-item-desc">${safeDescription}</div>
            ${badges ? `<div class="cv-badges">${badges}</div>` : ''}
          </div>
        </div>
        <div class="cv-item-actions">
          ${profileSelect}
          <button class="cv-btn cv-run" data-action-run="${wf.id}" ${manualAvailable ? '' : 'disabled'}>Run</button>
        </div>
      `;

      const runBtn = item.querySelector(`[data-action-run="${wf.id}"]`) as HTMLButtonElement | null;
      if (runBtn) {
        runBtn.title = profilesEnabled ? `Run (${profileLabel(activeProfile)})` : 'Run';
        runBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          this.dispatch('run-workflow', { workflowId: wf.id, profileId: activeProfile });
          this.close();
        });
      }

      const profileSelectEl = item.querySelector(`[data-profile-select="${wf.id}"]`) as HTMLSelectElement | null;
      if (profileSelectEl) {
        profileSelectEl.addEventListener('change', (event) => {
          event.stopPropagation();
          const nextProfile = (profileSelectEl.value as ProfileId) ?? activeProfile;
          setActiveProfile(this.store, wf.id, nextProfile);
          this.markActiveProfile(wf.id, nextProfile);
        });
      }

      const openDetail = () => this.openDetail(wf);
      item.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('button,select,input,label')) return;
        openDetail();
      });
      item.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDetail();
        }
      });

      list.appendChild(item);
    }
  }

  private renderAutomationRows(list: HTMLElement, workflows: WorkflowDefinition[]){
    for (const wf of workflows){
      const prefs = getRunPrefs(this.store, wf.id);
      const triggers = resolveTriggerState(wf, prefs);
      const autoAvailable = triggers.auto.available;
      const autoEnabled = triggers.auto.enabled;
      const autoStatus = this.autoRunStatuses.get(wf.id);
      const outcome = this.workflowOutcomes.get(wf.id);
      const lastRunAt = outcome?.at ?? prefs.lastRun?.at;
      const lastRunText = lastRunAt ? new Date(lastRunAt).toLocaleTimeString() : 'Never run';
      const outcomeLabel = outcome ? outcome.status.toUpperCase() : (autoStatus?.status == 'error' ? 'ERROR' : autoStatus?.status == 'ran' ? 'OK' : '');
      const outcomeClass = outcome?.status ?? (autoStatus?.status == 'error' ? 'error' : autoStatus?.status == 'ran' ? 'ok' : '');
      const reason = this.formatAutoReason(autoStatus);
      const safeLabel = escapeHtml(wf.label);
      const safeDescription = escapeHtml(wf.description ?? '');
      const safeReason = escapeHtml(reason ?? '');
      const repeatBadge = triggers.repeat.enabled ? '<span class="cv-badge cv-badge-repeat">Repeat</span>' : '';
      const statusLabel = autoAvailable ? (autoEnabled ? 'Enabled' : 'Disabled') : 'Unavailable';
      const statusClass = autoAvailable && autoEnabled ? 'on' : 'off';

      const item = document.createElement('div');
      item.className = 'cv-item cv-item-automation';
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      item.dataset.automationRow = wf.id;
      item.innerHTML = `
        <div class="cv-item-main">
          <div class="cv-item-title">${safeLabel}</div>
          <div class="cv-item-desc">${safeDescription}</div>
          <div class="cv-status-line">
            <span class="cv-status-pill ${statusClass}">${statusLabel}</span>
            <span class="cv-status-meta">Last run: ${lastRunText}</span>
            ${outcomeLabel ? `<span class="cv-status-outcome ${outcomeClass}">${outcomeLabel}</span>` : ''}
            ${repeatBadge}
            ${reason ? `<span class="cv-status-reason">${safeReason}</span>` : ''}
          </div>
        </div>
        <div class="cv-item-actions">
          <label class="cv-switch cv-switch-compact" title="Enable automation">
            <input type="checkbox" data-auto-toggle="${wf.id}" ${autoEnabled ? 'checked' : ''} ${autoAvailable ? '' : 'disabled'}>
            <span class="cv-visually-hidden">Enable automation</span>
          </label>
        </div>
      `;

      const toggle = item.querySelector(`[data-auto-toggle="${wf.id}"]`) as HTMLInputElement | null;
      if (toggle) {
        toggle.addEventListener('change', (event) => {
          event.stopPropagation();
          const wantsEnable = toggle.checked;
          if (wantsEnable && !this.confirmAutoEnable(wf)) {
            toggle.checked = false;
            return;
          }
          const prev = prefs;
          const next = updateRunPrefs(this.store, wf.id, { auto: wantsEnable, repeat: wantsEnable ? prefs.repeat : false });
          if (!next.auto) toggle.checked = false;
          this.dispatch('run-prefs-updated', { workflowId: wf.id, prefs: next, prev });
          this.renderAutomations();
          this.renderActions();
          if (this.currentWorkflow?.id === wf.id) this.renderDetail();
        });
      }

      const openDetail = () => this.openDetail(wf);
      item.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('button,select,input,label')) return;
        openDetail();
      });
      item.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDetail();
        }
      });

      list.appendChild(item);
    }
  }

  private renderArchivedSection(items: WorkflowDefinition[], forceHide = false){
    const wrap = this.actionsArchivedWrap;
    const list = this.actionsArchivedList;
    if (!wrap || !list) return;
    const hiddenCount = this.hiddenWorkflowsCache.length;
    const toggle = this.shadow.getElementById('cv-archived-toggle');
    if (toggle) {
      toggle.textContent = `Archived (${hiddenCount})`;
    }
    if (!hiddenCount || forceHide) {
      wrap.hidden = true;
      list.innerHTML = '';
      return;
    }
    wrap.hidden = false;
    wrap.classList.toggle('open', this.menuState.showArchived);
    list.innerHTML = '';
    if (!this.menuState.showArchived) return;

    if (!items.length) {
      list.innerHTML = '<div class="cv-empty">No archived actions match your filters.</div>';
      return;
    }

    for (const wf of items){
      const prefs = getRunPrefs(this.store, wf.id);
      const badges = this.renderBadges(wf, prefs);
      const safeLabel = escapeHtml(wf.label);
      const safeDescription = escapeHtml(wf.description ?? '');
      const item = document.createElement('div');
      item.className = 'cv-archived-item';
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      item.dataset.archivedRow = wf.id;
      item.innerHTML = `
        <div class="cv-item-main">
          <div class="cv-item-title">${safeLabel}</div>
          <div class="cv-item-desc">${safeDescription}</div>
          ${badges ? `<div class="cv-badges">${badges}</div>` : ''}
        </div>
        <div class="cv-item-actions">
          <button type="button" class="cv-btn secondary" data-archived-unhide="${wf.id}">Show</button>
        </div>
      `;
      const unhideBtn = item.querySelector(`[data-archived-unhide="${wf.id}"]`) as HTMLButtonElement | null;
      if (unhideBtn) {
        unhideBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          this.setWorkflowHidden(wf, false);
        });
      }
      item.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('button,select,input,label')) return;
        this.openDetail(wf);
      });
      item.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.openDetail(wf);
        }
      });
      list.appendChild(item);
    }
  }

  private renderAutomations(){
    const list = this.automationsList;
    if (!list) return;
    list.innerHTML = '';

    const page = this.currentPage;
    if (!page){
      list.innerHTML = '<div class="cv-empty">No page detected yet</div>';
      return;
    }

    const workflows = this.getOrderedWorkflows(page);
    const automationTasks = workflows.filter(wf => {
      const prefs = getRunPrefs(this.store, wf.id);
      return prefs.auto || this.automationIntent(wf);
    });

    const filtered = this.applyFilters(automationTasks, 'automations');
    const sorted = this.applySort(filtered);
    const groups = this.splitByRelevance(sorted);
    const showGroups = this.shouldShowRelevanceGroups(groups);

    if (!sorted.length) {
      list.innerHTML = '<div class="cv-empty">No automations match your filters.</div>';
      return;
    }

    if (showGroups) {
      if (groups.relevant.length) {
        this.renderGroupHeader(list, 'Relevant to this page');
        this.renderAutomationRows(list, groups.relevant);
      }
      if (groups.other.length) {
        this.renderGroupHeader(list, 'All automations');
        this.renderAutomationRows(list, groups.other);
      }
    } else {
      this.renderAutomationRows(list, sorted);
    }
  }

  private renderDetail(){
    const detail = this.getDetailPane();
    if (!detail) return;
    if (this.menuState.section === 'settings') {
      detail.innerHTML = '';
      this.setDetailOpen(false);
      return;
    }

    const wf = this.currentWorkflow;
    if (!wf || (this.currentPage && !this.currentPage.workflows.some(w => w.id === wf.id))) {
      detail.innerHTML = '<div class="cv-empty">Select an item to see details.</div>';
      this.setDetailOpen(false);
      return;
    }

    this.setDetailOpen(true);
    const profilesEnabled = this.profilesEnabled(wf);
    const activeProfile = profilesEnabled ? getActiveProfile(this.store, wf.id) : 'p1';
    const runPrefs = getRunPrefs(this.store, wf.id);
    const triggers = resolveTriggerState(wf, runPrefs);
    const manualAvailable = triggers.manual.available;
    const autoAvailable = triggers.auto.available;
    const repeatAvailable = triggers.repeat.available;
    const outcome = this.workflowOutcomes.get(wf.id);
    const autoStatus = this.autoRunStatuses.get(wf.id);
    const lastRunAt = outcome?.at ?? runPrefs.lastRun?.at;
    const lastRunText = lastRunAt ? new Date(lastRunAt).toLocaleString() : 'Never run';
    const outcomeLabel = outcome ? outcome.status.toUpperCase() : (autoStatus?.status == 'error' ? 'ERROR' : autoStatus?.status == 'ran' ? 'OK' : '');
    const outcomeClass = outcome?.status ?? (autoStatus?.status == 'error' ? 'error' : autoStatus?.status == 'ran' ? 'ok' : '');
    const reason = this.formatAutoReason(autoStatus);
    const badges = this.renderBadges(wf, runPrefs);
    const risk = wf.riskLevel ?? 'safe';
    const safeLabel = escapeHtml(wf.label);
    const safeDescription = escapeHtml(wf.description ?? '');
    const safeReason = escapeHtml(reason ?? '');
    const safeRisk = escapeHtml(risk);

    const profilePills = profilesEnabled
      ? PROFILE_SLOTS.map(slot => {
          const activeClass = slot.id === activeProfile ? ' active' : '';
          const label = slot.label;
          return `<button class="cv-profile-pill${activeClass}" data-detail-profile="${slot.id}" aria-pressed="${slot.id === activeProfile ? 'true' : 'false'}">${label}</button>`;
        }).join('')
      : '';

    const actionIntent = this.isActionIntent(wf);

    const isSplit = this.container.classList.contains('cv-layout-split');
    detail.innerHTML = `
      <div class="cv-detail-header">
        <button class="cv-btn secondary cv-detail-close" data-detail-back title="Close details (Esc)">${isSplit ? '&times;' : '&larr; Back'}</button>
        <div class="cv-detail-header-content">
          <div class="cv-detail-title">${safeLabel}</div>
          <div class="cv-detail-desc">${safeDescription}</div>
          ${badges ? `<div class="cv-badges">${badges}</div>` : ''}
        </div>
      </div>
      <div class="cv-detail-actions">
        <button class="cv-btn" data-detail-run="${wf.id}" ${manualAvailable ? '' : 'disabled'}>Run now${profilesEnabled ? ` (${profileLabel(activeProfile)})` : ''}</button>
        ${profilesEnabled ? `<div class="cv-detail-profiles">${profilePills}</div>` : ''}
      </div>
      <div class="cv-detail-status">
        <span class="cv-status-pill ${autoAvailable && triggers.auto.enabled ? 'on' : 'off'}">${autoAvailable ? (triggers.auto.enabled ? 'Automation enabled' : 'Automation disabled') : 'Automation unavailable'}</span>
        <span class="cv-status-meta">Last run: ${lastRunText}</span>
        ${outcomeLabel ? `<span class="cv-status-outcome ${outcomeClass}">${outcomeLabel}</span>` : ''}
        ${reason ? `<span class="cv-status-reason">${safeReason}</span>` : ''}
      </div>
      <div class="cv-detail-section">
        <h4>Triggers</h4>
        <div class="cv-trigger-row">Manual: ${manualAvailable ? 'Available' : 'Disabled'}</div>
        <label class="cv-switch">
          <input type="checkbox" data-detail-auto="${wf.id}" ${triggers.auto.enabled ? 'checked' : ''} ${autoAvailable ? '' : 'disabled'}>
          <span>Auto</span>
        </label>
        <label class="cv-switch">
          <input type="checkbox" data-detail-repeat="${wf.id}" ${triggers.repeat.enabled ? 'checked' : ''} ${triggers.auto.enabled && repeatAvailable ? '' : 'disabled'}>
          <span>Repeat</span>
        </label>
        <div class="cv-hint">Risk: ${safeRisk}</div>
        ${autoAvailable ? '' : '<div class="cv-hint">Auto trigger disabled in task definition.</div>'}
        ${manualAvailable ? '' : '<div class="cv-hint">Manual trigger disabled in task definition.</div>'}
      </div>
      <div class="cv-detail-section">
        <h4>Profiles</h4>
        <div class="cv-hint">${profilesEnabled ? 'Active profile applies to manual runs and automations.' : 'Profiles disabled for this task.'}</div>
      </div>
      <div class="cv-detail-section">
        <h4>Options</h4>
        <div class="cv-options-wrap" data-options-wrap></div>
      </div>
      <div class="cv-detail-section">
        <h4>Selectors</h4>
        ${this.menuState.mode === 'developer'
          ? `<textarea class="cv-textarea" data-selector-json spellcheck="false"></textarea>
             <div class="cv-row right">
               <button class="cv-btn cv-test-selectors">Test Match</button>
               <button class="cv-btn" data-selector-save>Save (in-memory)</button>
             </div>`
          : '<div class="cv-hint">Switch to Developer mode to view and edit selectors.</div>'}
      </div>
      <div class="cv-detail-section">
        <h4>Visibility</h4>
        ${
          actionIntent
            ? `<label class="cv-switch">
                <input type="checkbox" data-detail-visible="${wf.id}" ${this.isHidden(wf.id) ? '' : 'checked'}>
                <span>Show in Actions</span>
               </label>`
            : '<div class="cv-hint">This task is marked as automation-only and does not appear in Actions.</div>'
        }
      </div>
      <div class="cv-detail-section">
        <h4>Logs</h4>
        <div class="cv-row">
          <button class="cv-btn secondary" data-detail-logs="${wf.id}">View logs for this task</button>
        </div>
      </div>
    `;

    const runBtn = detail.querySelector(`[data-detail-run="${wf.id}"]`) as HTMLButtonElement | null;
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        this.dispatch('run-workflow', { workflowId: wf.id, profileId: activeProfile });
        this.close();
      });
    }

    detail.querySelectorAll('[data-detail-profile]').forEach(btn => {
      const raw = (btn as HTMLElement).getAttribute('data-detail-profile');
      if (!raw) return;
      const profileId = raw as ProfileId;
      btn.addEventListener('click', () => {
        setActiveProfile(this.store, wf.id, profileId);
        this.markActiveProfile(wf.id, profileId);
      });
    });

    const autoToggle = detail.querySelector(`[data-detail-auto="${wf.id}"]`) as HTMLInputElement | null;
    const repeatToggle = detail.querySelector(`[data-detail-repeat="${wf.id}"]`) as HTMLInputElement | null;
    if (autoToggle) {
      autoToggle.disabled = !autoAvailable;
      autoToggle.addEventListener('change', () => {
        const wantsEnable = autoToggle.checked;
        if (wantsEnable && !this.confirmAutoEnable(wf)) {
          autoToggle.checked = false;
          return;
        }
        const prev = runPrefs;
        const next = updateRunPrefs(this.store, wf.id, { auto: wantsEnable, repeat: wantsEnable ? runPrefs.repeat : false });
        if ((!next.auto || !repeatAvailable) && repeatToggle) {
          repeatToggle.checked = false;
          repeatToggle.disabled = true;
        }
        this.dispatch('run-prefs-updated', { workflowId: wf.id, prefs: next, prev });
        this.renderDetail();
        this.renderAutomations();
        this.renderActions();
      });
    }
    if (repeatToggle) {
      repeatToggle.disabled = !triggers.auto.enabled || !repeatAvailable;
      repeatToggle.addEventListener('change', () => {
        const prev = runPrefs;
        const next = updateRunPrefs(this.store, wf.id, { repeat: repeatToggle.checked });
        repeatToggle.checked = next.repeat;
        this.dispatch('run-prefs-updated', { workflowId: wf.id, prefs: next, prev });
        this.renderDetail();
      });
    }

    const visibilityToggle = detail.querySelector(`[data-detail-visible="${wf.id}"]`) as HTMLInputElement | null;
    if (visibilityToggle) {
      visibilityToggle.addEventListener('change', () => {
        this.setWorkflowHidden(wf, !visibilityToggle.checked);
      });
    }

    const logsBtn = detail.querySelector(`[data-detail-logs="${wf.id}"]`) as HTMLButtonElement | null;
    if (logsBtn) {
      logsBtn.addEventListener('click', () => {
        this.openLogsForWorkflow(wf);
      });
    }

    this.renderOptions();
    if (this.menuState.mode === 'developer') {
      this.showSelectorEditor(wf);
    }
  }

  private renderSettings(){
    const settings = this.shadow.getElementById('cv-section-settings');
    if (settings) {
      settings.classList.toggle('active', this.menuState.section === 'settings');
    }
    const pageLabel = this.currentPage?.label ?? 'Unknown';
    const pageCount = this.currentPage?.workflows.filter(w => !(w as any).internal).length ?? 0;
    const pageEl = this.shadow.getElementById('cv-advanced-page');
    if (pageEl) pageEl.textContent = pageLabel;
    const countEl = this.shadow.getElementById('cv-advanced-count');
    if (countEl) countEl.textContent = String(pageCount);
    const urlEl = this.shadow.getElementById('cv-advanced-url');
    if (urlEl) {
      const href = typeof globalThis.location?.href === 'string' ? globalThis.location.href : 'Unknown';
      urlEl.textContent = href;
    }
  }

  private loadAdvancedJson(){
    const textarea = this.shadow.getElementById('cv-advanced-json') as HTMLTextAreaElement | null;
    if (!textarea) return;
    if (!this.currentPage) {
      textarea.value = '';
      alert('No page detected yet.');
      return;
    }
    textarea.value = JSON.stringify(this.currentPage.workflows, null, 2);
  }

  private copyAdvancedJson(){
    const textarea = this.shadow.getElementById('cv-advanced-json') as HTMLTextAreaElement | null;
    if (!textarea) return;
    navigator.clipboard.writeText(textarea.value).catch(err => console.error('copy JSON failed', err));
  }

  private applyAdvancedJson(){
    const textarea = this.shadow.getElementById('cv-advanced-json') as HTMLTextAreaElement | null;
    if (!textarea) return;
    if (!this.currentPage) {
      alert('No page detected yet.');
      return;
    }
    const raw = textarea.value.trim();
    if (!raw) {
      alert('Paste workflow JSON first.');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      let workflows: WorkflowDefinition[] | null = null;
      if (Array.isArray(parsed)) {
        workflows = parsed as WorkflowDefinition[];
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).workflows)) {
        workflows = (parsed as any).workflows as WorkflowDefinition[];
      }
      if (!workflows) {
        throw new Error('Expected an array of workflows or an object with a workflows array.');
      }
      this.currentPage.workflows = workflows;
      this.appendLog(`Updated workflows for ${this.currentPage.label} from JSON (in-memory).`);
      this.renderAll();
    } catch (err: any) {
      alert(`Invalid workflow JSON: ${err?.message ?? 'Unknown error'}`);
    }
  }

  private openDetail(wf: WorkflowDefinition){
    this.setCurrentWorkflow(wf);
    this.setDetailOpen(true);
  }

  private closeDetail(){
    this.setDetailOpen(false);
    this.setCurrentWorkflow(undefined);
  }

  private setDetailOpen(open: boolean){
    this.container.classList.toggle('cv-detail-open', open);
  }

  private updateLayoutMode(){
    const width = this.container?.getBoundingClientRect().width ?? 0;
    const split = width >= 640;
    this.container.classList.toggle('cv-layout-split', split);
  }

  private openLogsForWorkflow(wf: WorkflowDefinition){
    const filterInput = this.shadow.getElementById('cv-logs-filter') as HTMLInputElement | null;
    if (filterInput) {
      filterInput.value = wf.id;
      this.renderLogs(filterInput.value);
    }
    this.updateMenuState({ section: 'settings', settingsSection: 'logs' });
  }

  private canDragReorder(): boolean {
    return this.menuState.sort === 'custom' && this.menuState.filter === 'all' && this.menuState.search.trim().length === 0;
  }

  private applyFilters(workflows: WorkflowDefinition[], view: 'actions' | 'automations', options?: { includeHidden?: boolean }): WorkflowDefinition[] {
    const query = this.menuState.search.trim().toLowerCase();
    const filter = this.menuState.filter;
    return workflows.filter(wf => {
      if (query && !this.matchesSearch(wf, query)) return false;
      if (filter === 'hidden') return options?.includeHidden === true;
      return this.matchesFilter(wf, filter, view);
    });
  }

  private applySort(workflows: WorkflowDefinition[]): WorkflowDefinition[] {
    if (this.menuState.sort === 'custom') return workflows;
    const sorted = [...workflows];
    if (this.menuState.sort === 'alpha') {
      sorted.sort((a, b) => a.label.localeCompare(b.label));
    } else if (this.menuState.sort === 'last-run') {
      sorted.sort((a, b) => this.getLastRunTimestamp(b) - this.getLastRunTimestamp(a));
    }
    return sorted;
  }

  private matchesSearch(wf: WorkflowDefinition, query: string): boolean {
    if (!query) return true;
    const tags = Array.isArray((wf as any).tags) ? (wf as any).tags.join(' ') : '';
    const haystack = `${wf.label} ${(wf.description ?? '')} ${wf.id} ${tags}`.toLowerCase();
    return haystack.includes(query);
  }

  private matchesFilter(wf: WorkflowDefinition, filter: MenuFilter, view: 'actions' | 'automations'): boolean {
    const prefs = getRunPrefs(this.store, wf.id);
    switch (filter) {
      case 'auto':
        return prefs.auto;
      case 'options':
        return (wf.options?.length ?? 0) > 0;
      case 'errors':
        return this.hasError(wf);
      case 'relevant':
        return this.isRelevantToPage(wf);
      case 'hidden':
        return view === 'actions' ? this.isHidden(wf.id) : false;
      case 'all':
      default:
        return true;
    }
  }

  private isRelevantToPage(wf: WorkflowDefinition): boolean {
    if (wf.enabledWhen) {
      return this.matchesCondition(wf.enabledWhen);
    }
    const auto = resolveAutoRunConfig(wf);
    const selector = auto?.waitForSelector || auto?.waitForHiddenSelector || auto?.waitForInteractableSelector;
    if (selector) {
      return this.selectorMatches(selector);
    }
    return false;
  }

  private splitByRelevance(workflows: WorkflowDefinition[]): { relevant: WorkflowDefinition[]; other: WorkflowDefinition[] } {
    const relevant: WorkflowDefinition[] = [];
    const other: WorkflowDefinition[] = [];
    for (const wf of workflows) {
      if (this.isRelevantToPage(wf)) relevant.push(wf);
      else other.push(wf);
    }
    return { relevant, other };
  }

  private shouldShowRelevanceGroups(groups: { relevant: WorkflowDefinition[]; other: WorkflowDefinition[] }): boolean {
    if (this.menuState.filter !== 'all') return false;
    if (this.menuState.search.trim().length > 0) return false;
    return groups.relevant.length > 0 && groups.other.length > 0;
  }

  private renderGroupHeader(list: HTMLElement, label: string){
    const header = document.createElement('div');
    header.className = 'cv-group-title';
    header.textContent = label;
    header.setAttribute('role', 'heading');
    header.setAttribute('aria-level', '3');
    list.appendChild(header);
  }

  private isHidden(workflowId: string): boolean {
    return this.hiddenWorkflowsCache.some(w => w.id === workflowId);
  }

  private hasError(wf: WorkflowDefinition): boolean {
    const outcome = this.workflowOutcomes.get(wf.id);
    if (outcome?.status === 'error') return true;
    return this.autoRunStatuses.get(wf.id)?.status === 'error';
  }

  private getLastRunTimestamp(wf: WorkflowDefinition): number {
    const outcome = this.workflowOutcomes.get(wf.id);
    if (outcome?.at) return outcome.at;
    const prefs = getRunPrefs(this.store, wf.id);
    return prefs.lastRun?.at ?? 0;
  }

  private automationIntent(wf: WorkflowDefinition): boolean {
    const intent = (wf as any).intent;
    if (intent === 'automation' || intent === 'both') return true;
    return !!resolveAutoRunConfig(wf);
  }

  private isActionIntent(wf: WorkflowDefinition): boolean {
    const intent = (wf as any).intent;
    if (!isManualTriggerAvailable(wf)) return false;
    return intent !== 'automation';
  }

  private formatAutoReason(status?: AutoRunStatus): string {
    if (!status) return '';
    switch (status.status) {
      case 'disabled': return 'Disabled';
      case 'cooldown': return 'Cooldown';
      case 'busy': return 'Waiting for other workflow';
      case 'blocked': return 'Conditions not met';
      case 'waiting-ready': return 'Waiting for readiness';
      case 'ready-timeout': return 'Readiness timeout';
      case 'starting': return 'Starting';
      case 'error': return 'Last run failed';
      default: return status.message || '';
    }
  }

  private renderBadges(wf: WorkflowDefinition, prefs: WorkflowRunPrefs): string {
    const triggers = resolveTriggerState(wf, prefs);
    const badges: string[] = [];
    if (triggers.auto.enabled) badges.push('<span class="cv-badge cv-badge-auto">Auto</span>');
    if (triggers.repeat.enabled) badges.push('<span class="cv-badge cv-badge-repeat">Repeat</span>');
    if ((wf.options?.length ?? 0) > 0) badges.push('<span class="cv-badge cv-badge-options">Options</span>');
    if (this.menuState.mode === 'developer' && this.workflowHasSelectors(wf)) badges.push('<span class="cv-badge cv-badge-dev">Dev</span>');
    if (this.hasError(wf)) badges.push('<span class="cv-badge cv-badge-error">Error</span>');
    return badges.join('');
  }

  private renderProfileSelect(workflowId: string, activeProfile: ProfileId): string {
    const options = PROFILE_SLOTS.map(slot => {
      const selected = slot.id === activeProfile ? ' selected' : '';
      return `<option value="${slot.id}"${selected}>${slot.shortLabel}</option>`;
    }).join('');
    return `<select class="cv-input cv-select" data-profile-select="${workflowId}" aria-label="Profile">${options}</select>`;
  }

  private workflowHasSelectors(wf: WorkflowDefinition): boolean {
    if (wf.enabledWhen) return true;
    for (const step of wf.steps || []) {
      const s = step as any;
      if (s.target || s.list || s.item || s.waitForSelector || s.waitForHiddenSelector || s.waitForInteractableSelector) {
        return true;
      }
    }
    return false;
  }

  private matchesCondition(condition?: any): boolean {
    if (!condition) return true;
    const c = condition as any;
    if (c.exists) {
      return this.selectorMatches(c.exists);
    }
    if (c.notExists) {
      return !this.selectorMatches(c.notExists);
    }
    if (c.textPresent) {
      const where = c.textPresent.where;
      const matcher = c.textPresent.matcher;
      const el = findOne(where, { visibleOnly: true });
      if (!el) return false;
      const text = (el.textContent || '').trim();
      return this.matchText(text, matcher);
    }
    if (Array.isArray(c.any)) {
      return c.any.some((entry: any) => this.matchesCondition(entry));
    }
    if (Array.isArray(c.all)) {
      return c.all.every((entry: any) => this.matchesCondition(entry));
    }
    if (c.not) {
      return !this.matchesCondition(c.not);
    }
    return true;
  }

  private matchText(text: string, matcher: any): boolean {
    if (!matcher || typeof matcher !== 'object') return false;
    const normalized = matcher.trim === false ? text : text.trim();
    if (typeof matcher.equals === 'string') {
      return matcher.caseInsensitive ? normalized.toLowerCase() === matcher.equals.toLowerCase() : normalized === matcher.equals;
    }
    if (typeof matcher.includes === 'string') {
      return matcher.caseInsensitive ? normalized.toLowerCase().includes(matcher.includes.toLowerCase()) : normalized.includes(matcher.includes);
    }
    if (typeof matcher.regex === 'string') {
      try {
        const regex = new RegExp(matcher.regex, matcher.flags);
        return regex.test(normalized);
      } catch {
        return false;
      }
    }
    return false;
  }

  private selectorMatches(spec?: any): boolean {
    if (!spec) return true;
    try {
      const visibleOnly = spec.visible === true;
      return !!findOne(spec, { visibleOnly });
    } catch {
      return false;
    }
  }
  private announceWorkflowStatus(message: string){
    if (this.workflowAnnouncer) {
      this.workflowAnnouncer.textContent = message;
    }
  }

  private setWorkflowHidden(wf: WorkflowDefinition, hidden: boolean){
    const page = this.currentPage;
    if (!page) return;
    const preferences = this.ensureWorkflowPreferences(page);
    if (!preferences) return;
    const workflows = this.getAllDraggableWorkflows();
    if (!workflows.length) return;

    const partition = preferences.toggleHidden(workflows, wf.id, hidden);
    this.visibleWorkflowsCache = [...partition.ordered];
    this.hiddenWorkflowsCache = [...partition.hidden];
    if (!hidden) {
      this.focusAfterRenderWorkflowId = wf.id;
    }
    this.appendLog(hidden ? `Archived ${wf.label} from Actions.` : `Restored ${wf.label} to Actions.`);
    this.renderActions();
    this.renderDetail();
    this.announceWorkflowStatus(hidden ? `${wf.label} archived from Actions.` : `${wf.label} restored to Actions.`);
  }

  private focusWorkflowAfterRender(){
    if (!this.focusAfterRenderWorkflowId) return;
    const workflowId = this.focusAfterRenderWorkflowId;
    const runTarget = this.shadow.querySelector<HTMLButtonElement>(`[data-action-run="${workflowId}"]`);
    const rowTarget = this.shadow.querySelector<HTMLElement>(`[data-action-row="${workflowId}"]`);
    (runTarget ?? rowTarget)?.focus({ preventScroll: true });
    this.focusAfterRenderWorkflowId = null;
  }

  private confirmAutoEnable(wf: WorkflowDefinition): boolean {
    const risk = wf.riskLevel ?? 'safe';
    if (risk === 'safe') return true;
    const win: any = typeof window !== 'undefined' ? window : undefined;
    const confirmFn = typeof win?.confirm === 'function' ? win.confirm.bind(win) : null;
    if (!confirmFn) return false;
    const label = risk === 'danger' ? 'danger' : 'caution';
    return confirmFn(`Auto-run for "${wf.label}" is marked ${label}. Enable anyway?`);
  }

  private getDetailPane(): HTMLElement | null {
    if (this.menuState.section === 'actions') {
      return this.shadow.getElementById('cv-actions-detail') as HTMLElement | null;
    }
    if (this.menuState.section === 'automations') {
      return this.shadow.getElementById('cv-automations-detail') as HTMLElement | null;
    }
    return null;
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

  private getOrderedWorkflows(page: PageDefinition): WorkflowDefinition[] {
    const workflows = page.workflows.filter(w => !(w as any).internal);
    if (!workflows.length) return [];
    const prefs = this.ensureWorkflowPreferences(page);
    if (!prefs) return workflows;
    prefs.partition(workflows);
    const orderIds = prefs.getOrderIds();
    const byId = new Map(workflows.map(w => [w.id, w] as const));
    const ordered: WorkflowDefinition[] = [];
    for (const id of orderIds) {
      const wf = byId.get(id);
      if (wf) ordered.push(wf);
    }
    return ordered;
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
    const list = this.actionsList;
    if (!list) return;
    list.removeAttribute('data-drop-tail');
    list.querySelectorAll<HTMLElement>('[data-drop-target]').forEach(el => el.removeAttribute('data-drop-target'));
  }

  private showDropIndicator(detail: DragReorderDetail){
    const list = this.actionsList;
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
    const list = this.actionsList;
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
      this.renderActions();
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
    if (this.currentWorkflow?.id === workflowId) {
      this.optionsProfileId = profileId;
    }
    this.renderActions();
    this.renderDetail();
  }

  private profileValuesFor(wf: WorkflowDefinition, profileId: ProfileId): Record<string, any> {
    return getProfileValues(this.store, wf.id, profileId);
  }

  private renderOptions(){
    const detail = this.getDetailPane();
    const wrap = detail?.querySelector<HTMLElement>('[data-options-wrap]');
    if (!wrap) return;
    wrap.innerHTML = '';
    const wf = this.currentWorkflow;
    if (!wf || wf.internal) {
      wrap.innerHTML = '<div class="cv-empty">Select a task to view options.</div>';
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
      this.renderActions();
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
        input.className = 'cv-input';
        (input as HTMLInputElement).type = 'number';
        (input as HTMLInputElement).value = String(value ?? '');
        break;
      case 'select':
        input = document.createElement('select');
        input.className = 'cv-input cv-select';
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
        input.className = 'cv-input';
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
    const detail = this.getDetailPane();
    const ta = detail?.querySelector<HTMLTextAreaElement>('[data-selector-json]');
    if (!ta) return;
    ta.value = JSON.stringify(wf, null, 2);
    const saveBtn = detail?.querySelector<HTMLButtonElement>('[data-selector-save]');
    if (!saveBtn) return;
    saveBtn.onclick = () => {
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
      <div class="cv-title-row">
        <div class="cv-title">Carvana Automations</div>
        <div class="cv-mode-toggle" role="group" aria-label="Mode">
          <button class="cv-mode-btn" data-mode="operator" type="button">Operator</button>
          <button class="cv-mode-btn" data-mode="developer" type="button">Developer</button>
        </div>
      </div>
      <div class="cv-header-controls">
        <label class="cv-visually-hidden" for="cv-search">Search</label>
        <input id="cv-search" class="cv-input cv-search" type="search" placeholder="Search actions or automations" autocomplete="off" spellcheck="false">
      </div>
      <div class="cv-tabs cv-primary-tabs" role="tablist">
        <button class="cv-tab" data-section="actions" role="tab">Actions</button>
        <button class="cv-tab" data-section="automations" role="tab">Automations</button>
        <button class="cv-tab" data-section="settings" role="tab">Settings</button>
      </div>
    </div>
    <div class="cv-body">
      <div class="cv-section" data-section-id="actions">
        <div id="cv-list-announcer" class="cv-visually-hidden" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="cv-section-toolbar">
          <div class="cv-filters" data-view="actions">
            <button class="cv-chip" data-filter="all">All</button>
            <button class="cv-chip" data-filter="auto">Auto enabled</button>
            <button class="cv-chip" data-filter="options">Has options</button>
            <button class="cv-chip" data-filter="errors">Has errors</button>
            <button class="cv-chip" data-filter="hidden">Archived</button>
            <button class="cv-chip" data-filter="relevant">Relevant</button>
          </div>
          <div class="cv-sort">
            <label class="cv-visually-hidden" for="cv-actions-sort">Sort</label>
            <select id="cv-actions-sort" class="cv-input cv-select" data-sort>
              <option value="custom">Custom</option>
              <option value="alpha">A-Z</option>
              <option value="last-run">Last run</option>
            </select>
          </div>
        </div>
        <div class="cv-layout">
          <div class="cv-list-pane">
            <div id="cv-actions-list"></div>
            <div id="cv-actions-archived" class="cv-archived">
              <button id="cv-archived-toggle" class="cv-archived-toggle" type="button">Archived (0)</button>
              <div id="cv-actions-archived-list" class="cv-archived-list"></div>
            </div>
          </div>
          <div id="cv-actions-detail" class="cv-detail-pane"></div>
        </div>
      </div>
      <div class="cv-section" data-section-id="automations">
        <div class="cv-section-toolbar">
          <div class="cv-filters" data-view="automations">
            <button class="cv-chip" data-filter="all">All</button>
            <button class="cv-chip" data-filter="auto">Auto enabled</button>
            <button class="cv-chip" data-filter="options">Has options</button>
            <button class="cv-chip" data-filter="errors">Has errors</button>
            <button class="cv-chip" data-filter="relevant">Relevant</button>
          </div>
          <div class="cv-sort">
            <label class="cv-visually-hidden" for="cv-automations-sort">Sort</label>
            <select id="cv-automations-sort" class="cv-input cv-select" data-sort>
              <option value="custom">Custom</option>
              <option value="alpha">A-Z</option>
              <option value="last-run">Last run</option>
            </select>
          </div>
        </div>
        <div class="cv-layout">
          <div class="cv-list-pane">
            <div id="cv-automations-list"></div>
          </div>
          <div id="cv-automations-detail" class="cv-detail-pane"></div>
        </div>
      </div>
      <div class="cv-section" data-section-id="settings" id="cv-section-settings">
        <div class="cv-settings-nav" role="tablist">
          <button class="cv-tab" data-settings-tab="theme" role="tab">Theme</button>
          <button class="cv-tab" data-settings-tab="storage" role="tab">Storage</button>
          <button class="cv-tab" data-settings-tab="logs" role="tab">Logs</button>
          <button class="cv-tab" data-settings-tab="advanced" role="tab">Advanced</button>
        </div>
        <div class="cv-settings-body">
          <div id="cv-settings-theme" class="cv-settings-panel" data-settings-panel="theme">
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
          <div id="cv-settings-storage" class="cv-settings-panel" data-settings-panel="storage">
            <div class="cv-row">
              <button id="cv-export" class="cv-btn">Export Config to Clipboard</button>
              <button id="cv-import" class="cv-btn">Import Config</button>
            </div>
          </div>
          <div id="cv-settings-logs" class="cv-settings-panel" data-settings-panel="logs">
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
          <div id="cv-settings-advanced" class="cv-settings-panel" data-settings-panel="advanced">
            <div class="cv-row">
              <div class="cv-hint">Developer tools and diagnostics.</div>
            </div>
            <div class="cv-advanced-grid">
              <div class="cv-advanced-card">
                <div class="cv-advanced-title">Current page</div>
                <div id="cv-advanced-page" class="cv-advanced-value">Unknown</div>
              </div>
              <div class="cv-advanced-card">
                <div class="cv-advanced-title">Tasks detected</div>
                <div id="cv-advanced-count" class="cv-advanced-value">0</div>
              </div>
              <div class="cv-advanced-card">
                <div class="cv-advanced-title">Current URL</div>
                <div id="cv-advanced-url" class="cv-advanced-value">Unknown</div>
              </div>
            </div>
            <div class="cv-detail-section">
              <h4>Task JSON</h4>
              <div class="cv-row gap">
                <button id="cv-advanced-load" class="cv-btn secondary">Load current page</button>
                <button id="cv-advanced-copy" class="cv-btn secondary">Copy JSON</button>
                <button id="cv-advanced-apply" class="cv-btn">Apply JSON</button>
              </div>
              <textarea id="cv-advanced-json" class="cv-textarea cv-advanced-json" spellcheck="false"></textarea>
              <div class="cv-hint">Edit workflows for the current page. Changes are in-memory only.</div>
            </div>
            <div class="cv-hint">Selector editor is available inside each task detail (Developer mode).</div>
          </div>
        </div>
      </div>
    </div>
    `;
  }

  private css(){
    return `
      :host { all: initial; }

      /* Floating Action Button - Modern gear icon */
      .cv-gear{
        position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
        width: 52px; height: 52px; border: none; cursor: pointer;
        border-radius: 16px;
        background: linear-gradient(135deg, var(--cv-primary) 0%, color-mix(in srgb, var(--cv-primary) 80%, #000) 100%);
        color: var(--cv-text);
        box-shadow: 0 4px 20px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.08) inset;
        transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease;
        font-size: 22px;
        display: flex; align-items: center; justify-content: center;
      }
      .cv-gear:hover{
        transform: scale(1.08) rotate(15deg);
        box-shadow: 0 8px 28px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.12) inset;
      }
      .cv-gear:active{ transform: scale(.95); }

      /* Main Panel - Card-based floating design */
      .cv-panel{
        position: fixed; bottom: 84px; right: 20px;
        width: min(94vw, 680px); max-height: 75vh; overflow: hidden;
        display: flex; flex-direction: column;
        background: var(--cv-panel-bg, var(--cv-bg));
        color: var(--cv-text);
        border: 1px solid rgba(255,255,255,.06);
        border-radius: 20px;
        box-shadow: 0 25px 60px -20px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04) inset;
        backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        transform: translateY(16px) scale(.97); opacity: 0; pointer-events: none;
        transition: transform .28s cubic-bezier(.22,1,.36,1), opacity .22s ease;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, 'Helvetica Neue', Arial, sans-serif;
        z-index: 2147483647;
        font-size: 14px;
        line-height: 1.5;
      }
      .cv-panel.open{ transform: translateY(0) scale(1); opacity: 1; pointer-events: all; }

      /* Header - Clean minimal design */
      .cv-header{
        flex-shrink: 0;
        display: flex; flex-direction: column; gap: 14px;
        padding: 18px 20px 16px;
        background: linear-gradient(180deg, rgba(255,255,255,.04) 0%, transparent 100%);
        border-bottom: 1px solid rgba(255,255,255,.06);
      }
      .cv-title-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; }
      .cv-title{
        font-weight: 700; letter-spacing: -.2px; font-size: 18px;
        background: linear-gradient(135deg, var(--cv-text), rgba(255,255,255,.7));
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      /* Mode Toggle - Pill style */
      .cv-mode-toggle{
        display: flex; gap: 2px;
        background: rgba(255,255,255,.06);
        border-radius: 10px; padding: 3px;
      }
      .cv-mode-btn{
        background: transparent; color: var(--cv-text); border: none;
        padding: 6px 14px; cursor: pointer; font-size: 12px; font-weight: 500;
        border-radius: 8px;
        transition: all .2s ease;
        opacity: .65;
      }
      .cv-mode-btn:hover{ opacity: .9; }
      .cv-mode-btn.active{
        background: rgba(255,255,255,.1);
        color: var(--cv-accent);
        opacity: 1;
        box-shadow: 0 2px 8px rgba(0,0,0,.15);
      }

      .cv-header-controls{ display:flex; gap:10px; width:100%; }
      .cv-search{ flex:1; font-size: 13px; }

      /* Primary Tabs - Segmented control style */
      .cv-tabs{ display:flex; gap:4px; width:100%; }
      .cv-primary-tabs{
        background: rgba(255,255,255,.04);
        border-radius: 12px; padding: 4px;
      }
      .cv-tab{
        position:relative; flex: 1;
        background: transparent; color: var(--cv-text);
        border: none; padding: 10px 16px;
        border-radius: 10px; cursor: pointer;
        font-weight: 500; font-size: 13px;
        white-space: nowrap;
        transition: all .2s ease;
        opacity: .6;
      }
      .cv-tab:hover{ opacity: .85; background: rgba(255,255,255,.04); }
      .cv-tab.active{
        opacity: 1;
        background: rgba(255,255,255,.1);
        color: var(--cv-accent);
        box-shadow: 0 2px 12px rgba(0,0,0,.12);
      }

      /* Body content - fills remaining space, children scroll */
      .cv-body{ flex: 1 1 auto; min-height: 0; padding: 16px 20px 20px; overflow: hidden; display: flex; flex-direction: column; }
      .cv-section{ display:none; }
      .cv-section.active{ display:flex; flex-direction: column; flex: 1 1 auto; animation: cv-fade-in .25s ease; min-height: 0; overflow: hidden; }
      .cv-section-toolbar{ flex-shrink: 0; }
      @keyframes cv-fade-in{ from{ opacity: 0; transform: translateY(6px); } to{ opacity: 1; transform: translateY(0); } }

      /* Section Toolbar */
      .cv-section-toolbar{
        display: flex; align-items: stretch;
        gap: 10px; margin-bottom: 16px;
        padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,.05);
      }

      /* Filter Chips - Segmented control style */
      .cv-filters{
        display: flex; gap: 6px;
        flex-wrap: wrap;
        align-items: center;
        background: rgba(255,255,255,.04);
        border-radius: 10px; padding: 4px;
        flex: 1 1 0;
        width: 100%;
        min-width: 0;
      }
      .cv-chip{
        background: transparent; color: var(--cv-text);
        border: none;
        border-radius: 8px; padding: 6px 10px;
        font-size: 12px; font-weight: 500;
        cursor: pointer;
        transition: all .18s ease;
        opacity: .55;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 0 1 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        min-width: max-content;
      }
      .cv-chip:hover{ opacity: .85; background: rgba(255,255,255,.06); }
      .cv-chip.active{
        color: var(--cv-accent);
        background: rgba(255,255,255,.1);
        opacity: 1;
        box-shadow: 0 1px 4px rgba(0,0,0,.12);
      }
      .cv-sort{
        flex: 0 0 auto;
        display: flex; align-items: center;
      }

      /* Layout Grid - flex-based for proper height distribution */
      .cv-layout{ display:flex; gap:16px; flex: 1 1 auto; min-height: 0; overflow: hidden; }
      .cv-list-pane{ flex: 1 1 50%; min-width: 0; min-height: 0; display:flex; flex-direction:column; gap:10px; overflow-y: auto; padding-bottom: 16px; }
      .cv-panel.cv-layout-split.cv-detail-open .cv-list-pane{ flex: 0 0 50%; }
      #cv-actions-list, #cv-automations-list{ display:flex; flex-direction:column; gap:10px; }

      /* Detail Pane - Card style with internal scroll */
      .cv-detail-pane{
        display:none;
        flex: 1 1 50%;
        min-width: 0;
        min-height: 0;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 16px; padding: 18px;
        padding-bottom: 32px;
        background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01));
        box-shadow: 0 4px 20px rgba(0,0,0,.1) inset;
        overflow-y: auto;
      }
      .cv-panel.cv-layout-split.cv-detail-open .cv-detail-pane{ display:block; }
      .cv-panel.cv-detail-open .cv-detail-pane{ display:block; }
      .cv-panel.cv-detail-open:not(.cv-layout-split) .cv-list-pane{ display:none; }
      .cv-panel:not(.cv-detail-open) .cv-detail-pane{ display:none; }

      /* Detail Header */
      .cv-detail-header{ display:flex; flex-direction:column; gap:8px; margin-bottom:16px; flex-shrink: 0; }
      .cv-detail-close{
        align-self: flex-start;
        padding: 6px 12px; font-size: 13px;
        min-width: 0; margin-bottom: 4px;
      }
      .cv-panel.cv-layout-split .cv-detail-header{
        flex-direction: row; align-items: flex-start; gap: 12px;
      }
      .cv-panel.cv-layout-split .cv-detail-header-content{
        flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px;
      }
      .cv-panel.cv-layout-split .cv-detail-close{
        flex-shrink: 0; order: 2;
        padding: 4px 12px; font-size: 16px; font-weight: 400;
        line-height: 1; border-radius: 8px;
      }
      .cv-detail-pane{ position: relative; }
      .cv-detail-title{ font-weight: 700; font-size: 17px; letter-spacing: -.2px; }
      .cv-detail-desc{ font-size: 13px; opacity: .7; line-height: 1.5; }
      .cv-detail-actions{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
      .cv-detail-profiles{ display:flex; gap:8px; flex-wrap:wrap; }
      .cv-detail-status{ display:flex; gap:8px; flex-wrap:wrap; font-size: 12px; opacity: .9; margin-bottom:16px; }

      /* Detail Sections */
      .cv-detail-section{
        border-top: 1px solid rgba(255,255,255,.06);
        padding-top: 16px; margin-top: 16px;
        display:flex; flex-direction:column; gap:10px;
      }
      .cv-detail-section h4{
        margin: 0; font-size: 11px;
        text-transform: uppercase; letter-spacing: 1px;
        opacity: .5; font-weight: 600;
      }

      /* Workflow Item Cards */
      .cv-item{
        position:relative;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 14px; padding: 14px 16px;
        background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01));
        transition: all .2s ease;
        display:flex; flex-direction:column; gap:10px;
        cursor: pointer;
      }
      .cv-item:hover{
        border-color: rgba(255,255,255,.15);
        background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
        transform: translateY(-1px);
        box-shadow: 0 8px 24px rgba(0,0,0,.12);
      }
      .cv-item[data-drop-target]{ border-color: var(--cv-accent); }
      .cv-item[data-drop-target]::after{
        content:''; position:absolute; left:16px; right:16px; height:3px; border-radius:999px;
        background: var(--cv-accent); opacity:.85;
      }
      .cv-item[data-drop-target="before"]::after{ top:-7px; }
      .cv-item[data-drop-target="after"]::after{ bottom:-7px; }
      .cv-item:focus-visible{ outline: 2px solid var(--cv-accent); outline-offset: 2px; }
      .cv-item-row{ display:flex; gap:12px; align-items: flex-start; }
      .cv-item-main{ flex:1; min-width:0; display:flex; flex-direction:column; gap:6px; }
      .cv-item-title{ font-weight: 600; font-size: 14px; letter-spacing: -.1px; }
      .cv-item-desc{ font-size: 12px; opacity: .6; line-height: 1.45; }
      .cv-item-actions{ display:flex; gap:10px; justify-content:flex-end; align-items:center; flex-wrap:wrap; }
      .cv-item-automation{ flex-direction:row; align-items:flex-start; justify-content:space-between; }
      .cv-item-automation .cv-item-actions{ margin-left:auto; }

      /* Badges - Refined pill style */
      .cv-badges{ display:flex; flex-wrap:wrap; gap:6px; margin-top: 2px; }
      .cv-badge{
        display:inline-flex; align-items:center;
        padding: 3px 10px; border-radius: 8px;
        font-size: 10px; font-weight: 600;
        letter-spacing: .5px; text-transform: uppercase;
        background: rgba(255,255,255,.08); color: var(--cv-text);
      }
      .cv-badge-auto{ background: color-mix(in srgb, var(--cv-primary) 30%, transparent); color: #cfeff5; }
      .cv-badge-repeat{ background: rgba(255,189,89,.18); color: #ffe3b8; }
      .cv-badge-options{ background: rgba(255,255,255,.1); }
      .cv-badge-dev{ background: rgba(255,255,255,.15); color: var(--cv-accent); }
      .cv-badge-error{ background: rgba(255,95,95,.18); color: #ffb6b6; }

      /* Status indicators */
      .cv-status-line{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; font-size: 12px; }
      .cv-status-pill{ padding: 4px 12px; border-radius: 8px; font-weight: 600; background: rgba(255,255,255,.08); }
      .cv-status-pill.on{ background: rgba(41,162,121,.25); color: #bff3d8; }
      .cv-status-pill.off{ background: rgba(255,255,255,.06); color: var(--cv-text); opacity: .7; }
      .cv-status-outcome{ padding: 3px 8px; border-radius: 6px; font-weight: 600; }
      .cv-status-outcome.ok{ background: rgba(76,175,80,.18); color:#c8f0c8; }
      .cv-status-outcome.error{ background: rgba(255,95,95,.18); color:#ffb6b6; }
      .cv-status-reason{ opacity: .6; font-size: 11px; }
      .cv-status-meta{ opacity: .5; }

      /* Group titles */
      .cv-group-title{
        font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
        opacity: .45; margin: 8px 4px 4px; font-weight: 600;
      }

      /* Archived section */
      .cv-archived{ border-top: 1px dashed rgba(255,255,255,.1); padding-top: 12px; margin-top: 8px; display:flex; flex-direction:column; gap:10px; }
      .cv-archived-toggle{
        background: transparent; border: 1px solid rgba(255,255,255,.15);
        color: var(--cv-text); border-radius: 10px; padding: 8px 14px;
        cursor: pointer; align-self: flex-start;
        font-size: 12px; font-weight: 500; opacity: .7;
        transition: all .18s ease;
      }
      .cv-archived-toggle:hover{ opacity: 1; border-color: rgba(255,255,255,.25); }
      .cv-archived-list{ display:flex; flex-direction:column; gap:10px; }
      .cv-archived.open .cv-archived-list{ display:flex; }
      .cv-archived-item{
        border: 1px solid rgba(255,255,255,.08); border-radius: 12px;
        padding: 12px 14px; background: rgba(255,255,255,.02);
        display:flex; justify-content:space-between; gap:12px;
      }

      /* Drag handle */
      .cv-drag-handle{
        background: rgba(255,255,255,.04); border: 1px solid transparent;
        color: var(--cv-text); border-radius: 8px;
        width: 28px; height: 28px; min-width: 28px;
        display:flex; align-items:center; justify-content:center;
        cursor: grab; transition: all .18s ease; opacity: .4;
        font-size: 11px;
      }
      .cv-drag-handle:hover{ border-color: rgba(255,255,255,.15); background: rgba(255,255,255,.08); opacity: .7; }
      .cv-drag-handle:active{ cursor: grabbing; transform: scale(.94); }

      /* Profile pills */
      .cv-profile-pill{
        background: rgba(255,255,255,.04); color: var(--cv-text);
        border: 1px solid rgba(255,255,255,.12);
        padding: 6px 14px; border-radius: 10px;
        cursor: pointer; font-size: 12px; font-weight: 500;
        transition: all .18s ease;
      }
      .cv-profile-pill:hover{ border-color: rgba(255,255,255,.2); }
      .cv-profile-pill.active{
        background: color-mix(in srgb, var(--cv-accent) 15%, transparent);
        border-color: var(--cv-accent); color: var(--cv-accent);
      }

      /* Settings Navigation - Segmented control style */
      .cv-settings-nav{
        display: flex; gap: 2px;
        background: rgba(255,255,255,.04);
        border-radius: 10px; padding: 3px;
        margin-bottom: 16px;
      }
      .cv-settings-nav .cv-tab{
        flex: 1 1 0;
        padding: 9px 12px;
        border-radius: 8px;
        font-size: 13px;
        text-align: center;
        min-width: 0;
      }
      .cv-settings-panel{ display:none; }
      .cv-settings-panel.active{ display:block; animation: cv-fade-in .25s ease; }

      /* Advanced cards grid */
      .cv-advanced-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom: 16px; }
      .cv-advanced-card{
        border: 1px solid rgba(255,255,255,.08); border-radius: 12px;
        padding: 14px; background: rgba(255,255,255,.03);
      }
      .cv-advanced-title{ font-size: 10px; opacity: .5; text-transform: uppercase; letter-spacing: .8px; font-weight: 600; }
      .cv-advanced-value{ font-weight: 600; margin-top: 6px; word-break: break-all; font-size: 13px; }

      /* Form rows */
      .cv-row{ display:flex; gap:12px; align-items:center; margin: 10px 0; flex-wrap: wrap; }
      .cv-row.gap{ gap:8px; }
      .cv-row.right{ justify-content:flex-end; }
      .cv-row.between{ justify-content:space-between; }

      /* Textarea */
      .cv-textarea{
        width: 100%; min-height: 180px;
        background: rgba(0,0,0,.25);
        color: var(--cv-text);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px; padding: 12px 14px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px; line-height: 1.5;
        resize: vertical;
        transition: border-color .18s ease;
      }
      .cv-textarea:focus{ border-color: var(--cv-accent); outline: none; }
      .cv-advanced-json{ min-height: 140px; }

      /* Buttons - Modern filled style */
      .cv-btn{
        background: linear-gradient(135deg, var(--cv-primary) 0%, color-mix(in srgb, var(--cv-primary) 80%, #000) 100%);
        color: var(--cv-text); border: none;
        padding: 9px 18px; border-radius: 10px;
        cursor: pointer; font-weight: 600; font-size: 13px;
        transition: all .2s ease;
        box-shadow: 0 2px 10px rgba(0,0,0,.15);
      }
      .cv-btn:hover{
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0,0,0,.2);
        filter: brightness(1.1);
      }
      .cv-btn:active{ transform: translateY(0); }
      .cv-btn:disabled{ opacity: .4; cursor: not-allowed; transform: none; filter: none; }
      .cv-btn.secondary{
        background: transparent;
        border: 1px solid rgba(255,255,255,.15);
        color: var(--cv-text);
        box-shadow: none;
      }
      .cv-btn.secondary:hover{
        border-color: var(--cv-accent); color: var(--cv-accent);
        background: color-mix(in srgb, var(--cv-accent) 8%, transparent);
        transform: translateY(-1px);
      }
      .cv-btn:focus-visible,
      .cv-tab:focus-visible,
      .cv-mode-btn:focus-visible,
      .cv-chip:focus-visible,
      .cv-profile-pill:focus-visible,
      .cv-archived-toggle:focus-visible{
        outline: 2px solid var(--cv-accent);
        outline-offset: 2px;
      }

      /* Input fields */
      .cv-input{
        background: rgba(0,0,0,.2);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 10px; padding: 9px 14px;
        color: var(--cv-text); font-size: 13px;
        min-width: 120px;
        transition: border-color .18s ease, background .18s ease;
      }
      .cv-input:focus{ border-color: var(--cv-accent); background: rgba(0,0,0,.3); outline: none; }
      .cv-input::placeholder{ color: rgba(255,255,255,.35); }

      /* Select dropdowns - Modern custom styling */
      select.cv-select,
      .cv-select{
        appearance: none !important;
        -webkit-appearance: none !important;
        -moz-appearance: none !important;
        background-color: rgba(0,0,0,.2);
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23f5f7fb' fill-opacity='0.6' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        padding-right: 36px;
        cursor: pointer;
        min-width: 90px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 10px;
        padding: 9px 36px 9px 14px;
        color: var(--cv-text);
        font-size: 13px;
      }
      select.cv-select:hover,
      .cv-select:hover{
        border-color: rgba(255,255,255,.2);
        background-color: rgba(0,0,0,.25);
      }
      select.cv-select:focus,
      .cv-select:focus{
        border-color: var(--cv-accent);
        background-color: rgba(0,0,0,.3);
        outline: none;
      }
      select.cv-select option,
      .cv-select option{
        background: #1a1b1f;
        color: var(--cv-text);
        padding: 10px 14px;
      }
      select.cv-select option:checked,
      .cv-select option:checked{
        background: linear-gradient(135deg, var(--cv-primary), color-mix(in srgb, var(--cv-primary) 70%, #000));
      }

      /* Empty state */
      .cv-empty{ opacity: .5; padding: 20px 12px; text-align: center; font-size: 13px; }

      /* Toggle Switch - Modern style */
      .cv-switch{ display:inline-flex; align-items:center; gap:10px; font-size: 13px; color: rgba(255,255,255,.8); cursor: pointer; }
      .cv-switch input{
        position:relative; width: 40px; height: 22px;
        border-radius: 999px; appearance: none; -webkit-appearance: none;
        background: rgba(255,255,255,.12); outline: none;
        cursor: pointer; transition: background .2s ease;
      }
      .cv-switch input::after{
        content:''; position:absolute; top: 3px; left: 3px;
        width: 16px; height: 16px; border-radius: 50%;
        background: var(--cv-text);
        box-shadow: 0 2px 6px rgba(0,0,0,.2);
        transition: transform .2s cubic-bezier(.34,1.56,.64,1);
      }
      .cv-switch input:checked{ background: var(--cv-primary); }
      .cv-switch input:checked::after{ transform: translateX(18px); }
      .cv-switch input:focus-visible{ box-shadow: 0 0 0 3px color-mix(in srgb, var(--cv-accent) 40%, transparent); }
      .cv-switch input:disabled{ opacity: .35; cursor: not-allowed; }
      .cv-switch-compact span{ display:none; }

      /* Hint text */
      .cv-hint{ font-size: 12px; opacity: .55; margin: 6px 0 10px; line-height: 1.5; }

      /* Theme settings grid */
      .cv-theme-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:16px; align-items:end; }
      .cv-theme-grid label{ display:flex; flex-direction:column; gap:8px; font-size: 12px; color: var(--cv-text); font-weight: 500; }
      .cv-theme-grid input[type="color"]{
        width:100%; min-width: 100px; height: 42px;
        border: 1px solid rgba(255,255,255,.15); border-radius: 10px;
        background: transparent; padding: 4px; cursor: pointer;
        transition: border-color .18s ease, box-shadow .18s ease;
      }
      .cv-theme-grid input[type="color"]:hover{
        border-color: rgba(255,255,255,.25);
      }
      .cv-theme-grid input[type="color"]:focus{
        border-color: var(--cv-accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--cv-accent) 20%, transparent);
        outline: none;
      }
      .cv-theme-grid input[type="color"]::-webkit-color-swatch-wrapper{ padding: 0; }
      .cv-theme-grid input[type="color"]::-webkit-color-swatch{
        border: none; border-radius: 6px;
      }
      .cv-theme-grid input[type="color"]::-moz-color-swatch{
        border: none; border-radius: 6px;
      }
      .cv-opacity{ display:flex; align-items:center; gap:12px; color: var(--cv-text); font-size: 13px; grid-column: span 2; }
      .cv-opacity input[type="range"]{ flex:1; min-width: 120px; }
      .cv-opacity span:first-child{ font-weight: 500; }
      .cv-opacity span:last-child{ min-width: 44px; text-align: right; opacity: .7; font-weight: 500; }
      .cv-theme-actions{ display:flex; gap:12px; align-items:center; grid-column: span 2; margin-top: 8px; }

      /* Range slider - Modern custom styling */
      input[type="range"]{
        -webkit-appearance: none; appearance: none;
        background: transparent; cursor: pointer;
        height: 20px;
      }
      input[type="range"]::-webkit-slider-runnable-track{
        height: 6px; border-radius: 3px;
        background: rgba(255,255,255,.12);
      }
      input[type="range"]::-webkit-slider-thumb{
        -webkit-appearance: none; appearance: none;
        width: 18px; height: 18px; border-radius: 50%;
        background: var(--cv-accent);
        border: 2px solid rgba(255,255,255,.9);
        margin-top: -6px;
        box-shadow: 0 2px 6px rgba(0,0,0,.3);
        transition: transform .15s ease, box-shadow .15s ease;
      }
      input[type="range"]::-webkit-slider-thumb:hover{
        transform: scale(1.1);
        box-shadow: 0 3px 10px rgba(0,0,0,.4);
      }
      input[type="range"]::-moz-range-track{
        height: 6px; border-radius: 3px;
        background: rgba(255,255,255,.12);
      }
      input[type="range"]::-moz-range-thumb{
        width: 18px; height: 18px; border-radius: 50%;
        background: var(--cv-accent);
        border: 2px solid rgba(255,255,255,.9);
        box-shadow: 0 2px 6px rgba(0,0,0,.3);
        transition: transform .15s ease, box-shadow .15s ease;
      }
      input[type="range"]::-moz-range-thumb:hover{
        transform: scale(1.1);
        box-shadow: 0 3px 10px rgba(0,0,0,.4);
      }
      input[type="range"]:focus{ outline: none; }
      input[type="range"]:focus::-webkit-slider-thumb{
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--cv-accent) 30%, transparent), 0 2px 6px rgba(0,0,0,.3);
      }
      input[type="range"]:focus::-moz-range-thumb{
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--cv-accent) 30%, transparent), 0 2px 6px rgba(0,0,0,.3);
      }

      /* Screen reader only */
      .cv-visually-hidden{ position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce){
        .cv-panel, .cv-tab, .cv-item, .cv-drag-handle, .cv-btn, .cv-gear{
          transition-duration: 0ms !important;
          animation-duration: 0ms !important;
        }
      }

      /* Custom Scrollbars - Modern thin style */
      .cv-list-pane::-webkit-scrollbar,
      .cv-detail-pane::-webkit-scrollbar{
        width: 6px;
      }
      .cv-list-pane::-webkit-scrollbar-track,
      .cv-detail-pane::-webkit-scrollbar-track{
        background: transparent;
      }
      .cv-list-pane::-webkit-scrollbar-thumb,
      .cv-detail-pane::-webkit-scrollbar-thumb{
        background: rgba(255,255,255,.15);
        border-radius: 3px;
      }
      .cv-list-pane::-webkit-scrollbar-thumb:hover,
      .cv-detail-pane::-webkit-scrollbar-thumb:hover{
        background: rgba(255,255,255,.25);
      }
      .cv-list-pane,
      .cv-detail-pane{
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,.15) transparent;
      }

      /* CSS Variables */
      :host{
        --cv-primary: ${DEFAULT_THEME.primary};
        --cv-bg: ${DEFAULT_THEME.background};
        --cv-text: ${DEFAULT_THEME.text};
        --cv-accent: ${DEFAULT_THEME.accent};
        --cv-panel-bg: rgba(11,12,16,0.95);
        --cv-focus-outline: var(--cv-accent);
        --cv-surface-muted: rgba(255,255,255,.03);
        --cv-surface-hover: rgba(255,255,255,.06);
        --cv-drag-handle-bg: rgba(255,255,255,.04);
        --cv-drag-handle-hover: rgba(255,255,255,.1);
        --cv-drop-indicator: var(--cv-accent);
      }
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
