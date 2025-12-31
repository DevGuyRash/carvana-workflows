import type { Store } from '@cv/core';
import {
  JQL_FUNCTION_DOCS_BY_NAME,
  JQL_OPERATOR_DEFS,
  operatorKeyFromToken,
  type JqlJoiner
} from './jql-data';
import {
  buildJql,
  createClauseState,
  createDefaultBuilderState,
  createDefaultValueState,
  ensureOperatorDefaults,
  resolveOperatorDef,
  type JqlBuilderState,
  type JqlClauseState,
  type JqlGroupState,
  type JqlNodeState,
  type JqlSortState,
  type JqlValueState
} from './jql-builder';

// ============================================================================
// CONSTANTS
// ============================================================================

const ROOT_ID = 'cv-jql-builder-root';
const STATE_KEY = 'jira.jql.builder:state';
const SETTINGS_KEY = 'jira.jql.builder:settings';
const AUTO_CACHE_KEY = '__cvJqlAutocompleteData';
const AUTO_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

// ============================================================================
// QUICK PRESETS - One-click common queries for ADHD-friendly quick access
// ============================================================================

interface QuickPreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  jql: string;
  category: 'personal' | 'team' | 'time' | 'priority';
}

const QUICK_PRESETS: QuickPreset[] = [
  // Personal
  {
    id: 'my-open',
    label: 'My Open Issues',
    emoji: '📋',
    description: 'Issues assigned to you that are not done',
    jql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
    category: 'personal'
  },
  {
    id: 'created-by-me',
    label: 'Created by Me',
    emoji: '✍️',
    description: 'Issues you created',
    jql: 'reporter = currentUser() ORDER BY created DESC',
    category: 'personal'
  },
  {
    id: 'watching',
    label: 'Watching',
    emoji: '👀',
    description: 'Issues you are watching',
    jql: 'watcher = currentUser() ORDER BY updated DESC',
    category: 'personal'
  },
  // Time-based
  {
    id: 'recently-updated',
    label: 'Recently Updated',
    emoji: '🔄',
    description: 'Updated in the last 24 hours',
    jql: 'updated >= -1d ORDER BY updated DESC',
    category: 'time'
  },
  {
    id: 'created-today',
    label: 'Created Today',
    emoji: '🆕',
    description: 'Issues created today',
    jql: 'created >= startOfDay() ORDER BY created DESC',
    category: 'time'
  },
  {
    id: 'due-this-week',
    label: 'Due This Week',
    emoji: '📅',
    description: 'Issues due within this week',
    jql: 'due >= startOfWeek() AND due <= endOfWeek() ORDER BY due ASC',
    category: 'time'
  },
  {
    id: 'overdue',
    label: 'Overdue',
    emoji: '⚠️',
    description: 'Past due date and not resolved',
    jql: 'due < now() AND resolution = Unresolved ORDER BY due ASC',
    category: 'time'
  },
  // Priority/Status
  {
    id: 'high-priority',
    label: 'High Priority',
    emoji: '🔥',
    description: 'Highest and High priority issues',
    jql: 'priority in (Highest, High) AND resolution = Unresolved ORDER BY priority DESC',
    category: 'priority'
  },
  {
    id: 'unassigned',
    label: 'Unassigned',
    emoji: '❓',
    description: 'Issues without an assignee',
    jql: 'assignee IS EMPTY AND resolution = Unresolved ORDER BY created DESC',
    category: 'priority'
  },
  {
    id: 'blocked',
    label: 'Blocked',
    emoji: '🚫',
    description: 'Issues with Blocked status',
    jql: 'status = Blocked ORDER BY updated DESC',
    category: 'priority'
  }
];

// ============================================================================
// FRIENDLY FIELD DEFINITIONS - Human-readable field categories
// ============================================================================

interface FriendlyField {
  id: string;
  label: string;
  emoji: string;
  description: string;
  jqlField: string;
  category: 'who' | 'what' | 'when' | 'where' | 'status';
  defaultOperator: string;
  valueType: 'user' | 'status' | 'priority' | 'text' | 'date' | 'project' | 'type' | 'list' | 'number';
  commonValues?: string[];
}

const FRIENDLY_FIELDS: FriendlyField[] = [
  // WHO
  {
    id: 'assignee',
    label: 'Assigned to',
    emoji: '👤',
    description: 'Who is working on it',
    jqlField: 'assignee',
    category: 'who',
    defaultOperator: 'equals',
    valueType: 'user',
    commonValues: ['Me (current user)', 'Unassigned']
  },
  {
    id: 'reporter',
    label: 'Created by',
    emoji: '✍️',
    description: 'Who reported/created it',
    jqlField: 'reporter',
    category: 'who',
    defaultOperator: 'equals',
    valueType: 'user',
    commonValues: ['Me (current user)']
  },
  {
    id: 'watcher',
    label: 'Watched by',
    emoji: '👀',
    description: 'Who is watching it',
    jqlField: 'watcher',
    category: 'who',
    defaultOperator: 'equals',
    valueType: 'user'
  },
  // WHAT
  {
    id: 'summary',
    label: 'Title contains',
    emoji: '📝',
    description: 'Search in issue title',
    jqlField: 'summary',
    category: 'what',
    defaultOperator: 'contains',
    valueType: 'text'
  },
  {
    id: 'description',
    label: 'Description contains',
    emoji: '📄',
    description: 'Search in description',
    jqlField: 'description',
    category: 'what',
    defaultOperator: 'contains',
    valueType: 'text'
  },
  {
    id: 'text',
    label: 'Anywhere (text search)',
    emoji: '🔍',
    description: 'Search summary, description, and comments',
    jqlField: 'text',
    category: 'what',
    defaultOperator: 'contains',
    valueType: 'text'
  },
  {
    id: 'labels',
    label: 'Has label',
    emoji: '🏷️',
    description: 'Filter by labels',
    jqlField: 'labels',
    category: 'what',
    defaultOperator: 'equals',
    valueType: 'list'
  },
  // STATUS
  {
    id: 'status',
    label: 'Status',
    emoji: '🚦',
    description: 'Current workflow status',
    jqlField: 'status',
    category: 'status',
    defaultOperator: 'equals',
    valueType: 'status',
    commonValues: ['Open', 'In Progress', 'Done', 'Closed', 'To Do', 'Blocked']
  },
  {
    id: 'resolution',
    label: 'Resolution',
    emoji: '✅',
    description: 'How it was resolved',
    jqlField: 'resolution',
    category: 'status',
    defaultOperator: 'equals',
    valueType: 'status',
    commonValues: ['Unresolved', 'Done', 'Fixed', "Won't Do", 'Duplicate']
  },
  {
    id: 'priority',
    label: 'Priority',
    emoji: '🎯',
    description: 'How urgent it is',
    jqlField: 'priority',
    category: 'status',
    defaultOperator: 'equals',
    valueType: 'priority',
    commonValues: ['Highest', 'High', 'Medium', 'Low', 'Lowest']
  },
  // WHERE
  {
    id: 'project',
    label: 'Project',
    emoji: '📁',
    description: 'Which project',
    jqlField: 'project',
    category: 'where',
    defaultOperator: 'equals',
    valueType: 'project'
  },
  {
    id: 'issuetype',
    label: 'Type',
    emoji: '📋',
    description: 'Bug, Task, Story, etc.',
    jqlField: 'issuetype',
    category: 'where',
    defaultOperator: 'equals',
    valueType: 'type',
    commonValues: ['Bug', 'Task', 'Story', 'Epic', 'Sub-task']
  },
  {
    id: 'component',
    label: 'Component',
    emoji: '🧩',
    description: 'Project component',
    jqlField: 'component',
    category: 'where',
    defaultOperator: 'equals',
    valueType: 'list'
  },
  // WHEN
  {
    id: 'created',
    label: 'Created',
    emoji: '📆',
    description: 'When it was created',
    jqlField: 'created',
    category: 'when',
    defaultOperator: 'greater-than-equals',
    valueType: 'date'
  },
  {
    id: 'updated',
    label: 'Updated',
    emoji: '🔄',
    description: 'When it was last updated',
    jqlField: 'updated',
    category: 'when',
    defaultOperator: 'greater-than-equals',
    valueType: 'date'
  },
  {
    id: 'due',
    label: 'Due date',
    emoji: '⏰',
    description: 'When it is due',
    jqlField: 'due',
    category: 'when',
    defaultOperator: 'less-than-equals',
    valueType: 'date'
  },
  {
    id: 'resolved',
    label: 'Resolved',
    emoji: '✔️',
    description: 'When it was resolved',
    jqlField: 'resolved',
    category: 'when',
    defaultOperator: 'greater-than-equals',
    valueType: 'date'
  }
];

