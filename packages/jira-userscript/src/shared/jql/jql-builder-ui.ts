import type { Store } from '@cv/core';
import {
  JQL_FUNCTION_DOCS_BY_NAME,
  JQL_HISTORY_MODIFIERS,
  JQL_KEYWORDS,
  JQL_OPERATOR_DEFS,
  operatorKeyFromToken,
  type JqlJoiner
} from './jql-data';
import {
  buildJql,
  createClauseState,
  createDefaultBuilderState,
  createDefaultValueState,
  createGroupState,
  ensureOperatorDefaults,
  resolveOperatorDef,
  type JqlBuilderState,
  type JqlClauseState,
  type JqlGroupState,
  type JqlNodeState,
  type JqlSortState,
  type JqlValueState
} from './jql-builder';

const ROOT_ID = 'cv-jql-builder-root';
const STATE_KEY = 'jira.jql.builder:state';
const SETTINGS_KEY = 'jira.jql.builder:settings';
const PANEL_KEY = 'jira.jql.builder:panel';
const AUTO_CACHE_KEY = '__cvJqlAutocompleteData';
const AUTO_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

interface JqlFieldSuggestion {
  value: string;
  displayName: string;
  displayLabel: string;
  metaLabel?: string;
  operators: string[];
  types: string[];
  searchKey: string;
  matchTokens: string[];
  cfid?: string;
}

interface JqlFunctionSuggestion {
  value: string;
  displayName: string;
  isList: boolean;
  description?: string;
  searchKey: string;
}

interface JqlAutocompleteData {
  fields: JqlFieldSuggestion[];
  functions: JqlFunctionSuggestion[];
  reservedWords: string[];
  fetchedAt: number;
}

interface PanelPosition {
  top: number;
  left: number;
  width: number;
}

interface JqlBuilderController {
  destroy: () => void;
}

const decodeHtml = (value: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const normalizeSearch = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();

const splitFieldLabel = (displayName: string, value: string): { label: string; meta?: string } => {
  const cfMatch = displayName.match(/^(.*)\\s+-\\s+(cf\\[\\d+\\])$/i);
  if (cfMatch) {
    return { label: cfMatch[1].trim(), meta: cfMatch[2] };
  }
  const rawValue = value.replace(/^\"|\"$/g, '');
  if (rawValue && displayName.toLowerCase().includes(rawValue.toLowerCase())) {
    return { label: rawValue, meta: displayName.replace(rawValue, '').trim() || undefined };
  }
  return { label: displayName };
};

const deriveFieldTypeLabel = (types: string[]): string => {
  const joined = types.join(' ').toLowerCase();
  if (joined.includes('date') || joined.includes('time')) return 'Date/Time';
  if (joined.includes('string') || joined.includes('text')) return 'Text';
  if (joined.includes('number') || joined.includes('double') || joined.includes('integer') || joined.includes('long')) return 'Number';
  if (joined.includes('user')) return 'User';
  if (joined.includes('group')) return 'Group';
  if (joined.includes('version')) return 'Version';
  if (joined.includes('project')) return 'Project';
  if (joined.includes('issue')) return 'Issue';
  if (joined.includes('option')) return 'Select';
  if (joined.includes('sla')) return 'SLA';
  return types[0] ?? 'Field';
};

const getInitialState = (store: Store): JqlBuilderState => {
  const base = createDefaultBuilderState();
  const savedState = store.get<Partial<JqlBuilderState> | null>(STATE_KEY, null);
  const savedSettings = store.get<JqlBuilderState['settings'] | null>(SETTINGS_KEY, null);
  const savedPanel = store.get<Partial<PanelPosition & { collapsed: boolean }> | null>(PANEL_KEY, null);

  if (savedState?.root) base.root = savedState.root as JqlGroupState;
  if (savedState?.sorts) base.sorts = savedState.sorts as JqlSortState[];
  if (savedSettings) base.settings = { ...base.settings, ...savedSettings };
  if (savedPanel?.collapsed != null) base.ui.panelCollapsed = savedPanel.collapsed;

  normalizeState(base);

  if (!base.ui.activeClauseId) {
    const first = findFirstClause(base.root);
    if (first) base.ui.activeClauseId = first.id;
  }

  return base;
};

const normalizeState = (state: JqlBuilderState): void => {
  const ensureValue = (value?: Partial<JqlValueState>): JqlValueState => ({
    ...createDefaultValueState(),
    ...(value ?? {}),
    list: Array.isArray(value?.list) ? value?.list ?? [] : []
  });
  const walk = (node: JqlNodeState, parent?: JqlGroupState) => {
    if (node.kind === 'clause') {
      node.not = Boolean(node.not);
      node.value = ensureValue(node.value);
      node.history = node.history ?? {};
      if (parent && !node.joiner && parent.children.indexOf(node) > 0) {
        node.joiner = parent.mode;
      }
      return;
    }
    node.not = Boolean(node.not);
    node.mode = node.mode ?? 'AND';
    if (!Array.isArray(node.children) || node.children.length === 0) {
      node.children = [createClauseState()];
    }
    node.children.forEach((child) => walk(child, node));
  };
  walk(state.root);
  state.sorts = (state.sorts ?? []).map((sort) => ({
    id: sort.id ?? `sort-${Date.now()}`,
    field: sort.field ?? '',
    direction: sort.direction ?? 'DESC'
  }));
  state.settings.preferFieldIds = Boolean(state.settings.preferFieldIds);
  state.ui.fieldFilter = state.ui.fieldFilter ?? '';
  state.ui.functionFilter = state.ui.functionFilter ?? '';
  state.ui.panelCollapsed = Boolean(state.ui.panelCollapsed);
};

const findFirstClause = (group: JqlGroupState): JqlClauseState | null => {
  for (const child of group.children) {
    if (child.kind === 'clause') return child;
    const nested = findFirstClause(child);
    if (nested) return nested;
  }
  return null;
};

const getAutocompleteData = async (log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void): Promise<JqlAutocompleteData> => {
  const cache = (window as any)[AUTO_CACHE_KEY] as JqlAutocompleteData | undefined;
  if (cache && Date.now() - cache.fetchedAt < AUTO_CACHE_TTL_MS) {
    return cache;
  }
  try {
    const res = await fetch('/rest/api/2/jql/autocompletedata');
    if (!res.ok) throw new Error(`JQL autocomplete fetch failed: ${res.status}`);
    const data = (await res.json()) as {
      visibleFieldNames?: Array<any>;
      visibleFunctionNames?: Array<any>;
      jqlReservedWords?: string[];
    };
    const fields = (data.visibleFieldNames ?? []).map((entry) => {
      const displayName = decodeHtml(String(entry.displayName ?? entry.value ?? ''));
      const value = String(entry.value ?? displayName);
      const labelInfo = splitFieldLabel(displayName, value);
      const operators = Array.isArray(entry.operators) ? entry.operators.map(String) : [];
      const types = Array.isArray(entry.types) ? entry.types.map(String) : [];
      const typeLabel = deriveFieldTypeLabel(types);
      const displayLabel = labelInfo.label || displayName;
      const cfid = entry.cfid ? String(entry.cfid) : undefined;
      const metaPieces = [labelInfo.meta, cfid, typeLabel ? typeLabel : undefined].filter(Boolean);
      const metaLabel = metaPieces.length ? metaPieces.join(' · ') : undefined;
      const rawValue = value.replace(/^\"|\"$/g, '');
      const matchTokens = [displayName, displayLabel, rawValue, value, entry.cfid ?? '', typeLabel]
        .filter(Boolean)
        .map((token) => normalizeSearch(String(token)));
      return {
        value,
        displayName,
        displayLabel,
        metaLabel,
        operators,
        types,
        cfid,
        searchKey: normalizeSearch(`${displayLabel} ${displayName} ${value} ${entry.cfid ?? ''} ${typeLabel}`),
        matchTokens
      };
    });
    const functions = (data.visibleFunctionNames ?? []).map((entry) => {
      const displayName = decodeHtml(String(entry.displayName ?? entry.value ?? ''));
      const nameKey = displayName.toLowerCase();
      const doc = JQL_FUNCTION_DOCS_BY_NAME.get(nameKey);
      return {
        value: String(entry.value ?? displayName),
        displayName,
        isList: Boolean(entry.isList),
        description: doc?.description,
        searchKey: normalizeSearch(`${displayName} ${doc?.description ?? ''}`)
      };
    });
    const reservedWords = (data.jqlReservedWords ?? []).map(word => word.toUpperCase());
    const out: JqlAutocompleteData = {
      fields,
      functions,
      reservedWords,
      fetchedAt: Date.now()
    };
    (window as any)[AUTO_CACHE_KEY] = out;
    return out;
  } catch (err) {
    log(`JQL autocomplete data unavailable: ${err}`, 'warn');
    return {
      fields: [],
      functions: [],
      reservedWords: Array.from(JQL_KEYWORDS),
      fetchedAt: Date.now()
    };
  }
};

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    html?: string;
    attrs?: Record<string, string>;
  } = {}
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.text != null) el.textContent = options.text;
  if (options.html != null) el.innerHTML = options.html;
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (value == null) continue;
      el.setAttribute(key, value);
    }
  }
  return el;
};

