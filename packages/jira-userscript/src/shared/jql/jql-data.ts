export type JqlJoiner = 'AND' | 'OR';

export type JqlOperatorValueMode = 'none' | 'single' | 'list';
export type JqlOperatorHistoryMode = 'was' | 'changed';

export interface JqlOperatorDef {
  key: string;
  label: string;
  operator: string;
  valueMode: JqlOperatorValueMode;
  valuePreset?: string;
  historyMode?: JqlOperatorHistoryMode;
  description?: string;
}

export const JQL_KEYWORDS = [
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS',
  'WAS',
  'CHANGED',
  'EMPTY',
  'NULL',
  'ORDER BY',
  'ASC',
  'DESC',
  'FROM',
  'TO',
  'BY',
  'AFTER',
  'BEFORE',
  'ON',
  'DURING'
] as const;

export const JQL_HISTORY_MODIFIERS = ['FROM', 'TO', 'BY', 'AFTER', 'BEFORE', 'ON', 'DURING'] as const;

export const JQL_OPERATOR_DEFS: JqlOperatorDef[] = [
  {
    key: 'equals',
    label: 'is exactly',
    operator: '=',
    valueMode: 'single',
    description: 'Exact match for numbers, dates, users, or text.'
  },
  {
    key: 'not-equals',
    label: 'is not',
    operator: '!=',
    valueMode: 'single',
    description: 'Exclude an exact value.'
  },
  {
    key: 'greater-than',
    label: 'is greater than',
    operator: '>',
    valueMode: 'single',
    description: 'Greater than for numbers or dates.'
  },
  {
    key: 'greater-than-equals',
    label: 'is at least',
    operator: '>=',
    valueMode: 'single',
    description: 'Greater than or equal to a number or date.'
  },
  {
    key: 'less-than',
    label: 'is less than',
    operator: '<',
    valueMode: 'single',
    description: 'Less than for numbers or dates.'
  },
  {
    key: 'less-than-equals',
    label: 'is at most',
    operator: '<=',
    valueMode: 'single',
    description: 'Less than or equal to a number or date.'
  },
  {
    key: 'contains',
    label: 'contains',
    operator: '~',
    valueMode: 'single',
    description: 'Text contains (fuzzy matching).'
  },
  {
    key: 'not-contains',
    label: 'does not contain',
    operator: '!~',
    valueMode: 'single',
    description: 'Exclude fuzzy text matches.'
  },
  {
    key: 'in',
    label: 'is one of',
    operator: 'IN',
    valueMode: 'list',
    description: 'Matches any value in a list.'
  },
  {
    key: 'not-in',
    label: 'is not one of',
    operator: 'NOT IN',
    valueMode: 'list',
    description: 'Exclude values in a list.'
  },
  {
    key: 'is',
    label: 'is',
    operator: 'IS',
    valueMode: 'single',
    description: 'Matches a special value like EMPTY or NULL.'
  },
  {
    key: 'is-not',
    label: 'is not',
    operator: 'IS NOT',
    valueMode: 'single',
    description: 'Excludes a special value like EMPTY or NULL.'
  },
  {
    key: 'is-empty',
    label: 'is empty',
    operator: 'IS',
    valueMode: 'none',
    valuePreset: 'EMPTY',
    description: 'Field has no value.'
  },
  {
    key: 'is-not-empty',
    label: 'is not empty',
    operator: 'IS NOT',
    valueMode: 'none',
    valuePreset: 'EMPTY',
    description: 'Field has a value.'
  },
  {
    key: 'is-null',
    label: 'is null',
    operator: 'IS',
    valueMode: 'none',
    valuePreset: 'NULL',
    description: 'Field value is NULL.'
  },
  {
    key: 'is-not-null',
    label: 'is not null',
    operator: 'IS NOT',
    valueMode: 'none',
    valuePreset: 'NULL',
    description: 'Field value is not NULL.'
  },
  {
    key: 'was',
    label: 'was',
    operator: 'WAS',
    valueMode: 'single',
    historyMode: 'was',
    description: 'Field had this value in the past.'
  },
  {
    key: 'was-not',
    label: 'was not',
    operator: 'WAS NOT',
    valueMode: 'single',
    historyMode: 'was',
    description: 'Field did not have this value in the past.'
  },
  {
    key: 'was-in',
    label: 'was one of',
    operator: 'WAS IN',
    valueMode: 'list',
    historyMode: 'was',
    description: 'Field matched any value in the past.'
  },
  {
    key: 'was-not-in',
    label: 'was not one of',
    operator: 'WAS NOT IN',
    valueMode: 'list',
    historyMode: 'was',
    description: 'Field matched none of the values in the past.'
  },
  {
    key: 'was-empty',
    label: 'was empty',
    operator: 'WAS',
    valueMode: 'none',
    valuePreset: 'EMPTY',
    historyMode: 'was',
    description: 'Field had no value in the past.'
  },
  {
    key: 'was-not-empty',
    label: 'was not empty',
    operator: 'WAS NOT',
    valueMode: 'none',
    valuePreset: 'EMPTY',
    historyMode: 'was',
    description: 'Field had a value in the past.'
  },
  {
    key: 'changed',
    label: 'changed',
    operator: 'CHANGED',
    valueMode: 'none',
    historyMode: 'changed',
    description: 'Field value changed at some point in time.'
  }
];

export const JQL_OPERATOR_BY_KEY = new Map(JQL_OPERATOR_DEFS.map(def => [def.key, def]));

