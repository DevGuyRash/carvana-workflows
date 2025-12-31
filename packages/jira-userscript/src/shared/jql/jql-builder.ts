import {
  JQL_OPERATOR_BY_KEY,
  JQL_OPERATOR_DEFS,
  type JqlJoiner,
  type JqlOperatorDef,
  type JqlOperatorHistoryMode,
  type JqlOperatorValueMode
} from './jql-data';

export type JqlValueMode = 'text' | 'number' | 'date' | 'relative' | 'user' | 'function' | 'raw' | 'list';

export interface JqlValueState {
  mode: JqlValueMode;
  text: string;
  list: string[];
  listMode: 'text' | 'raw';
  emptyValue: 'EMPTY' | 'NULL';
  textSearchMode: 'simple' | 'phrase' | 'wildcard' | 'prefix' | 'suffix' | 'fuzzy' | 'proximity' | 'boost' | 'raw';
  textSearchDistance: string;
  textSearchBoost: string;
}

export interface JqlHistoryState {
  from?: string;
  to?: string;
  by?: string;
  after?: string;
  before?: string;
  on?: string;
  during?: string;
}

export interface JqlClauseState {
  id: string;
  kind: 'clause';
  joiner?: JqlJoiner;
  not: boolean;
  field: string;
  fieldLabel?: string;
  operatorKey: string;
  value: JqlValueState;
  history: JqlHistoryState;
}

export interface JqlGroupState {
  id: string;
  kind: 'group';
  joiner?: JqlJoiner;
  not: boolean;
  mode: JqlJoiner;
  children: JqlNodeState[];
}

export type JqlNodeState = JqlClauseState | JqlGroupState;

