import { formatError, queryActiveTab, sendTabMessage, storageGet, storageSet } from './shared/webext-async';
import type { RuntimeCommand, RuntimeResponse } from './shared/messages';

type OpenControlCenterCommand = Extract<RuntimeCommand, { kind: 'open-control-center' }>;

function isExtensionSurfaceUrl(url: string | undefined): boolean {
  if (!url) return true;
  return /^(chrome-extension|moz-extension|chrome|edge|about|devtools):/i.test(url);
}

function isTabRunnable(tab: chrome.tabs.Tab | undefined): tab is chrome.tabs.Tab & { id: number } {
  if (!tab?.id || isExtensionSurfaceUrl(tab.url)) return false;
  return true;
}

async function getExecutionTab(
  sender: chrome.runtime.MessageSender,
): Promise<(chrome.tabs.Tab & { id: number }) | undefined> {
  if (isTabRunnable(sender.tab)) {
    return sender.tab;
  }

  const senderWindowId = sender.tab?.windowId;
  if (typeof senderWindowId === 'number') {
    const sameWindowActiveTabs = await chrome.tabs.query({ windowId: senderWindowId, active: true });
    const sameWindowActiveTab = sameWindowActiveTabs[0];
    if (isTabRunnable(sameWindowActiveTab)) {
      return sameWindowActiveTab;
    }
  }

  const current = await queryActiveTab();
  if (isTabRunnable(current)) {
    return current;
  }

  return undefined;
}

async function isRuleEnabled(ruleId: string): Promise<boolean> {
  const states = await storageGet<Record<string, boolean>>('cv_rules_state', {});
  return states[ruleId] !== false;
}

function normalizeRuleResultEnvelope(value: unknown): RuntimeResponse {
  if (!value || typeof value !== 'object') {
    return { ok: true, data: value };
  }

  const responseLike = value as Record<string, unknown>;
  const collectFailingRuleStatuses = (response: Record<string, unknown>): string[] => {
    const payload = response.data && typeof response.data === 'object'
      ? (response.data as Record<string, unknown>)
      : response;
    const results = payload.results;
    if (!Array.isArray(results)) return [];

    const failures: string[] = [];
    for (const entry of results) {
      if (!entry || typeof entry !== 'object') continue;
      const entryLike = entry as Record<string, unknown>;
      const status = typeof entryLike.status === 'string' ? entryLike.status.toLowerCase() : '';
      if (status === 'error' || status === 'failed' || status === 'partial') {
        const ruleId = typeof entryLike.ruleId === 'string' ? entryLike.ruleId : 'unknown-rule';
        failures.push(`${ruleId}:${status}`);
      }
    }
    return failures;
  };

  if (typeof responseLike.ok === 'boolean') {
    if (!responseLike.ok) {
      return { ok: false, error: String(responseLike.error ?? responseLike.message ?? 'Rule execution failed') };
    }
    const failures = collectFailingRuleStatuses(responseLike);
    if (failures.length > 0) {
      return {
        ok: false,
        error: `Auto-rules had non-success statuses: ${failures.join(', ')}`,
        data: value,
      };
    }
    return { ok: true, data: value };
  }

  const status = typeof responseLike.status === 'string' ? responseLike.status.toLowerCase() : '';
  if (status === 'error' || status === 'failed' || status === 'partial') {
    return {
      ok: false,
      error: String(responseLike.error ?? responseLike.message ?? `Rule execution ended with status: ${status}`),
      data: value,
    };
  }

  return { ok: true, data: value };
}

function isRuntimeResponse(value: unknown): value is RuntimeResponse {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'ok' in value &&
    typeof (value as { ok: unknown }).ok === 'boolean',
  );
}

