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

const EMPTY_RESERVED_WORDS = new Set<string>();

type InternalBuildOptions = {
  autoQuote: boolean;
  reservedWords: Set<string>;
};

export const buildJql = (state: JqlBuilderState, opts: JqlBuildOptions = {}): string => {
  const autoQuote = opts.autoQuote ?? true;
  const reservedWords = opts.reservedWords?.length
    ? new Set(opts.reservedWords.map(word => word.toLowerCase()))
    : EMPTY_RESERVED_WORDS;
  const options = { autoQuote, reservedWords };
  const query = buildGroup(state.root, options);
  const orderBy = buildOrderBy(state.sorts);
  if (!query) return orderBy;
  if (!orderBy) return query;
  return `${query} ${orderBy}`.trim();
};

const buildOrderBy = (sorts: JqlSortState[]): string => {
  const items: string[] = [];
  for (const sort of sorts) {
    const field = sort.field?.trim();
    if (!field) continue;
    items.push(`${field} ${sort.direction}`);
  }
  return items.length ? `ORDER BY ${items.join(', ')}` : '';
};

const buildGroup = (group: JqlGroupState, options: InternalBuildOptions): string => {
  const pieces: string[] = [];
  for (const child of group.children) {
    const fragment = buildNode(child, options);
    if (!fragment) continue;
    if (pieces.length) {
      const joiner = child.joiner ?? group.mode;
      pieces.push(joiner);
    }
    pieces.push(fragment);
  }
  if (!pieces.length) return '';
  const joined = pieces.join(' ');
  const needsWrap = pieces.length > 1;
  let value = needsWrap ? `(${joined})` : joined;
  if (group.not) {
    value = `NOT (${value})`;
  }
  return value;
};

const buildNode = (node: JqlNodeState, options: InternalBuildOptions): string => {
  if (node.kind === 'group') {
    return buildGroup(node, options);
  }
  return buildClause(node, options);
};

const buildClause = (clause: JqlClauseState, options: InternalBuildOptions): string => {
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
  options: InternalBuildOptions
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
  options: InternalBuildOptions
): string => {
  const value = raw.trim();
  if (!value) return value;
  return quoteIfNeeded(value, options);
};

const formatListValue = (
  value: JqlValueState,
  options: InternalBuildOptions
): string => {
  if (value.mode === 'function') {
    return value.text.trim();
  }
  const list: string[] = [];
  for (const item of value.list) {
    const formatted = formatListItem(item, value.listMode, options);
    if (formatted) list.push(formatted);
  }
  return list.length ? `(${list.join(', ')})` : '';
};

const formatListItem = (
  raw: string,
  listMode: 'text' | 'raw',
  options: InternalBuildOptions
): string => {
  const value = raw.trim();
  if (!value) return '';
  if (listMode === 'raw') return value;
  return quoteIfNeeded(value, options);
};

const formatValue = (
  value: JqlValueState,
  options: InternalBuildOptions,
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
  let out = '';
  let mutated = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const isWildcard = char === '*' || char === '?';
    const isAllowed =
      (options.allowWildcards && isWildcard) ||
      (options.allowFuzzy && char === '~') ||
      (options.allowBoost && char === '^');
    const isSpecial =
      char === '+' ||
      char === '-' ||
      char === '&' ||
      char === '|' ||
      char === '!' ||
      char === '(' ||
      char === ')' ||
      char === '{' ||
      char === '}' ||
      char === '[' ||
      char === ']' ||
      char === '^' ||
      char === '~' ||
      char === '*' ||
      char === '?' ||
      char === ':';
    if (isSpecial && !isAllowed) {
      if (!mutated) {
        out = input.slice(0, i);
        mutated = true;
      }
      out += `\\${char}`;
      continue;
    }
    if (mutated) out += char;
  }
  return mutated ? out : input;
};

const wrapJqlString = (value: string): string => {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
};

const quoteIfNeeded = (
  raw: string,
  options: InternalBuildOptions
): string => {
  if (!options.autoQuote) return raw;
  if (raw.startsWith('"') && raw.endsWith('"')) return raw;
  if (looksLikeFunction(raw)) return raw;
  const lower = raw.toLowerCase();
  const isReserved = options.reservedWords.has(lower);
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