export interface JqlSortState {
  id: string;
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface JqlBuilderState {
  root: JqlGroupState;
  sorts: JqlSortState[];
  settings: {
    autoQuote: boolean;
    runSearch: boolean;
    showAllOperators: boolean;
    preferFieldIds: boolean;
  };
  ui: {
    activeClauseId?: string;
    fieldFilter: string;
    functionFilter: string;
    panelCollapsed: boolean;
  };
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cv-${Math.random().toString(16).slice(2)}`;
};

export const createDefaultValueState = (): JqlValueState => ({
  mode: 'text',
  text: '',
  list: [],
  listMode: 'text',
  emptyValue: 'EMPTY',
  textSearchMode: 'simple',
  textSearchDistance: '10',
  textSearchBoost: '2'
});

export const createClauseState = (overrides: Partial<JqlClauseState> = {}): JqlClauseState => ({
  id: createId(),
  kind: 'clause',
  joiner: undefined,
  not: false,
  field: '',
  fieldLabel: '',
  operatorKey: 'equals',
  value: createDefaultValueState(),
  history: {},
  ...overrides
});

export const createGroupState = (overrides: Partial<JqlGroupState> = {}): JqlGroupState => ({
  id: createId(),
  kind: 'group',
  joiner: undefined,
  not: false,
  mode: 'AND',
  children: [createClauseState()],
  ...overrides
});

export const createDefaultBuilderState = (): JqlBuilderState => ({
  root: createGroupState(),
  sorts: [],
  settings: {
    autoQuote: true,
    runSearch: false,
    showAllOperators: false,
    preferFieldIds: false
  },
  ui: {
    activeClauseId: undefined,
    fieldFilter: '',
    functionFilter: '',
    panelCollapsed: false
  }
});

export const resolveOperatorDef = (key: string): JqlOperatorDef => {
  return JQL_OPERATOR_BY_KEY.get(key) ?? JQL_OPERATOR_DEFS[0];
};

export const ensureOperatorDefaults = (clause: JqlClauseState, operator: JqlOperatorDef): void => {
  const value = clause.value;
  if (operator.valueMode === 'none') {
    return;
  }
  if (operator.valueMode === 'list') {
    if (value.mode !== 'list' && value.mode !== 'function') {
      value.mode = 'list';
    }
    return;
  }
  if (operator.valueMode === 'single') {
    if (value.mode === 'list') {
      value.mode = 'text';
    }
  }
};

export interface JqlBuildOptions {
  reservedWords?: string[];
  autoQuote?: boolean;
}

export const buildJql = (state: JqlBuilderState, opts: JqlBuildOptions = {}): string => {
  const autoQuote = opts.autoQuote ?? true;
  const reservedWords = (opts.reservedWords ?? []).map(word => word.toLowerCase());
  const query = buildGroup(state.root, { autoQuote, reservedWords });
  const orderBy = buildOrderBy(state.sorts, { autoQuote, reservedWords });
  if (!query) return orderBy;
  if (!orderBy) return query;
  return `${query} ${orderBy}`.trim();
};

const buildOrderBy = (
  sorts: JqlSortState[],
  options: { autoQuote: boolean; reservedWords: string[] }
): string => {
  const items = sorts
    .map(sort => {
      const field = sort.field?.trim();
      if (!field) return '';
      return `${field} ${sort.direction}`;
    })
    .filter(Boolean);
  if (!items.length) return '';
  return `ORDER BY ${items.join(', ')}`;
};

const buildGroup = (
  group: JqlGroupState,
  options: { autoQuote: boolean; reservedWords: string[] }
): string => {
  const pieces: string[] = [];
  group.children.forEach((child, index) => {
    const fragment = buildNode(child, options);
    if (!fragment) return;
    if (index > 0) {
      const joiner = child.joiner ?? group.mode;
      pieces.push(joiner);
    }
    pieces.push(fragment);
  });
  if (!pieces.length) return '';
  const joined = pieces.join(' ');
  const needsWrap = group.children.length > 1;
  let value = needsWrap ? `(${joined})` : joined;
  if (group.not) {
    value = `NOT (${value})`;
  }
  return value;
};

const buildNode = (
  node: JqlNodeState,
  options: { autoQuote: boolean; reservedWords: string[] }
): string => {
  if (node.kind === 'group') {
    return buildGroup(node, options);
  }
  return buildClause(node, options);
};

const buildClause = (
  clause: JqlClauseState,
  options: { autoQuote: boolean; reservedWords: string[] }
): string => {
  const field = clause.field?.trim();
  if (!field) return '';
  const operator = resolveOperatorDef(clause.operatorKey);
  let value = '';
  if (operator.valueMode === 'none') {
    if (operator.valuePreset) {
      value = operator.valuePreset;
    }
  } else if (operator.valueMode === 'single') {
    if (operator.operator === '~' || operator.operator === '!~') {
      value = formatTextSearchValue(clause.value);
    } else {
      value = formatValue(clause.value, options, operator.valueMode);
    }
  } else if (operator.valueMode === 'list') {
    value = formatListValue(clause.value, options);
  }

  let expr = field;
  expr += ` ${operator.operator}`;
  if (value) {
    expr += ` ${value}`;
  }

  const history = buildHistory(clause.history, operator.historyMode, options);
  if (history) {
    expr += ` ${history}`;
  }

  if (clause.not) {
    return `NOT (${expr})`;
  }
  return expr;
};

const buildHistory = (
  history: JqlHistoryState,
  mode: JqlOperatorHistoryMode | undefined,
  options: { autoQuote: boolean; reservedWords: string[] }
): string => {
  if (!mode) return '';
  const parts: string[] = [];
  if (mode === 'changed') {
    if (history.from) parts.push(`FROM ${formatHistoryValue(history.from, options)}`);
    if (history.to) parts.push(`TO ${formatHistoryValue(history.to, options)}`);
  }
  if (history.by) parts.push(`BY ${formatHistoryValue(history.by, options)}`);
  if (history.after) parts.push(`AFTER ${formatHistoryValue(history.after, options)}`);
  if (history.before) parts.push(`BEFORE ${formatHistoryValue(history.before, options)}`);
  if (history.on) parts.push(`ON ${formatHistoryValue(history.on, options)}`);
  if (history.during) parts.push(`DURING ${formatHistoryValue(history.during, options)}`);
  return parts.join(' ');
};

const formatHistoryValue = (
  raw: string,
  options: { autoQuote: boolean; reservedWords: string[] }
): string => {
  const value = raw.trim();
  if (!value) return value;
  return quoteIfNeeded(value, options);
};

const formatListValue = (
  value: JqlValueState,
  options: { autoQuote: boolean; reservedWords: string[] }
): string => {
  if (value.mode === 'function') {
    return value.text.trim();
  }
  const list = value.list
    .map(item => formatListItem(item, value.listMode, options))
    .filter(Boolean);
  return list.length ? `(${list.join(', ')})` : '';
};

const formatListItem = (
  raw: string,
  listMode: 'text' | 'raw',
  options: { autoQuote: boolean; reservedWords: string[] }
): string => {
  const value = raw.trim();
  if (!value) return '';
  if (listMode === 'raw') return value;
  return quoteIfNeeded(value, options);
};

const formatValue = (
  value: JqlValueState,
  options: { autoQuote: boolean; reservedWords: string[] },
  mode: JqlOperatorValueMode
): string => {
  if (mode === 'none') return '';
  if (value.mode === 'list') {
    return formatListValue(value, options);
  }
  if (value.mode === 'function') {
    return value.text.trim();
  }
  if (value.mode === 'raw') {
    return value.text.trim();
  }
  if (value.mode === 'number' || value.mode === 'date' || value.mode === 'relative') {
    return value.text.trim();
  }
  const text = value.text.trim();
  if (!text) return '';
  return quoteIfNeeded(text, options);
};

const formatTextSearchValue = (value: JqlValueState): string => {
  if (value.mode === 'raw' || value.mode === 'function') {
    return value.text.trim();
  }
  const term = value.text.trim();
  if (!term) return '';
  const mode = value.textSearchMode ?? 'simple';
  const lucene = buildLuceneQuery(term, value, mode);
  return wrapJqlString(lucene);
};

const buildLuceneQuery = (term: string, value: JqlValueState, mode: JqlValueState['textSearchMode']): string => {
  switch (mode) {
    case 'phrase': {
      const escaped = escapeLucene(term, { allowWildcards: false, allowFuzzy: false, allowBoost: false });
      return `"${escaped}"`;
    }
    case 'wildcard': {
      const escaped = escapeLucene(term, { allowWildcards: true, allowFuzzy: false, allowBoost: false });
      return escaped;
    }
    case 'prefix': {
      const escaped = escapeLucene(term, { allowWildcards: true, allowFuzzy: false, allowBoost: false });
      return escaped.endsWith('*') ? escaped : `${escaped}*`;
    }
    case 'suffix': {
      const escaped = escapeLucene(term, { allowWildcards: true, allowFuzzy: false, allowBoost: false });
      return escaped.startsWith('*') ? escaped : `*${escaped}`;
    }
    case 'fuzzy': {
      const escaped = escapeLucene(term, { allowWildcards: false, allowFuzzy: true, allowBoost: false });
      return escaped.endsWith('~') ? escaped : `${escaped}~`;
    }
    case 'proximity': {
      const escaped = escapeLucene(term, { allowWildcards: false, allowFuzzy: false, allowBoost: false });
      const distance = value.textSearchDistance?.trim() || '10';
      return `"${escaped}"~${distance}`;
    }
    case 'boost': {
      const escaped = escapeLucene(term, { allowWildcards: false, allowFuzzy: false, allowBoost: true });
      const boost = value.textSearchBoost?.trim();
      if (boost) return `${escaped}^${boost}`;
      return escaped;
    }
    case 'raw':
      return term;
    case 'simple':
    default: {
      return escapeLucene(term, { allowWildcards: false, allowFuzzy: false, allowBoost: false });
    }
  }
};

const escapeLucene = (
  input: string,
  options: { allowWildcards: boolean; allowFuzzy: boolean; allowBoost: boolean }
): string => {
  const specials = ['+', '-', '&', '|', '!', '(', ')', '{', '}', '[', ']', '^', '~', '*', '?', ':'];
  const allow = new Set<string>();
  if (options.allowWildcards) {
    allow.add('*');
    allow.add('?');
  }
  if (options.allowFuzzy) allow.add('~');
  if (options.allowBoost) allow.add('^');

  let out = input;
  for (const char of specials) {
    if (allow.has(char)) continue;
    const escaped = `\\${char}`;
    out = out.split(char).join(escaped);
  }
  return out;
};

const wrapJqlString = (value: string): string => {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
};

const quoteIfNeeded = (
  raw: string,
  options: { autoQuote: boolean; reservedWords: string[] }
): string => {
  if (!options.autoQuote) return raw;
  if (raw.startsWith('"') && raw.endsWith('"')) return raw;
  if (looksLikeFunction(raw)) return raw;
  const lower = raw.toLowerCase();
  const isReserved = options.reservedWords.includes(lower);
  const simple = /^[a-z0-9_\-\.]+$/i.test(raw);
  if (simple && !isReserved) return raw;
  const escaped = raw.replace(/"/g, '\\"');
  return `"${escaped}"`;
};

const looksLikeFunction = (raw: string): boolean => {
  const value = raw.trim();
  if (!value.includes('(') || !value.endsWith(')')) return false;
  return /^[a-zA-Z_][\w.\-]*\s*\(.*\)$/.test(value);
};
