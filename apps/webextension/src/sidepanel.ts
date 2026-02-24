import type { RuntimeCommand, RuntimeResponse } from './shared/messages';
import {
  executeScriptFile,
  formatError,
  queryActiveTab,
  sendTabMessage,
  storageGet,
  storageSet,
} from './shared/webext-async';

interface RunReportLike {
  workflow_id?: string;
  site?: string;
  status?: string;
  started_at_ms?: number;
  ended_at_ms?: number;
  detail?: string;
  steps?: unknown[];
  artifacts?: unknown[];
  error?: unknown;
}

interface RunLogEntry {
  id: string;
  createdAtMs: number;
  workflowId: string;
  site: string;
  status: string;
  detail: string;
  report: RunReportLike;
}

const RUN_LOGS_KEY = 'cv_ext_run_logs_v1';
const RUN_LOGS_LIMIT = 200;
const JQL_DRAFT_KEY = 'cv_ext_jql_draft_v1';

const siteEl = document.getElementById('site');
const outputEl = document.getElementById('output');
const workflowSelect = document.getElementById('workflow-select') as HTMLSelectElement | null;
const runWorkflowButton = document.getElementById('run-workflow');
const captureTableButton = document.getElementById('capture-table');
const tabWorkflowsButton = document.getElementById('tab-workflows');
const tabLogsButton = document.getElementById('tab-logs');
const panelWorkflows = document.getElementById('panel-workflows');
const panelLogs = document.getElementById('panel-logs');
const logsListEl = document.getElementById('logs-list');
const logsEmptyEl = document.getElementById('logs-empty');
const clearLogsButton = document.getElementById('clear-logs');
const jiraBuilderEl = document.getElementById('jira-builder');
const jqlEditorEl = document.getElementById('jql-editor') as HTMLTextAreaElement | null;
const jqlStatusEl = document.getElementById('jql-status');
const jqlPresetMyActiveButton = document.getElementById('jql-preset-my-active');
const jqlPresetMyOpenButton = document.getElementById('jql-preset-my-open');
const jqlApplyButton = document.getElementById('jql-apply');
const jqlRunButton = document.getElementById('jql-run');

let activeSite = 'unsupported';
let hydrateScheduled = false;
let runLogs: RunLogEntry[] = [];

function setOutput(value: unknown): void {
  if (outputEl) {
    outputEl.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }
}

function setSiteText(value: string): void {
  if (siteEl) {
    siteEl.textContent = `Site: ${value}`;
  }
}

function setJqlStatus(value: string): void {
  if (jqlStatusEl) {
    jqlStatusEl.textContent = value;
  }
}

function isNoReceiverError(error: unknown): boolean {
  const text = formatError(error).toLowerCase();
  return text.includes('receiving end does not exist') || text.includes('message port closed');
}

function asRunReportLike(data: unknown): RunReportLike | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const candidate = data as Record<string, unknown>;
  if (typeof candidate.workflow_id !== 'string') {
    return null;
  }

  return {
    workflow_id: candidate.workflow_id as string,
    site: typeof candidate.site === 'string' ? candidate.site : undefined,
    status: typeof candidate.status === 'string' ? candidate.status : undefined,
    started_at_ms: typeof candidate.started_at_ms === 'number' ? candidate.started_at_ms : undefined,
    ended_at_ms: typeof candidate.ended_at_ms === 'number' ? candidate.ended_at_ms : undefined,
    detail: typeof candidate.detail === 'string' ? candidate.detail : undefined,
    steps: Array.isArray(candidate.steps) ? candidate.steps : undefined,
    artifacts: Array.isArray(candidate.artifacts) ? candidate.artifacts : undefined,
    error: candidate.error,
  };
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

function switchTab(next: 'workflows' | 'logs'): void {
  const workflowsActive = next === 'workflows';
  tabWorkflowsButton?.classList.toggle('active', workflowsActive);
  tabLogsButton?.classList.toggle('active', !workflowsActive);

  if (panelWorkflows) {
    panelWorkflows.hidden = !workflowsActive;
  }

  if (panelLogs) {
    panelLogs.hidden = workflowsActive;
  }
}

function updateJiraBuilderVisibility(): void {
  if (jiraBuilderEl) {
    jiraBuilderEl.hidden = activeSite !== 'jira';
  }
}

async function loadJqlDraft(): Promise<void> {
  const draft = await storageGet<string>(JQL_DRAFT_KEY, '');
  if (jqlEditorEl && draft) {
    jqlEditorEl.value = draft;
  }
}

async function persistJqlDraft(): Promise<void> {
  if (!jqlEditorEl) {
    return;
  }

  await storageSet({ [JQL_DRAFT_KEY]: jqlEditorEl.value });
}

async function loadRunLogs(): Promise<void> {
  runLogs = await storageGet<RunLogEntry[]>(RUN_LOGS_KEY, []);
  renderRunLogs();
}

