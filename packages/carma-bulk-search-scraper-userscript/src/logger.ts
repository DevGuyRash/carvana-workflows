import type { AppUi } from './types';

export interface Logger {
  log: (line: string) => void;
  logDebug: (line: string) => void;
  clear: () => void;
}

export function createLogger(ui: AppUi): Logger {
  const setStatus = (line: string) => {
    const pre = ui.status;
    const wasNearBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 30;
    pre.textContent += (pre.textContent ? '\n' : '') + line;
    if (wasNearBottom) pre.scrollTop = pre.scrollHeight;
  };

  return {
    log: (line: string) => {
      setStatus(line);
    },
    logDebug: (line: string) => {
      if (!ui.debug?.checked) return;
      setStatus(`[DEBUG] ${line}`);
    },
    clear: () => {
      ui.status.textContent = '';
    },
  };
}
