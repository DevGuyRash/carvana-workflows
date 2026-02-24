import { formatError, queryActiveTab } from './shared/webext-async';

interface OpenControlCenterMessage {
  kind: 'open-control-center';
  tabId?: number;
  windowId?: number;
}

interface OpenControlCenterResponse {
  ok: boolean;
  error?: string;
}

interface ControlCenterContext {
  tabId?: number;
  windowId?: number;
}

async function queryActiveTabContext(): Promise<ControlCenterContext> {
  const activeTab = await queryActiveTab();

  return {
    tabId: typeof activeTab?.id === 'number' ? activeTab.id : undefined,
    windowId: typeof activeTab?.windowId === 'number' ? activeTab.windowId : undefined,
  };
}

async function resolveTargetContext(
  message: OpenControlCenterMessage,
  sender: chrome.runtime.MessageSender,
): Promise<ControlCenterContext> {
  const messageContext: ControlCenterContext = {
    tabId: typeof message.tabId === 'number' ? message.tabId : undefined,
    windowId: typeof message.windowId === 'number' ? message.windowId : undefined,
  };

  if (typeof messageContext.tabId === 'number' || typeof messageContext.windowId === 'number') {
    return messageContext;
  }

  const senderContext: ControlCenterContext = {
    tabId: typeof sender.tab?.id === 'number' ? sender.tab.id : undefined,
    windowId: typeof sender.tab?.windowId === 'number' ? sender.tab.windowId : undefined,
  };

  if (typeof senderContext.tabId === 'number' || typeof senderContext.windowId === 'number') {
    return senderContext;
  }

  return queryActiveTabContext();
}

async function openControlCenterForBrowser(context: ControlCenterContext): Promise<void> {
  const sidePanelApi = (chrome as any).sidePanel;
  if (sidePanelApi?.open) {
    const params: Record<string, number> = {};

    if (typeof context.tabId === 'number') {
      params.tabId = context.tabId;
    }

    if (typeof context.windowId === 'number') {
      params.windowId = context.windowId;
    }

    if (!('tabId' in params) && !('windowId' in params)) {
      throw new Error('active tab/window context unavailable');
    }

    await sidePanelApi.open(params);
    return;
  }

  const sidebarAction = (chrome as any).sidebarAction;
  if (sidebarAction?.open) {
    await Promise.resolve(sidebarAction.open());
    return;
  }

  throw new Error('side panel API unavailable');
}

async function handleOpenControlCenter(
  message: OpenControlCenterMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: OpenControlCenterResponse) => void,
): Promise<void> {
  try {
    const context = await resolveTargetContext(message, sender);
    if (typeof context.tabId !== 'number' && typeof context.windowId !== 'number') {
      throw new Error('active tab not found');
    }

    await openControlCenterForBrowser(context);
    sendResponse({ ok: true });
  } catch (error) {
    const text = formatError(error) || 'unknown error';
    console.error('[cv-ext] failed to open control center:', text);
    sendResponse({ ok: false, error: text });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[cv-ext] background installed');
});

chrome.runtime.onMessage.addListener(
  (
    message: OpenControlCenterMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: OpenControlCenterResponse) => void,
  ) => {
    if (message?.kind !== 'open-control-center') {
      return;
    }

    void handleOpenControlCenter(message, sender, sendResponse);
    return true;
  },
);
