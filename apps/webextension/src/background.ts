interface OpenControlCenterMessage {
  kind: 'open-control-center';
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[cv-ext] background installed');
});

chrome.runtime.onMessage.addListener(
  (
    message: OpenControlCenterMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: { ok: boolean; error?: string }) => void,
  ) => {
    if (message?.kind !== 'open-control-center') {
      return;
    }

    const tabId = sender.tab?.id;
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, error: 'no active tab' });
      return;
    }

    const sidePanelApi = (chrome as any).sidePanel;
    if (sidePanelApi?.open) {
      sidePanelApi
        .open({ tabId })
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          sendResponse({ ok: false, error: String(error) });
        });
      return true;
    }

    const sidebarAction = (chrome as any).sidebarAction;
    if (sidebarAction?.open) {
      sidebarAction.open();
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: 'side panel API unavailable' });
  },
);
