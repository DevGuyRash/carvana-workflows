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
  // User Functions
  { name: 'currentUser()', description: 'Matches the currently logged-in user. Works with assignee, reporter, voter, watcher, creator.', category: 'User' },
  { name: 'membersOf(group)', description: 'Users in a specified group. Use with IN/NOT IN operators.', category: 'User' },
  { name: 'componentsLeadByUser()', description: 'Issues in components led by you (or specified user).', category: 'User' },
  { name: 'projectsLeadByUser()', description: 'Projects led by a specified user (defaults to you).', category: 'User' },
  { name: 'projectsWhereUserHasPermission(permission)', description: 'Projects where you have a specified permission.', category: 'User' },
  { name: 'projectsWhereUserHasRole(role)', description: 'Projects where you have a specified role.', category: 'User' },

  // Date/Time Functions
  { name: 'now()', description: 'Current date/time.', category: 'Date' },
  { name: 'currentLogin()', description: 'Matches times based on the start of the current session.', category: 'Date' },
  { name: 'lastLogin()', description: 'Matches times based on the previous session start.', category: 'Date' },
  { name: 'startOfDay()', description: 'Start of the current day. Supports increments like startOfDay(-1) for yesterday.', category: 'Date' },
  { name: 'startOfWeek()', description: 'Start of the current week. Supports increments like startOfWeek(-1) for last week.', category: 'Date' },
  { name: 'startOfMonth()', description: 'Start of the current month. Supports increments like startOfMonth(-1).', category: 'Date' },
  { name: 'startOfYear()', description: 'Start of the current year. Supports increments like startOfYear(-1).', category: 'Date' },
  { name: 'endOfDay()', description: 'End of the current day. Supports increments like endOfDay(1) for tomorrow.', category: 'Date' },
  { name: 'endOfWeek()', description: 'End of the current week. Supports increments like endOfWeek(1).', category: 'Date' },
  { name: 'endOfMonth()', description: 'End of the current month. Supports increments like endOfMonth(1).', category: 'Date' },
  { name: 'endOfYear()', description: 'End of the current year. Supports increments like endOfYear(1).', category: 'Date' },

  // Sprint Functions
  { name: 'openSprints()', description: 'Issues in sprints that are currently active/open.', category: 'Sprint' },
  { name: 'closedSprints()', description: 'Issues in completed sprints.', category: 'Sprint' },
  { name: 'futureSprints()', description: 'Issues in sprints that have not started yet.', category: 'Sprint' },

  // Version Functions
  { name: 'releasedVersions()', description: 'Released versions for a project. Use: fixVersion in releasedVersions()', category: 'Version' },
  { name: 'unreleasedVersions()', description: 'Unreleased versions for a project.', category: 'Version' },
  { name: 'latestReleasedVersion(project)', description: 'Latest released version for a project.', category: 'Version' },
  { name: 'earliestUnreleasedVersion(project)', description: 'Earliest unreleased version for a project.', category: 'Version' },

  // Issue Functions
  { name: 'issueHistory()', description: 'Issues you have recently viewed (up to 50).', category: 'Issue' },
  { name: 'linkedIssues(issueKey)', description: 'Issues linked to a specific issue. Can filter by link type: linkedIssues(ABC-123, "blocks")', category: 'Issue' },
  { name: 'votedIssues()', description: 'Issues you have voted for.', category: 'Issue' },
  { name: 'watchedIssues()', description: 'Issues you are watching.', category: 'Issue' },
  { name: 'updatedBy(user)', description: 'Issues updated by a specific user. Can filter by date: updatedBy(jsmith, "-7d")', category: 'Issue' },
  { name: 'issuesWithRemoteLinksByGlobalId(id)', description: 'Issues that have remote links with the provided global IDs.', category: 'Issue' },

  // Issue Type Functions
  { name: 'standardIssueTypes()', description: 'Issue types that are not sub-tasks.', category: 'Issue Type' },
  { name: 'subtaskIssueTypes()', description: 'Issue types that are sub-tasks.', category: 'Issue Type' },

  // Custom Field Functions
  { name: 'cascadeOption(parent, child)', description: 'Matches cascading select custom field values. Use "none" for empty.', category: 'Custom Field' },

  // Service Management - Approval Functions
  { name: 'approved()', description: 'Issues with final approval decision of "approved".', category: 'Service Management' },
  { name: 'approver(user1, user2)', description: 'Issues requiring approval from specified users.', category: 'Service Management' },
  { name: 'myApproval()', description: 'Issues requiring your approval decision.', category: 'Service Management' },
  { name: 'myPending()', description: 'Issues where your approval is pending.', category: 'Service Management' },
  { name: 'pending()', description: 'Issues with pending approval decisions.', category: 'Service Management' },
  { name: 'pendingBy(user1, user2)', description: 'Issues pending approval by specified users.', category: 'Service Management' },

  // Service Management - SLA Functions
  { name: 'breached()', description: 'SLAs that missed their goal (most recent cycle).', category: 'Service Management' },
  { name: 'everbreached()', description: 'SLAs that have ever missed their goal.', category: 'Service Management' },
  { name: 'completed()', description: 'SLAs that have completed at least one cycle.', category: 'Service Management' },
  { name: 'paused()', description: 'SLAs that are currently paused.', category: 'Service Management' },
  { name: 'running()', description: 'SLAs that are currently running.', category: 'Service Management' },
  { name: 'elapsed()', description: 'Elapsed time on an SLA. Use with comparison operators.', category: 'Service Management' },
  { name: 'remaining(time)', description: 'Remaining time on SLA. Example: remaining("2h")', category: 'Service Management' },
  { name: 'withinCalendarHours()', description: 'SLAs running within calendar hours.', category: 'Service Management' },
  { name: 'outdated()', description: 'SLAs with outdated data.', category: 'Service Management' }
];

export const JQL_FUNCTION_DOCS_BY_NAME = new Map(
  JQL_FUNCTION_DOCS.map((entry) => [entry.name.toLowerCase(), entry])
);
