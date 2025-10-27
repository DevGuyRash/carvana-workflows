import type { WorkflowDefinition } from '@cv/core';

export const JiraDemoTitleToClipboardWorkflow: WorkflowDefinition = {
  id: 'demo.title.clipboard',
  label: 'Demo: Title -> Clipboard',
  description: 'Copies document.title and shows it.',
  steps: [
    {
      kind: 'extract',
      items: [{ from: { global: 'document.title' }, intoKey: 'title', take: 'raw' }],
      copyToClipboard: true,
      present: true
    }
  ]
};