const createButton = (label: string, className: string, attrs: Record<string, string> = {}): HTMLButtonElement => {
  return createElement('button', { className, text: label, attrs: { type: 'button', ...attrs } }) as HTMLButtonElement;
};

const findAdvancedSearchInput = (): HTMLTextAreaElement | null => {
  return document.querySelector<HTMLTextAreaElement>(
    'textarea#advanced-search, textarea[name="jql"], textarea[aria-label="Advanced Query"]'
  );
};

const findSearchButton = (): HTMLButtonElement | null => {
  return document.querySelector<HTMLButtonElement>('button.search-button, button[title="Search for issues"]');
};

const attemptSwitchToAdvanced = (): void => {
  const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a'))
    .find(el => el.textContent?.trim().toLowerCase() === 'advanced');
  link?.click();
};

class JqlBuilderUI {
  private shadow: ShadowRoot;
  private store: Store;
  private log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void;
  private state: JqlBuilderState;
  private data: JqlAutocompleteData;
  private destroyed = false;
  private saveTimer: number | null = null;
  private panel: HTMLDivElement;
  private groupWrap: HTMLDivElement;
  private sortWrap: HTMLDivElement;
  private previewEl: HTMLTextAreaElement;
  private errorsEl: HTMLDivElement;
  private fieldFilterInput: HTMLInputElement;
  private functionFilterInput: HTMLInputElement;
  private fieldList: HTMLDivElement;
  private functionList: HTMLDivElement;
  private fieldDatalist: HTMLDataListElement;
  private functionDatalist: HTMLDataListElement;

  constructor(
    shadow: ShadowRoot,
    store: Store,
    log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void,
    state: JqlBuilderState,
    data: JqlAutocompleteData
  ) {
    this.shadow = shadow;
    this.store = store;
    this.log = log;
    this.state = state;
    this.data = data;

    this.panel = createElement('div', { className: 'cv-jql-panel' });
    this.groupWrap = createElement('div', { className: 'cv-jql-groups' });
    this.sortWrap = createElement('div', { className: 'cv-jql-sorts' });
    this.previewEl = createElement('textarea', { className: 'cv-jql-preview', attrs: { readonly: 'true' } }) as HTMLTextAreaElement;
    this.errorsEl = createElement('div', { className: 'cv-jql-errors' });
    this.fieldFilterInput = createElement('input', {
      className: 'cv-jql-filter',
      attrs: { type: 'search', placeholder: 'Search fields...' }
    }) as HTMLInputElement;
    this.functionFilterInput = createElement('input', {
      className: 'cv-jql-filter',
      attrs: { type: 'search', placeholder: 'Search functions...' }
    }) as HTMLInputElement;
    this.fieldList = createElement('div', { className: 'cv-jql-list' });
    this.functionList = createElement('div', { className: 'cv-jql-list' });
    this.fieldDatalist = createElement('datalist', { attrs: { id: 'cv-jql-fields' } }) as HTMLDataListElement;
    this.functionDatalist = createElement('datalist', { attrs: { id: 'cv-jql-functions' } }) as HTMLDataListElement;
  }