// ============================================================================
// FRIENDLY OPERATORS - Human-readable comparison labels
// ============================================================================

interface FriendlyOperator {
  key: string;
  label: string;
  forTypes: FriendlyField['valueType'][];
}

const FRIENDLY_OPERATORS: FriendlyOperator[] = [
  { key: 'equals', label: 'is', forTypes: ['user', 'status', 'priority', 'project', 'type', 'text', 'list', 'number'] },
  { key: 'not-equals', label: 'is not', forTypes: ['user', 'status', 'priority', 'project', 'type', 'text', 'list', 'number'] },
  { key: 'in', label: 'is any of', forTypes: ['user', 'status', 'priority', 'project', 'type', 'list'] },
  { key: 'not-in', label: 'is none of', forTypes: ['user', 'status', 'priority', 'project', 'type', 'list'] },
  { key: 'contains', label: 'contains', forTypes: ['text'] },
  { key: 'not-contains', label: 'does not contain', forTypes: ['text'] },
  { key: 'is-empty', label: 'is empty', forTypes: ['user', 'status', 'priority', 'project', 'type', 'text', 'list', 'date', 'number'] },
  { key: 'is-not-empty', label: 'has a value', forTypes: ['user', 'status', 'priority', 'project', 'type', 'text', 'list', 'date', 'number'] },
  { key: 'greater-than-equals', label: 'is on or after', forTypes: ['date'] },
  { key: 'less-than-equals', label: 'is on or before', forTypes: ['date'] },
  { key: 'greater-than', label: 'is after', forTypes: ['date'] },
  { key: 'less-than', label: 'is before', forTypes: ['date'] },
  { key: 'greater-than', label: 'is greater than', forTypes: ['number'] },
  { key: 'less-than', label: 'is less than', forTypes: ['number'] }
];

// ============================================================================
// FRIENDLY DATE PRESETS - Common relative dates
// ============================================================================

interface DatePreset {
  label: string;
  value: string;
  description: string;
}

const DATE_PRESETS: DatePreset[] = [
  { label: 'Today', value: 'startOfDay()', description: 'Start of today' },
  { label: 'Yesterday', value: '-1d', description: '24 hours ago' },
  { label: 'This week', value: 'startOfWeek()', description: 'Start of this week' },
  { label: 'Last 7 days', value: '-7d', description: '7 days ago' },
  { label: 'This month', value: 'startOfMonth()', description: 'Start of this month' },
  { label: 'Last 30 days', value: '-30d', description: '30 days ago' },
  { label: 'This year', value: 'startOfYear()', description: 'Start of this year' },
  { label: 'End of today', value: 'endOfDay()', description: 'End of today' },
  { label: 'End of week', value: 'endOfWeek()', description: 'End of this week' },
  { label: 'End of month', value: 'endOfMonth()', description: 'End of this month' }
];

// ============================================================================
// TYPES
// ============================================================================

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

interface BuilderController {
  destroy: () => void;
}

// ============================================================================
// V2 UI STATE - Simplified for ADHD-friendly experience
// ============================================================================

type ViewMode = 'quick' | 'visual' | 'advanced';

interface FilterCard {
  id: string;
  fieldId: string; // from FRIENDLY_FIELDS
  operatorKey: string;
  value: string;
  values: string[]; // for multi-select
  isNegated: boolean;
}

interface V2State {
  mode: ViewMode;
  filters: FilterCard[];
  sortField: string;
  sortDirection: 'ASC' | 'DESC';
  showAdvancedSort: boolean;
  advancedSorts: JqlSortState[];
  searchText: string; // for quick search mode
  selectedPreset: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `cv-${Math.random().toString(16).slice(2)}`;

const decodeHtml = (value: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const normalizeSearch = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();

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
  const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).find(
    (el) => el.textContent?.trim().toLowerCase() === 'advanced'
  );
  link?.click();
};

// ============================================================================
// AUTOCOMPLETE DATA FETCHER
// ============================================================================

