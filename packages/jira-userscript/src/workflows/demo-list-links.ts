import type { WorkflowDefinition } from '@cv/core';

export const JiraDemoListLinksWorkflow: WorkflowDefinition = {
  id: 'demo.links.topN',
  label: 'Demo: List Links (top N)',
  description: 'Extracts link text and href for the first N anchors.',
  options: [
    { key: 'maxLinks', label: 'Max links', type: 'number', default: 20 }
  ],
  steps: [
    {
      kind: 'extractList',
      list: { selector: 'a[href]' },
      fields: [
        { key: 'text', take: 'text' },
        { key: 'href', take: 'href' }
      ],
      limit: '{{opt.maxLinks}}',
      intoKey: 'links',
      present: true,
      copyToClipboard: true
    }
  ]
};
