import type { WorkflowDefinition } from '@cv/core';
import { installJqlBuilderSwitcherHooks } from '../shared/jql';

export const JiraJqlBuilderWorkflow: WorkflowDefinition = {
  id: 'jira.jql.builder',
  label: 'Jira: Search Builder',
  description: 'Auto-wires the Jira Advanced toggle to open the search builder and closes on Basic.',
  intent: 'automation',
  riskLevel: 'safe',
  autoRun: {
    waitForSelector: { selector: 'a.switcher-item' },
    pollIntervalMs: 200,
    waitForConditionMs: 12000,
    skipReadiness: true,
    watchMutations: {
      root: { selector: 'body' },
      debounceMs: 300,
      observeAttributes: true,
      observeChildList: true,
      forceAutoRun: true
    }
  },
  steps: [
    {
      kind: 'execute',
      run: async (ctx) => {
        installJqlBuilderSwitcherHooks(ctx.store, ctx.log);
        return true;
      }
    }
  ]
};
