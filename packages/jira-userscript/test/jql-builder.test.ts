import { describe, expect, it } from 'vitest';
import {
  buildJql,
  createDefaultBuilderState,
  createClauseState,
  createGroupState,
  createDefaultValueState,
  type JqlClauseState
} from '../src/shared/jql';

describe('jira jql builder', () => {
  it('builds a simple equals clause with auto-quote', () => {
    const state = createDefaultBuilderState();
    const clause = state.root.children[0] as JqlClauseState;
    clause.field = 'project';
    clause.operatorKey = 'equals';
    clause.value.text = 'AP';

    const jql = buildJql(state, { autoQuote: true, reservedWords: ['AND', 'OR'] });
    expect(jql).toBe('project = AP');
  });

  it('quotes values with spaces', () => {
    const state = createDefaultBuilderState();
    const clause = state.root.children[0] as JqlClauseState;
    clause.field = 'status';
    clause.operatorKey = 'equals';
    clause.value.text = 'In Progress';

    const jql = buildJql(state, { autoQuote: true, reservedWords: [] });
    expect(jql).toBe('status = "In Progress"');
  });

  it('builds list clauses and functions', () => {
    const state = createDefaultBuilderState();
    const clause = state.root.children[0] as JqlClauseState;
    clause.field = 'assignee';
    clause.operatorKey = 'in';
    clause.value.mode = 'list';
    clause.value.list = ['user1', 'user2'];

    const listJql = buildJql(state, { autoQuote: true, reservedWords: [] });
    expect(listJql).toBe('assignee IN (user1, user2)');

    clause.value.mode = 'function';
    clause.value.text = 'membersOf("jira-users")';
    const fnJql = buildJql(state, { autoQuote: true, reservedWords: [] });
    expect(fnJql).toBe('assignee IN membersOf("jira-users")');
  });

  it('supports groups, joiners, and NOT', () => {
    const valueA = createDefaultValueState();
    valueA.text = 'AP';
    const clauseA = createClauseState({
      field: 'project',
      operatorKey: 'equals',
      value: valueA
    });
    const valueB = createDefaultValueState();
    valueB.text = 'Done';
    const clauseB = createClauseState({
      joiner: 'OR',
      field: 'status',
      operatorKey: 'equals',
      value: valueB
    });
    const group = createGroupState({ mode: 'AND', children: [clauseA, clauseB], not: true });
    const state = createDefaultBuilderState();
    state.root = group;

    const jql = buildJql(state, { autoQuote: true, reservedWords: [] });
    expect(jql).toBe('NOT ((project = AP OR status = Done))');
  });

  it('adds history modifiers and order by', () => {
    const state = createDefaultBuilderState();
    const clause = state.root.children[0] as JqlClauseState;
    clause.field = 'status';
    clause.operatorKey = 'changed';
    clause.history = { from: 'To Do', to: 'Done', after: 'startOfDay()', by: 'currentUser()' };

    state.sorts = [{ id: 'sort-1', field: 'created', direction: 'DESC' }];

    const jql = buildJql(state, { autoQuote: true, reservedWords: [] });
    expect(jql).toBe('status CHANGED FROM "To Do" TO Done BY currentUser() AFTER startOfDay() ORDER BY created DESC');
  });

  it('builds text search syntax for ~ operators', () => {
    const state = createDefaultBuilderState();
    const clause = state.root.children[0] as JqlClauseState;
    clause.field = 'Vendor';
    clause.operatorKey = 'contains';
    clause.value.mode = 'text';
    clause.value.text = 'ACME Motors';

    let jql = buildJql(state, { autoQuote: true, reservedWords: [] });
    expect(jql).toBe('Vendor ~ "ACME Motors"');

    clause.value.textSearchMode = 'phrase';
    jql = buildJql(state, { autoQuote: true, reservedWords: [] });
    expect(jql).toBe('Vendor ~ "\\\"ACME Motors\\\""');

    clause.value.text = 'Vendor';
    clause.value.textSearchMode = 'prefix';
    jql = buildJql(state, { autoQuote: true, reservedWords: [] });
    expect(jql).toBe('Vendor ~ "Vendor*"');

    clause.value.text = 'ACME Motors';
    clause.value.textSearchMode = 'proximity';
    clause.value.textSearchDistance = '5';
    jql = buildJql(state, { autoQuote: true, reservedWords: [] });
    expect(jql).toBe('Vendor ~ "\\\"ACME Motors\\\"~5"');
  });
});
