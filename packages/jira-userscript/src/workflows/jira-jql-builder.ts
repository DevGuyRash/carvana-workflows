import type { WorkflowDefinition } from '@cv/core';
import { toggleJqlBuilder } from '../shared/jql';

export const JiraJqlBuilderWorkflow: WorkflowDefinition = {
  id: 'jira.jql.builder',
  label: 'Jira: Advanced Search Builder',
  description: 'Toggle a friendly JQL builder that writes to the Advanced Search bar.',
  steps: [
    {
      kind: 'execute',
      run: async (ctx) => {
        await toggleJqlBuilder(ctx.store, ctx.log);
        return true;
      }
    }
  ]
};
