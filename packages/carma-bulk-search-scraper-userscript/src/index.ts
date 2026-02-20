import { extractQuickCopyValues, type QuickCopyField } from './copy-utils';
import { copyToClipboard } from './export';
import type { Logger } from './logger';
import { createLogger } from './logger';
import { openResultsPopout } from './popout';
import { downloadCsv, downloadJson, exportCsv, exportJson, runScrape } from './scraper';
import { createInitialState } from './state';
import { loadOptions, saveOptions } from './storage';
import type { AppUi } from './types';
import { closeModal, createUi, installFab, openModal } from './ui';

declare global {
  interface Window {
    __carmaBulkSearchScraper__?: { loadedAt: number };
  }
}

(() => {
  if (window.__carmaBulkSearchScraper__) return;
  window.__carmaBulkSearchScraper__ = { loadedAt: Date.now() };

  const state = createInitialState();
  let ui!: AppUi;
  let logger!: Logger;
  let popout: ReturnType<typeof openResultsPopout> | null = null;

  const onOpen = () => openModal(ui);
  const onClose = () => {
    if (state.running) {
      logger.log('[WARN] Close disabled while running. Use Cancel first.');
      return;
    }
    closeModal(ui);
  };

  const onStart = () => {
    void runScrape({ state, ui, logger });
  };

  const onCancel = () => {
    state.abort = true;
    logger.log('[WARN] Cancel requested.');
  };

  const onDownloadCsv = () => {
    downloadCsv(state);
  };

  const onCopyCsv = async () => {
    const csv = exportCsv(state);
    const ok = await copyToClipboard(csv);
    logger.log(ok ? '[OK] Copied CSV to clipboard.' : '[ERROR] Failed to copy CSV.');
  };

  const onDownloadJson = () => {
    downloadJson(state);
  };

  const onCopyJson = async () => {
    const json = exportJson(state);
    const ok = await copyToClipboard(json);
    logger.log(ok ? '[OK] Copied JSON to clipboard.' : '[ERROR] Failed to copy JSON.');
  };

  const onCopyQuickField = async (field: QuickCopyField, label: string) => {
    const values = extractQuickCopyValues(state.rows, field);
    if (!values.length) {
      logger.log(`[WARN] No ${label} values available to copy.`);
      return;
    }

    const ok = await copyToClipboard(values.join('\n'));
    if (ok) {
      logger.log(`[OK] Copied ${values.length} ${label} value(s).`);
    } else {
      logger.log(`[ERROR] Failed to copy ${label} values.`);
    }
  };

  const onPopoutTable = () => {
    const stale = !!(popout && popout.isClosed());
    if (stale) {
      popout = null;
    }

    if (popout) {
      popout.focus();
      popout.update();
      logger.log('[INFO] Popout focused and refreshed.');
      return;
    }

    popout = openResultsPopout({
      getRows: () => state.rows,
      getRunning: () => state.running,
      logger,
    });
    if (!popout) return;

    if (stale) {
      logger.log('[INFO] Popout reopened.');
      return;
    }

    if (state.running) {
      logger.log('[INFO] Popout opened (live updates while running).');
    } else {
      logger.log('[INFO] Popout opened.');
    }
  };

  const options = loadOptions();
  ui = createUi(options, {
    onStart,
    onCancel,
    onDownloadCsv,
    onCopyCsv,
    onDownloadJson,
    onCopyJson,
    onPopoutTable,
    onCopyStock: () => onCopyQuickField('stock', 'stock'),
    onCopyVin: () => onCopyQuickField('vin', 'VIN'),
    onCopyPid: () => onCopyQuickField('pid', 'PID'),
    onCopyReference: () => onCopyQuickField('reference', 'reference'),
    onOptionsChange: saveOptions,
    onClose,
  });

  logger = createLogger(ui);

  installFab(onOpen);

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Open Carma Bulk Search Scraper', onOpen);
  }

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && (event.key === 'Y' || event.key === 'y')) {
      event.preventDefault();
      onOpen();
    }
  });
})();
