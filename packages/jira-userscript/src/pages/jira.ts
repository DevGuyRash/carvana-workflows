import type { PageDefinition } from '@cv/core';
import { JiraJqlBuilderWorkflow } from '../workflows/jira-jql-builder';

export const JiraDemoPage: PageDefinition = {
  id: 'jira.demo',
  label: 'Jira',
  detector: { exists: { selector: 'html' } },
  workflows: [
    JiraJqlBuilderWorkflow
  ]
};
