import { formatError, queryActiveTab, sendTabMessage, storageGet, storageSet } from './shared/webext-async';
import type { RuntimeCommand, RuntimeResponse } from './shared/messages';

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
      const { ruleId, site, context } = (message as any).payload ?? {};
      const tab = await queryActiveTab();
      if (!tab?.id) return { ok: false, error: 'No active tab' };
      try {
        const result = await sendTabMessage(tab.id, { kind: 'run-rule', payload: { ruleId, site, context } });
        await appendLogEntry('info', `rule:${ruleId}`, `Executed rule ${ruleId}`);
        return { ok: true, data: result };
      } catch (err) {
        await appendLogEntry('error', `rule:${ruleId}`, formatError(err));
        return { ok: false, error: formatError(err) };
      }
    }

    case 'run-auto-rules': {
      const { url } = (message as any).payload ?? {};
      const tab = await queryActiveTab();
      if (!tab?.id) return { ok: false, error: 'No active tab' };
      try {
        const result = await sendTabMessage(tab.id, { kind: 'run-auto-rules', payload: { url } });
        return { ok: true, data: result };
      } catch (err) {
        return { ok: false, error: formatError(err) };
      }
    }

    case 'get-rules': {
      return { ok: true, data: [] };
    }

    case 'toggle-rule': {
      const { ruleId, enabled } = (message as any).payload ?? {};
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
      await storageSet({ cv_settings: (message as any).payload });
      return { ok: true };
    }

    case 'theme-changed': {
      const { themeId } = (message as any).payload ?? {};
      await storageSet({ cv_theme: themeId });
      return { ok: true };
    }

    case 'data-captured': {
      const { site, data } = (message as any).payload ?? {};
      if (site && data) {
        await storageSet({ [`cv_data_${site}`]: data });
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unknown message kind: ${message.kind}` };
  }
}

async function handleOpenControlCenter(
  message: RuntimeCommand,
  sender: chrome.runtime.MessageSender,
): Promise<RuntimeResponse> {
  try {
    const msg = message as any;
    let tabId: number | undefined = msg.tabId;
    let windowId: number | undefined = msg.windowId;

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

chrome.runtime.onInstalled.addListener(() => {
  console.log('[cv-ext] background service worker installed');
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
