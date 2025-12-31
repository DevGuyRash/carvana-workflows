import type { PageDefinition } from '@cv/core';
import { JiraDemoTitleToClipboardWorkflow } from '../workflows/demo-title-to-clipboard';
import { JiraDemoPageInfoWorkflow } from '../workflows/demo-page-info';
import { JiraDemoListLinksWorkflow } from '../workflows/demo-list-links';
import { JiraJqlBuilderWorkflow } from '../workflows/jira-jql-builder';

export const JiraDemoPage: PageDefinition = {
  id: 'jira.demo',
  label: 'Demo (Jira Site)',
  detector: { exists: { selector: 'html' } },
  workflows: [
    JiraJqlBuilderWorkflow,
    JiraDemoTitleToClipboardWorkflow,
    JiraDemoPageInfoWorkflow,
    JiraDemoListLinksWorkflow
  ]
};
