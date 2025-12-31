import type { WorkflowDefinition } from '@cv/core';
import { toggleJqlBuilderV2 } from '../shared/jql';

export const JiraJqlBuilderWorkflow: WorkflowDefinition = {
  id: 'jira.jql.builder',
  label: 'Jira: Search Builder',
  description: 'Toggle an ADHD-friendly search builder with quick filters and visual card-based interface.',
  steps: [
    {
      kind: 'execute',
      run: async (ctx) => {
        await toggleJqlBuilderV2(ctx.store, ctx.log);
        return true;
      }
    }
  ]
};