const OPERATOR_TOKEN_MAP: Record<string, string> = {
  '=': 'equals',
  '!=': 'not-equals',
  '>': 'greater-than',
  '>=': 'greater-than-equals',
  '<': 'less-than',
  '<=': 'less-than-equals',
  '~': 'contains',
  '!~': 'not-contains',
  'in': 'in',
  'not in': 'not-in',
  'is': 'is',
  'is not': 'is-not',
  'was': 'was',
  'was not': 'was-not',
  'was in': 'was-in',
  'was not in': 'was-not-in',
  'changed': 'changed'
};

export const normalizeOperatorToken = (token: string): string => token.trim().toLowerCase().replace(/\s+/g, ' ');

export const operatorKeyFromToken = (token: string): string | undefined => {
  const normalized = normalizeOperatorToken(token);
  return OPERATOR_TOKEN_MAP[normalized];
};

export interface JqlFunctionDoc {
  name: string;
  description: string;
  category?: string;
}

export const JQL_FUNCTION_DOCS: JqlFunctionDoc[] = [
  { name: 'approved()', description: 'Only available when Jira Service Management approvals are enabled.', category: 'Service Management' },
  { name: 'approver()', description: 'Only available when Jira Service Management approvals are enabled.', category: 'Service Management' },
  { name: 'breached()', description: 'Only available when Jira Service Management SLA data is enabled.', category: 'Service Management' },
  { name: 'cascadeOption()', description: 'Matches selected values of a cascading select custom field.' },
  { name: 'closedSprints()', description: 'Issues in completed sprints.' },
  { name: 'completed()', description: 'Only available when Jira Service Management SLA data is enabled.', category: 'Service Management' },
  { name: 'componentsLeadByUser()', description: 'Issues in components led by a specified user (defaults to you).' },
  { name: 'currentLogin()', description: 'Matches times based on the start of the current session.' },
  { name: 'currentUser()', description: 'Matches the currently logged-in user.' },
  { name: 'earliestUnreleasedVersion()', description: 'Earliest unreleased version for a project.' },
  { name: 'elapsed()', description: 'Only available when Jira Service Management SLA data is enabled.', category: 'Service Management' },
  { name: 'endOfDay()', description: 'End of the current day.' },
  { name: 'endOfMonth()', description: 'End of the current month.' },
  { name: 'endOfWeek()', description: 'End of the current week.' },
  { name: 'endOfYear()', description: 'End of the current year.' },
  { name: 'everbreached()', description: 'Only available when Jira Service Management SLA data is enabled.', category: 'Service Management' },
  { name: 'futureSprints()', description: 'Issues in sprints that have not started yet.' },
  { name: 'issueHistory()', description: 'Issues you have recently viewed.' },
  { name: 'issuesWithRemoteLinksByGlobalId()', description: 'Issues that have remote links with the provided global IDs.' },
  { name: 'lastLogin()', description: 'Matches times based on the previous session start.' },
  { name: 'latestReleasedVersion()', description: 'Latest released version for a project.' },
  { name: 'linkedIssues()', description: 'Issues linked to a specific issue (optionally by link type).' },
  { name: 'membersOf()', description: 'Users in a specified group.' },
  { name: 'myApproval()', description: 'Only available when Jira Service Management approvals are enabled.', category: 'Service Management' },
  { name: 'myPending()', description: 'Only available when Jira Service Management approvals are enabled.', category: 'Service Management' },
  { name: 'now()', description: 'Current date/time.' },
  { name: 'openSprints()', description: 'Issues in sprints that are currently open.' },
  { name: 'outdated()', description: 'Only available when Jira Service Management SLA data is enabled.', category: 'Service Management' },
  { name: 'paused()', description: 'Only available when Jira Service Management SLA data is enabled.', category: 'Service Management' },
  { name: 'pending()', description: 'Only available when Jira Service Management SLA data is enabled.', category: 'Service Management' },
  { name: 'pendingBy()', description: 'Only available when Jira Service Management SLA data is enabled.', category: 'Service Management' },
  { name: 'projectsLeadByUser()', description: 'Projects led by a specified user (defaults to you).' },
  { name: 'projectsWhereUserHasPermission()', description: 'Projects where you have a specified permission.' },
  { name: 'projectsWhereUserHasRole()', description: 'Projects where you have a specified role.' },
  { name: 'releasedVersions()', description: 'Released versions for a project.' },
  { name: 'remaining()', description: 'Only available when Jira Service Management SLA data is enabled.', category: 'Service Management' },
  { name: 'running()', description: 'Only available when Jira Service Management SLA data is enabled.', category: 'Service Management' },
  { name: 'standardIssueTypes()', description: 'Issue types that are not sub-tasks.' },
  { name: 'startOfDay()', description: 'Start of the current day.' },
  { name: 'startOfMonth()', description: 'Start of the current month.' },
  { name: 'startOfWeek()', description: 'Start of the current week.' },
  { name: 'startOfYear()', description: 'Start of the current year.' },
  { name: 'subtaskIssueTypes()', description: 'Issue types that are sub-tasks.' },
  { name: 'unreleasedVersions()', description: 'Unreleased versions for a project.' },
  { name: 'updatedBy()', description: 'Issues updated by a specific user, optionally within a time range.' },
  { name: 'votedIssues()', description: 'Issues you have voted for.' },
  { name: 'watchedIssues()', description: 'Issues you are watching.' },
  { name: 'withinCalendarHours()', description: 'Only available when Jira Service Management SLA data is enabled.', category: 'Service Management' }
];

export const JQL_FUNCTION_DOCS_BY_NAME = new Map(
  JQL_FUNCTION_DOCS.map((entry) => [entry.name.toLowerCase(), entry])
);
