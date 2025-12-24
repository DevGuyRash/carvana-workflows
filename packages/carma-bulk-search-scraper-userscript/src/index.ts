import { copyToClipboard } from './export';
import type { Logger } from './logger';
import { createLogger } from './logger';
import { createInitialState } from './state';
import { loadOptions, saveOptions } from './storage';
import { downloadCsv, downloadJson, exportCsv, exportJson, runScrape } from './scraper';
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

  const onOpen = () => openModal(ui);
  const onClose = () => {
    if (state.running) {
      logger.log('??  Close disabled while running. Use Cancel first.');
      return;
    }
    closeModal(ui);
  };

  const onStart = () => {
    void runScrape({ state, ui, logger });
  };

  const onCancel = () => {
    state.abort = true;
    logger.log('? Cancel requested.');
  };

  const onDownloadCsv = () => {
    downloadCsv(state);
  };

  const onCopyCsv = async () => {
    const csv = exportCsv(state);
    const ok = await copyToClipboard(csv);
    logger.log(ok ? '? Copied CSV to clipboard.' : '??  Failed to copy CSV.');
  };

  const onDownloadJson = () => {
    downloadJson(state);
  };

  const onCopyJson = async () => {
    const json = exportJson(state);
    const ok = await copyToClipboard(json);
    logger.log(ok ? '? Copied JSON to clipboard.' : '??  Failed to copy JSON.');
  };

  const options = loadOptions();
  ui = createUi(options, {
    onStart,
    onCancel,
    onDownloadCsv,
    onCopyCsv,
    onDownloadJson,
    onCopyJson,
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