async function handleMessage(
  message: RuntimeCommand,
  sender: chrome.runtime.MessageSender,
): Promise<RuntimeResponse> {
  switch (message.kind) {
    case 'open-control-center':
      return handleOpenControlCenter(message, sender);

    case 'open-extension-page': {
      const url = chrome.runtime.getURL('extension.html');
      await chrome.tabs.create({ url });
      return { ok: true };
    }

    case 'run-rule': {
      const { ruleId, site, context } = message.payload;
      if (!(await isRuleEnabled(ruleId))) {
        return { ok: false, error: `Rule ${ruleId} is disabled` };
      }
      const tab = await getExecutionTab(sender);
      if (!tab?.id) return { ok: false, error: 'No runnable tab available' };
      try {
        const result = await sendTabMessage<RuntimeCommand, RuntimeResponse>(
          tab.id,
          { kind: 'run-rule', payload: { ruleId, site, context } },
        );
        if (!isRuntimeResponse(result)) {
          return { ok: false, error: 'Rule execution did not return a valid response' };
        }
        if (!result.ok) {
          await appendLogEntry('error', `rule:${ruleId}`, result.error ?? 'Rule execution failed');
          return result;
        }
        await appendLogEntry('info', `rule:${ruleId}`, `Executed rule ${ruleId}`);
        try {
          if (site) {
            await storageSet({ [`cv_last_run_${site}`]: result.data });
          }
        } catch {
          // best effort
        }
        return result;
      } catch (err) {
        await appendLogEntry('error', `rule:${ruleId}`, formatError(err));
        return { ok: false, error: formatError(err) };
      }
    }

    case 'run-rule-with-result-mode': {
      const { ruleId, site, context, resultMode } = message.payload;
      if (!(await isRuleEnabled(ruleId))) {
        return { ok: false, error: `Rule ${ruleId} is disabled` };
      }
      const tab = await getExecutionTab(sender);
      if (!tab?.id) return { ok: false, error: 'No runnable tab available' };
      try {
        const result = await sendTabMessage<RuntimeCommand, RuntimeResponse>(
          tab.id,
          { kind: 'run-rule', payload: { ruleId, site, context } },
        );
        if (!isRuntimeResponse(result)) {
          return { ok: false, error: 'Rule execution did not return a valid response' };
        }
        if (!result.ok) {
          await appendLogEntry('error', `rule:${ruleId}`, result.error ?? 'Rule execution failed');
          return result;
        }
        await appendLogEntry('info', `rule:${ruleId}`, `Executed rule ${ruleId}`);
        if (site && resultMode === 'store') {
          await storageSet({ [`cv_last_run_${site}`]: result.data });
        }
        return result;
      } catch (err) {
        await appendLogEntry('error', `rule:${ruleId}`, formatError(err));
        return { ok: false, error: formatError(err) };
      }
    }

    case 'run-auto-rules': {
      const { url } = message.payload;
      const tab = await getExecutionTab(sender);
      if (!tab?.id) return { ok: false, error: 'No runnable tab available' };
      try {
        const result = await sendTabMessage(tab.id, { kind: 'run-auto-rules', payload: { url } });
        return normalizeRuleResultEnvelope(result);
      } catch (err) {
        return { ok: false, error: formatError(err) };
      }
    }

    case 'detect-site': {
      const { url } = message.payload;
      const tab = await getExecutionTab(sender);
      if (!tab?.id) return { ok: true, data: { site: 'unsupported' } };
      try {
        const detected = await sendTabMessage<RuntimeCommand, RuntimeResponse>(
          tab.id,
          { kind: 'detect-site', payload: { url: url || tab.url || '' } },
        );
        if (!isRuntimeResponse(detected)) {
          return { ok: true, data: { site: 'unsupported' } };
        }
        return detected.ok ? detected : { ok: true, data: { site: 'unsupported' } };
      } catch {
        return { ok: true, data: { site: 'unsupported' } };
      }
    }

    case 'get-rules': {
      const { site } = message.payload;
      const tab = await getExecutionTab(sender);
      if (!tab?.id) return { ok: false, error: 'No runnable tab available' };
      try {
        const result = await sendTabMessage<RuntimeCommand, RuntimeResponse>(
          tab.id,
          { kind: 'get-rules', payload: { site } },
        );
        if (!isRuntimeResponse(result)) {
          return { ok: false, error: 'Rule list did not return a valid response' };
        }
        return result;
      } catch (err) {
        return { ok: false, error: formatError(err) };
      }
    }
    case 'get-ui-rules': {
      const { site } = message.payload;
      const tab = await getExecutionTab(sender);
      if (!tab?.id) return { ok: false, error: 'No runnable tab available' };
      try {
        const result = await sendTabMessage<RuntimeCommand, RuntimeResponse>(
          tab.id,
          { kind: 'get-ui-rules', payload: { site } },
        );
        if (!isRuntimeResponse(result)) {
          return { ok: false, error: 'UI rules did not return a valid response' };
        }
        return result;
      } catch (err) {
        return { ok: false, error: formatError(err) };
      }
    }


    case 'toggle-rule': {
      const { ruleId, enabled } = message.payload;
      const states = await storageGet<Record<string, boolean>>('cv_rules_state', {});
      states[ruleId] = enabled;
      await storageSet({ cv_rules_state: states });
      return { ok: true };
    }

    case 'get-settings': {
      const settings = await storageGet('cv_settings', {
        theme: 'midnight',
        log_level: 'info',
        log_retention_days: 7,
        notifications_enabled: true,
        auto_run_rules: true,
      });
      return { ok: true, data: settings };
    }

    case 'save-settings': {
      await storageSet({ cv_settings: message.payload });
      return { ok: true };
    }

    case 'theme-changed': {
      const { themeId } = message.payload;
      await storageSet({ cv_theme: themeId });
      return { ok: true };
    }

    case 'data-captured': {
      const { site, data } = message.payload;
      if (site && data) {
        await storageSet({ [`cv_data_${site}`]: data });
      }
      return { ok: true };
    }

    case 'capture-table': {
      const tab = await getExecutionTab(sender);
      if (!tab?.id) return { ok: false, error: 'No runnable tab available' };
      try {
        const result = await sendTabMessage<RuntimeCommand, RuntimeResponse>(tab.id, { kind: 'capture-table' });
        if (!isRuntimeResponse(result)) {
          return { ok: false, error: 'Table capture did not return a valid response' };
        }
        if (result.ok) {
          await storageSet({ cv_last_capture: result.data });
        }
        return result;
      } catch (err) {
        return { ok: false, error: formatError(err) };
      }
    }


    case 'download-result': {
      const { filename, mime, data } = message.payload;
      if (!filename || !data) return { ok: false, error: 'Missing download payload' };
      try {
        const dataUrl = 'data:' + (mime || 'application/octet-stream') + ';base64,' + btoa(unescape(encodeURIComponent(data)));
        await chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: true,
        });
        await appendLogEntry('info', 'download', 'Downloaded ' + filename);
        return { ok: true };
      } catch (err) {
        await appendLogEntry('error', 'download', formatError(err));
        return { ok: false, error: formatError(err) };
      }
    }

    case 'copy-result': {
      const { data: copyData } = message.payload;
      if (!copyData) return { ok: false, error: 'No data to copy' };
      try {
        const tab = await getExecutionTab(sender);
        if (!tab?.id) return { ok: false, error: 'No runnable tab available' };
        const response = await sendTabMessage<RuntimeCommand, RuntimeResponse>(
          tab.id,
          { kind: 'clipboard-write', payload: { text: copyData } },
        );
        if (!isRuntimeResponse(response)) {
          return { ok: false, error: 'Clipboard write was not acknowledged by content script' };
        }
        if (!response.ok) {
          return response;
        }
        await appendLogEntry('info', 'clipboard', 'Copied result to clipboard');
        return { ok: true };
      } catch (err) {
        return { ok: false, error: formatError(err) };
      }
    }
    default:
      return { ok: false, error: `Unknown message kind: ${message.kind}` };
  }
}

