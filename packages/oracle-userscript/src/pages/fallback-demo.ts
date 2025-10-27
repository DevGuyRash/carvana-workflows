import type { PageDefinition, WorkflowDefinition } from '@cv/core';

export const OracleFallbackPage: PageDefinition = {
  id: 'oracle.main',
  label: 'Oracle Cloud',
  detector: { exists: { selector: 'html' } },
  workflows: []
};

const ExpandInvoiceSearchWorkflow: WorkflowDefinition = {
  id: 'oracle.search.invoice.expand',
  label: 'Oracle: Expand Search — Invoice',
  description: 'Expands the Invoice search panel when it is collapsed.',
  enabledWhen: {
    all: [
      {
        exists: {
          selector: "div[role='search'] a[role='button'][aria-expanded='false'][aria-label*='Search: Invoice']"
        }
      },
      {
        exists: {
          selector: "div[role='search'][aria-labelledby*='::indReqLab'] table"
        }
      },
      {
        notExists: {
          selector: "div[role='search'][aria-labelledby*='::indReqLab'] > div:nth-of-type(2)"
        }
      }
    ]
  },
  steps: [
    {
      kind: 'waitFor',
      target: {
        selector: "a[role='button'][aria-expanded='false'][aria-label*='Search: Invoice']",
        within: { selector: "div[role='search'][aria-labelledby*='::indReqLab']" }
      },
      wait: { timeoutMs: 20000, visibleOnly: true }
    },
    {
      kind: 'click',
      target: {
        selector: "a[role='button'][aria-expanded='false'][aria-label*='Search: Invoice']",
        within: { selector: "div[role='search'][aria-labelledby*='::indReqLab']" },
        visible: true
      },
      preWait: { timeoutMs: 5000, visibleOnly: true },
      postWaitFor: {
        selector: "a[role='button'][aria-expanded='true'][aria-label*='Search: Invoice']",
        within: { selector: "div[role='search'][aria-labelledby*='::indReqLab']" },
        visible: true
      }
    },
    {
      kind: 'waitFor',
      target: {
        selector: "div[role='search'][aria-labelledby*='::indReqLab'] > div:nth-of-type(2)",
        visible: true
      },
      wait: { timeoutMs: 20000, visibleOnly: true, minStabilityMs: 300 }
    }
  ]
};

OracleFallbackPage.workflows.push(ExpandInvoiceSearchWorkflow);
