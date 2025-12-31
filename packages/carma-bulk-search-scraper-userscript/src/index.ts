import { copyToClipboard } from './export';
import type { Logger } from './logger';
import { createLogger } from './logger';
import { createInitialState } from './state';
import { loadOptions, saveOptions } from './storage';
import { downloadCsv, downloadJson, exportCsv, exportJson, runScrape } from './scraper';
import type { AppUi } from './types';
import { closeModal, createUi, installFab, openModal } from './ui';
import { openResultsPopout } from './popout';

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

  const onPopoutTable = () => {
    if (popout && !popout.isClosed()) {
      popout.focus();
      popout.update();
      logger.log('[INFO] Popout refreshed.');
      return;
    }
    popout = openResultsPopout({
      getRows: () => state.rows,
      getRunning: () => state.running,
      logger,
    });
    if (!popout) return;
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