async function handleOpenControlCenter(
  message: OpenControlCenterCommand,
  sender: chrome.runtime.MessageSender,
): Promise<RuntimeResponse> {
  try {
    let tabId: number | undefined = message.tabId;
    let windowId: number | undefined = message.windowId;

    if (tabId === undefined && windowId === undefined) {
      tabId = sender.tab?.id;
      windowId = sender.tab?.windowId;
    }
    if (tabId === undefined && windowId === undefined) {
      const active = await queryActiveTab();
      tabId = active?.id;
      windowId = active?.windowId;
    }

    const sidePanelApi = (chrome as any).sidePanel;
    if (sidePanelApi?.open) {
      const params: Record<string, number> = {};
      if (typeof tabId === 'number') params.tabId = tabId;
      if (typeof windowId === 'number') params.windowId = windowId;
      await sidePanelApi.open(params);
      return { ok: true };
    }

    const sidebarAction = (chrome as any).sidebarAction;
    if (sidebarAction?.open) {
      await Promise.resolve(sidebarAction.open());
      return { ok: true };
    }

    return { ok: false, error: 'Side panel API unavailable' };
  } catch (err) {
    return { ok: false, error: formatError(err) };
  }
}

async function appendLogEntry(level: string, source: string, message: string): Promise<void> {
  try {
    const logs = await storageGet<unknown[]>('cv_logs', []);
    logs.push({
      timestamp_ms: Date.now(),
      level,
      source,
      message,
    });
    const trimmed = logs.length > 500 ? logs.slice(-500) : logs;
    await storageSet({ cv_logs: trimmed });
  } catch {
    // best effort
  }
}

const AUTO_RULE_COOLDOWN_MS = 5000;
const lastAutoRunByTab = new Map<number, number>();

async function autoRunEnabled(): Promise<boolean> {
  const settings = await storageGet<Record<string, unknown>>('cv_settings', { auto_run_rules: true });
  return settings.auto_run_rules !== false;
}

async function triggerAutoRulesForTab(tab: chrome.tabs.Tab | undefined, reason: string): Promise<void> {
  if (!isTabRunnable(tab)) return;
  if (!(await autoRunEnabled())) return;

  const now = Date.now();
  const lastRun = lastAutoRunByTab.get(tab.id) ?? 0;
  if (now - lastRun < AUTO_RULE_COOLDOWN_MS) return;
  lastAutoRunByTab.set(tab.id, now);

  try {
    const result = await sendTabMessage(tab.id, {
      kind: 'run-auto-rules',
      payload: { url: tab.url ?? '' },
    });
    const normalized = normalizeRuleResultEnvelope(result);
    if (!normalized.ok) {
      await appendLogEntry('warn', 'autorun', `autorun (${reason}) finished with non-success status: ${normalized.error ?? 'unknown error'}`);
    }
  } catch (err) {
    await appendLogEntry('warn', 'autorun', `autorun (${reason}) failed: ${formatError(err)}`);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[cv-ext] background service worker installed');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab || tab.id !== tabId) return;
  void triggerAutoRulesForTab(tab, 'tabs.onUpdated');
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  void chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    void triggerAutoRulesForTab(tab, 'tabs.onActivated');
  });
});

chrome.runtime.onMessage.addListener(
  (
    message: RuntimeCommand,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: RuntimeResponse) => void,
  ) => {
    void handleMessage(message, sender).then(sendResponse).catch((err) => {
      sendResponse({ ok: false, error: formatError(err) });
    });
    return true;
  },
);