  mount(): void {
    this.shadow.appendChild(this.renderStyles());
    this.shadow.appendChild(this.panel);
    this.shadow.appendChild(this.fieldDatalist);
    this.shadow.appendChild(this.functionDatalist);
    this.panel.appendChild(this.renderHeader());

    const body = createElement('div', { className: 'cv-jql-body' });
    const left = createElement('div', { className: 'cv-jql-left' });
    const right = createElement('div', { className: 'cv-jql-right' });

    left.appendChild(this.renderGroupControls());
    left.appendChild(this.groupWrap);
    left.appendChild(this.renderSortSection());
    right.appendChild(this.renderFieldPanel());
    right.appendChild(this.renderFunctionPanel());
    right.appendChild(this.renderReferencePanel());

    body.appendChild(left);
    body.appendChild(right);
    this.panel.appendChild(body);
    this.panel.appendChild(this.renderFooter());

    this.renderGroupTree();
    this.renderSorts();
    this.renderFieldDatalist();
    this.renderFunctionDatalist();
    this.refreshLists();
    this.updatePreview();
    this.applyPanelPosition();

    if (this.state.ui.panelCollapsed) {
      this.panel.classList.add('collapsed');
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.panel.remove();
  }

  private renderStyles(): HTMLStyleElement {
    const style = createElement('style');
    style.textContent = `
      :host {
        font-family: "Atlassian Sans", "Segoe UI", "Trebuchet MS", sans-serif;
        color: #1b1f2a;
      }
      .cv-jql-panel {
        position: fixed;
        top: 96px;
        right: 32px;
        width: min(980px, 92vw);
        max-height: 86vh;
        display: grid;
        grid-template-rows: auto 1fr auto;
        background: linear-gradient(135deg, #f7f9ff 0%, #eef3ff 55%, #fef6ef 100%);
        border-radius: 18px;
        border: 1px solid rgba(30, 40, 70, 0.16);
        box-shadow: 0 24px 60px rgba(17, 20, 40, 0.25);
        z-index: 2147483647;
        overflow: hidden;
      }
      .cv-jql-panel.collapsed .cv-jql-body,
      .cv-jql-panel.collapsed .cv-jql-footer {
        display: none;
      }
      .cv-jql-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 22px 12px;
        background: linear-gradient(120deg, rgba(255,255,255,0.85), rgba(246,248,255,0.7));
        border-bottom: 1px solid rgba(30, 40, 70, 0.12);
        cursor: grab;
      }
      .cv-jql-header:active {
        cursor: grabbing;
      }
      .cv-jql-title {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .cv-jql-kicker {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 11px;
        color: #5c6b8a;
      }
      .cv-jql-title h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: #1c1f2f;
      }
      .cv-jql-title p {
        margin: 0;
        font-size: 13px;
        color: #5f6d87;
      }
      .cv-jql-actions {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .cv-jql-btn {
        border: 1px solid rgba(30, 40, 70, 0.2);
        background: rgba(255,255,255,0.9);
        color: #1c2235;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
      }
      .cv-jql-btn:hover {
        transform: translateY(-1px);
        border-color: rgba(30, 40, 70, 0.35);
        box-shadow: 0 6px 16px rgba(14, 20, 40, 0.16);
      }
      .cv-jql-btn.primary {
        background: linear-gradient(135deg, #ffb74d, #ff8a65);
        color: #2a1408;
        border-color: rgba(168, 72, 32, 0.35);
      }
      .cv-jql-body {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
        gap: 18px;
        padding: 16px 22px 12px;
        overflow: auto;
      }
      .cv-jql-left, .cv-jql-right {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .cv-jql-section {
        background: rgba(255,255,255,0.78);
        border: 1px solid rgba(30, 40, 70, 0.12);
        border-radius: 14px;
        padding: 12px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.65);
      }
      .cv-jql-section h3 {
        margin: 0 0 8px 0;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #657089;
      }
      .cv-jql-controls {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .cv-jql-groups {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .cv-jql-group {
        border-radius: 14px;
        border: 1px dashed rgba(60, 70, 100, 0.25);
        padding: 12px;
        background: rgba(255,255,255,0.72);
      }
      .cv-jql-group-meta {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
      }
      .cv-jql-group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 10px;
      }
      .cv-jql-group-title {
        font-size: 13px;
        font-weight: 600;
        color: #2a3348;
      }
      .cv-jql-group-actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .cv-jql-clause {
        display: grid;
        grid-template-columns: auto auto minmax(140px, 1fr) minmax(140px, 1fr) minmax(180px, 1.3fr) auto;
        gap: 8px;
        align-items: start;
        padding: 10px;
        border-radius: 12px;
        border: 1px solid rgba(30, 40, 70, 0.08);
        background: rgba(255,255,255,0.9);
      }
      .cv-jql-clause + .cv-jql-clause {
        margin-top: 10px;
      }
      .cv-jql-clause.active {
        border-color: rgba(255, 140, 80, 0.6);
        box-shadow: 0 0 0 2px rgba(255, 140, 80, 0.2);
      }
      .cv-jql-joiner select {
        border-radius: 999px;
        border: 1px solid rgba(30,40,70,0.2);
        background: #fff;
        padding: 4px 10px;
        font-size: 11px;
        text-transform: uppercase;
      }
      .cv-jql-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #3c465f;
      }
      .cv-jql-input, .cv-jql-select, .cv-jql-textarea {
        width: 100%;
        border-radius: 10px;
        border: 1px solid rgba(30, 40, 70, 0.2);
        background: #fff;
        padding: 8px 10px;
        font-size: 12px;
        color: #1c2235;
      }
      .cv-jql-input.invalid {
        border-color: rgba(200, 64, 64, 0.7);
        box-shadow: 0 0 0 2px rgba(200, 64, 64, 0.15);
      }
      .cv-jql-value {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cv-jql-list-input {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 6px;
        border-radius: 10px;
        border: 1px solid rgba(30, 40, 70, 0.2);
        background: #fff;
      }
      .cv-jql-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: rgba(255, 165, 100, 0.2);
        border-radius: 999px;
        font-size: 11px;
      }
      .cv-jql-chip button {
        border: none;
        background: transparent;
        cursor: pointer;
        color: #8a3b12;
      }
      .cv-jql-history {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 6px;
        padding: 8px;
        border-radius: 10px;
        border: 1px solid rgba(30,40,70,0.15);
        background: rgba(248, 250, 255, 0.9);
      }
      .cv-jql-history label {
        font-size: 11px;
        color: #5c6982;
      }
      .cv-jql-text-options {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        border-radius: 10px;
        border: 1px solid rgba(30,40,70,0.15);
        background: rgba(247, 249, 255, 0.95);
      }
      .cv-jql-text-header {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #6a768f;
      }
      .cv-jql-text-extra label {
        font-size: 11px;
        color: #5c6982;
      }
      .cv-jql-footer {
        padding: 12px 22px 18px;
        border-top: 1px solid rgba(30,40,70,0.12);
        background: rgba(255,255,255,0.85);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .cv-jql-preview {
        min-height: 80px;
        resize: vertical;
      }
      .cv-jql-footer-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .cv-jql-errors {
        color: #a3412d;
        font-size: 12px;
      }
      .cv-jql-panel small {
        color: #6a768f;
        font-size: 11px;
      }
      .cv-jql-right .cv-jql-list {
        max-height: 240px;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .cv-jql-list-item {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid rgba(30,40,70,0.12);
        background: #fff;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
      }
      .cv-jql-list-item span {
        font-weight: 600;
        color: #2a3348;
      }
      .cv-jql-list-item small {
        color: #6a768f;
      }
      @media (max-width: 980px) {
        .cv-jql-body {
          grid-template-columns: 1fr;
        }
        .cv-jql-clause {
          grid-template-columns: auto auto minmax(140px, 1fr) minmax(140px, 1fr);
          grid-auto-rows: auto;
        }
        .cv-jql-value {
          grid-column: 1 / -1;
        }
      }
    `;
    return style;
  }

  private renderHeader(): HTMLDivElement {
    const header = createElement('div', { className: 'cv-jql-header' });
    const title = createElement('div', { className: 'cv-jql-title' });
    title.appendChild(createElement('span', { className: 'cv-jql-kicker', text: 'Jira Advanced Search' }));
    title.appendChild(createElement('h1', { text: 'Query Builder' }));
    title.appendChild(createElement('p', { text: 'Build complex searches without writing JQL.' }));

    const actions = createElement('div', { className: 'cv-jql-actions' });
    const collapseBtn = createButton(this.state.ui.panelCollapsed ? 'Expand' : 'Collapse', 'cv-jql-btn');
    collapseBtn.addEventListener('click', () => {
      this.state.ui.panelCollapsed = !this.state.ui.panelCollapsed;
      collapseBtn.textContent = this.state.ui.panelCollapsed ? 'Expand' : 'Collapse';
      this.panel.classList.toggle('collapsed', this.state.ui.panelCollapsed);
      this.savePanelState();
    });
    const closeBtn = createButton('Close', 'cv-jql-btn');
    closeBtn.addEventListener('click', () => this.destroy());

    actions.appendChild(collapseBtn);
    actions.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(actions);

    this.bindDrag(header);

    return header;
  }

  private renderGroupControls(): HTMLDivElement {
    const section = createElement('div', { className: 'cv-jql-section' });
    section.appendChild(createElement('h3', { text: 'Rules' }));
    const controls = createElement('div', { className: 'cv-jql-controls' });
    const addRule = createButton('Add rule', 'cv-jql-btn');
    addRule.addEventListener('click', () => {
      this.state.root.children.push(createClauseState({ joiner: this.state.root.mode }));
      this.renderGroupTree();
      this.updatePreview();
      this.scheduleSave();
    });
    const addGroup = createButton('Add group', 'cv-jql-btn');
    addGroup.addEventListener('click', () => {
      const group = createGroupState({ joiner: this.state.root.mode });
      this.state.root.children.push(group);
      this.renderGroupTree();
      this.updatePreview();
      this.scheduleSave();
    });
    const toggleJoiner = createElement('select', { className: 'cv-jql-select' }) as HTMLSelectElement;
    toggleJoiner.appendChild(new Option('Match ALL (AND)', 'AND'));
    toggleJoiner.appendChild(new Option('Match ANY (OR)', 'OR'));
    toggleJoiner.value = this.state.root.mode;
    toggleJoiner.addEventListener('change', () => {
      this.state.root.mode = toggleJoiner.value as JqlJoiner;
      this.state.root.children.forEach((child, index) => {
        if (index === 0) return;
        child.joiner = this.state.root.mode;
      });
      this.renderGroupTree();
      this.updatePreview();
      this.scheduleSave();
    });

    controls.appendChild(addRule);
    controls.appendChild(addGroup);
    controls.appendChild(toggleJoiner);
    section.appendChild(controls);
    return section;
  }

  private renderSortSection(): HTMLDivElement {
    const section = createElement('div', { className: 'cv-jql-section' });
    section.appendChild(createElement('h3', { text: 'Order By' }));
    const addSort = createButton('Add sort', 'cv-jql-btn');
    addSort.addEventListener('click', () => {
      this.state.sorts.push({ id: crypto.randomUUID?.() ?? `sort-${Date.now()}`, field: '', direction: 'DESC' });
      this.renderSorts();
      this.updatePreview();
      this.scheduleSave();
    });
    section.appendChild(addSort);
    section.appendChild(this.sortWrap);
    return section;
  }

  private renderFieldPanel(): HTMLDivElement {
    const section = createElement('div', { className: 'cv-jql-section' });
    const fieldCount = this.data.fields.length;
    section.appendChild(createElement('h3', { text: `Field Library (${fieldCount})` }));
    section.appendChild(createElement('small', { text: 'Pulled from Jira autocomplete (includes custom fields).' }));
    this.fieldFilterInput.addEventListener('input', () => {
      this.state.ui.fieldFilter = this.fieldFilterInput.value;
      this.refreshFieldList();
      this.scheduleSave();
    });
    section.appendChild(this.fieldFilterInput);
    section.appendChild(this.fieldList);
    return section;
  }

  private renderFunctionPanel(): HTMLDivElement {
    const section = createElement('div', { className: 'cv-jql-section' });
    const fnCount = this.data.functions.length;
    section.appendChild(createElement('h3', { text: `Function Library (${fnCount})` }));
    section.appendChild(createElement('small', { text: 'Built from Jira autocomplete; some functions require JSM add-ons.' }));
    this.functionFilterInput.addEventListener('input', () => {
      this.state.ui.functionFilter = this.functionFilterInput.value;
      this.refreshFunctionList();
      this.scheduleSave();
    });
    section.appendChild(this.functionFilterInput);
    section.appendChild(this.functionList);
    return section;
  }

  private renderReferencePanel(): HTMLDivElement {
    const section = createElement('div', { className: 'cv-jql-section' });
    section.appendChild(createElement('h3', { text: 'Reference' }));
    const keywordList = createElement('div');
    keywordList.innerHTML = `<small>Keywords: ${Array.from(JQL_KEYWORDS).join(', ')}</small>`;
    const historyList = createElement('div');
    historyList.innerHTML = `<small>History modifiers: ${Array.from(JQL_HISTORY_MODIFIERS).join(', ')}</small>`;
    const textSearchList = createElement('div');
    textSearchList.innerHTML = `<small>Text search (~): use * or ? for wildcards, \"phrase\" for exact, \"phrase\"~10 for proximity, term^2 for boost.</small>`;
    const resultsList = createElement('div');
    resultsList.innerHTML = `<small>After running: use Columns/Export/Tools for result views and bulk change.</small>`;
    const customFieldNote = createElement('div');
    customFieldNote.innerHTML = `<small>Tip: Jira recommends using custom field IDs (cf[12345]) when field names collide.</small>`;
    const textFieldNote = createElement('div');
    textFieldNote.innerHTML = `<small>Tip: Use the \`text\` field to search summary, description, and comments together.</small>`;
    section.appendChild(keywordList);
    section.appendChild(historyList);
    section.appendChild(textSearchList);
    section.appendChild(resultsList);
    section.appendChild(customFieldNote);
    section.appendChild(textFieldNote);
    return section;
  }

  private renderFooter(): HTMLDivElement {
    const footer = createElement('div', { className: 'cv-jql-footer' });
    const previewLabel = createElement('div', { className: 'cv-jql-preview-label', text: 'Generated JQL' });
    footer.appendChild(previewLabel);
    footer.appendChild(this.previewEl);
    footer.appendChild(this.errorsEl);

    const actions = createElement('div', { className: 'cv-jql-footer-actions' });
    const left = createElement('div', { className: 'cv-jql-controls' });
    const autoQuoteToggle = this.createToggle('Auto-quote text', this.state.settings.autoQuote, (checked) => {
      this.state.settings.autoQuote = checked;
      this.updatePreview();
      this.saveSettings();
    });
    const runSearchToggle = this.createToggle('Run search on apply', this.state.settings.runSearch, (checked) => {
      this.state.settings.runSearch = checked;
      this.saveSettings();
    });
    const showAllOps = this.createToggle('Show all operators', this.state.settings.showAllOperators, (checked) => {
      this.state.settings.showAllOperators = checked;
      this.renderGroupTree();
      this.saveSettings();
    });
    const preferIds = this.createToggle('Prefer custom field IDs (cf[...])', this.state.settings.preferFieldIds, (checked) => {
      this.state.settings.preferFieldIds = checked;
      this.syncFieldIdentifiers();
      this.renderGroupTree();
      this.saveSettings();
    });
    left.appendChild(autoQuoteToggle);
    left.appendChild(runSearchToggle);
    left.appendChild(showAllOps);
    left.appendChild(preferIds);

    const right = createElement('div', { className: 'cv-jql-controls' });
    const copyBtn = createButton('Copy JQL', 'cv-jql-btn');
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(this.previewEl.value || '');
    });
    const applyBtn = createButton('Apply to Jira', 'cv-jql-btn primary');
    applyBtn.addEventListener('click', () => void this.applyToJira());

