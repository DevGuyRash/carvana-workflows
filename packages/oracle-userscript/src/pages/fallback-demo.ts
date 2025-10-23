import type { PageDefinition, WorkflowDefinition } from '@cv/core';

export const OracleFallbackPage: PageDefinition = {
  id: 'oracle.demo',
  label: 'Demo (Oracle Site)',
  detector: { exists: { selector: 'html' } },
  workflows: []
};

const DemoTitleWorkflow: WorkflowDefinition = {
  id: 'demo.title.clipboard',
  label: 'Demo: Title → Clipboard',
  description: 'Copies document.title and shows it.',
  steps: [
    { kind: 'extract',
      items: [{ from: { global: 'document.title' }, intoKey: 'title', take: 'raw' }],
      copyToClipboard: true,
      present: true
    }
  ]
};

const DemoPageInfoWorkflow: WorkflowDefinition = {
  id: 'demo.page.info',
  label: 'Demo: Page Info',
  description: 'Collects title, URL, host, path, UA, timestamp.',
  steps: [
    { kind: 'extract',
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

const DemoLinksWorkflow: WorkflowDefinition = {
  id: 'demo.links.topN',
  label: 'Demo: List Links (top N)',
  description: 'Extracts link text & href for the first N anchors.',
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

OracleFallbackPage.workflows.push(DemoTitleWorkflow, DemoPageInfoWorkflow, DemoLinksWorkflow);