const getAutocompleteData = async (
  log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void
): Promise<JqlAutocompleteData> => {
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
      const operators = Array.isArray(entry.operators) ? entry.operators.map(String) : [];
      const types = Array.isArray(entry.types) ? entry.types.map(String) : [];
      const cfid = entry.cfid ? String(entry.cfid) : undefined;
      const matchTokens = [displayName, value, cfid ?? ''].filter(Boolean).map(normalizeSearch);
      return {
        value,
        displayName,
        displayLabel: displayName,
        metaLabel: cfid,
        operators,
        types,
        cfid,
        searchKey: normalizeSearch(`${displayName} ${value} ${cfid ?? ''}`),
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
    const reservedWords = (data.jqlReservedWords ?? []).map((word) => word.toUpperCase());
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
      reservedWords: [],
      fetchedAt: Date.now()
    };
  }
};

// ============================================================================
// JQL BUILDER FROM V2 STATE
// ============================================================================

const buildJqlFromV2State = (state: V2State): string => {
  const clauses: string[] = [];

  for (const filter of state.filters) {
    const field = FRIENDLY_FIELDS.find((f) => f.id === filter.fieldId);
    if (!field) continue;

    const operator = resolveOperatorDef(filter.operatorKey);
    let clause = '';

    // Handle special cases
    if (filter.operatorKey === 'is-empty') {
      clause = `${field.jqlField} IS EMPTY`;
    } else if (filter.operatorKey === 'is-not-empty') {
      clause = `${field.jqlField} IS NOT EMPTY`;
    } else if (filter.operatorKey === 'in' || filter.operatorKey === 'not-in') {
      const values = filter.values.length > 0 ? filter.values : [filter.value];
      const formatted = values.map((v) => formatValueForJql(v, field.valueType)).join(', ');
      clause = `${field.jqlField} ${operator.operator} (${formatted})`;
    } else {
      const formatted = formatValueForJql(filter.value, field.valueType);
      clause = `${field.jqlField} ${operator.operator} ${formatted}`;
    }

    if (filter.isNegated) {
      clause = `NOT (${clause})`;
    }

    clauses.push(clause);
  }

  let jql = clauses.join(' AND ');

  // Add sorting
  if (state.sortField) {
    jql += ` ORDER BY ${state.sortField} ${state.sortDirection}`;
  }

  return jql;
};

