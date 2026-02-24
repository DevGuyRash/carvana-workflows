import {
  formatError,
  queryActiveTab,
  sendRuntimeMessage,
} from './shared/webext-async';

const statusEl = document.getElementById('status');
const openPanelButton = document.getElementById('open-panel');

interface OpenControlCenterResponse {
  ok: boolean;
  error?: string;
}

interface ActiveTabContext {
  tabId?: number;
  windowId?: number;
}

function setStatus(value: string): void {
  if (statusEl) {
    statusEl.textContent = value;
  }
}

async function getActiveTabContext(): Promise<ActiveTabContext> {
  const activeTab = await queryActiveTab();

  return {
    tabId: typeof activeTab?.id === 'number' ? activeTab.id : undefined,
    windowId: typeof activeTab?.windowId === 'number' ? activeTab.windowId : undefined,
  };
}

async function openControlCenter(): Promise<void> {
  setStatus('Opening control center...');

  try {
    const context = await getActiveTabContext();

    const response = await sendRuntimeMessage<
      { kind: 'open-control-center'; tabId?: number; windowId?: number },
      OpenControlCenterResponse
    >({
      kind: 'open-control-center',
      tabId: context.tabId,
      windowId: context.windowId,
    });

    if (!response) {
      setStatus('Open failed: background did not respond');
      return;
    }

    if (!response.ok) {
      setStatus(`Open failed: ${response.error ?? 'unknown error'}`);
      return;
    }

    setStatus('Control center opened.');
  } catch (error) {
    setStatus(`Open failed: ${formatError(error)}`);
  }
}

openPanelButton?.addEventListener('click', () => {
  void openControlCenter();
});
