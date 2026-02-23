import type { RuntimeCommand, RuntimeResponse } from './shared/messages';

const siteEl = document.getElementById('site');
const outputEl = document.getElementById('output');
const workflowSelect = document.getElementById('workflow-select') as HTMLSelectElement | null;
const runWorkflowButton = document.getElementById('run-workflow');
const captureTableButton = document.getElementById('capture-table');

let activeSite = 'unsupported';

function setOutput(value: unknown): void {
  if (outputEl) {
    outputEl.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }
}

async function getActiveTabId(): Promise<number> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (typeof tabId !== 'number') {
    throw new Error('active tab not found');
  }
  return tabId;
}

async function sendToContent(command: RuntimeCommand): Promise<RuntimeResponse> {
  const tabId = await getActiveTabId();
  const response = await chrome.tabs.sendMessage(tabId, command);
  return response as RuntimeResponse;
}

async function hydrateSite(): Promise<void> {
  const detect = await sendToContent({ kind: 'detect-site' });
  if (!detect.ok) {
    setOutput(detect.error ?? 'site detection failed');
    return;
  }

  activeSite = String(detect.data ?? 'unsupported');
  if (siteEl) {
    siteEl.textContent = `Site: ${activeSite}`;
  }

  const workflows = await sendToContent({ kind: 'list-workflows', site: activeSite });
  if (!workflows.ok) {
    setOutput(workflows.error ?? 'workflow listing failed');
    return;
  }

  const data = Array.isArray(workflows.data) ? workflows.data : [];
  if (!workflowSelect) {
    return;
  }

  workflowSelect.innerHTML = '';
  for (const item of data as Array<{ id: string; label: string }>) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.label} (${item.id})`;
    workflowSelect.appendChild(option);
  }
}

async function runSelectedWorkflow(): Promise<void> {
  if (!workflowSelect) {
    return;
  }

  const workflowId = workflowSelect.value;
  if (!workflowId) {
    setOutput('No workflow selected.');
    return;
  }

  const response = await sendToContent({
    kind: 'run-workflow',
    site: activeSite,
    workflowId,
  });
  setOutput(response.ok ? response.data ?? 'ok' : response.error ?? 'workflow run failed');
}

async function captureTable(): Promise<void> {
  const response = await sendToContent({ kind: 'capture-jira-table' });
  setOutput(response.ok ? response.data ?? [] : response.error ?? 'capture failed');
}

runWorkflowButton?.addEventListener('click', () => {
  void runSelectedWorkflow();
});

captureTableButton?.addEventListener('click', () => {
  void captureTable();
});

void hydrateSite();