async function persistRunLogs(): Promise<void> {
  const trimmed = runLogs.slice(0, RUN_LOGS_LIMIT);
  runLogs = trimmed;
  await storageSet({ [RUN_LOGS_KEY]: trimmed });
}

function renderRunLogs(): void {
  if (!logsListEl || !logsEmptyEl) {
    return;
  }

  logsListEl.innerHTML = '';

  if (runLogs.length === 0) {
    logsEmptyEl.hidden = false;
    return;
  }

  logsEmptyEl.hidden = true;

  for (const item of runLogs) {
    const card = document.createElement('details');
    card.className = 'log-card';

    const summary = document.createElement('summary');
    summary.className = 'log-summary';

    const left = document.createElement('span');
    left.textContent = `${item.workflowId} [${item.status}]`;
    summary.appendChild(left);

    const right = document.createElement('span');
    right.textContent = formatTimestamp(item.createdAtMs);
    summary.appendChild(right);

    const meta = document.createElement('div');
    meta.className = 'log-meta';
    meta.textContent = `site=${item.site} | detail=${item.detail || 'n/a'}`;

    const pre = document.createElement('pre');
    pre.className = 'log-pre';
    pre.textContent = JSON.stringify(item.report, null, 2);

    card.appendChild(summary);
    card.appendChild(meta);
    card.appendChild(pre);
    logsListEl.appendChild(card);
  }
}

async function appendRunLog(report: RunReportLike): Promise<void> {
  const workflowId = report.workflow_id ?? 'unknown';
  const site = report.site ?? activeSite;
  const status = report.status ?? 'unknown';
  const detail = report.detail ?? '';

  const entry: RunLogEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAtMs: Date.now(),
    workflowId,
    site,
    status,
    detail,
    report,
  };

  runLogs.unshift(entry);
  await persistRunLogs();
  renderRunLogs();
}

async function clearRunLogs(): Promise<void> {
  runLogs = [];
  await persistRunLogs();
  renderRunLogs();
}

function parseKeyValueInput(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const divider = trimmed.indexOf('=');
    if (divider <= 0) {
      continue;
    }

    const key = trimmed.slice(0, divider).trim();
    const value = trimmed.slice(divider + 1).trim();
    if (!key) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

function normalizeOracleInvoiceInput(source: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [rawKey, value] of Object.entries(source)) {
    const key = rawKey.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

    if (key === 'business unit') {
      normalized.businessUnit = value;
    } else if (key === 'supplier') {
      normalized.supplier = value;
    } else if (key === 'supplier search') {
      normalized.supplierSearch = value;
    } else if (key === 'supplier site') {
      normalized.supplierSite = value;
    } else if (key === 'invoice group') {
      normalized.invoiceGroup = value;
    } else if (key === 'amount' || key === 'amount numeric') {
      normalized.amountNumeric = value;
    } else if (key === 'amount raw') {
      normalized.amountRaw = value;
    } else if (key === 'number' || key === 'invoice number') {
      normalized.invoiceNumber = value;
    } else if (key === 'description') {
      normalized.description = value;
    } else {
      normalized[rawKey] = value;
    }
  }

  return normalized;
}

function collectWorkflowInput(site: string, workflowId: string): Record<string, string> | undefined {
  if (site !== 'oracle') {
    return undefined;
  }

  if (!workflowId.startsWith('oracle.invoice.create')) {
    return undefined;
  }

  const template = [
    'Business Unit=',
    'Supplier=',
    'Supplier Search=',
    'Supplier Site=',
    'Invoice Group=',
    'Amount=',
    'Number=',
    'Description=',
  ].join('\n');

  const raw = globalThis.prompt(
    'Enter Oracle invoice fields as key=value (one per line). Leave blank to cancel.',
    template,
  );

  if (raw === null) {
    return undefined;
  }

  const parsed = parseKeyValueInput(raw);
  const normalized = normalizeOracleInvoiceInput(parsed);
  return Object.keys(normalized).length === 0 ? undefined : normalized;
}

async function getActiveTabId(): Promise<number> {
  const activeTab = await queryActiveTab();
  const tabId = activeTab?.id;
  if (typeof tabId !== 'number') {
    throw new Error('active tab not found');
  }

  return tabId;
}

async function sendToContent(tabId: number, command: RuntimeCommand): Promise<RuntimeResponse> {
  const response = await sendTabMessage<RuntimeCommand, RuntimeResponse>(tabId, command);
  if (!response) {
    throw new Error('content script did not respond');
  }

  return response;
}

async function sendToContentWithInjectionFallback(command: RuntimeCommand): Promise<RuntimeResponse> {
  const tabId = await getActiveTabId();

  try {
    return await sendToContent(tabId, command);
  } catch (error) {
    if (!isNoReceiverError(error)) {
      throw error;
    }

    await executeScriptFile(tabId, 'content.js');
    return await sendToContent(tabId, command);
  }
}

