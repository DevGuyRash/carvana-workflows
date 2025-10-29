import type { SelectorSpec, WorkflowDefinition } from '@cv/core';

const SEARCH_CONTAINER = "div[role='search'][aria-labelledby*='::indReqLab']";
const BUTTON_SELECTOR = "a[role='button'][aria-label*='Search: Invoice']";

const BUTTON_BASE_SPEC: SelectorSpec = {
  selector: BUTTON_SELECTOR,
  within: { selector: SEARCH_CONTAINER }
};

const BUTTON_VISIBLE_SPEC: SelectorSpec = {
  ...BUTTON_BASE_SPEC,
  visible: true
};

const BUTTON_COLLAPSED_SPEC: SelectorSpec = {
  ...BUTTON_BASE_SPEC,
  attribute: { 'aria-expanded': { equals: 'false', caseInsensitive: true } }
};

const BUTTON_EXPANDED_SPEC: SelectorSpec = {
  ...BUTTON_BASE_SPEC,
  attribute: { 'aria-expanded': { equals: 'true', caseInsensitive: true } }
};

const BUTTON_EXPANDED_VISIBLE_SPEC: SelectorSpec = {
  ...BUTTON_EXPANDED_SPEC,
  visible: true
};

const getSearchContainer = (): HTMLElement | null =>
  document.querySelector(SEARCH_CONTAINER) as HTMLElement | null;

const getSearchButton = (): HTMLAnchorElement | null =>
  getSearchContainer()?.querySelector<HTMLAnchorElement>(BUTTON_SELECTOR) ?? null;

const getPanelBody = (): HTMLElement | null => {
  const container = getSearchContainer();
  if (!container) return null;

  const labelledBy = (container.getAttribute('aria-labelledby') || '').trim();
  if (labelledBy) {
    for (const token of labelledBy.split(/\s+/)) {
      if (!token) continue;
      const candidateId = token.replace(/::indReqLab$/i, '::qryPanel');
      if (candidateId && candidateId !== token) {
        const candidate = document.getElementById(candidateId);
        if (candidate instanceof HTMLElement) return candidate;
      }
    }
  }

  const panel = container.querySelector<HTMLElement>('[id*="::qryPanel"], [id*="qryPanel"]');
  if (panel) return panel;

  return container.querySelector<HTMLElement>(':scope > div:nth-of-type(2)');
};

const isElementVisible = (el: HTMLElement | null): boolean => {
  if (!el || !el.isConnected) return false;
  if (el.hidden) return false;
  if (el.getAttribute('aria-hidden')?.toLowerCase() === 'true') return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect?.();
  if (rect && (rect.height <= 1 || rect.width <= 1)) return false;
  return true;
};

const resolvePanelState = (): 'expanded' | 'collapsed' => {
  const button = getSearchButton();
  const expandedAttr = button?.getAttribute('aria-expanded');
  if (expandedAttr && expandedAttr.toLowerCase() === 'true') return 'expanded';
  const body = getPanelBody();
  return isElementVisible(body) ? 'expanded' : 'collapsed';
};

const resolveOraclePageContext = (): string | undefined => {
  const pieces: string[] = [];
  const container = getSearchContainer();
  const labelledBy = (container?.getAttribute('aria-labelledby') || '').trim();

  if (labelledBy) {
    for (const token of labelledBy.split(/\s+/)) {
      const label = document.getElementById(token);
      const text = label?.textContent?.trim();
      if (text) {
        pieces.push(text);
        break;
      }
    }
  }

  const activeTab = document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
  const tabText = activeTab?.textContent?.trim();
  if (tabText) pieces.push(`tab:${tabText}`);

  const header = document.querySelector<HTMLElement>('h1[data-afr-title], h1.xh2, span.xh2, [data-afr-title]');
  const headerText = header?.textContent?.trim();
  if (headerText) pieces.push(headerText);

  const title = document.title?.trim();
  if (title) pieces.push(`title:${title}`);

  const unique = Array.from(new Set(pieces.filter(Boolean)));
  return unique.length ? unique.join('|') : undefined;
};

const resolveAutoRunContext = (): string => {
  const state = resolvePanelState();
  const ctx = resolveOraclePageContext();
  return `${ctx ?? 'oracle'}::${state}`;
};

export const OracleExpandInvoiceSearchWorkflow: WorkflowDefinition = {
  id: 'oracle.search.invoice.expand',
  label: 'Oracle: Expand Search — Invoice',
  description: 'Expands the Invoice search panel when it is collapsed.',
  autoRun: {
    waitForMs: 0,
    waitForConditionMs: 12000,
    pollIntervalMs: 150,
    retryDelayMs: 500,
    respectLoadingIndicator: false,
    skipReadiness: true,
    watchMutations: {
      root: { selector: 'body' },
      debounceMs: 300,
      observeAttributes: true,
      observeCharacterData: true,
      forceAutoRun: false,
      attributeFilter: ['aria-expanded']
    },
    context: { resolve: resolveAutoRunContext }
  },
  profiles: { enabled: false },
  enabledWhen: {
    all: [
      {
        exists: {
          ...BUTTON_BASE_SPEC
        }
      },
      {
        exists: BUTTON_COLLAPSED_SPEC
      }
    ]
  },
  steps: [
    {
      kind: 'branch',
      condition: {
        exists: BUTTON_COLLAPSED_SPEC
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
        ...BUTTON_VISIBLE_SPEC
      },
      preWait: { timeoutMs: 5000, visibleOnly: true },
      postWaitFor: BUTTON_EXPANDED_VISIBLE_SPEC,
      postWaitTimeoutMs: 20000,
      postWaitPollMs: 400
    },
    {
      kind: 'waitFor',
      target: {
        ...BUTTON_EXPANDED_SPEC
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
        ...BUTTON_EXPANDED_SPEC
      },
      wait: { timeoutMs: 20000, visibleOnly: false, minStabilityMs: 300 }
    }
  ]
};
