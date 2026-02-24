import type { RuntimeCommand, RuntimeResponse } from './shared/messages';
import { loadRuntime } from './shared/runtime';

let initialized = false;

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function setInputLikeValue(element: Element, value: string): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  const html = element as HTMLElement;
  if (html.isContentEditable) {
    html.focus();
    html.textContent = value;
    html.dispatchEvent(new Event('input', { bubbles: true }));
    html.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  return false;
}

function applyJqlToUi(jql: string): { applied: boolean; selector?: string } {
  const selectors = [
    'textarea[aria-label*="JQL"]',
    'textarea#advanced-search',
    'textarea[name="jql"]',
    'input[aria-label*="JQL"]',
    'input[name="jql"]',
    '[contenteditable="true"][aria-label*="JQL"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element) {
      continue;
    }

    if (setInputLikeValue(element, jql)) {
      return { applied: true, selector };
    }
  }

  return { applied: false };
}

function clickJiraSearchButton(): boolean {
  const selectors = [
    'button[aria-label="Search"]',
    'button[data-testid="advanced-search.search-button"]',
    'button[type="submit"]',
    'button[aria-label*="Run"]',
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (!(button instanceof HTMLElement)) {
      continue;
    }

    button.click();
    return true;
  }

  return false;
}

function navigateToJqlResults(jql: string): void {
  const url = new URL(window.location.href);
  url.pathname = '/issues/';
  url.searchParams.set('jql', jql);
  window.location.assign(url.toString());
}

function applyJqlInJira(jqlRaw: string, runSearch: boolean): RuntimeResponse {
  const jql = normalizeSpace(jqlRaw);
  if (!jql) {
    return { ok: false, error: 'jql is empty' };
  }

  const applyResult = applyJqlToUi(jql);

  if (runSearch) {
    if (!clickJiraSearchButton()) {
      navigateToJqlResults(jql);
      return {
        ok: true,
        data: {
          applied: applyResult.applied,
          selector: applyResult.selector,
          mode: 'navigate',
          jql,
        },
      };
    }

    return {
      ok: true,
      data: {
        applied: applyResult.applied,
        selector: applyResult.selector,
        mode: 'click-search',
        jql,
      },
    };
  }

  if (!applyResult.applied) {
    return {
      ok: false,
      error: 'JQL editor not found on current Jira page',
    };
  }

  return {
    ok: true,
    data: {
      applied: true,
      selector: applyResult.selector,
      mode: 'apply-only',
      jql,
    },
  };
}

async function handleCommand(command: RuntimeCommand): Promise<RuntimeResponse> {
  const runtime = await loadRuntime();

  try {
    if (command.kind === 'detect-site') {
      return { ok: true, data: runtime.detect_site(window.location.href) };
    }

    if (command.kind === 'list-workflows') {
      return { ok: true, data: runtime.list_workflows(command.site) };
    }

    if (command.kind === 'run-workflow') {
      return {
        ok: true,
        data: runtime.run_workflow(command.site, command.workflowId, command.input),
      };
    }

    if (command.kind === 'apply-jql') {
      const host = window.location.hostname.toLowerCase();
      if (!host.includes('jira.carvana.com')) {
        return { ok: false, error: 'not on Jira tab' };
      }

      return applyJqlInJira(command.jql, command.runSearch);
    }

    if (command.kind === 'capture-jira-table') {
      return { ok: true, data: runtime.capture_jira_filter_table() };
    }

    return { ok: false, error: 'unsupported command' };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function installListener(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  chrome.runtime.onMessage.addListener(
    (
      message: RuntimeCommand,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: RuntimeResponse) => void,
    ) => {
      void handleCommand(message).then(sendResponse);
      return true;
    },
  );
}

installListener();