    right.appendChild(copyBtn);
    right.appendChild(applyBtn);
    actions.appendChild(left);
    actions.appendChild(right);
    footer.appendChild(actions);
    return footer;
  }

  private createToggle(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement {
    const wrapper = createElement('label', { className: 'cv-jql-toggle' }) as HTMLLabelElement;
    const input = createElement('input', { attrs: { type: 'checkbox' } }) as HTMLInputElement;
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    wrapper.appendChild(input);
    wrapper.appendChild(createElement('span', { text: label }));
    return wrapper;
  }

  private renderGroupTree(): void {
    this.groupWrap.innerHTML = '';
    this.groupWrap.appendChild(this.renderGroup(this.state.root, null, 0));
    this.highlightActiveClause();
  }

  private renderGroup(group: JqlGroupState, parent: JqlGroupState | null, index: number): HTMLDivElement {
    const groupEl = createElement('div', { className: 'cv-jql-group' });
    if (parent && index > 0) {
      const joinerRow = createElement('div', { className: 'cv-jql-group-meta' });
      const joinerSelect = createElement('select', { className: 'cv-jql-select' }) as HTMLSelectElement;
      joinerSelect.appendChild(new Option('AND', 'AND'));
      joinerSelect.appendChild(new Option('OR', 'OR'));
      joinerSelect.value = group.joiner ?? parent.mode;
      joinerSelect.addEventListener('change', () => {
        group.joiner = joinerSelect.value as JqlJoiner;
        this.updatePreview();
        this.scheduleSave();
      });
      const removeBtn = createButton('Remove group', 'cv-jql-btn');
      removeBtn.addEventListener('click', () => {
        parent.children = parent.children.filter(child => child.id !== group.id);
        this.renderGroupTree();
        this.updatePreview();
        this.scheduleSave();
      });
      joinerRow.appendChild(joinerSelect);
      joinerRow.appendChild(removeBtn);
      groupEl.appendChild(joinerRow);
    }
    const header = createElement('div', { className: 'cv-jql-group-header' });
    header.appendChild(createElement('div', { className: 'cv-jql-group-title', text: 'Group' }));

    const actions = createElement('div', { className: 'cv-jql-group-actions' });
    const addRule = createButton('Add rule', 'cv-jql-btn');
    addRule.addEventListener('click', () => {
      group.children.push(createClauseState({ joiner: group.mode }));
      this.renderGroupTree();
      this.updatePreview();
      this.scheduleSave();
    });
    const addGroup = createButton('Add group', 'cv-jql-btn');
    addGroup.addEventListener('click', () => {
      group.children.push(createGroupState({ joiner: group.mode }));
      this.renderGroupTree();
      this.updatePreview();
      this.scheduleSave();
    });
    const notToggle = this.createToggle('NOT', group.not, (checked) => {
      group.not = checked;
      this.updatePreview();
      this.scheduleSave();
    });

    actions.appendChild(addRule);
    actions.appendChild(addGroup);
    actions.appendChild(notToggle);

    header.appendChild(actions);
    groupEl.appendChild(header);

    const childWrap = createElement('div');
    group.children.forEach((child, childIndex) => {
      if (child.kind === 'group') {
        childWrap.appendChild(this.renderGroup(child, group, childIndex));
        return;
      }
      childWrap.appendChild(this.renderClause(child, group, childIndex));
    });
    groupEl.appendChild(childWrap);
    return groupEl;
  }

  private renderClause(clause: JqlClauseState, parent: JqlGroupState, index: number): HTMLDivElement {
    const clauseEl = createElement('div', { className: 'cv-jql-clause' });
    if (this.state.ui.activeClauseId === clause.id) {
      clauseEl.classList.add('active');
    }
    clauseEl.dataset.id = clause.id;
    clauseEl.addEventListener('click', () => this.setActiveClause(clause.id));

    const joinerWrap = createElement('div', { className: 'cv-jql-joiner' });
    if (index > 0) {
      const select = createElement('select', { className: 'cv-jql-select' }) as HTMLSelectElement;
      select.appendChild(new Option('AND', 'AND'));
      select.appendChild(new Option('OR', 'OR'));
      select.value = clause.joiner ?? parent.mode;
      select.addEventListener('change', () => {
        clause.joiner = select.value as JqlJoiner;
        this.updatePreview();
        this.scheduleSave();
      });
      joinerWrap.appendChild(select);
    }

    const notToggle = this.createToggle('NOT', clause.not, (checked) => {
      clause.not = checked;
      this.updatePreview();
      this.scheduleSave();
    });

    const fieldInput = createElement('input', {
      className: 'cv-jql-input',
      attrs: { type: 'text', placeholder: 'Field (name or cf[12345])', list: 'cv-jql-fields', value: clause.fieldLabel || clause.field }
    }) as HTMLInputElement;
    fieldInput.addEventListener('focus', () => this.setActiveClause(clause.id));
    fieldInput.addEventListener('input', () => {
      clause.fieldLabel = fieldInput.value;
      const match = this.matchField(fieldInput.value);
      if (match) {
        this.applyFieldSelection(clause, match, false);
      } else {
        clause.field = fieldInput.value;
      }
      this.updatePreview();
      this.scheduleSave();
    });
    fieldInput.addEventListener('blur', () => {
      const match = this.matchField(fieldInput.value);
      if (match) {
        this.applyFieldSelection(clause, match, true);
        fieldInput.value = match.displayName;
      }
      this.renderGroupTree();
      this.updatePreview();
      this.scheduleSave();
    });

    const operatorSelect = createElement('select', { className: 'cv-jql-select' }) as HTMLSelectElement;
    const operatorDefs = this.getOperatorDefsForClause(clause);
    operatorDefs.forEach((def) => operatorSelect.appendChild(new Option(def.label, def.key)));
    if (!operatorDefs.find(def => def.key === clause.operatorKey)) {
      clause.operatorKey = operatorDefs[0]?.key ?? clause.operatorKey;
    }
    operatorSelect.value = clause.operatorKey;
    operatorSelect.addEventListener('change', () => {
      clause.operatorKey = operatorSelect.value;
      ensureOperatorDefaults(clause, resolveOperatorDef(clause.operatorKey));
      this.renderGroupTree();
      this.updatePreview();
      this.scheduleSave();
    });

    const valueWrap = createElement('div', { className: 'cv-jql-value' });
    const opDef = resolveOperatorDef(clause.operatorKey);
    this.renderValueEditor(valueWrap, clause, opDef);

    const removeBtn = createButton('Remove', 'cv-jql-btn');
    removeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      parent.children = parent.children.filter(child => child.id !== clause.id);
      if (!parent.children.length) {
        parent.children.push(createClauseState());
      }
      if (this.state.ui.activeClauseId === clause.id) {
        this.state.ui.activeClauseId = findFirstClause(this.state.root)?.id;
      }
      this.renderGroupTree();
      this.updatePreview();
      this.scheduleSave();
    });

    clauseEl.appendChild(joinerWrap);
    clauseEl.appendChild(notToggle);
    clauseEl.appendChild(fieldInput);
    clauseEl.appendChild(operatorSelect);
    clauseEl.appendChild(valueWrap);
    clauseEl.appendChild(removeBtn);

    return clauseEl;
  }

  private renderValueEditor(container: HTMLDivElement, clause: JqlClauseState, operator: ReturnType<typeof resolveOperatorDef>): void {
    container.innerHTML = '';
    if (operator.valueMode === 'none') {
      if (operator.valuePreset) {
        container.appendChild(createElement('div', { className: 'cv-jql-chip', text: operator.valuePreset }));
      } else {
        container.appendChild(createElement('small', { text: 'No value required' }));
      }
      if (operator.historyMode) {
        container.appendChild(this.renderHistoryEditor(clause, operator.historyMode));
      }
      return;
    }

    const isTextSearch = operator.operator === '~' || operator.operator === '!~';
    const modeSelect = createElement('select', { className: 'cv-jql-select' }) as HTMLSelectElement;
    const modeOptions = operator.valueMode === 'list'
      ? [
        { value: 'list', label: 'List' },
        { value: 'function', label: 'Function' },
        { value: 'raw', label: 'Raw list' }
      ]
      : isTextSearch
        ? [
          { value: 'text', label: 'Text' },
          { value: 'raw', label: 'Raw Lucene' }
        ]
        : [
          { value: 'text', label: 'Text' },
          { value: 'number', label: 'Number' },
          { value: 'date', label: 'Date' },
          { value: 'relative', label: 'Relative' },
          { value: 'user', label: 'User' },
          { value: 'function', label: 'Function' },
          { value: 'raw', label: 'Raw' }
        ];
    modeOptions.forEach(opt => modeSelect.appendChild(new Option(opt.label, opt.value)));

    if (!modeOptions.find(opt => opt.value === clause.value.mode)) {
      clause.value.mode = operator.valueMode === 'list' ? 'list' : 'text';
    }
    if (operator.valueMode === 'list') {
      modeSelect.value = clause.value.mode === 'function'
        ? 'function'
        : (clause.value.listMode === 'raw' ? 'raw' : 'list');
    } else {
      modeSelect.value = clause.value.mode;
    }
    modeSelect.addEventListener('change', () => {
      clause.value.mode = modeSelect.value as JqlValueState['mode'];
      if (operator.valueMode === 'list' && clause.value.mode !== 'function') {
        clause.value.mode = 'list';
        clause.value.listMode = modeSelect.value === 'raw' ? 'raw' : 'text';
      }
      this.renderGroupTree();
      this.updatePreview();
      this.scheduleSave();
    });

    container.appendChild(modeSelect);
    const input = this.renderValueInput(clause.value, isTextSearch ? 'Text search (e.g. Vendor Name)' : undefined);
    container.appendChild(input);
    if (isTextSearch) {
      container.appendChild(this.renderTextSearchOptions(clause.value));
    }

    if (operator.historyMode) {
      container.appendChild(this.renderHistoryEditor(clause, operator.historyMode));
    }
  }

  private renderValueInput(value: JqlValueState, placeholder?: string): HTMLDivElement {
    const wrap = createElement('div');
    if (value.mode === 'list') {
      const listWrap = createElement('div', { className: 'cv-jql-list-input' });
      const input = createElement('input', { className: 'cv-jql-input', attrs: { type: 'text', placeholder: 'Add value' } }) as HTMLInputElement;
      const renderChips = () => {
        listWrap.querySelectorAll('.cv-jql-chip').forEach(node => node.remove());
        value.list.forEach((item, idx) => {
          const chip = createElement('div', { className: 'cv-jql-chip' });
          chip.appendChild(createElement('span', { text: item }));
          const remove = createButton('x', '');
          remove.addEventListener('click', () => {
            value.list.splice(idx, 1);
            renderChips();
            this.updatePreview();
            this.scheduleSave();
          });
          chip.appendChild(remove);
          listWrap.insertBefore(chip, input);
        });
      };
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          const next = input.value.trim();
          if (next) {
            value.list.push(next);
            input.value = '';
            renderChips();
            this.updatePreview();
            this.scheduleSave();
          }
        }
      });
      listWrap.appendChild(input);
      renderChips();
      wrap.appendChild(listWrap);
      return wrap;
    }
    const fallbackPlaceholder = value.mode === 'function'
      ? 'Function (e.g. currentUser())'
      : value.mode === 'raw'
        ? 'Raw value (e.g. "\"ACME\"~5")'
        : 'Value';
    const attrs: Record<string, string> = {
      type: 'text',
      placeholder: value.mode === 'raw' ? fallbackPlaceholder : (placeholder ?? fallbackPlaceholder),
      value: value.text || ''
    };
    if (value.mode === 'function') attrs.list = 'cv-jql-functions';
    const input = createElement('input', { className: 'cv-jql-input', attrs }) as HTMLInputElement;
    input.addEventListener('input', () => {
      value.text = input.value;
      this.updatePreview();
      this.scheduleSave();
    });
    wrap.appendChild(input);
    return wrap;
  }

  private renderHistoryEditor(clause: JqlClauseState, mode: 'was' | 'changed'): HTMLDivElement {
    const history = clause.history;
    const wrap = createElement('div', { className: 'cv-jql-history' });
    const buildField = (label: string, key: keyof JqlClauseState['history']) => {
      const fieldWrap = createElement('div');
      const labelEl = createElement('label', { text: label });
      const input = createElement('input', {
        className: 'cv-jql-input',
        attrs: { type: 'text', placeholder: label, value: history[key] ?? '' }
      }) as HTMLInputElement;
      input.addEventListener('input', () => {
        history[key] = input.value;
        this.updatePreview();
        this.scheduleSave();
      });
      fieldWrap.appendChild(labelEl);
      fieldWrap.appendChild(input);
      return fieldWrap;
    };

    if (mode === 'changed') {
      wrap.appendChild(buildField('From', 'from'));
      wrap.appendChild(buildField('To', 'to'));
    }
    wrap.appendChild(buildField('By', 'by'));
    wrap.appendChild(buildField('After', 'after'));
    wrap.appendChild(buildField('Before', 'before'));
    wrap.appendChild(buildField('On', 'on'));
    wrap.appendChild(buildField('During', 'during'));
    return wrap;
  }

  private renderTextSearchOptions(value: JqlValueState): HTMLDivElement {
    const wrap = createElement('div', { className: 'cv-jql-text-options' });
    const header = createElement('div', { className: 'cv-jql-text-header', text: 'Text search' });
    const modeSelect = createElement('select', { className: 'cv-jql-select' }) as HTMLSelectElement;
    const modes: Array<{ value: JqlValueState['textSearchMode']; label: string }> = [
      { value: 'simple', label: 'Any order (default)' },
      { value: 'phrase', label: 'Exact phrase' },
      { value: 'wildcard', label: 'Wildcard (* or ?)' },
      { value: 'prefix', label: 'Starts with' },
      { value: 'suffix', label: 'Ends with' },
      { value: 'fuzzy', label: 'Fuzzy (~)' },
      { value: 'proximity', label: 'Phrase proximity' },
      { value: 'boost', label: 'Boost term' },
      { value: 'raw', label: 'Raw Lucene' }
    ];
    modes.forEach(mode => modeSelect.appendChild(new Option(mode.label, mode.value)));
    modeSelect.value = value.textSearchMode ?? 'simple';

    const distanceWrap = createElement('div', { className: 'cv-jql-text-extra' });
    const distanceLabel = createElement('label', { text: 'Distance' });
    const distanceInput = createElement('input', {
      className: 'cv-jql-input',
      attrs: { type: 'text', placeholder: '10', value: value.textSearchDistance || '10' }
    }) as HTMLInputElement;
    distanceInput.addEventListener('input', () => {
      value.textSearchDistance = distanceInput.value;
      this.updatePreview();
      this.scheduleSave();
    });
    distanceWrap.appendChild(distanceLabel);
    distanceWrap.appendChild(distanceInput);

    const boostWrap = createElement('div', { className: 'cv-jql-text-extra' });
    const boostLabel = createElement('label', { text: 'Boost' });
    const boostInput = createElement('input', {
      className: 'cv-jql-input',
      attrs: { type: 'text', placeholder: '2', value: value.textSearchBoost || '2' }
    }) as HTMLInputElement;
    boostInput.addEventListener('input', () => {
      value.textSearchBoost = boostInput.value;
      this.updatePreview();
      this.scheduleSave();
    });
    boostWrap.appendChild(boostLabel);
    boostWrap.appendChild(boostInput);

    const hint = createElement('small', {
      text: 'Tip: Use AND/OR/NOT inside text search, or pick Raw for full Lucene syntax.'
    });

    const updateVisibility = () => {
      const mode = modeSelect.value as JqlValueState['textSearchMode'];
      distanceWrap.style.display = mode === 'proximity' ? 'block' : 'none';
      boostWrap.style.display = mode === 'boost' ? 'block' : 'none';
    };

    modeSelect.addEventListener('change', () => {
      value.textSearchMode = modeSelect.value as JqlValueState['textSearchMode'];
      updateVisibility();
      this.updatePreview();
      this.scheduleSave();
    });

    updateVisibility();
    wrap.appendChild(header);
    wrap.appendChild(modeSelect);
    wrap.appendChild(distanceWrap);
    wrap.appendChild(boostWrap);
    wrap.appendChild(hint);
    return wrap;
  }

  private renderSorts(): void {
    this.sortWrap.innerHTML = '';
    this.state.sorts.forEach((sort, idx) => {
      const row = createElement('div', { className: 'cv-jql-controls' });
      const fieldInput = createElement('input', {
        className: 'cv-jql-input',
        attrs: { type: 'text', placeholder: 'Sort field', value: sort.field, list: 'cv-jql-fields' }
      }) as HTMLInputElement;
      fieldInput.addEventListener('input', () => {
        sort.field = fieldInput.value;
        this.updatePreview();
        this.scheduleSave();
      });
      const dirSelect = createElement('select', { className: 'cv-jql-select' }) as HTMLSelectElement;
      dirSelect.appendChild(new Option('DESC', 'DESC'));
      dirSelect.appendChild(new Option('ASC', 'ASC'));
      dirSelect.value = sort.direction;
      dirSelect.addEventListener('change', () => {
        sort.direction = dirSelect.value as JqlSortState['direction'];
        this.updatePreview();
        this.scheduleSave();
      });
      const remove = createButton('Remove', 'cv-jql-btn');
      remove.addEventListener('click', () => {
        this.state.sorts.splice(idx, 1);
        this.renderSorts();
        this.updatePreview();
        this.scheduleSave();
      });
      row.appendChild(fieldInput);
      row.appendChild(dirSelect);
      row.appendChild(remove);
      this.sortWrap.appendChild(row);
    });
  }

  private renderFieldDatalist(): void {
    this.fieldDatalist.innerHTML = '';
    this.data.fields.forEach((field) => {
      const option = createElement('option') as HTMLOptionElement;
      option.value = field.displayLabel;
      option.label = field.metaLabel ? `${field.metaLabel} ${field.value}` : field.value;
      this.fieldDatalist.appendChild(option);
    });
  }

  private renderFunctionDatalist(): void {
    this.functionDatalist.innerHTML = '';
    this.data.functions.forEach((fn) => {
      const option = createElement('option') as HTMLOptionElement;
      option.value = fn.displayName;
      this.functionDatalist.appendChild(option);
    });
  }

  private refreshLists(): void {
    this.fieldFilterInput.value = this.state.ui.fieldFilter;
    this.functionFilterInput.value = this.state.ui.functionFilter;
    this.refreshFieldList();
    this.refreshFunctionList();
  }

  private refreshFieldList(): void {
    const query = normalizeSearch(this.state.ui.fieldFilter || '');
    this.fieldList.innerHTML = '';
    const matches = query
      ? this.data.fields.filter(field => field.searchKey.includes(query)).slice(0, 80)
      : this.data.fields.slice(0, 20);
    if (!matches.length) {
      this.fieldList.appendChild(createElement('small', { text: 'No fields match. Try a partial name or cf[12345].' }));
      return;
    }
    matches.forEach((field) => {
      const item = createElement('div', { className: 'cv-jql-list-item' });
      item.appendChild(createElement('span', { text: field.displayLabel }));
      const meta = field.metaLabel ? `${field.metaLabel} · JQL: ${field.value}` : `JQL: ${field.value}`;
      item.appendChild(createElement('small', { text: meta }));
      item.addEventListener('click', () => this.applyFieldToActiveClause(field));
      this.fieldList.appendChild(item);
    });
  }

  private refreshFunctionList(): void {
    const query = normalizeSearch(this.state.ui.functionFilter || '');
    this.functionList.innerHTML = '';
    const matches = query
      ? this.data.functions.filter(fn => fn.searchKey.includes(query)).slice(0, 80)
      : this.data.functions.slice(0, 20);
    if (!matches.length) {
      this.functionList.appendChild(createElement('small', { text: 'No functions match.' }));
      return;
    }
    matches.forEach((fn) => {
      const item = createElement('div', { className: 'cv-jql-list-item' });
      item.appendChild(createElement('span', { text: fn.displayName }));
      item.appendChild(createElement('small', { text: fn.description ?? 'Click to insert' }));
      item.addEventListener('click', () => this.applyFunctionToActiveClause(fn));
      this.functionList.appendChild(item);
    });
  }

  private applyFieldToActiveClause(field: JqlFieldSuggestion): void {
    const clause = this.findClauseById(this.state.ui.activeClauseId);
    if (!clause) return;
    this.applyFieldSelection(clause, field, true);
    this.renderGroupTree();
    this.updatePreview();
    this.scheduleSave();
  }

  private applyFunctionToActiveClause(fn: JqlFunctionSuggestion): void {
    const clause = this.findClauseById(this.state.ui.activeClauseId);
    if (!clause) return;
    clause.value.mode = 'function';
    clause.value.text = fn.value;
    this.renderGroupTree();
    this.updatePreview();
    this.scheduleSave();
  }

  private matchField(input: string): JqlFieldSuggestion | undefined {
    const normalized = normalizeSearch(input);
    if (!normalized) return undefined;
    let best: { score: number; field: JqlFieldSuggestion } | null = null;
    for (const field of this.data.fields) {
      const tokens = field.matchTokens;
      let score = 0;
      if (tokens.some(token => token === normalized)) score = 3;
      else if (tokens.some(token => token.startsWith(normalized))) score = 2;
      else if (tokens.some(token => token.includes(normalized))) score = 1;
      if (score > 0) {
        if (!best || score > best.score || (score === best.score && field.displayLabel.length < best.field.displayLabel.length)) {
          best = { score, field };
        }
      }
    }
    return best?.field;
  }

  private applyFieldSelection(clause: JqlClauseState, field: JqlFieldSuggestion, forceOperator: boolean): void {
    clause.field = this.state.settings.preferFieldIds && field.cfid ? field.cfid : field.value;
    clause.fieldLabel = field.displayLabel;
    if (this.state.settings.showAllOperators) return;
    const operatorKeys = field.operators
      .map(token => operatorKeyFromToken(token))
      .filter((key): key is string => Boolean(key));
    if (!operatorKeys.length) return;
    const current = clause.operatorKey;
    const normalized = new Set(operatorKeys);
    if (forceOperator || !normalized.has(current)) {
      clause.operatorKey = operatorKeys[0];
      ensureOperatorDefaults(clause, resolveOperatorDef(clause.operatorKey));
    }
  }

  private findClauseById(id?: string): JqlClauseState | null {
    if (!id) return null;
    const stack: JqlNodeState[] = [this.state.root];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      if (node.kind === 'clause' && node.id === id) return node;
      if (node.kind === 'group') {
        stack.push(...node.children);
      }
    }
    return null;
  }

  private setActiveClause(id: string): void {
    this.state.ui.activeClauseId = id;
    this.highlightActiveClause();
    this.scheduleSave();
  }

  private highlightActiveClause(): void {
    const activeId = this.state.ui.activeClauseId;
    this.groupWrap.querySelectorAll<HTMLElement>('.cv-jql-clause').forEach((el) => {
      el.classList.toggle('active', el.dataset.id === activeId);
    });
  }

  private getOperatorDefsForClause(clause: JqlClauseState): ReturnType<typeof resolveOperatorDef>[] {
    if (this.state.settings.showAllOperators) return JQL_OPERATOR_DEFS;
    const field = this.matchField(clause.fieldLabel || clause.field);
    if (!field || !field.operators.length) return JQL_OPERATOR_DEFS;
    const keys = field.operators
      .map(token => operatorKeyFromToken(token))
      .filter((key): key is string => Boolean(key));
    if (keys.includes('is')) {
      keys.push('is-empty', 'is-null');
    }
    if (keys.includes('is-not')) {
      keys.push('is-not-empty', 'is-not-null');
    }
    if (keys.includes('was')) {
      keys.push('was-empty');
    }
    if (keys.includes('was-not')) {
      keys.push('was-not-empty');
    }
    if (!keys.length) return JQL_OPERATOR_DEFS;
    const uniqueKeys = Array.from(new Set(keys));
    const defs = uniqueKeys
      .map(key => JQL_OPERATOR_DEFS.find(def => def.key === key))
      .filter((def): def is ReturnType<typeof resolveOperatorDef> => Boolean(def));
    return defs.length ? defs : JQL_OPERATOR_DEFS;
  }

  private updatePreview(): void {
    const reserved = Array.from(new Set([...JQL_KEYWORDS, ...this.data.reservedWords]));
    const jql = buildJql(this.state, { autoQuote: this.state.settings.autoQuote, reservedWords: reserved });
    this.previewEl.value = jql;
    this.refreshErrors();
  }

  private refreshErrors(): void {
    const errors: string[] = [];
    this.collectErrors(this.state.root, errors);
    if (!errors.length) {
      this.errorsEl.textContent = '';
      return;
    }
    this.errorsEl.textContent = `Incomplete rules: ${errors.join(' | ')}`;
  }

  private collectErrors(node: JqlNodeState, errors: string[]): void {
    if (node.kind === 'group') {
      node.children.forEach(child => this.collectErrors(child, errors));
      return;
    }
    if (!node.field?.trim()) {
      errors.push('Missing field');
    }
    const op = resolveOperatorDef(node.operatorKey);
    if (op.valueMode !== 'none') {
      if (node.value.mode === 'list') {
        if (!node.value.list.length) errors.push('Missing list value');
      } else if (!node.value.text.trim()) {
        errors.push('Missing value');
      }
    }
  }

  private syncFieldIdentifiers(): void {
    const walk = (node: JqlNodeState) => {
      if (node.kind === 'group') {
        node.children.forEach(child => walk(child));
        return;
      }
      const candidate = this.matchField(node.fieldLabel || node.field);
      if (!candidate) return;
      node.field = this.state.settings.preferFieldIds && candidate.cfid ? candidate.cfid : candidate.value;
    };
    walk(this.state.root);
  }

  private scheduleSave(): void {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      if (this.destroyed) return;
      this.store.set(STATE_KEY, { root: this.state.root, sorts: this.state.sorts });
      this.store.set(SETTINGS_KEY, this.state.settings);
    }, 400);
  }

  private saveSettings(): void {
    this.store.set(SETTINGS_KEY, this.state.settings);
  }

  private savePanelState(): void {
    const rect = this.panel.getBoundingClientRect();
    const panelState: PanelPosition & { collapsed: boolean } = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      collapsed: this.state.ui.panelCollapsed
    };
    this.store.set(PANEL_KEY, panelState);
  }

  private applyPanelPosition(): void {
    const saved = this.store.get<PanelPosition | null>(PANEL_KEY, null);
    if (!saved) return;
    this.panel.style.top = `${saved.top}px`;
    this.panel.style.left = `${saved.left}px`;
    this.panel.style.right = 'auto';
    if (saved.width) this.panel.style.width = `${saved.width}px`;
  }

  private bindDrag(handle: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      this.panel.style.left = `${startLeft + dx}px`;
      this.panel.style.top = `${startTop + dy}px`;
      this.panel.style.right = 'auto';
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      this.savePanelState();
    };

    handle.addEventListener('pointerdown', (ev) => {
      if ((ev.target as HTMLElement).closest('button, input, select, textarea')) return;
      isDragging = true;
      startX = ev.clientX;
      startY = ev.clientY;
      const rect = this.panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  private async applyToJira(): Promise<void> {
    if (!this.previewEl.value.trim()) {
      alert('No JQL to apply. Add at least one complete rule.');
      return;
    }
    let input = findAdvancedSearchInput();
    if (!input) {
      attemptSwitchToAdvanced();
      await new Promise(resolve => setTimeout(resolve, 350));
      input = findAdvancedSearchInput();
    }
    if (!input) {
      alert('Advanced search box not found. Switch to Advanced search first.');
      return;
    }
    input.focus();
    input.value = this.previewEl.value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    if (this.state.settings.runSearch) {
      const btn = findSearchButton();
      btn?.click();
    }
  }
}

export const toggleJqlBuilder = async (
  store: Store,
  log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void
): Promise<void> => {
  const existing = (window as any).__cvJqlBuilder as JqlBuilderController | undefined;
  if (existing) {
    existing.destroy();
    (window as any).__cvJqlBuilder = undefined;
    return;
  }
  const host = document.createElement('div');
  host.id = ROOT_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  const state = getInitialState(store);
  const data = await getAutocompleteData(log);

  const builder = new JqlBuilderUI(shadow, store, log, state, data);
  builder.mount();
  document.body.appendChild(host);

  const controller: JqlBuilderController = {
    destroy: () => {
      builder.destroy();
      host.remove();
    }
  };
  (window as any).__cvJqlBuilder = controller;
};