async function hydrateSite(): Promise<void> {
  try {
    const detect = await sendToContentWithInjectionFallback({ kind: 'detect-site' });
    if (!detect.ok) {
      setSiteText('unsupported');
      setOutput(detect.error ?? 'site detection failed');
      updateJiraBuilderVisibility();
      return;
    }

    activeSite = String(detect.data ?? 'unsupported');
    setSiteText(activeSite);
    updateJiraBuilderVisibility();

    const workflows = await sendToContentWithInjectionFallback({
      kind: 'list-workflows',
      site: activeSite,
    });
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

    if (data.length === 0) {
      setOutput('No workflows available for this site.');
    }
  } catch (error) {
    setSiteText('unavailable');
    updateJiraBuilderVisibility();
    setOutput(`Failed to hydrate control center: ${formatError(error)}`);
  }
}

function scheduleHydrate(): void {
  if (hydrateScheduled) {
    return;
  }

  hydrateScheduled = true;
  setTimeout(() => {
    hydrateScheduled = false;
    void hydrateSite();
  }, 150);
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

  try {
    const input = collectWorkflowInput(activeSite, workflowId);
    const response = await sendToContentWithInjectionFallback({
      kind: 'run-workflow',
      site: activeSite,
      workflowId,
      input,
    });

    if (!response.ok) {
      setOutput(response.error ?? 'workflow run failed');
      return;
    }

    setOutput(response.data ?? 'ok');

    if (activeSite === 'jira' && workflowId === 'jira.jql.builder') {
      updateJiraBuilderVisibility();
      setJqlStatus('Use the Jira JQL Builder section below to build/apply queries.');
    }

    const report = asRunReportLike(response.data);
    if (report) {
      await appendRunLog(report);
    }
  } catch (error) {
    setOutput(`Workflow run failed: ${formatError(error)}`);
  }
}

async function captureTable(): Promise<void> {
  try {
    const response = await sendToContentWithInjectionFallback({ kind: 'capture-jira-table' });
    setOutput(response.ok ? response.data ?? [] : response.error ?? 'capture failed');
  } catch (error) {
    setOutput(`Capture failed: ${formatError(error)}`);
  }
}

function presetMyActiveWork(): string {
  return 'assignee = currentUser() AND status in ("In Progress", "Work in progress", "Waiting for support", "Waiting for customer", "Approved", "AP In Progress", "In Development", "In Review") ORDER BY updated DESC, priority DESC';
}

function presetMyOpenIssues(): string {
  return 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';
}

async function applyJql(runSearch: boolean): Promise<void> {
  if (!jqlEditorEl) {
    return;
  }

  if (activeSite !== 'jira') {
    setJqlStatus('JQL builder requires an active Jira tab.');
    return;
  }

  const jql = jqlEditorEl.value.trim();
  if (!jql) {
    setJqlStatus('JQL is empty.');
    return;
  }

  setJqlStatus(runSearch ? 'Applying and running query...' : 'Applying query...');

  try {
    await persistJqlDraft();

    const response = await sendToContentWithInjectionFallback({
      kind: 'apply-jql',
      jql,
      runSearch,
    });

    if (!response.ok) {
      const message = response.error ?? 'failed to apply JQL';
      setJqlStatus(`Failed: ${message}`);
      return;
    }

    const mode = (response.data as { mode?: string } | undefined)?.mode ?? 'ok';
    setJqlStatus(runSearch ? `Query applied (${mode}).` : 'Query applied to editor.');
    setOutput(response.data ?? 'JQL applied');
  } catch (error) {
    setJqlStatus(`Failed: ${formatError(error)}`);
  }
}

runWorkflowButton?.addEventListener('click', () => {
  void runSelectedWorkflow();
});

captureTableButton?.addEventListener('click', () => {
  void captureTable();
});

tabWorkflowsButton?.addEventListener('click', () => {
  switchTab('workflows');
});

tabLogsButton?.addEventListener('click', () => {
  switchTab('logs');
});

clearLogsButton?.addEventListener('click', () => {
  void clearRunLogs();
});

jqlPresetMyActiveButton?.addEventListener('click', () => {
  if (!jqlEditorEl) {
    return;
  }
  jqlEditorEl.value = presetMyActiveWork();
  setJqlStatus('Preset loaded: My Active Work');
  void persistJqlDraft();
});

jqlPresetMyOpenButton?.addEventListener('click', () => {
  if (!jqlEditorEl) {
    return;
  }
  jqlEditorEl.value = presetMyOpenIssues();
  setJqlStatus('Preset loaded: My Open Issues');
  void persistJqlDraft();
});

jqlApplyButton?.addEventListener('click', () => {
  void applyJql(false);
});

jqlRunButton?.addEventListener('click', () => {
  void applyJql(true);
});

jqlEditorEl?.addEventListener('input', () => {
  void persistJqlDraft();
});

if (chrome.tabs?.onActivated) {
  chrome.tabs.onActivated.addListener(() => {
    scheduleHydrate();
  });
}

if (chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener(() => {
    scheduleHydrate();
  });
}

void loadRunLogs();
void loadJqlDraft();
updateJiraBuilderVisibility();
void hydrateSite();
