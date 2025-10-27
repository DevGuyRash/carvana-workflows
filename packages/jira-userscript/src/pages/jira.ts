import type { PageDefinition } from '@cv/core';
import { JiraDemoTitleToClipboardWorkflow } from '../workflows/demo-title-to-clipboard';
import { JiraDemoPageInfoWorkflow } from '../workflows/demo-page-info';
import { JiraDemoListLinksWorkflow } from '../workflows/demo-list-links';

export const JiraDemoPage: PageDefinition = {
  id: 'jira.demo',
  label: 'Demo (Jira Site)',
  detector: { exists: { selector: 'html' } },
  workflows: [
    JiraDemoTitleToClipboardWorkflow,
    JiraDemoPageInfoWorkflow,
    JiraDemoListLinksWorkflow
  ]
};
