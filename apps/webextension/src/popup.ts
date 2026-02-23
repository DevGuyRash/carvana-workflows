const statusEl = document.getElementById('status');
const openPanelButton = document.getElementById('open-panel');

function setStatus(value: string): void {
  if (statusEl) {
    statusEl.textContent = value;
  }
}

async function openControlCenter(): Promise<void> {
  setStatus('Opening control center...');
  const response = await chrome.runtime.sendMessage({ kind: 'open-control-center' });
  if (!response?.ok) {
    setStatus(`Open failed: ${response?.error ?? 'unknown error'}`);
    return;
  }

  setStatus('Control center opened.');
}

openPanelButton?.addEventListener('click', () => {
  void openControlCenter();
});
