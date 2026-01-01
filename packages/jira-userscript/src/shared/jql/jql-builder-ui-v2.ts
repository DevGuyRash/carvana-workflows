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
const CUSTOM_PRESETS_KEY = 'jira.jql.builder:customPresets';
const PRESET_ORDER_KEY = 'jira.jql.builder:presetOrder';
const PINNED_PRESETS_KEY = 'jira.jql.builder:pinnedPresets';
const RECENT_FILTERS_KEY = 'jira.jql.builder:recentFilters';
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
  category: 'personal' | 'team' | 'time' | 'priority' | 'custom';
  isCustom?: boolean;
}

// Common "in progress" type statuses that various projects use
const ACTIVE_WORK_STATUSES = [
  'In Progress',
  'Work in progress',
  'Waiting for support',
  'Waiting for customer',
  'Approved',
  'AP In Progress',
  'In Development',
  'In Review',
  'Under Review',
  'Working',
  'Active',
  'Implementing'
];

const QUICK_PRESETS: QuickPreset[] = [
  // === TOP PRIORITY FOR AP - Daily workflow essentials ===
  {
    id: 'my-active-work',
    label: 'My Active Work',
    emoji: '🚀',
    description: 'All issues actively being worked on by you',
    jql: `assignee = currentUser() AND status in ("${ACTIVE_WORK_STATUSES.slice(0, 8).join('", "')}") ORDER BY updated DESC, priority DESC`,
    category: 'personal'
  },
  {
    id: 'my-open',
    label: 'My Open Issues',
    emoji: '📋',
    description: 'Issues assigned to you that are not done',
    jql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
    category: 'personal'
  },
  {
    id: 'overdue',
    label: 'Overdue',
    emoji: '⚠️',
    description: 'Past due date and not resolved',
    jql: 'due < now() AND resolution = Unresolved ORDER BY due ASC',
    category: 'time'
  },
  {
    id: 'due-soon',
    label: 'Due in 7 Days',
    emoji: '⏰',
    description: 'Issues due in the next 7 days',
    jql: 'due >= now() AND due <= 7d ORDER BY due ASC',
    category: 'time'
  },
  {
    id: 'high-priority',
    label: 'High Priority',
    emoji: '🔥',
    description: 'Highest and High priority issues',
    jql: 'priority in (Highest, High) AND resolution = Unresolved ORDER BY priority DESC',
    category: 'priority'
  },
  {
    id: 'due-this-week',
    label: 'Due This Week',
    emoji: '📅',
    description: 'Issues due within this week',
    jql: 'due >= startOfWeek() AND due <= endOfWeek() ORDER BY due ASC',
    category: 'time'
  },
  // === COMMONLY USED - Regular daily checks ===
  {
    id: 'recently-updated',
    label: 'Recently Updated',
    emoji: '🔄',
    description: 'Updated in the last 24 hours',
    jql: 'updated >= -1d ORDER BY updated DESC',
    category: 'time'
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
  {
    id: 'in-progress',
    label: 'In Progress',
    emoji: '🔧',
    description: 'Issues being worked on',
    jql: 'status = "In Progress" ORDER BY updated DESC',
    category: 'priority'
  },
  {
    id: 'recently-viewed',
    label: 'Recently Viewed',
    emoji: '🕐',
    description: 'Issues you recently viewed',
    jql: 'issuekey in issueHistory() ORDER BY lastViewed DESC',
    category: 'personal'
  },
  {
    id: 'unassigned',
    label: 'Unassigned',
    emoji: '❓',
    description: 'Issues without an assignee',
    jql: 'assignee IS EMPTY AND resolution = Unresolved ORDER BY created DESC',
    category: 'priority'
  },
  // === MODERATE USE - Weekly/periodic checks ===
  {
    id: 'created-today',
    label: 'Created Today',
    emoji: '🆕',
    description: 'Issues created today',
    jql: 'created >= startOfDay() ORDER BY created DESC',
    category: 'time'
  },
  {
    id: 'created-this-week',
    label: 'Created This Week',
    emoji: '📅',
    description: 'Issues created this week',
    jql: 'created >= startOfWeek() ORDER BY created DESC',
    category: 'time'
  },
  {
    id: 'no-due-date',
    label: 'No Due Date',
    emoji: '❓',
    description: 'Issues without a due date',
    jql: 'due IS EMPTY AND resolution = Unresolved ORDER BY priority DESC',
    category: 'time'
  },
  {
    id: 'team-open',
    label: 'All Open Issues',
    emoji: '📂',
    description: 'All open issues in project',
    jql: 'resolution = Unresolved ORDER BY priority DESC, updated DESC',
    category: 'team'
  },
  {
    id: 'resolved-this-week',
    label: 'Resolved This Week',
    emoji: '✅',
    description: 'Issues resolved this week',
    jql: 'resolved >= startOfWeek() ORDER BY resolved DESC',
    category: 'time'
  },
  {
    id: 'recently-resolved',
    label: 'Recently Resolved',
    emoji: '🎉',
    description: 'Resolved in the last 7 days',
    jql: 'resolved >= -7d ORDER BY resolved DESC',
    category: 'priority'
  },
  {
    id: 'open-tasks',
    label: 'Open Tasks',
    emoji: '✅',
    description: 'All unresolved tasks',
    jql: 'issuetype = Task AND resolution = Unresolved ORDER BY priority DESC, created DESC',
    category: 'team'
  },
  {
    id: 'blocked',
    label: 'Blocked',
    emoji: '🚫',
    description: 'Issues with Blocked status',
    jql: 'status = Blocked ORDER BY updated DESC',
    category: 'priority'
  },
  // === LESS COMMON - Specialized searches ===
  {
    id: 'my-comments',
    label: 'My Comments',
    emoji: '💬',
    description: 'Issues I commented on',
    jql: 'issuekey in issueHistory() AND updated >= -30d ORDER BY updated DESC',
    category: 'personal'
  },
  {
    id: 'stale',
    label: 'Stale Issues',
    emoji: '🕸️',
    description: 'Not updated in 30+ days',
    jql: 'updated < -30d AND resolution = Unresolved ORDER BY updated ASC',
    category: 'team'
  },
  {
    id: 'has-attachments',
    label: 'Has Attachments',
    emoji: '📎',
    description: 'Issues with attachments',
    jql: 'attachments IS NOT EMPTY ORDER BY updated DESC',
    category: 'team'
  },
  {
    id: 'updated-since-login',
    label: 'Updated Since Login',
    emoji: '🔑',
    description: 'Updated since your session started',
    jql: 'updated >= currentLogin() ORDER BY updated DESC',
    category: 'time'
  },
  // === DEV/SPRINT FOCUSED - Less used in AP ===
  {
    id: 'blockers',
    label: 'Blockers',
    emoji: '🚨',
    description: 'Blocker priority issues',
    jql: 'priority = Blocker AND resolution = Unresolved ORDER BY created DESC',
    category: 'priority'
  },
  {
    id: 'critical',
    label: 'Critical Issues',
    emoji: '💥',
    description: 'Critical priority issues',
    jql: 'priority = Critical AND resolution = Unresolved ORDER BY created DESC',
    category: 'priority'
  },
  {
    id: 'open-bugs',
    label: 'Open Bugs',
    emoji: '🐛',
    description: 'All unresolved bugs',
    jql: 'issuetype = Bug AND resolution = Unresolved ORDER BY priority DESC, created DESC',
    category: 'team'
  },
  {
    id: 'open-stories',
    label: 'Open Stories',
    emoji: '📖',
    description: 'All unresolved stories',
    jql: 'issuetype = Story AND resolution = Unresolved ORDER BY priority DESC, created DESC',
    category: 'team'
  },
  {
    id: 'current-sprint',
    label: 'Current Sprint',
    emoji: '🏃',
    description: 'Issues in active sprint',
    jql: 'sprint in openSprints() ORDER BY priority DESC',
    category: 'team'
  },
  {
    id: 'next-sprint',
    label: 'Next Sprint',
    emoji: '⏭️',
    description: 'Issues in upcoming sprints',
    jql: 'sprint in futureSprints() ORDER BY priority DESC',
    category: 'team'
  },
  {
    id: 'backlog',
    label: 'Backlog',
    emoji: '📚',
    description: 'Issues not in any sprint',
    jql: 'sprint IS EMPTY AND resolution = Unresolved ORDER BY priority DESC',
    category: 'team'
  },
  {
    id: 'voted',
    label: 'Voted For',
    emoji: '🗳️',
    description: 'Issues you voted for',
    jql: 'voter = currentUser() ORDER BY updated DESC',
    category: 'personal'
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
    id: 'creator',
    label: 'Creator',
    emoji: '👷',
    description: 'Original creator of the issue',
    jqlField: 'creator',
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
  {
    id: 'voter',
    label: 'Voted by',
    emoji: '🗳️',
    description: 'Who voted for this issue',
    jqlField: 'voter',
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
    id: 'environment',
    label: 'Environment contains',
    emoji: '🌍',
    description: 'Search in environment field',
    jqlField: 'environment',
    category: 'what',
    defaultOperator: 'contains',
    valueType: 'text'
  },
  {
    id: 'comment',
    label: 'Comment contains',
    emoji: '💬',
    description: 'Search in issue comments',
    jqlField: 'comment',
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
  {
    id: 'issuekey',
    label: 'Issue Key',
    emoji: '🔑',
    description: 'Search by issue key (e.g., PROJ-123)',
    jqlField: 'issuekey',
    category: 'what',
    defaultOperator: 'equals',
    valueType: 'text'
  },
  {
    id: 'parent',
    label: 'Parent Issue',
    emoji: '⬆️',
    description: 'Parent of sub-task',
    jqlField: 'parent',
    category: 'what',
    defaultOperator: 'equals',
    valueType: 'text'
  },
  {
    id: 'attachments',
    label: 'Has Attachments',
    emoji: '📎',
    description: 'Issues with/without attachments',
    jqlField: 'attachments',
    category: 'what',
    defaultOperator: 'is-not-empty',
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
    commonValues: ['Open', 'In Progress', 'Done', 'Closed', 'To Do', 'Blocked', 'Resolved', 'Reopened']
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
    commonValues: ['Unresolved', 'Done', 'Fixed', "Won't Do", "Won't Fix", 'Duplicate', 'Cannot Reproduce', 'Incomplete']
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
    commonValues: ['Highest', 'High', 'Medium', 'Low', 'Lowest', 'Blocker', 'Critical', 'Major', 'Minor', 'Trivial']
  },
  {
    id: 'votes',
    label: 'Votes',
    emoji: '👍',
    description: 'Number of votes',
    jqlField: 'votes',
    category: 'status',
    defaultOperator: 'greater-than',
    valueType: 'number'
  },
  {
    id: 'watchers',
    label: 'Watcher Count',
    emoji: '👁️',
    description: 'Number of watchers',
    jqlField: 'watchers',
    category: 'status',
    defaultOperator: 'greater-than',
    valueType: 'number'
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
    commonValues: ['Bug', 'Task', 'Story', 'Epic', 'Sub-task', 'Improvement', 'New Feature', 'Incident', 'Service Request', 'Change']
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
  {
    id: 'category',
    label: 'Category',
    emoji: '📂',
    description: 'Project category',
    jqlField: 'category',
    category: 'where',
    defaultOperator: 'equals',
    valueType: 'list'
  },
  {
    id: 'fixVersion',
    label: 'Fix Version',
    emoji: '🏁',
    description: 'Target release version',
    jqlField: 'fixVersion',
    category: 'where',
    defaultOperator: 'equals',
    valueType: 'list'
  },
  {
    id: 'affectedVersion',
    label: 'Affected Version',
    emoji: '🐛',
    description: 'Version affected by issue',
    jqlField: 'affectedVersion',
    category: 'where',
    defaultOperator: 'equals',
    valueType: 'list'
  },
  {
    id: 'sprint',
    label: 'Sprint',
    emoji: '🏃',
    description: 'Agile sprint',
    jqlField: 'sprint',
    category: 'where',
    defaultOperator: 'equals',
    valueType: 'list'
  },
  {
    id: 'level',
    label: 'Security Level',
    emoji: '🔒',
    description: 'Issue security level',
    jqlField: 'level',
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
  },
  {
    id: 'lastViewed',
    label: 'Last Viewed',
    emoji: '👁️',
    description: 'When you last viewed it',
    jqlField: 'lastViewed',
    category: 'when',
    defaultOperator: 'greater-than-equals',
    valueType: 'date'
  },
  // TIME TRACKING
  {
    id: 'originalEstimate',
    label: 'Original Estimate',
    emoji: '📊',
    description: 'Original time estimate',
    jqlField: 'originalEstimate',
    category: 'status',
    defaultOperator: 'greater-than',
    valueType: 'number'
  },
  {
    id: 'remainingEstimate',
    label: 'Remaining Estimate',
    emoji: '⏳',
    description: 'Remaining time estimate',
    jqlField: 'remainingEstimate',
    category: 'status',
    defaultOperator: 'greater-than',
    valueType: 'number'
  },
  {
    id: 'timeSpent',
    label: 'Time Spent',
    emoji: '⏱️',
    description: 'Time logged on issue',
    jqlField: 'timeSpent',
    category: 'status',
    defaultOperator: 'greater-than',
    valueType: 'number'
  },
  {
    id: 'workRatio',
    label: 'Work Ratio',
    emoji: '📈',
    description: 'Logged vs estimated time (%)',
    jqlField: 'workRatio',
    category: 'status',
    defaultOperator: 'greater-than',
    valueType: 'number'
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
  // Relative past - common
  { label: 'Today', value: 'startOfDay()', description: 'Start of today' },
  { label: 'Yesterday', value: '-1d', description: '24 hours ago' },
  { label: 'Last 2 days', value: '-2d', description: '2 days ago' },
  { label: 'Last 3 days', value: '-3d', description: '3 days ago' },
  { label: 'This week', value: 'startOfWeek()', description: 'Start of this week' },
  { label: 'Last week', value: 'startOfWeek(-1)', description: 'Start of last week' },
  { label: 'Last 7 days', value: '-7d', description: '7 days ago' },
  { label: 'Last 14 days', value: '-14d', description: '14 days ago' },
  { label: 'This month', value: 'startOfMonth()', description: 'Start of this month' },
  { label: 'Last month', value: 'startOfMonth(-1)', description: 'Start of last month' },
  { label: 'Last 30 days', value: '-30d', description: '30 days ago' },
  { label: 'Last 60 days', value: '-60d', description: '60 days ago' },
  { label: 'Last 90 days', value: '-90d', description: '90 days ago' },
  { label: 'This quarter', value: '-90d', description: 'Approximately this quarter' },
  { label: 'This year', value: 'startOfYear()', description: 'Start of this year' },
  { label: 'Last year', value: 'startOfYear(-1)', description: 'Start of last year' },
  // End dates - for due date ranges
  { label: 'End of today', value: 'endOfDay()', description: 'End of today' },
  { label: 'End of tomorrow', value: 'endOfDay(1)', description: 'End of tomorrow' },
  { label: 'End of week', value: 'endOfWeek()', description: 'End of this week' },
  { label: 'End of next week', value: 'endOfWeek(1)', description: 'End of next week' },
  { label: 'End of month', value: 'endOfMonth()', description: 'End of this month' },
  { label: 'End of next month', value: 'endOfMonth(1)', description: 'End of next month' },
  { label: 'End of year', value: 'endOfYear()', description: 'End of this year' },
  // Session-based
  { label: 'Since login', value: 'currentLogin()', description: 'Since current session started' },
  { label: 'Since last login', value: 'lastLogin()', description: 'Since previous session' },
  // Now
  { label: 'Now', value: 'now()', description: 'Current date and time' }
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

interface SortEntry {
  field: string;
  direction: 'ASC' | 'DESC';
}

interface RecentFilter {
  jql: string;
  label?: string;
  usedAt: number;
}

interface V2State {
  mode: ViewMode;
  filters: FilterCard[];
  sortField: string;
  sortDirection: 'ASC' | 'DESC';
  sortEntries: SortEntry[]; // Multiple sort support
  showAdvancedSort: boolean;
  advancedSorts: JqlSortState[];
  searchText: string; // for quick search mode
  selectedPresets: Set<string>; // Multiple presets can be selected
  showReferencePanel: boolean; // For advanced mode
  customPresets: QuickPreset[]; // User-created presets
  pinnedPresets: string[]; // IDs of presets to show in visual mode (4 max)
  recentFilters: RecentFilter[]; // Recently used filters
  draggedPresetId: string | null; // For drag-and-drop reordering
}

// ============================================================================
// STORAGE HELPERS - Using GM_setValue/GM_getValue for Tampermonkey/Violentmonkey
// ============================================================================

const gmStorage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      // Try GM_getValue first (Tampermonkey/Violentmonkey)
      if (typeof GM_getValue !== 'undefined') {
        const val = GM_getValue(key, null);
        if (val !== null) return JSON.parse(val);
      }
      // Fallback to localStorage
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      const json = JSON.stringify(value);
      // Try GM_setValue first (Tampermonkey/Violentmonkey)
      if (typeof GM_setValue !== 'undefined') {
        GM_setValue(key, json);
      }
      // Also save to localStorage as backup
      localStorage.setItem(key, json);
    } catch (e) {
      console.warn('Failed to save to storage:', e);
    }
  }
};

// Declare GM functions for TypeScript
declare function GM_getValue(key: string, defaultValue: any): any;
declare function GM_setValue(key: string, value: any): void;

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
    style?: string;
  } = {}
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.text != null) el.textContent = options.text;
  if (options.html != null) el.innerHTML = options.html;
  if (options.style != null) el.style.cssText = options.style;
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

  // Add sorting - support multiple sort entries
  if (state.sortEntries && state.sortEntries.length > 0) {
    const sortParts = state.sortEntries.map(e => `${e.field} ${e.direction}`);
    jql += ` ORDER BY ${sortParts.join(', ')}`;
  } else if (state.sortField) {
    // Fallback to legacy single sort
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
    sortEntries: [{ field: 'updated', direction: 'DESC' }],
    showAdvancedSort: false,
    advancedSorts: [],
    searchText: '',
    selectedPresets: new Set(),
    showReferencePanel: false,
    customPresets: [],
    pinnedPresets: ['my-active-work', 'my-open', 'recently-updated', 'overdue'],
    recentFilters: [],
    draggedPresetId: null
  };

  private panel!: HTMLDivElement;
  private previewEl!: HTMLTextAreaElement;
  private filtersContainer!: HTMLDivElement;
  private advancedTextarea!: HTMLTextAreaElement;
  private toastEl!: HTMLDivElement;

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
    this.loadStoredPreferences();
  }

  private loadStoredPreferences(): void {
    // Load custom presets
    this.state.customPresets = gmStorage.get<QuickPreset[]>(CUSTOM_PRESETS_KEY, []);
    // Load pinned presets (the 4 shown in visual mode)
    this.state.pinnedPresets = gmStorage.get<string[]>(PINNED_PRESETS_KEY,
      ['my-active-work', 'my-open', 'recently-updated', 'overdue']
    );
    // Load recent filters
    this.state.recentFilters = gmStorage.get<RecentFilter[]>(RECENT_FILTERS_KEY, []);
  }

  private saveCustomPresets(): void {
    gmStorage.set(CUSTOM_PRESETS_KEY, this.state.customPresets);
  }

  private savePinnedPresets(): void {
    gmStorage.set(PINNED_PRESETS_KEY, this.state.pinnedPresets);
  }

  private saveRecentFilters(): void {
    gmStorage.set(RECENT_FILTERS_KEY, this.state.recentFilters);
  }

  private addToRecentFilters(jql: string, label?: string): void {
    const now = Date.now();
    // Remove if already exists
    this.state.recentFilters = this.state.recentFilters.filter(f => f.jql !== jql);
    // Add to front
    this.state.recentFilters.unshift({ jql, label, usedAt: now });
    // Keep only last 4
    this.state.recentFilters = this.state.recentFilters.slice(0, 4);
    this.saveRecentFilters();
    // Update the Recent Filters section in Visual mode if visible
    if (this.state.mode === 'visual') {
      this.rerenderVisualMode();
    }
  }

  private getAllPresets(): QuickPreset[] {
    return [...QUICK_PRESETS, ...this.state.customPresets];
  }

  mount(): void {
    this.shadow.appendChild(this.renderStyles());
    this.panel = this.renderPanel();
    this.shadow.appendChild(this.panel);
    this.updatePreview();

    // Hijack keyboard events on textboxes to prevent Jira shortcuts from firing
    this.panel.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        e.stopPropagation();
      }
    }, true);
    this.panel.addEventListener('keyup', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        e.stopPropagation();
      }
    }, true);
    this.panel.addEventListener('keypress', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        e.stopPropagation();
      }
    }, true);
  }

  destroy(): void {
    this.destroyed = true;
    this.panel?.remove();
    this.toastEl?.remove();
  }

  private showToast(message: string): void {
    if (!this.toastEl) {
      this.toastEl = createElement('div', { className: 'cv-toast' });
      this.shadow.appendChild(this.toastEl);
    }
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2000);
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
        flex-direction: column;
        gap: 8px;
        padding: 12px 16px;
        background: var(--cv-bg-secondary);
        border: 1px solid var(--cv-border);
        border-radius: var(--cv-radius-sm);
      }

      .cv-sort-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .cv-sort-label {
        font-size: 13px;
        color: var(--cv-text-muted);
        white-space: nowrap;
        min-width: 55px;
      }

      .cv-sort-section select {
        flex: 1;
        max-width: 160px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        padding: 6px 10px;
        border-radius: var(--cv-radius-sm);
        font-size: 13px;
        color: var(--cv-text);
        cursor: pointer;
      }

      /* Modern Secondary Action Button */
      .cv-secondary-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        color: var(--cv-text-muted);
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .cv-secondary-btn:hover {
        border-color: var(--cv-primary-light);
        background: rgba(99, 102, 241, 0.08);
        color: var(--cv-primary);
        transform: translateY(-1px);
      }

      .cv-secondary-btn:active {
        transform: translateY(0);
      }

      /* Small Pill Button */
      .cv-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        border-radius: 999px;
        font-size: 12px;
        font-weight: 500;
        color: var(--cv-text-muted);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .cv-pill-btn:hover {
        border-color: var(--cv-primary-light);
        background: rgba(99, 102, 241, 0.08);
        color: var(--cv-primary);
      }

      /* Copy Button with text */
      .cv-copy-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        color: var(--cv-text-muted);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .cv-copy-btn:hover {
        border-color: var(--cv-primary-light);
        background: rgba(99, 102, 241, 0.08);
        color: var(--cv-primary);
      }

      .cv-copy-btn.copied {
        border-color: var(--cv-success);
        background: rgba(34, 197, 94, 0.1);
        color: var(--cv-success);
      }

      /* Remove Sort Button */
      .cv-remove-sort-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        border-radius: 6px;
        font-size: 12px;
        color: var(--cv-text-muted);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .cv-remove-sort-btn:hover {
        border-color: var(--cv-danger);
        background: rgba(239, 68, 68, 0.1);
        color: var(--cv-danger);
      }

      /* Drag and Drop Styles */
      .cv-preset-picker-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        background: var(--cv-bg-hover);
        cursor: grab;
        transition: all 0.2s ease;
        border: 2px solid transparent;
      }

      .cv-preset-picker-row:hover {
        background: var(--cv-bg-secondary);
      }

      .cv-preset-picker-row.pinned {
        background: rgba(99, 102, 241, 0.1);
        border-color: rgba(99, 102, 241, 0.2);
      }

      .cv-preset-picker-row.dragging {
        opacity: 0.6;
        transform: scale(1.02);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        cursor: grabbing;
      }

      .cv-preset-picker-row.drag-over {
        border-top-color: var(--cv-primary);
        background: rgba(99, 102, 241, 0.15);
      }

      .cv-preset-picker-row .drag-handle {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px;
        color: var(--cv-text-light);
        cursor: grab;
      }

      .cv-preset-picker-row .drag-handle span {
        display: block;
        width: 12px;
        height: 2px;
        background: currentColor;
        border-radius: 1px;
      }

      .cv-preset-picker-row .preset-checkbox {
        width: 18px;
        height: 18px;
        accent-color: var(--cv-primary);
        cursor: pointer;
      }

      .cv-preset-picker-row .preset-info {
        flex: 1;
        font-size: 14px;
        color: var(--cv-text);
      }

      .cv-preset-picker-row .delete-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        border-radius: 6px;
        color: var(--cv-text-muted);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .cv-preset-picker-row .delete-btn:hover {
        background: rgba(239, 68, 68, 0.1);
        color: var(--cv-danger);
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

      /* Toast notification */
      .cv-toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        padding: 12px 24px;
        background: var(--cv-text);
        color: white;
        border-radius: var(--cv-radius-sm);
        font-size: 14px;
        font-weight: 500;
        box-shadow: var(--cv-shadow-lg);
        opacity: 0;
        transition: all 300ms ease;
        z-index: 2147483647;
        pointer-events: none;
      }

      .cv-toast.show {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }

      /* Reference panel for advanced mode */
      .cv-ref-panel {
        position: absolute;
        bottom: 100%;
        left: 0;
        right: 0;
        background: var(--cv-bg);
        border: 1px solid var(--cv-border);
        border-radius: var(--cv-radius-sm);
        box-shadow: var(--cv-shadow-lg);
        margin-bottom: 8px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 10;
      }

      .cv-ref-tabs {
        display: flex;
        border-bottom: 1px solid var(--cv-border);
        padding: 8px;
        gap: 4px;
        flex-wrap: wrap;
      }

      .cv-ref-tab {
        padding: 6px 12px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg);
        border-radius: 999px;
        font-size: 12px;
        cursor: pointer;
        transition: all var(--cv-transition);
      }

      .cv-ref-tab:hover {
        border-color: var(--cv-primary-light);
        color: var(--cv-primary);
      }

      .cv-ref-tab.active {
        background: var(--cv-primary);
        border-color: var(--cv-primary);
        color: white;
      }

      .cv-ref-content {
        padding: 12px;
      }

      .cv-ref-items {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .cv-ref-item {
        padding: 4px 10px;
        border: 1px solid var(--cv-border);
        background: var(--cv-bg-secondary);
        border-radius: var(--cv-radius-sm);
        font-size: 12px;
        font-family: "JetBrains Mono", "Fira Code", monospace;
        cursor: pointer;
        transition: all var(--cv-transition);
      }

      .cv-ref-item:hover {
        border-color: var(--cv-primary);
        background: rgba(99, 102, 241, 0.1);
        color: var(--cv-primary);
      }

      /* Preset multi-select indicator */
      .cv-preset-btn.selected .cv-preset-check {
        display: inline-flex;
      }

      .cv-preset-check {
        display: none;
        width: 18px;
        height: 18px;
        align-items: center;
        justify-content: center;
        background: var(--cv-primary);
        color: white;
        border-radius: 50%;
        font-size: 10px;
        margin-left: auto;
      }

      .cv-preset-btn {
        flex-direction: row;
        align-items: center;
      }

      .cv-preset-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
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

    // Presets section - multi-select
    const presetsSection = createElement('div', { className: 'cv-section' });
    const presetsTitle = createElement('div', { className: 'cv-section-title' });
    presetsTitle.innerHTML = '⚡ Quick Filters <span style="font-weight: normal; text-transform: none; font-size: 11px;">(select any combination)</span>';
    presetsSection.appendChild(presetsTitle);

    const presetsGrid = createElement('div', { className: 'cv-presets-grid' });
    QUICK_PRESETS.forEach((preset) => {
      const btn = createElement('button', { className: 'cv-preset-btn' });
      if (this.state.selectedPresets.has(preset.id)) btn.classList.add('selected');

      const content = createElement('div', { className: 'cv-preset-content' });
      const label = createElement('span', { className: 'cv-preset-label' });
      label.appendChild(createElement('span', { className: 'cv-preset-emoji', text: preset.emoji }));
      label.appendChild(document.createTextNode(preset.label));
      const desc = createElement('span', { className: 'cv-preset-desc', text: preset.description });
      content.appendChild(label);
      content.appendChild(desc);

      const check = createElement('span', { className: 'cv-preset-check', text: '✓' });

      btn.appendChild(content);
      btn.appendChild(check);

      btn.addEventListener('click', () => {
        if (this.state.selectedPresets.has(preset.id)) {
          this.state.selectedPresets.delete(preset.id);
        } else {
          this.state.selectedPresets.add(preset.id);
        }
        this.combineSelectedPresets();
        this.rerender();
      });

      presetsGrid.appendChild(btn);
    });
    presetsSection.appendChild(presetsGrid);
    container.appendChild(presetsSection);

    // Add "+ Create Filter" button section
    const createSection = createElement('div', { className: 'cv-section', style: 'margin-top: 16px;' });
    const createBtn = createElement('button', {
      className: 'cv-btn',
      style: 'width: 100%; border-style: dashed; opacity: 0.8;'
    });
    createBtn.innerHTML = '➕ Create Custom Filter';
    createBtn.title = 'Create a custom quick filter from any JQL query';
    createBtn.addEventListener('click', () => this.showCreatePresetModal());
    createSection.appendChild(createBtn);
    container.appendChild(createSection);

    // Natural language search section
    const searchSection = createElement('div', { className: 'cv-section' });
    searchSection.style.marginTop = '20px';
    const searchTitle = createElement('div', { className: 'cv-section-title' });
    searchTitle.textContent = '🔍 Natural Language Search';
    searchSection.appendChild(searchTitle);

    const input = createElement('input', {
      className: 'cv-quick-search-input',
      attrs: { type: 'text', placeholder: 'Describe what you\'re looking for...' }
    }) as HTMLInputElement;
    input.value = this.state.searchText;
    input.addEventListener('input', () => {
      this.state.searchText = input.value;
      this.state.selectedPresets.clear(); // Clear presets when typing
      this.parseQuickSearch(input.value);
      // Only update preview, don't rerender (prevents scroll jump)
      this.updatePreview();
    });
    searchSection.appendChild(input);

    // Hint
    const hint = createElement('div', { className: 'cv-quick-search-hint' });
    hint.innerHTML = '<strong>Examples:</strong> "my open bugs", "high priority created this week", "unassigned tasks due soon", "status in progress project MYPROJ"';
    searchSection.appendChild(hint);

    // Quick examples
    const examples = createElement('div', { className: 'cv-quick-search-examples' });
    const exampleQueries = [
      'my open issues',
      'high priority bugs',
      'updated today',
      'unassigned tasks',
      'created this week',
      'overdue issues',
      'blocked items',
      'epic stories'
    ];
    exampleQueries.forEach((text) => {
      const btn = createButton(text, 'cv-quick-example');
      btn.addEventListener('click', () => {
        input.value = text;
        this.state.searchText = text;
        this.state.selectedPresets.clear();
        this.parseQuickSearch(text);
        this.rerender();
      });
      examples.appendChild(btn);
    });
    searchSection.appendChild(examples);
    container.appendChild(searchSection);

    return container;
  }

  private combineSelectedPresets(): void {
    // Combine multiple presets intelligently
    const selected = Array.from(this.state.selectedPresets);
    if (selected.length === 0) {
      this.previewEl.value = '';
      return;
    }

    // Parse each preset's JQL and combine clauses
    const clauses: string[] = [];
    let orderBy = '';

    for (const presetId of selected) {
      const preset = QUICK_PRESETS.find(p => p.id === presetId);
      if (!preset) continue;

      // Extract ORDER BY if present
      const parts = preset.jql.split(/\s+ORDER\s+BY\s+/i);
      const mainClause = parts[0].trim();
      if (parts[1] && !orderBy) {
        orderBy = parts[1].trim();
      }

      if (mainClause) {
        clauses.push(`(${mainClause})`);
      }
    }

    // Combine with AND (can be smart about it)
    let combined = clauses.join(' AND ');

    // Simplify: remove duplicate conditions
    combined = this.simplifyJql(combined);

    if (orderBy) {
      combined += ` ORDER BY ${orderBy}`;
    }

    this.previewEl.value = combined;
  }

  private simplifyJql(jql: string): string {
    // Simplify combined JQL by removing redundant standalone clauses
    let result = jql;

    // Only remove standalone duplicate resolution = Unresolved clauses
    // Pattern: (resolution = Unresolved) as a standalone group
    let foundStandaloneResolution = false;
    result = result.replace(/\(\s*resolution\s*=\s*Unresolved\s*\)/gi, (match) => {
      if (foundStandaloneResolution) {
        return ''; // Remove duplicate standalone clause
      }
      foundStandaloneResolution = true;
      return match;
    });

    // Clean up resulting empty ANDs and whitespace
    result = result.replace(/AND\s+AND/gi, 'AND');
    result = result.replace(/^\s*AND\s+/i, '');
    result = result.replace(/\s+AND\s*$/i, '');
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  private parseQuickSearch(text: string): void {
    // Enhanced natural language parsing with fuzzy matching
    const lower = text.toLowerCase().trim();
    if (!lower) {
      this.state.filters = [];
      this.updatePreview();
      return;
    }

    this.state.filters = [];

    // Tokenize for better matching
    const tokens = lower.split(/\s+/);
    const hasWord = (word: string) => tokens.some(t => t.includes(word) || word.includes(t));
    const hasPhrase = (phrase: string) => lower.includes(phrase);

    // User context detection
    if (hasWord('my') || hasPhrase('assigned to me') || hasWord('mine')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'assignee',
        operatorKey: 'equals',
        value: 'currentUser()',
        values: [],
        isNegated: false
      });
    }

    if (hasWord('unassigned') || hasPhrase('no assignee') || hasPhrase('not assigned')) {
      // Remove any existing assignee filter
      this.state.filters = this.state.filters.filter(f => f.fieldId !== 'assignee');
      this.state.filters.push({
        id: createId(),
        fieldId: 'assignee',
        operatorKey: 'is-empty',
        value: '',
        values: [],
        isNegated: false
      });
    }

    if (hasPhrase('created by me') || hasPhrase('i created') || hasPhrase('reported by me')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'reporter',
        operatorKey: 'equals',
        value: 'currentUser()',
        values: [],
        isNegated: false
      });
    }

    // Status detection
    if (hasWord('open') || hasWord('unresolved') || hasWord('active')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'resolution',
        operatorKey: 'is-empty',
        value: '',
        values: [],
        isNegated: false
      });
    }

    if (hasWord('closed') || hasWord('resolved') || hasWord('done') || hasWord('completed')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'resolution',
        operatorKey: 'is-not-empty',
        value: '',
        values: [],
        isNegated: false
      });
    }

    if (hasWord('blocked') || hasWord('blocking')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'status',
        operatorKey: 'equals',
        value: 'Blocked',
        values: [],
        isNegated: false
      });
    }

    if (hasPhrase('in progress') || hasWord('wip') || hasWord('working')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'status',
        operatorKey: 'equals',
        value: 'In Progress',
        values: [],
        isNegated: false
      });
    }

    // Issue type detection
    if (hasWord('bug') || hasWord('bugs') || hasWord('defect') || hasWord('defects')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'issuetype',
        operatorKey: 'equals',
        value: 'Bug',
        values: [],
        isNegated: false
      });
    }

    if (hasWord('task') || hasWord('tasks')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'issuetype',
        operatorKey: 'equals',
        value: 'Task',
        values: [],
        isNegated: false
      });
    }

    if (hasWord('story') || hasWord('stories')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'issuetype',
        operatorKey: 'equals',
        value: 'Story',
        values: [],
        isNegated: false
      });
    }

    if (hasWord('epic') || hasWord('epics')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'issuetype',
        operatorKey: 'equals',
        value: 'Epic',
        values: [],
        isNegated: false
      });
    }

    // Priority detection
    if (hasPhrase('high priority') || hasWord('urgent') || hasWord('critical') || hasWord('important')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'priority',
        operatorKey: 'in',
        value: '',
        values: ['Highest', 'High'],
        isNegated: false
      });
    }

    if (hasPhrase('low priority') || hasWord('minor') || hasWord('trivial')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'priority',
        operatorKey: 'in',
        value: '',
        values: ['Low', 'Lowest'],
        isNegated: false
      });
    }

    // Time detection - updated/created
    if (hasWord('today')) {
      const field = hasPhrase('created today') ? 'created' : 'updated';
      this.state.filters.push({
        id: createId(),
        fieldId: field,
        operatorKey: 'greater-than-equals',
        value: 'startOfDay()',
        values: [],
        isNegated: false
      });
    }

    if (hasWord('yesterday')) {
      const field = hasPhrase('created yesterday') ? 'created' : 'updated';
      this.state.filters.push({
        id: createId(),
        fieldId: field,
        operatorKey: 'greater-than-equals',
        value: '-1d',
        values: [],
        isNegated: false
      });
    }

    if (hasPhrase('this week') || hasPhrase('past week') || hasPhrase('last week')) {
      const field = hasPhrase('created') ? 'created' : 'updated';
      this.state.filters.push({
        id: createId(),
        fieldId: field,
        operatorKey: 'greater-than-equals',
        value: hasPhrase('last week') ? '-7d' : 'startOfWeek()',
        values: [],
        isNegated: false
      });
    }

    if (hasPhrase('this month') || hasPhrase('past month') || hasPhrase('last month')) {
      const field = hasPhrase('created') ? 'created' : 'updated';
      this.state.filters.push({
        id: createId(),
        fieldId: field,
        operatorKey: 'greater-than-equals',
        value: hasPhrase('last month') ? '-30d' : 'startOfMonth()',
        values: [],
        isNegated: false
      });
    }

    if (hasWord('recent') || hasWord('recently') || hasWord('latest')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'updated',
        operatorKey: 'greater-than-equals',
        value: '-7d',
        values: [],
        isNegated: false
      });
    }

    // Due date detection
    if (hasPhrase('due this week') || hasPhrase('due soon')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'due',
        operatorKey: 'less-than-equals',
        value: 'endOfWeek()',
        values: [],
        isNegated: false
      });
    }

    if (hasWord('overdue') || hasPhrase('past due') || hasWord('late')) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'due',
        operatorKey: 'less-than',
        value: 'now()',
        values: [],
        isNegated: false
      });
      // Also add unresolved if not present
      if (!this.state.filters.some(f => f.fieldId === 'resolution')) {
        this.state.filters.push({
          id: createId(),
          fieldId: 'resolution',
          operatorKey: 'is-empty',
          value: '',
          values: [],
          isNegated: false
        });
      }
    }

    // Project detection - look for uppercase words that might be project keys
    const projectMatch = text.match(/\b(project\s+)?([A-Z]{2,10})\b/);
    if (projectMatch && projectMatch[2]) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'project',
        operatorKey: 'equals',
        value: projectMatch[2],
        values: [],
        isNegated: false
      });
    }

    // Text search - if there's quoted text, use it for summary search
    const quotedMatch = text.match(/"([^"]+)"/);
    if (quotedMatch) {
      this.state.filters.push({
        id: createId(),
        fieldId: 'summary',
        operatorKey: 'contains',
        value: quotedMatch[1],
        values: [],
        isNegated: false
      });
    }

    // Set default sort
    if (!this.state.sortField) {
      this.state.sortField = 'updated';
      this.state.sortDirection = 'DESC';
    }

    this.updatePreview();
  }

  // ==========================================================================
  // VISUAL MODE - Card-based filter builder
  // ==========================================================================

  private renderVisualMode(): HTMLDivElement {
    const container = createElement('div');

    // Quick presets (pinned - max 4 shown with swap button)
    const presetsSection = createElement('div', { className: 'cv-section' });
    const presetsTitleRow = createElement('div', { className: 'cv-section-title', style: 'display: flex; justify-content: space-between; align-items: center;' });
    const titleSpan = createElement('span', { text: '⚡ Quick Filters' });
    presetsTitleRow.appendChild(titleSpan);

    // Swap button to choose which 4 presets to show
    const swapBtn = createElement('button', { className: 'cv-pill-btn' });
    swapBtn.innerHTML = '<span>⚙️</span> Customize';
    swapBtn.addEventListener('click', () => this.showPresetPicker());
    presetsTitleRow.appendChild(swapBtn);
    presetsSection.appendChild(presetsTitleRow);

    const presetsGrid = createElement('div', { className: 'cv-presets-grid' });
    const allPresets = this.getAllPresets();

    // Show pinned presets (up to 4)
    this.state.pinnedPresets.slice(0, 4).forEach((presetId) => {
      const preset = allPresets.find(p => p.id === presetId);
      if (!preset) return;

      const btn = createElement('button', { className: 'cv-preset-btn' });
      const label = createElement('span', { className: 'cv-preset-label' });
      label.appendChild(createElement('span', { className: 'cv-preset-emoji', text: preset.emoji }));
      label.appendChild(document.createTextNode(preset.label));
      btn.appendChild(label);
      btn.title = preset.description;
      btn.addEventListener('click', () => {
        this.state.selectedPresets.clear();
        this.state.selectedPresets.add(preset.id);
        this.previewEl.value = preset.jql;
        this.addToRecentFilters(preset.jql, preset.label);
      });
      presetsGrid.appendChild(btn);
    });

    presetsSection.appendChild(presetsGrid);
    container.appendChild(presetsSection);

    // Recent Filters section (if any) - limit to 4
    if (this.state.recentFilters.length > 0) {
      const recentSection = createElement('div', { className: 'cv-section' });
      const recentTitle = createElement('div', { className: 'cv-section-title' });
      recentTitle.textContent = '🕐 Recent Filters';
      recentSection.appendChild(recentTitle);

      const recentGrid = createElement('div', { className: 'cv-presets-grid' });
      this.state.recentFilters.slice(0, 4).forEach((recent) => {
        const btn = createElement('button', { className: 'cv-preset-btn cv-recent-btn' });
        const label = createElement('span', { className: 'cv-preset-label' });
        const shortJql = recent.jql.length > 30 ? recent.jql.substring(0, 30) + '...' : recent.jql;
        label.textContent = recent.label || shortJql;
        btn.appendChild(label);
        btn.title = recent.jql;
        btn.addEventListener('click', () => {
          this.previewEl.value = recent.jql;
        });
        recentGrid.appendChild(btn);
      });
      recentSection.appendChild(recentGrid);
      container.appendChild(recentSection);
    }

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
        const option = new Option(f.label, f.id);
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

    const sortFields = [
      { value: 'updated', label: 'Last Updated' },
      { value: 'created', label: 'Created Date' },
      { value: 'priority', label: 'Priority' },
      { value: 'due', label: 'Due Date' },
      { value: 'status', label: 'Status' },
      { value: 'key', label: 'Issue Key' },
      { value: 'assignee', label: 'Assignee' },
      { value: 'reporter', label: 'Reporter' },
      { value: 'resolution', label: 'Resolution' },
      { value: 'resolved', label: 'Resolved Date' }
    ];

    // Initialize sortEntries if empty
    if (this.state.sortEntries.length === 0) {
      this.state.sortEntries = [{ field: this.state.sortField, direction: this.state.sortDirection }];
    }

    // Render each sort entry
    this.state.sortEntries.forEach((entry, index) => {
      const row = createElement('div', { className: 'cv-sort-row' });

      if (index === 0) {
        row.appendChild(createElement('span', { className: 'cv-sort-label', text: 'Sort by' }));
      } else {
        row.appendChild(createElement('span', { className: 'cv-sort-label', text: 'then by' }));
      }

      const fieldSelect = createElement('select') as HTMLSelectElement;
      sortFields.forEach((sf) => {
        const option = new Option(sf.label, sf.value);
        option.selected = sf.value === entry.field;
        fieldSelect.appendChild(option);
      });
      fieldSelect.addEventListener('change', () => {
        entry.field = fieldSelect.value;
        this.syncSortEntriesToLegacy();
        this.updatePreview();
      });

      const dirSelect = createElement('select') as HTMLSelectElement;
      dirSelect.appendChild(new Option('↓ DESC', 'DESC'));
      dirSelect.appendChild(new Option('↑ ASC', 'ASC'));
      dirSelect.value = entry.direction;
      dirSelect.addEventListener('change', () => {
        entry.direction = dirSelect.value as 'ASC' | 'DESC';
        this.syncSortEntriesToLegacy();
        this.updatePreview();
      });

      row.appendChild(fieldSelect);
      row.appendChild(dirSelect);

      // Remove button (only if not the first entry)
      if (index > 0) {
        const removeBtn = createElement('button', { className: 'cv-remove-sort-btn', text: '✕' });
        removeBtn.title = 'Remove sort';
        removeBtn.addEventListener('click', () => {
          this.state.sortEntries.splice(index, 1);
          this.syncSortEntriesToLegacy();
          this.rerenderVisualMode();
        });
        row.appendChild(removeBtn);
      }

      section.appendChild(row);
    });

    // Add another sort button (max 3)
    if (this.state.sortEntries.length < 3) {
      const addSortBtn = createElement('button', { className: 'cv-secondary-btn' });
      addSortBtn.innerHTML = '<span>➕</span> Add secondary sort';
      addSortBtn.addEventListener('click', () => {
        this.state.sortEntries.push({ field: 'priority', direction: 'DESC' });
        this.rerenderVisualMode();
      });
      section.appendChild(addSortBtn);
    }

    return section;
  }

  private syncSortEntriesToLegacy(): void {
    // Keep legacy sortField/sortDirection in sync with first entry
    if (this.state.sortEntries.length > 0) {
      this.state.sortField = this.state.sortEntries[0].field;
      this.state.sortDirection = this.state.sortEntries[0].direction;
    }
  }

  private rerenderVisualMode(): void {
    // Re-render visual mode content
    const body = this.panel.querySelector('.cv-body');
    if (body && this.state.mode === 'visual') {
      body.innerHTML = '';
      body.appendChild(this.renderVisualMode());
    }
  }

  // ==========================================================================
  // PRESET PICKER MODAL - Choose which 4 presets to show
  // ==========================================================================

  private showPresetPicker(): void {
    // Prevent duplicate modals
    const existing = this.shadow.querySelector('.cv-modal-overlay');
    if (existing) {
      return;
    }

    const overlay = createElement('div', { className: 'cv-modal-overlay' });
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;';

    const modal = createElement('div', { className: 'cv-modal' });
    modal.style.cssText = 'background: var(--cv-bg); border-radius: 12px; padding: 20px; max-width: 500px; max-height: 70vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);';

    const title = createElement('h3', { text: '⚙️ Customize Quick Filters', style: 'margin: 0 0 16px 0;' });
    modal.appendChild(title);

    const hint = createElement('p', { text: 'Drag to reorder or click to toggle. First 4 will be shown.', style: 'color: var(--cv-text-muted); font-size: 12px; margin-bottom: 12px;' });
    modal.appendChild(hint);

    const list = createElement('div', { className: 'cv-preset-list' });
    list.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

    const allPresets = this.getAllPresets();

    // Show pinned presets first, then the rest
    const orderedPresets = [
      ...this.state.pinnedPresets.map(id => allPresets.find(p => p.id === id)).filter(Boolean) as QuickPreset[],
      ...allPresets.filter(p => !this.state.pinnedPresets.includes(p.id))
    ];

    orderedPresets.forEach((preset, index) => {
      const isPinned = this.state.pinnedPresets.includes(preset.id);
      const row = createElement('div', { className: `cv-preset-picker-row${isPinned ? ' pinned' : ''}` });
      row.draggable = true;
      row.dataset.presetId = preset.id;

      // Drag handle (modern 3-line grip)
      const handle = createElement('div', { className: 'drag-handle' });
      handle.appendChild(createElement('span'));
      handle.appendChild(createElement('span'));
      handle.appendChild(createElement('span'));
      row.appendChild(handle);

      // Checkbox for pinned
      const checkbox = createElement('input', { className: 'preset-checkbox', attrs: { type: 'checkbox' } }) as HTMLInputElement;
      checkbox.checked = isPinned;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (this.state.pinnedPresets.length < 4) {
            this.state.pinnedPresets.push(preset.id);
            row.classList.add('pinned');
          } else {
            checkbox.checked = false;
            this.showToast('Maximum 4 quick filters allowed');
          }
        } else {
          this.state.pinnedPresets = this.state.pinnedPresets.filter(id => id !== preset.id);
          row.classList.remove('pinned');
        }
        this.savePinnedPresets();
      });
      row.appendChild(checkbox);

      // Preset info
      const info = createElement('span', { className: 'preset-info', text: `${preset.emoji} ${preset.label}` });
      row.appendChild(info);

      // Delete button for custom presets
      if (preset.isCustom) {
        const deleteBtn = createElement('button', { className: 'delete-btn', text: '🗑️' });
        deleteBtn.title = 'Delete custom filter';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteCustomPreset(preset.id);
          overlay.remove();
          this.showPresetPicker(); // Refresh
        });
        row.appendChild(deleteBtn);
      }

      // Drag events with modern visual feedback
      row.addEventListener('dragstart', (e) => {
        this.state.draggedPresetId = preset.id;
        row.classList.add('dragging');
        // Set drag image
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
        }
      });

      row.addEventListener('dragend', () => {
        this.state.draggedPresetId = null;
        row.classList.remove('dragging');
        // Remove drag-over from all rows
        list.querySelectorAll('.cv-preset-picker-row').forEach(r => r.classList.remove('drag-over'));
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        // Only show indicator if this isn't the dragged item
        if (this.state.draggedPresetId && this.state.draggedPresetId !== preset.id) {
          row.classList.add('drag-over');
        }
      });

      row.addEventListener('dragleave', (e) => {
        // Only remove if we're actually leaving (not entering a child)
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (!row.contains(relatedTarget)) {
          row.classList.remove('drag-over');
        }
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        if (this.state.draggedPresetId && this.state.draggedPresetId !== preset.id) {
          this.reorderPinnedPreset(this.state.draggedPresetId, preset.id);
          overlay.remove();
          this.showPresetPicker(); // Refresh
        }
      });

      list.appendChild(row);
    });

    modal.appendChild(list);

    // Close button
    const closeBtn = createElement('button', { text: 'Done', className: 'cv-primary-btn', style: 'margin-top: 16px; width: 100%;' });
    closeBtn.addEventListener('click', () => {
      overlay.remove();
      this.rerenderVisualMode();
    });
    modal.appendChild(closeBtn);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        this.rerenderVisualMode();
      }
    });

    this.shadow.appendChild(overlay);
  }

  private reorderPinnedPreset(draggedId: string, targetId: string): void {
    // Only reorder within pinned presets
    if (!this.state.pinnedPresets.includes(draggedId)) return;

    const draggedIndex = this.state.pinnedPresets.indexOf(draggedId);
    const targetIndex = this.state.pinnedPresets.indexOf(targetId);

    if (draggedIndex === -1) return;

    // Remove dragged item
    this.state.pinnedPresets.splice(draggedIndex, 1);

    // Insert at target position (or at end if target not pinned)
    if (targetIndex !== -1) {
      this.state.pinnedPresets.splice(targetIndex, 0, draggedId);
    } else {
      this.state.pinnedPresets.push(draggedId);
    }

    this.savePinnedPresets();
  }

  private deleteCustomPreset(presetId: string): void {
    this.state.customPresets = this.state.customPresets.filter(p => p.id !== presetId);
    this.state.pinnedPresets = this.state.pinnedPresets.filter(id => id !== presetId);
    this.saveCustomPresets();
    this.savePinnedPresets();
    this.showToast('Custom filter deleted');
  }

  // ==========================================================================
  // CREATE PRESET MODAL - Create custom quick filters
  // ==========================================================================

  private showCreatePresetModal(): void {
    // Prevent duplicate modals
    const existing = this.shadow.querySelector('.cv-modal-overlay');
    if (existing) {
      return;
    }

    const overlay = createElement('div', { className: 'cv-modal-overlay' });
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;';

    const modal = createElement('div', { className: 'cv-modal' });
    modal.style.cssText = 'background: var(--cv-bg); border-radius: 12px; padding: 20px; max-width: 450px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.3);';

    const title = createElement('h3', { text: '➕ Create Custom Filter', style: 'margin: 0 0 16px 0;' });
    modal.appendChild(title);

    // Emoji picker (simple grid of common emojis)
    const emojiLabel = createElement('label', { text: 'Icon', style: 'display: block; margin-bottom: 4px; font-weight: 500;' });
    modal.appendChild(emojiLabel);
    const emojiGrid = createElement('div', { style: 'display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px;' });
    const emojis = ['📋', '🔥', '🐛', '✅', '🚀', '⭐', '💡', '🎯', '📌', '🔧', '📦', '🎨', '🔍', '📊', '💬', '🏷️'];
    let selectedEmoji = '📋';
    emojis.forEach(emoji => {
      const btn = createElement('button', { text: emoji, style: 'font-size: 18px; padding: 4px 8px; border: 1px solid var(--cv-border); border-radius: 4px; background: var(--cv-bg); cursor: pointer;' });
      if (emoji === selectedEmoji) btn.style.background = 'var(--cv-accent-bg)';
      btn.addEventListener('click', () => {
        selectedEmoji = emoji;
        emojiGrid.querySelectorAll('button').forEach(b => b.style.background = 'var(--cv-bg)');
        btn.style.background = 'var(--cv-accent-bg)';
      });
      emojiGrid.appendChild(btn);
    });
    modal.appendChild(emojiGrid);

    // Title input
    const titleLabel = createElement('label', { text: 'Title', style: 'display: block; margin-bottom: 4px; font-weight: 500;' });
    modal.appendChild(titleLabel);
    const titleInput = createElement('input', { attrs: { type: 'text', placeholder: 'My Custom Filter' }, style: 'width: 100%; padding: 8px; margin-bottom: 12px; border: 1px solid var(--cv-border); border-radius: 6px;' }) as HTMLInputElement;
    modal.appendChild(titleInput);

    // Description input
    const descLabel = createElement('label', { text: 'Description', style: 'display: block; margin-bottom: 4px; font-weight: 500;' });
    modal.appendChild(descLabel);
    const descInput = createElement('input', { attrs: { type: 'text', placeholder: 'What this filter finds' }, style: 'width: 100%; padding: 8px; margin-bottom: 12px; border: 1px solid var(--cv-border); border-radius: 6px;' }) as HTMLInputElement;
    modal.appendChild(descInput);

    // JQL input
    const jqlLabel = createElement('label', { text: 'JQL Query', style: 'display: block; margin-bottom: 4px; font-weight: 500;' });
    modal.appendChild(jqlLabel);
    const jqlTextarea = createElement('textarea', { attrs: { placeholder: 'project = AP AND status = "In Progress" ORDER BY updated DESC', rows: '3' }, style: 'width: 100%; padding: 8px; margin-bottom: 12px; border: 1px solid var(--cv-border); border-radius: 6px; font-family: monospace; font-size: 12px;' }) as HTMLTextAreaElement;
    // Pre-fill with current preview if available
    if (this.previewEl?.value) {
      jqlTextarea.value = this.previewEl.value;
    }
    modal.appendChild(jqlTextarea);

    // Buttons
    const btnRow = createElement('div', { style: 'display: flex; gap: 8px;' });
    const cancelBtn = createElement('button', { text: 'Cancel', style: 'flex: 1; padding: 8px; border: 1px solid var(--cv-border); border-radius: 6px; background: var(--cv-bg); cursor: pointer;' });
    cancelBtn.addEventListener('click', () => overlay.remove());

    const saveBtn = createElement('button', { text: 'Save Filter', className: 'cv-primary-btn', style: 'flex: 1; padding: 8px; border-radius: 6px;' });
    saveBtn.addEventListener('click', () => {
      if (!titleInput.value.trim() || !jqlTextarea.value.trim()) {
        this.showToast('Please fill in title and JQL query');
        return;
      }

      const newPreset: QuickPreset = {
        id: `custom-${createId()}`,
        label: titleInput.value.trim(),
        emoji: selectedEmoji,
        description: descInput.value.trim() || titleInput.value.trim(),
        jql: jqlTextarea.value.trim(),
        category: 'custom',
        isCustom: true
      };

      this.state.customPresets.push(newPreset);
      this.saveCustomPresets();

      // Auto-pin if we have room
      if (this.state.pinnedPresets.length < 4) {
        this.state.pinnedPresets.push(newPreset.id);
        this.savePinnedPresets();
      }

      this.showToast('Custom filter created!');
      overlay.remove();
      this.rerenderVisualMode();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    modal.appendChild(btnRow);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    this.shadow.appendChild(overlay);
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
        Edit JQL directly. Click items below to insert at cursor.
      </p>
    `;
    container.appendChild(hint);

    // Textarea wrapper for positioning reference panel
    const textareaWrap = createElement('div');
    textareaWrap.style.position = 'relative';
    textareaWrap.style.marginTop = '12px';

    this.advancedTextarea = createElement('textarea', {
      className: 'cv-preview',
      attrs: { placeholder: 'Enter your JQL query...' }
    }) as HTMLTextAreaElement;
    this.advancedTextarea.style.minHeight = '160px';
    this.advancedTextarea.value = this.previewEl?.value || buildJqlFromV2State(this.state);
    this.advancedTextarea.addEventListener('input', () => {
      if (this.previewEl) {
        this.previewEl.value = this.advancedTextarea.value;
      }
    });
    textareaWrap.appendChild(this.advancedTextarea);
    container.appendChild(textareaWrap);

    // Interactive reference sections
    const refContainer = createElement('div', { className: 'cv-section' });
    refContainer.style.marginTop = '16px';

    // Reference tabs
    const refTabs = createElement('div', { className: 'cv-ref-tabs' });
    const categories = [
      { id: 'fields', label: '📋 Fields', items: this.getFieldItems() },
      { id: 'operators', label: '⚙️ Operators', items: this.getOperatorItems() },
      { id: 'functions', label: 'ƒ Functions', items: this.getFunctionItems() },
      { id: 'time', label: '🕐 Time', items: this.getTimeItems() },
      { id: 'keywords', label: '🔤 Keywords', items: this.getKeywordItems() }
    ];

    let activeTab = 'fields';
    const contentDiv = createElement('div', { className: 'cv-ref-content' });

    const renderContent = (tabId: string) => {
      const category = categories.find(c => c.id === tabId);
      if (!category) return;

      contentDiv.innerHTML = '';
      const itemsWrap = createElement('div', { className: 'cv-ref-items' });

      category.items.forEach(item => {
        const btn = createButton(item.label, 'cv-ref-item');
        btn.title = item.description || item.value;
        btn.addEventListener('click', () => {
          this.insertAtCursor(item.value);
        });
        itemsWrap.appendChild(btn);
      });

      contentDiv.appendChild(itemsWrap);
    };

    categories.forEach(cat => {
      const tab = createButton(cat.label, 'cv-ref-tab');
      if (cat.id === activeTab) tab.classList.add('active');
      tab.addEventListener('click', () => {
        refTabs.querySelectorAll('.cv-ref-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = cat.id;
        renderContent(cat.id);
      });
      refTabs.appendChild(tab);
    });

    refContainer.appendChild(refTabs);
    refContainer.appendChild(contentDiv);
    container.appendChild(refContainer);

    // Render initial content
    renderContent(activeTab);

    return container;
  }

  private getFieldItems(): Array<{ label: string; value: string; description?: string }> {
    // Common fields first, then from autocomplete data
    const common = [
      { label: 'project', value: 'project', description: 'Project key or name' },
      { label: 'status', value: 'status', description: 'Issue status' },
      { label: 'assignee', value: 'assignee', description: 'Assigned user' },
      { label: 'reporter', value: 'reporter', description: 'Issue reporter' },
      { label: 'priority', value: 'priority', description: 'Issue priority' },
      { label: 'issuetype', value: 'issuetype', description: 'Type of issue' },
      { label: 'created', value: 'created', description: 'Creation date' },
      { label: 'updated', value: 'updated', description: 'Last update date' },
      { label: 'due', value: 'due', description: 'Due date' },
      { label: 'resolved', value: 'resolved', description: 'Resolution date' },
      { label: 'resolution', value: 'resolution', description: 'Resolution type' },
      { label: 'labels', value: 'labels', description: 'Issue labels' },
      { label: 'summary', value: 'summary', description: 'Issue title' },
      { label: 'description', value: 'description', description: 'Issue description' },
      { label: 'text', value: 'text', description: 'Full text search' },
      { label: 'component', value: 'component', description: 'Project component' },
      { label: 'fixVersion', value: 'fixVersion', description: 'Fix version' },
      { label: 'affectedVersion', value: 'affectedVersion', description: 'Affected version' },
      { label: 'sprint', value: 'sprint', description: 'Sprint name' },
      { label: 'watcher', value: 'watcher', description: 'Issue watchers' },
      { label: 'voter', value: 'voter', description: 'Issue voters' },
      { label: 'comment', value: 'comment', description: 'Comment text' },
      { label: 'key', value: 'key', description: 'Issue key (e.g., PROJ-123)' },
      { label: 'id', value: 'id', description: 'Issue ID number' },
      { label: 'parent', value: 'parent', description: 'Parent issue key' }
    ];

    // Add custom fields from autocomplete if available
    if (this.data.fields.length > 0) {
      const seen = new Set(common.map(c => c.value.toLowerCase()));
      const custom = this.data.fields
        .filter(f => !seen.has(f.value.toLowerCase()))
        .slice(0, 20) // Limit to prevent overwhelming
        .map(f => ({
          label: f.displayName || f.value,
          value: f.value.includes(' ') ? `"${f.value}"` : f.value,
          description: f.cfid ? 'Custom field' : undefined
        }));
      return [...common, ...custom];
    }

    return common;
  }

  private getOperatorItems(): Array<{ label: string; value: string; description?: string }> {
    return [
      { label: '=', value: ' = ', description: 'Equals' },
      { label: '!=', value: ' != ', description: 'Not equals' },
      { label: '~', value: ' ~ ', description: 'Contains text' },
      { label: '!~', value: ' !~ ', description: 'Does not contain' },
      { label: '>', value: ' > ', description: 'Greater than' },
      { label: '>=', value: ' >= ', description: 'Greater than or equal' },
      { label: '<', value: ' < ', description: 'Less than' },
      { label: '<=', value: ' <= ', description: 'Less than or equal' },
      { label: 'IN', value: ' IN ()', description: 'In list of values' },
      { label: 'NOT IN', value: ' NOT IN ()', description: 'Not in list of values' },
      { label: 'IS', value: ' IS ', description: 'Is (for EMPTY/NULL)' },
      { label: 'IS NOT', value: ' IS NOT ', description: 'Is not (for EMPTY/NULL)' },
      { label: 'IS EMPTY', value: ' IS EMPTY', description: 'Field has no value' },
      { label: 'IS NOT EMPTY', value: ' IS NOT EMPTY', description: 'Field has a value' },
      { label: 'WAS', value: ' WAS ', description: 'Was previously' },
      { label: 'WAS NOT', value: ' WAS NOT ', description: 'Was not previously' },
      { label: 'CHANGED', value: ' CHANGED', description: 'Value changed' },
      { label: 'AND', value: ' AND ', description: 'Both conditions' },
      { label: 'OR', value: ' OR ', description: 'Either condition' },
      { label: 'NOT', value: 'NOT ', description: 'Negate condition' },
      { label: '( )', value: '()', description: 'Group conditions' }
    ];
  }

  private getFunctionItems(): Array<{ label: string; value: string; description?: string }> {
    return [
      { label: 'currentUser()', value: 'currentUser()', description: 'Currently logged in user' },
      { label: 'now()', value: 'now()', description: 'Current date/time' },
      { label: 'startOfDay()', value: 'startOfDay()', description: 'Start of today' },
      { label: 'endOfDay()', value: 'endOfDay()', description: 'End of today' },
      { label: 'startOfWeek()', value: 'startOfWeek()', description: 'Start of this week' },
      { label: 'endOfWeek()', value: 'endOfWeek()', description: 'End of this week' },
      { label: 'startOfMonth()', value: 'startOfMonth()', description: 'Start of this month' },
      { label: 'endOfMonth()', value: 'endOfMonth()', description: 'End of this month' },
      { label: 'startOfYear()', value: 'startOfYear()', description: 'Start of this year' },
      { label: 'endOfYear()', value: 'endOfYear()', description: 'End of this year' },
      { label: 'membersOf()', value: 'membersOf("")', description: 'Members of a group' },
      { label: 'linkedIssues()', value: 'linkedIssues()', description: 'Linked issues' },
      { label: 'votedIssues()', value: 'votedIssues()', description: 'Issues you voted for' },
      { label: 'watchedIssues()', value: 'watchedIssues()', description: 'Issues you watch' },
      { label: 'issueHistory()', value: 'issueHistory()', description: 'Recently viewed issues' },
      { label: 'openSprints()', value: 'openSprints()', description: 'Active sprints' },
      { label: 'closedSprints()', value: 'closedSprints()', description: 'Completed sprints' },
      { label: 'futureSprints()', value: 'futureSprints()', description: 'Upcoming sprints' },
      { label: 'latestReleasedVersion()', value: 'latestReleasedVersion(PROJECT)', description: 'Latest released version' },
      { label: 'unreleasedVersions()', value: 'unreleasedVersions(PROJECT)', description: 'Unreleased versions' },
      { label: 'updatedBy()', value: 'updatedBy()', description: 'Updated by specific user' },
      { label: 'currentLogin()', value: 'currentLogin()', description: 'Current session start' },
      { label: 'lastLogin()', value: 'lastLogin()', description: 'Previous session start' }
    ];
  }

  private getTimeItems(): Array<{ label: string; value: string; description?: string }> {
    return [
      { label: '-1d', value: '-1d', description: '1 day ago' },
      { label: '-2d', value: '-2d', description: '2 days ago' },
      { label: '-3d', value: '-3d', description: '3 days ago' },
      { label: '-7d', value: '-7d', description: '1 week ago' },
      { label: '-14d', value: '-14d', description: '2 weeks ago' },
      { label: '-30d', value: '-30d', description: '1 month ago' },
      { label: '-90d', value: '-90d', description: '3 months ago' },
      { label: '-1w', value: '-1w', description: '1 week ago' },
      { label: '-2w', value: '-2w', description: '2 weeks ago' },
      { label: '-1m', value: '-1m', description: '1 month ago' },
      { label: '-3m', value: '-3m', description: '3 months ago' },
      { label: '-6m', value: '-6m', description: '6 months ago' },
      { label: '-1y', value: '-1y', description: '1 year ago' },
      { label: '+1d', value: '+1d', description: '1 day from now' },
      { label: '+7d', value: '+7d', description: '1 week from now' },
      { label: '+1w', value: '+1w', description: '1 week from now' },
      { label: '+1m', value: '+1m', description: '1 month from now' },
      { label: '"2024-01-01"', value: '"2024-01-01"', description: 'Specific date' },
      { label: '"2024-12-31"', value: '"2024-12-31"', description: 'Specific date' }
    ];
  }

  private getKeywordItems(): Array<{ label: string; value: string; description?: string }> {
    return [
      { label: 'EMPTY', value: 'EMPTY', description: 'No value' },
      { label: 'NULL', value: 'NULL', description: 'Null value' },
      { label: 'ORDER BY', value: ' ORDER BY ', description: 'Sort results' },
      { label: 'ASC', value: ' ASC', description: 'Ascending order' },
      { label: 'DESC', value: ' DESC', description: 'Descending order' },
      { label: 'FROM', value: ' FROM ', description: 'History: from value' },
      { label: 'TO', value: ' TO ', description: 'History: to value' },
      { label: 'BY', value: ' BY ', description: 'History: by user' },
      { label: 'AFTER', value: ' AFTER ', description: 'After date' },
      { label: 'BEFORE', value: ' BEFORE ', description: 'Before date' },
      { label: 'ON', value: ' ON ', description: 'On date' },
      { label: 'DURING', value: ' DURING ', description: 'During period' }
    ];
  }

  private insertAtCursor(text: string): void {
    if (!this.advancedTextarea) return;

    const textarea = this.advancedTextarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    textarea.value = before + text + after;
    textarea.focus();

    // Position cursor intelligently
    let cursorPos = start + text.length;

    // If text contains () or "", position cursor inside
    if (text.includes('()')) {
      cursorPos = start + text.indexOf('(') + 1;
    } else if (text.includes('""')) {
      cursorPos = start + text.indexOf('""') + 1;
    }

    textarea.setSelectionRange(cursorPos, cursorPos);

    // Update preview
    if (this.previewEl) {
      this.previewEl.value = textarea.value;
    }

    this.showToast(`Inserted: ${text.trim()}`);
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
    const copyBtn = createElement('button', { className: 'cv-copy-btn' });
    copyBtn.innerHTML = '<span>📋</span> Copy';
    copyBtn.title = 'Copy to clipboard';
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(this.previewEl.value);
      copyBtn.innerHTML = '<span>✓</span> Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.innerHTML = '<span>📋</span> Copy';
        copyBtn.classList.remove('copied');
      }, 2000);
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
      this.state.selectedPresets.clear();
      this.state.searchText = '';
      // Reset sort entries to default (avoid duplicates)
      this.state.sortEntries = [{ field: 'updated', direction: 'DESC' }];
      this.state.sortField = 'updated';
      this.state.sortDirection = 'DESC';
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

    // If presets are selected, combine them
    if (this.state.selectedPresets.size > 0) {
      this.combineSelectedPresets();
      return;
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
