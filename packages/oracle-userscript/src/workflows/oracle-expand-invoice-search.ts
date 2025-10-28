import type { WorkflowDefinition } from '@cv/core';

const SEARCH_CONTAINER = "div[role='search'][aria-labelledby*='::indReqLab']";
const BUTTON_SELECTOR = "a[role='button'][aria-label*='Search: Invoice']";

const resolvePanelState = (): 'expanded' | 'collapsed' => {
  const container = document.querySelector(SEARCH_CONTAINER);
  const row = container?.querySelector(':scope > div:nth-of-type(2)') as HTMLElement | null;
  if (!row) return 'collapsed';
  const style = getComputedStyle(row);
  if (row.hidden) return 'collapsed';
  if (row.getAttribute('aria-hidden') === 'true') return 'collapsed';
  if (style.display === 'none') return 'collapsed';
  if (style.visibility === 'hidden') return 'collapsed';
  if (style.height === '0px') return 'collapsed';
  return 'expanded';
};

export const OracleExpandInvoiceSearchWorkflow: WorkflowDefinition = {
  id: 'oracle.search.invoice.expand',
  label: 'Oracle: Expand Search — Invoice',
  description: 'Expands the Invoice search panel when it is collapsed.',
  autoRun: {
    waitForMs: 0,
    waitForConditionMs: 0,
    pollIntervalMs: 100,
    retryDelayMs: 500,
    waitForSelector: {
      selector: `${BUTTON_SELECTOR}[aria-expanded='false']`,
      within: { selector: SEARCH_CONTAINER },
      visible: true
    },
    respectLoadingIndicator: false,
    skipReadiness: true,
    watchMutations: {
      debounceMs: 300,
      attributeFilter: ['aria-expanded']
    },
    context: {
      resolve: () => resolvePanelState()
    }
  },
  profiles: { enabled: false },
  enabledWhen: {
    all: [
      {
        exists: {
          selector: `div[role='search'] ${BUTTON_SELECTOR}`
        }
      },
      {
        exists: {
          selector: `${SEARCH_CONTAINER} table`
        }
      },
      {
        not: {
          exists: {
            selector: `${SEARCH_CONTAINER} > div:nth-of-type(2)`,
            visible: true
          }
        }
      }
    ]
  },
  steps: [
    {
      kind: 'branch',
      condition: {
        exists: {
          selector: `${BUTTON_SELECTOR}[aria-expanded='false']`,
          within: { selector: SEARCH_CONTAINER }
        }
      },
      thenWorkflow: 'oracle.search.invoice.expand.perform',
      elseWorkflow: 'oracle.search.invoice.expand.ensure'
    }
  ]
};

export const OracleExpandInvoicePerformWorkflow: WorkflowDefinition = {
  id: 'oracle.search.invoice.expand.perform',
  label: '[internal] Expand invoice search (perform)',
  internal: true,
  steps: [
    {
      kind: 'click',
      target: {
        selector: `${BUTTON_SELECTOR}[aria-expanded='false']`,
        within: { selector: SEARCH_CONTAINER },
        visible: true
      },
      preWait: { timeoutMs: 5000, visibleOnly: true },
      postWaitFor: {
        selector: `${BUTTON_SELECTOR}[aria-expanded='true']`,
        within: { selector: SEARCH_CONTAINER },
        visible: true
      }
    },
    {
      kind: 'waitFor',
      target: {
        selector: `${BUTTON_SELECTOR}[aria-expanded='true']`,
        within: { selector: SEARCH_CONTAINER }
      },
      wait: { timeoutMs: 5000, visibleOnly: false }
    },
    {
      kind: 'waitFor',
      target: {
        selector: `${SEARCH_CONTAINER} > div:nth-of-type(2)`,
        visible: true
      },
      wait: { timeoutMs: 20000, visibleOnly: true, minStabilityMs: 300 }
    }
  ]
};

export const OracleExpandInvoiceEnsureWorkflow: WorkflowDefinition = {
  id: 'oracle.search.invoice.expand.ensure',
  label: '[internal] Expand invoice search (ensure)',
  internal: true,
  steps: [
    {
      kind: 'waitFor',
      target: {
        selector: `${BUTTON_SELECTOR}[aria-expanded='true']`,
        within: { selector: SEARCH_CONTAINER }
      },
      wait: { timeoutMs: 5000, visibleOnly: false }
    },
    {
      kind: 'waitFor',
      target: {
        selector: `${SEARCH_CONTAINER} > div:nth-of-type(2)`,
        visible: true
      },
      wait: { timeoutMs: 20000, visibleOnly: true, minStabilityMs: 300 }
    }
  ]
};