const formatValueForJql = (value: string, valueType: FriendlyField['valueType']): string => {
  if (!value) return '""';

  // Handle special user values
  if (valueType === 'user') {
    if (value.toLowerCase().includes('me') || value.toLowerCase().includes('current')) {
      return 'currentUser()';
    }
    if (value.toLowerCase() === 'unassigned' || value.toLowerCase() === 'empty') {
      return 'EMPTY';
    }
  }

  // Handle functions (contain parentheses)
  if (value.includes('(') && value.includes(')')) {
    return value;
  }

  // Handle relative dates
  if (valueType === 'date' && (value.startsWith('-') || value.startsWith('+') || value.includes('('))) {
    return value;
  }

  // Quote if contains spaces or special chars
  if (/\s|[,()"]/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  return value;
};

// ============================================================================
// V2 UI CLASS - ADHD-Friendly Query Builder
// ============================================================================

class JqlBuilderV2UI {
  private shadow: ShadowRoot;
  private store: Store;
  private log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void;
  private data: JqlAutocompleteData;
  private destroyed = false;

  private state: V2State = {
    mode: 'visual',
    filters: [],
    sortField: 'updated',
    sortDirection: 'DESC',
    showAdvancedSort: false,
    advancedSorts: [],
    searchText: '',
    selectedPreset: null
  };

  private panel!: HTMLDivElement;
  private previewEl!: HTMLTextAreaElement;
  private filtersContainer!: HTMLDivElement;

  constructor(
    shadow: ShadowRoot,
    store: Store,
    log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void,
    data: JqlAutocompleteData
  ) {
    this.shadow = shadow;
    this.store = store;
    this.log = log;
    this.data = data;
  }

  mount(): void {
    this.shadow.appendChild(this.renderStyles());
    this.panel = this.renderPanel();
    this.shadow.appendChild(this.panel);
    this.updatePreview();
  }

  destroy(): void {
    this.destroyed = true;
    this.panel?.remove();
  }

  // ==========================================================================
  // STYLES - Modern, ADHD-friendly with clear visual hierarchy
  // ==========================================================================

  private renderStyles(): HTMLStyleElement {
    const style = createElement('style');
    style.textContent = `
      :host {
        --cv-primary: #6366f1;
        --cv-primary-light: #818cf8;
        --cv-primary-dark: #4f46e5;
        --cv-success: #10b981;
        --cv-warning: #f59e0b;
        --cv-danger: #ef4444;
        --cv-bg: #ffffff;
        --cv-bg-secondary: #f8fafc;
        --cv-bg-hover: #f1f5f9;
        --cv-border: #e2e8f0;
        --cv-text: #1e293b;
        --cv-text-muted: #64748b;
        --cv-text-light: #94a3b8;
        --cv-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        --cv-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
        --cv-radius: 12px;
        --cv-radius-sm: 8px;
        --cv-transition: 150ms ease;

        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 14px;
        color: var(--cv-text);
      }

      * {
        box-sizing: border-box;
      }

      .cv-panel {
        position: fixed;
        top: 80px;
        right: 24px;
        width: min(720px, calc(100vw - 48px));
        max-height: calc(100vh - 120px);
        background: var(--cv-bg);
        border-radius: var(--cv-radius);
        box-shadow: var(--cv-shadow-lg);
        border: 1px solid var(--cv-border);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* Header */
      .cv-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--cv-border);
        background: linear-gradient(135deg, var(--cv-bg) 0%, var(--cv-bg-secondary) 100%);
        cursor: grab;
      }

      .cv-header:active {
        cursor: grabbing;
      }

      .cv-header-title {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .cv-header-title h1 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--cv-text);
      }

      .cv-header-title .cv-badge {
        background: var(--cv-primary);
        color: white;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 500;
      }

      .cv-header-actions {
        display: flex;
        gap: 8px;
      }

      /* Mode Tabs */
      .cv-mode-tabs {
        display: flex;
        gap: 4px;
        padding: 12px 20px;
        background: var(--cv-bg-secondary);
        border-bottom: 1px solid var(--cv-border);
      }

      .cv-mode-tab {
        padding: 8px 16px;
        border: none;
        background: transparent;
        color: var(--cv-text-muted);
        font-size: 13px;
        font-weight: 500;
        border-radius: var(--cv-radius-sm);
        cursor: pointer;
        transition: all var(--cv-transition);
      }

      .cv-mode-tab:hover {
        background: var(--cv-bg);
        color: var(--cv-text);
      }

      .cv-mode-tab.active {
        background: var(--cv-bg);
        color: var(--cv-primary);
        box-shadow: var(--cv-shadow);
      }

      /* Body */
      .cv-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }

      /* Quick Presets Section */
      .cv-section {
        margin-bottom: 24px;
      }

      .cv-section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-size: 13px;
        font-weight: 600;
        color: var(--cv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .cv-presets-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 8px;
      }

      .cv-preset-btn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        padding: 12px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        border-radius: var(--cv-radius-sm);
        cursor: pointer;
        transition: all var(--cv-transition);
        text-align: left;
      }

      .cv-preset-btn:hover {
        border-color: var(--cv-primary-light);
        background: var(--cv-bg-secondary);
        transform: translateY(-1px);
        box-shadow: var(--cv-shadow);
      }

      .cv-preset-btn.selected {
        border-color: var(--cv-primary);
        background: rgba(99, 102, 241, 0.05);
      }

      .cv-preset-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 500;
        color: var(--cv-text);
      }

      .cv-preset-emoji {
        font-size: 16px;
      }

      .cv-preset-desc {
        font-size: 11px;
        color: var(--cv-text-light);
      }

      /* Filter Cards */
      .cv-filters {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .cv-filter-card {
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        gap: 10px;
        align-items: center;
        padding: 12px 16px;
        background: var(--cv-bg-secondary);
        border: 1px solid var(--cv-border);
        border-radius: var(--cv-radius-sm);
        transition: all var(--cv-transition);
      }

      .cv-filter-card:hover {
        border-color: var(--cv-primary-light);
      }

      .cv-filter-card:focus-within {
        border-color: var(--cv-primary);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
      }

      .cv-filter-field {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 140px;
      }

      .cv-filter-field-emoji {
        font-size: 18px;
      }

      .cv-filter-field-select {
        border: none;
        background: transparent;
        font-size: 14px;
        font-weight: 500;
        color: var(--cv-text);
        cursor: pointer;
        padding: 4px;
      }

      .cv-filter-field-select:focus {
        outline: none;
      }

      .cv-filter-operator {
        display: flex;
        align-items: center;
      }

      .cv-filter-operator select {
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        padding: 6px 10px;
        border-radius: var(--cv-radius-sm);
        font-size: 13px;
        color: var(--cv-text);
        cursor: pointer;
      }

      .cv-filter-value {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .cv-filter-value input,
      .cv-filter-value select {
        flex: 1;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        padding: 8px 12px;
        border-radius: var(--cv-radius-sm);
        font-size: 13px;
        color: var(--cv-text);
      }

      .cv-filter-value input:focus,
      .cv-filter-value select:focus {
        outline: none;
        border-color: var(--cv-primary);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
      }

      .cv-filter-value input::placeholder {
        color: var(--cv-text-light);
      }

      .cv-filter-actions {
        display: flex;
        gap: 4px;
      }

      .cv-icon-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        color: var(--cv-text-muted);
        border-radius: var(--cv-radius-sm);
        cursor: pointer;
        transition: all var(--cv-transition);
        font-size: 16px;
      }

      .cv-icon-btn:hover {
        background: var(--cv-bg);
        color: var(--cv-text);
      }

      .cv-icon-btn.danger:hover {
        background: rgba(239, 68, 68, 0.1);
        color: var(--cv-danger);
      }

      /* Add Filter Button */
      .cv-add-filter {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px;
        border: 2px dashed var(--cv-border);
        background: transparent;
        border-radius: var(--cv-radius-sm);
        color: var(--cv-text-muted);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all var(--cv-transition);
      }

      .cv-add-filter:hover {
        border-color: var(--cv-primary-light);
        color: var(--cv-primary);
        background: rgba(99, 102, 241, 0.05);
      }

      /* Date Presets */
      .cv-date-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 8px;
      }

      .cv-date-preset {
        padding: 4px 10px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        border-radius: 999px;
        font-size: 11px;
        color: var(--cv-text-muted);
        cursor: pointer;
        transition: all var(--cv-transition);
      }

      .cv-date-preset:hover {
        border-color: var(--cv-primary-light);
        color: var(--cv-primary);
      }

      /* Sort Section */
      .cv-sort-section {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--cv-bg-secondary);
        border: 1px solid var(--cv-border);
        border-radius: var(--cv-radius-sm);
      }

      .cv-sort-label {
        font-size: 13px;
        color: var(--cv-text-muted);
        white-space: nowrap;
      }

      .cv-sort-section select {
        flex: 1;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        padding: 6px 10px;
        border-radius: var(--cv-radius-sm);
        font-size: 13px;
        color: var(--cv-text);
        cursor: pointer;
      }

      /* Footer */
      .cv-footer {
        padding: 16px 20px;
        border-top: 1px solid var(--cv-border);
        background: var(--cv-bg-secondary);
      }

      .cv-preview-section {
        margin-bottom: 12px;
      }

      .cv-preview-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .cv-preview-label span {
        font-size: 12px;
        font-weight: 500;
        color: var(--cv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .cv-preview-actions {
        display: flex;
        gap: 4px;
      }

      .cv-preview {
        width: 100%;
        min-height: 60px;
        padding: 12px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        border-radius: var(--cv-radius-sm);
        font-family: "JetBrains Mono", "Fira Code", monospace;
        font-size: 12px;
        color: var(--cv-text);
        resize: vertical;
      }

      .cv-footer-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .cv-btn {
        padding: 10px 20px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        border-radius: var(--cv-radius-sm);
        font-size: 14px;
        font-weight: 500;
        color: var(--cv-text);
        cursor: pointer;
        transition: all var(--cv-transition);
      }

      .cv-btn:hover {
        background: var(--cv-bg-secondary);
        transform: translateY(-1px);
      }

      .cv-btn.primary {
        background: var(--cv-primary);
        border-color: var(--cv-primary);
        color: white;
      }

      .cv-btn.primary:hover {
        background: var(--cv-primary-dark);
      }

      /* Empty State */
      .cv-empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--cv-text-muted);
      }

      .cv-empty-state-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .cv-empty-state-title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--cv-text);
      }

      .cv-empty-state-text {
        font-size: 14px;
        margin-bottom: 16px;
      }

      /* Quick Search Mode */
      .cv-quick-search {
        padding: 20px;
      }

      .cv-quick-search-input {
        width: 100%;
        padding: 16px 20px;
        border: 2px solid var(--cv-border);
        border-radius: var(--cv-radius);
        font-size: 16px;
        color: var(--cv-text);
        transition: all var(--cv-transition);
      }

      .cv-quick-search-input:focus {
        outline: none;
        border-color: var(--cv-primary);
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
      }

      .cv-quick-search-input::placeholder {
        color: var(--cv-text-light);
      }

      .cv-quick-search-hint {
        margin-top: 12px;
        font-size: 13px;
        color: var(--cv-text-muted);
      }

      .cv-quick-search-examples {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }

      .cv-quick-example {
        padding: 8px 14px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        border-radius: 999px;
        font-size: 13px;
        color: var(--cv-text);
        cursor: pointer;
        transition: all var(--cv-transition);
      }

      .cv-quick-example:hover {
        border-color: var(--cv-primary-light);
        background: var(--cv-bg-secondary);
      }

      /* Chips for multi-select */
      .cv-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .cv-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: var(--cv-primary);
        color: white;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 500;
      }

      .cv-chip-remove {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 50%;
        color: white;
        font-size: 10px;
        cursor: pointer;
        transition: all var(--cv-transition);
      }

      .cv-chip-remove:hover {
        background: rgba(255, 255, 255, 0.4);
      }

      /* Value suggestions */
      .cv-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }

      .cv-suggestion {
        padding: 3px 8px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        border-radius: 999px;
        font-size: 11px;
        color: var(--cv-text-muted);
        cursor: pointer;
        transition: all var(--cv-transition);
      }

      .cv-suggestion:hover {
        border-color: var(--cv-primary-light);
        color: var(--cv-primary);
      }

      /* Responsive */
      @media (max-width: 640px) {
        .cv-panel {
          top: 0;
          right: 0;
          width: 100vw;
          max-height: 100vh;
          border-radius: 0;
        }

        .cv-filter-card {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .cv-filter-field {
          min-width: unset;
        }

        .cv-presets-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
    `;
    return style;
  }

  // ==========================================================================
  // MAIN PANEL
  // ==========================================================================

  private renderPanel(): HTMLDivElement {
    const panel = createElement('div', { className: 'cv-panel' });

    panel.appendChild(this.renderHeader());
    panel.appendChild(this.renderModeTabs());
    panel.appendChild(this.renderBody());
    panel.appendChild(this.renderFooter());

    return panel;
  }

  private renderHeader(): HTMLDivElement {
    const header = createElement('div', { className: 'cv-header' });

    const title = createElement('div', { className: 'cv-header-title' });
    title.appendChild(createElement('h1', { text: 'Search Builder' }));
    title.appendChild(createElement('span', { className: 'cv-badge', text: 'v2' }));

    const actions = createElement('div', { className: 'cv-header-actions' });
    const closeBtn = createButton('x', 'cv-icon-btn');
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => this.destroy());
    actions.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(actions);

    this.bindDrag(header);

    return header;
  }

  private renderModeTabs(): HTMLDivElement {
    const tabs = createElement('div', { className: 'cv-mode-tabs' });

    const modes: Array<{ id: ViewMode; label: string; emoji: string }> = [
      { id: 'quick', label: 'Quick', emoji: '⚡' },
      { id: 'visual', label: 'Visual', emoji: '🎨' },
      { id: 'advanced', label: 'Advanced', emoji: '🔧' }
    ];

    modes.forEach((mode) => {
      const tab = createButton(`${mode.emoji} ${mode.label}`, 'cv-mode-tab');
      if (mode.id === this.state.mode) tab.classList.add('active');
      tab.addEventListener('click', () => this.setMode(mode.id));
      tabs.appendChild(tab);
    });

    return tabs;
  }

  private renderBody(): HTMLDivElement {
    const body = createElement('div', { className: 'cv-body' });

    if (this.state.mode === 'quick') {
      body.appendChild(this.renderQuickMode());
    } else if (this.state.mode === 'visual') {
      body.appendChild(this.renderVisualMode());
    } else {
      body.appendChild(this.renderAdvancedMode());
    }

    return body;
  }

  // ==========================================================================
  // QUICK MODE - Natural language / preset-based
  // ==========================================================================

  private renderQuickMode(): HTMLDivElement {
    const container = createElement('div', { className: 'cv-quick-search' });

    // Search input
    const input = createElement('input', {
      className: 'cv-quick-search-input',
      attrs: { type: 'text', placeholder: 'Type what you are looking for...' }
    }) as HTMLInputElement;
    input.value = this.state.searchText;
    input.addEventListener('input', () => {
      this.state.searchText = input.value;
      this.parseQuickSearch(input.value);
    });
    container.appendChild(input);

    // Hint
    const hint = createElement('div', { className: 'cv-quick-search-hint' });
    hint.textContent = 'Try: "my open bugs", "high priority tasks", "created this week"';
    container.appendChild(hint);

    // Quick examples
    const examples = createElement('div', { className: 'cv-quick-search-examples' });
    const exampleQueries = [
      'My open issues',
      'High priority bugs',
      'Updated today',
      'Unassigned tasks',
      'Due this week'
    ];
    exampleQueries.forEach((text) => {
      const btn = createButton(text, 'cv-quick-example');
      btn.addEventListener('click', () => {
        input.value = text;
        this.state.searchText = text;
        this.parseQuickSearch(text);
      });
      examples.appendChild(btn);
    });
    container.appendChild(examples);

    // Presets section
    const presetsSection = createElement('div', { className: 'cv-section' });
    presetsSection.style.marginTop = '24px';
    const presetsTitle = createElement('div', { className: 'cv-section-title' });
    presetsTitle.textContent = '⚡ Quick Filters';
    presetsSection.appendChild(presetsTitle);

    const presetsGrid = createElement('div', { className: 'cv-presets-grid' });
    QUICK_PRESETS.forEach((preset) => {
      const btn = createElement('button', { className: 'cv-preset-btn' });
      if (this.state.selectedPreset === preset.id) btn.classList.add('selected');

      const label = createElement('span', { className: 'cv-preset-label' });
      label.appendChild(createElement('span', { className: 'cv-preset-emoji', text: preset.emoji }));
      label.appendChild(document.createTextNode(preset.label));

      const desc = createElement('span', { className: 'cv-preset-desc', text: preset.description });

      btn.appendChild(label);
      btn.appendChild(desc);

      btn.addEventListener('click', () => {
        this.state.selectedPreset = preset.id;
        this.previewEl.value = preset.jql;
        this.rerender();
      });

      presetsGrid.appendChild(btn);
    });
    presetsSection.appendChild(presetsGrid);
    container.appendChild(presetsSection);

    return container;
  }

  private parseQuickSearch(text: string): void {
    // Simple natural language parsing
    const lower = text.toLowerCase();
    this.state.filters = [];

    // Detect patterns
    if (lower.includes('my') || lower.includes('assigned to me')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'assignee',
        operatorKey: 'equals',
        value: 'currentUser()',
        values: [],
        isNegated: false
      });
    }

    if (lower.includes('open') || lower.includes('unresolved')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'resolution',
        operatorKey: 'is-empty',
        value: '',
        values: [],
        isNegated: false
      });
    }

    if (lower.includes('bug')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'issuetype',
        operatorKey: 'equals',
        value: 'Bug',
        values: [],
        isNegated: false
      });
    }

    if (lower.includes('task')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'issuetype',
        operatorKey: 'equals',
        value: 'Task',
        values: [],
        isNegated: false
      });
    }

    if (lower.includes('high priority')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'priority',
        operatorKey: 'in',
        value: '',
        values: ['Highest', 'High'],
        isNegated: false
      });
    }

    if (lower.includes('today') || lower.includes('updated today')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'updated',
        operatorKey: 'greater-than-equals',
        value: 'startOfDay()',
        values: [],
        isNegated: false
      });
    }

    if (lower.includes('this week')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'updated',
        operatorKey: 'greater-than-equals',
        value: 'startOfWeek()',
        values: [],
        isNegated: false
      });
    }

    if (lower.includes('unassigned')) {
      this.state.filters = this.state.filters.filter((f) => f.fieldId !== 'assignee');
      this.state.filters.push({
        id: createId(),
        fieldId: 'assignee',
        operatorKey: 'is-empty',
        value: '',
        values: [],
        isNegated: false
      });
    }

    if (lower.includes('due this week')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'due',
        operatorKey: 'greater-than-equals',
        value: 'startOfWeek()',
        values: [],
        isNegated: false
      });
      this.state.filters.push({
        id: createId(),
        fieldId: 'due',
        operatorKey: 'less-than-equals',
        value: 'endOfWeek()',
        values: [],
        isNegated: false
      });
    }

    this.updatePreview();
  }

  // ==========================================================================
  // VISUAL MODE - Card-based filter builder
  // ==========================================================================

  private renderVisualMode(): HTMLDivElement {
    const container = createElement('div');

    // Quick presets (collapsed by default)
    const presetsSection = createElement('div', { className: 'cv-section' });
    const presetsTitle = createElement('div', { className: 'cv-section-title' });
    presetsTitle.textContent = '⚡ Quick Filters';
    presetsSection.appendChild(presetsTitle);

    const presetsGrid = createElement('div', { className: 'cv-presets-grid' });
    QUICK_PRESETS.slice(0, 4).forEach((preset) => {
      const btn = createElement('button', { className: 'cv-preset-btn' });
      const label = createElement('span', { className: 'cv-preset-label' });
      label.appendChild(createElement('span', { className: 'cv-preset-emoji', text: preset.emoji }));
      label.appendChild(document.createTextNode(preset.label));
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        this.state.selectedPreset = preset.id;
        this.previewEl.value = preset.jql;
      });
      presetsGrid.appendChild(btn);
    });
    presetsSection.appendChild(presetsGrid);
    container.appendChild(presetsSection);

    // Filter cards section
    const filtersSection = createElement('div', { className: 'cv-section' });
    const filtersTitle = createElement('div', { className: 'cv-section-title' });
    filtersTitle.textContent = '📝 Your Filters';
    filtersSection.appendChild(filtersTitle);

    this.filtersContainer = createElement('div', { className: 'cv-filters' });

    if (this.state.filters.length === 0) {
      this.filtersContainer.appendChild(this.renderEmptyState());
    } else {
      this.state.filters.forEach((filter, index) => {
        this.filtersContainer.appendChild(this.renderFilterCard(filter, index));
      });
    }

    // Add filter button
    const addBtn = createButton('+ Add a filter', 'cv-add-filter');
    addBtn.addEventListener('click', () => this.addFilter());
    this.filtersContainer.appendChild(addBtn);

    filtersSection.appendChild(this.filtersContainer);
    container.appendChild(filtersSection);

    // Sort section
    const sortSection = createElement('div', { className: 'cv-section' });
    const sortTitle = createElement('div', { className: 'cv-section-title' });
    sortTitle.textContent = '↕️ Sort Results';
    sortSection.appendChild(sortTitle);
    sortSection.appendChild(this.renderSortSection());
    container.appendChild(sortSection);

    return container;
  }

  private renderEmptyState(): HTMLDivElement {
    const empty = createElement('div', { className: 'cv-empty-state' });
    empty.innerHTML = `
      <div class="cv-empty-state-icon">🔍</div>
      <div class="cv-empty-state-title">No filters yet</div>
      <div class="cv-empty-state-text">Add filters to build your search query, or use a quick filter above.</div>
    `;
    return empty;
  }

  private renderFilterCard(filter: FilterCard, index: number): HTMLDivElement {
    const card = createElement('div', { className: 'cv-filter-card' });
    const field = FRIENDLY_FIELDS.find((f) => f.id === filter.fieldId) ?? FRIENDLY_FIELDS[0];

    // Field selector
    const fieldWrap = createElement('div', { className: 'cv-filter-field' });
    const emoji = createElement('span', { className: 'cv-filter-field-emoji', text: field.emoji });
    const fieldSelect = createElement('select', { className: 'cv-filter-field-select' }) as HTMLSelectElement;

    // Group fields by category
    const categories: Record<string, FriendlyField[]> = {};
    FRIENDLY_FIELDS.forEach((f) => {
      if (!categories[f.category]) categories[f.category] = [];
      categories[f.category].push(f);
    });

    const categoryLabels: Record<string, string> = {
      who: '👤 Who',
      what: '📝 What',
      status: '🚦 Status',
      where: '📁 Where',
      when: '📅 When'
    };

    Object.entries(categories).forEach(([cat, fields]) => {
      const optgroup = createElement('optgroup', { attrs: { label: categoryLabels[cat] ?? cat } }) as HTMLOptGroupElement;
      fields.forEach((f) => {
        const option = new Option(`${f.emoji} ${f.label}`, f.id);
        option.selected = f.id === filter.fieldId;
        optgroup.appendChild(option);
      });
      fieldSelect.appendChild(optgroup);
    });

    fieldSelect.addEventListener('change', () => {
      filter.fieldId = fieldSelect.value;
      const newField = FRIENDLY_FIELDS.find((f) => f.id === filter.fieldId);
      if (newField) {
        filter.operatorKey = newField.defaultOperator;
      }
      this.rerender();
    });

    fieldWrap.appendChild(emoji);
    fieldWrap.appendChild(fieldSelect);

    // Operator selector
    const opWrap = createElement('div', { className: 'cv-filter-operator' });
    const opSelect = createElement('select') as HTMLSelectElement;

    const validOps = FRIENDLY_OPERATORS.filter((op) => op.forTypes.includes(field.valueType));
    validOps.forEach((op) => {
      const option = new Option(op.label, op.key);
      option.selected = op.key === filter.operatorKey;
      opSelect.appendChild(option);
    });

    opSelect.addEventListener('change', () => {
      filter.operatorKey = opSelect.value;
      this.updatePreview();
      this.rerender();
    });
    opWrap.appendChild(opSelect);

    // Value input
    const valueWrap = createElement('div', { className: 'cv-filter-value' });
    const op = resolveOperatorDef(filter.operatorKey);

    if (op.valueMode !== 'none') {
      if (field.valueType === 'user') {
        valueWrap.appendChild(this.renderUserValueInput(filter, field));
      } else if (field.valueType === 'date') {
        valueWrap.appendChild(this.renderDateValueInput(filter));
      } else if (field.commonValues && field.commonValues.length > 0) {
        valueWrap.appendChild(this.renderSelectValueInput(filter, field));
      } else {
        valueWrap.appendChild(this.renderTextValueInput(filter, field));
      }
    } else {
      valueWrap.appendChild(createElement('span', { text: '(no value needed)', className: 'cv-text-muted' }));
    }

    // Actions
    const actionsWrap = createElement('div', { className: 'cv-filter-actions' });
    const removeBtn = createButton('x', 'cv-icon-btn danger');
    removeBtn.title = 'Remove filter';
    removeBtn.addEventListener('click', () => {
      this.state.filters.splice(index, 1);
      this.rerender();
    });
    actionsWrap.appendChild(removeBtn);

    card.appendChild(fieldWrap);
    card.appendChild(opWrap);
    card.appendChild(valueWrap);
    card.appendChild(actionsWrap);

    return card;
  }

  private renderUserValueInput(filter: FilterCard, field: FriendlyField): HTMLDivElement {
    const wrap = createElement('div');
    const input = createElement('input', {
      attrs: { type: 'text', placeholder: 'Username or "Me"' }
    }) as HTMLInputElement;
    input.value = filter.value === 'currentUser()' ? 'Me' : filter.value;
    input.addEventListener('input', () => {
      const val = input.value.trim().toLowerCase();
      filter.value = val === 'me' || val === 'current user' ? 'currentUser()' : input.value;
      this.updatePreview();
    });
    wrap.appendChild(input);

    // Suggestions
    const suggestions = createElement('div', { className: 'cv-suggestions' });
    ['Me (current user)', 'Unassigned'].forEach((text) => {
      const btn = createButton(text, 'cv-suggestion');
      btn.addEventListener('click', () => {
        if (text.includes('Me')) {
          filter.value = 'currentUser()';
          input.value = 'Me';
        } else {
          filter.value = 'EMPTY';
          input.value = 'Unassigned';
        }
        this.updatePreview();
      });
      suggestions.appendChild(btn);
    });
    wrap.appendChild(suggestions);

    return wrap;
  }

  private renderDateValueInput(filter: FilterCard): HTMLDivElement {
    const wrap = createElement('div');
    const input = createElement('input', {
      attrs: { type: 'text', placeholder: 'Date (e.g., -7d, 2024-01-01)' }
    }) as HTMLInputElement;
    input.value = filter.value;
    input.addEventListener('input', () => {
      filter.value = input.value;
      this.updatePreview();
    });
    wrap.appendChild(input);

    // Date presets
    const presets = createElement('div', { className: 'cv-date-presets' });
    DATE_PRESETS.slice(0, 6).forEach((preset) => {
      const btn = createButton(preset.label, 'cv-date-preset');
      btn.title = preset.description;
      btn.addEventListener('click', () => {
        filter.value = preset.value;
        input.value = preset.value;
        this.updatePreview();
      });
      presets.appendChild(btn);
    });
    wrap.appendChild(presets);

    return wrap;
  }

  private renderSelectValueInput(filter: FilterCard, field: FriendlyField): HTMLDivElement {
    const wrap = createElement('div');
    const select = createElement('select') as HTMLSelectElement;
    select.appendChild(new Option('Select...', ''));
    field.commonValues?.forEach((val) => {
      const option = new Option(val, val);
      option.selected = val === filter.value;
      select.appendChild(option);
    });
    select.addEventListener('change', () => {
      filter.value = select.value;
      this.updatePreview();
    });
    wrap.appendChild(select);

    return wrap;
  }

  private renderTextValueInput(filter: FilterCard, field: FriendlyField): HTMLDivElement {
    const wrap = createElement('div');
    const input = createElement('input', {
      attrs: { type: 'text', placeholder: field.description || 'Enter value...' }
    }) as HTMLInputElement;
    input.value = filter.value;
    input.addEventListener('input', () => {
      filter.value = input.value;
      this.updatePreview();
    });
    wrap.appendChild(input);

    return wrap;
  }

  private renderSortSection(): HTMLDivElement {
    const section = createElement('div', { className: 'cv-sort-section' });

    const label = createElement('span', { className: 'cv-sort-label', text: 'Sort by' });

    const fieldSelect = createElement('select') as HTMLSelectElement;
    const sortFields = [
      { value: 'updated', label: 'Last Updated' },
      { value: 'created', label: 'Created Date' },
      { value: 'priority', label: 'Priority' },
      { value: 'due', label: 'Due Date' },
      { value: 'status', label: 'Status' },
      { value: 'key', label: 'Issue Key' }
    ];
    sortFields.forEach((sf) => {
      const option = new Option(sf.label, sf.value);
      option.selected = sf.value === this.state.sortField;
      fieldSelect.appendChild(option);
    });
    fieldSelect.addEventListener('change', () => {
      this.state.sortField = fieldSelect.value;
      this.updatePreview();
    });

    const dirSelect = createElement('select') as HTMLSelectElement;
    dirSelect.appendChild(new Option('Newest first', 'DESC'));
    dirSelect.appendChild(new Option('Oldest first', 'ASC'));
    dirSelect.value = this.state.sortDirection;
    dirSelect.addEventListener('change', () => {
      this.state.sortDirection = dirSelect.value as 'ASC' | 'DESC';
      this.updatePreview();
    });

    section.appendChild(label);
    section.appendChild(fieldSelect);
    section.appendChild(dirSelect);

    return section;
  }

  // ==========================================================================
  // ADVANCED MODE - Raw JQL editor
  // ==========================================================================

  private renderAdvancedMode(): HTMLDivElement {
    const container = createElement('div');

    const hint = createElement('div', { className: 'cv-section' });
    hint.innerHTML = `
      <div class="cv-section-title">🔧 Advanced JQL Editor</div>
      <p style="color: var(--cv-text-muted); font-size: 13px; margin: 0;">
        Edit the JQL query directly. Changes here will be applied when you click "Search".
      </p>
    `;
    container.appendChild(hint);

    const textarea = createElement('textarea', {
      className: 'cv-preview',
      attrs: { placeholder: 'Enter your JQL query...' }
    }) as HTMLTextAreaElement;
    textarea.style.minHeight = '200px';
    textarea.style.marginTop = '12px';
    textarea.value = this.previewEl?.value || buildJqlFromV2State(this.state);
    textarea.addEventListener('input', () => {
      if (this.previewEl) {
        this.previewEl.value = textarea.value;
      }
    });
    container.appendChild(textarea);

    // Quick reference
    const reference = createElement('div', { className: 'cv-section' });
    reference.style.marginTop = '20px';
    reference.innerHTML = `
      <div class="cv-section-title">📚 Quick Reference</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">
        <div style="font-size: 12px; color: var(--cv-text-muted);">
          <strong>Common Fields:</strong><br>
          project, status, assignee, reporter, priority, created, updated, due, labels, summary, description
        </div>
        <div style="font-size: 12px; color: var(--cv-text-muted);">
          <strong>Operators:</strong><br>
          = != ~ !~ > >= < <= IN NOT IN IS IS NOT WAS CHANGED
        </div>
        <div style="font-size: 12px; color: var(--cv-text-muted);">
          <strong>Functions:</strong><br>
          currentUser(), now(), startOfDay(), endOfWeek(), membersOf("group")
        </div>
        <div style="font-size: 12px; color: var(--cv-text-muted);">
          <strong>Time:</strong><br>
          -1d, -7d, -30d, startOfWeek(), endOfMonth(), "2024-01-01"
        </div>
      </div>
    `;
    container.appendChild(reference);

    return container;
  }

  // ==========================================================================
  // FOOTER
  // ==========================================================================

  private renderFooter(): HTMLDivElement {
    const footer = createElement('div', { className: 'cv-footer' });

    // Preview section
    const previewSection = createElement('div', { className: 'cv-preview-section' });

    const previewLabel = createElement('div', { className: 'cv-preview-label' });
    previewLabel.appendChild(createElement('span', { text: 'Generated JQL' }));

    const previewActions = createElement('div', { className: 'cv-preview-actions' });
    const copyBtn = createButton('📋', 'cv-icon-btn');
    copyBtn.title = 'Copy to clipboard';
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(this.previewEl.value);
    });
    previewActions.appendChild(copyBtn);
    previewLabel.appendChild(previewActions);

    this.previewEl = createElement('textarea', {
      className: 'cv-preview',
      attrs: { readonly: 'true' }
    }) as HTMLTextAreaElement;

    previewSection.appendChild(previewLabel);
    previewSection.appendChild(this.previewEl);
    footer.appendChild(previewSection);

    // Action buttons
    const actions = createElement('div', { className: 'cv-footer-actions' });

    const clearBtn = createButton('Clear All', 'cv-btn');
    clearBtn.addEventListener('click', () => {
      this.state.filters = [];
      this.state.selectedPreset = null;
      this.state.searchText = '';
      this.rerender();
    });

    const searchBtn = createButton('Search in Jira', 'cv-btn primary');
    searchBtn.addEventListener('click', () => void this.applyToJira());

    actions.appendChild(clearBtn);
    actions.appendChild(searchBtn);
    footer.appendChild(actions);

    return footer;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private setMode(mode: ViewMode): void {
    this.state.mode = mode;
    this.rerender();
  }

  private addFilter(): void {
    const defaultField = FRIENDLY_FIELDS[0];
    this.state.filters.push({
      id: createId(),
      fieldId: defaultField.id,
      operatorKey: defaultField.defaultOperator,
      value: '',
      values: [],
      isNegated: false
    });
    this.rerender();
  }

  private updatePreview(): void {
    if (!this.previewEl) return;

    if (this.state.selectedPreset) {
      const preset = QUICK_PRESETS.find((p) => p.id === this.state.selectedPreset);
      if (preset) {
        this.previewEl.value = preset.jql;
        return;
      }
    }

    this.previewEl.value = buildJqlFromV2State(this.state);
  }

  private rerender(): void {
    const body = this.panel.querySelector('.cv-body');
    if (body) {
      body.remove();
    }
    const modeTabs = this.panel.querySelector('.cv-mode-tabs');
    if (modeTabs) {
      modeTabs.remove();
    }

    // Reinsert after header
    const header = this.panel.querySelector('.cv-header');
    if (header) {
      header.after(this.renderModeTabs());
      this.panel.querySelector('.cv-mode-tabs')?.after(this.renderBody());
    }

    this.updatePreview();
  }

  private async applyToJira(): Promise<void> {
    const jql = this.previewEl?.value?.trim();
    if (!jql) {
      alert('No JQL to apply. Add at least one filter or select a preset.');
      return;
    }

    let input = findAdvancedSearchInput();
    if (!input) {
      attemptSwitchToAdvanced();
      await new Promise((resolve) => setTimeout(resolve, 350));
      input = findAdvancedSearchInput();
    }

    if (!input) {
      alert('Advanced search box not found. Switch to Advanced search first.');
      return;
    }

    input.focus();
    input.value = jql;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const btn = findSearchButton();
    btn?.click();
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
}

// ============================================================================
// EXPORT - Toggle function
// ============================================================================

export const toggleJqlBuilderV2 = async (
  store: Store,
  log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void
): Promise<void> => {
  const existing = (window as any).__cvJqlBuilderV2 as BuilderController | undefined;
  if (existing) {
    existing.destroy();
    (window as any).__cvJqlBuilderV2 = undefined;
    return;
  }

  const host = document.createElement('div');
  host.id = ROOT_ID + '-v2';
  const shadow = host.attachShadow({ mode: 'open' });
  const data = await getAutocompleteData(log);

  const builder = new JqlBuilderV2UI(shadow, store, log, data);
  builder.mount();
  document.body.appendChild(host);

  const controller: BuilderController = {
    destroy: () => {
      builder.destroy();
      host.remove();
    }
  };
  (window as any).__cvJqlBuilderV2 = controller;
};
