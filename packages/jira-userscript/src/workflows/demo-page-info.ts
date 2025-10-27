import type { WorkflowDefinition } from '@cv/core';

export const JiraDemoPageInfoWorkflow: WorkflowDefinition = {
  id: 'demo.page.info',
  label: 'Demo: Page Info',
  description: 'Collects title, URL, host, path, user agent, and timestamp.',
  steps: [
    {
      kind: 'extract',
      items: [
        { from: { global: 'document.title' }, intoKey: 'title', take: 'raw' },
        { from: { global: 'location.href' }, intoKey: 'href', take: 'raw' },
        { from: { global: 'location.host' }, intoKey: 'host', take: 'raw' },
        { from: { global: 'location.pathname' }, intoKey: 'path', take: 'raw' },
        { from: { global: 'navigator.userAgent' }, intoKey: 'ua', take: 'raw' },
        { from: { global: 'timestamp' }, intoKey: 'timestamp', take: 'raw' }
      ],
      present: true,
      copyToClipboard: true
    }
  ]
};
