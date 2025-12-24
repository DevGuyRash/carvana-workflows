import type { AppUi } from './types';

export interface Logger {
  log: (line: string) => void;
  logDebug: (line: string) => void;
  clear: () => void;
}

export function createLogger(ui: AppUi): Logger {
  const setStatus = (line: string) => {
    const pre = ui.status;
    pre.textContent += (pre.textContent ? '\n' : '') + line;
    const nearBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 30;
    if (nearBottom) pre.scrollTop = pre.scrollHeight;
  };

  return {
    log: (line: string) => {
      setStatus(line);
    },
    logDebug: (line: string) => {
      if (!ui.debug?.checked) return;
      setStatus(`   ?? ${line}`);
    },
    clear: () => {
      ui.status.textContent = '';
    },
  };
}
