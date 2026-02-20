import { extractQuickCopyValues, type QuickCopyField } from './copy-utils';
import { copyToClipboard } from './export';
import type { Logger } from './logger';
import { createLogger } from './logger';
import { openResultsPopout } from './popout';
import { downloadCsv, downloadJson, exportCsv, exportJson, runScrape } from './scraper';
import { createInitialState } from './state';
import { loadState, saveState } from './storage';
import type { PersistedState, PopoutOptions, ScrapeOptions, ThemeOptions, UiState, UniquenessOptions } from './types';
import { closeModal, createUi, installFab, openModal } from './ui';

declare global {
  interface Window {
    __carmaBulkSearchScraper__?: { loadedAt: number };
  }
}

function applyTheme(theme: ThemeOptions): void {
  try {
    document.documentElement.style.setProperty('--cbss-primary', theme.primary);
    document.documentElement.style.setProperty('--cbss-accent', theme.accent);
  } catch {
    // ignore
  }
}

(() => {
  if (window.__carmaBulkSearchScraper__) return;
  window.__carmaBulkSearchScraper__ = { loadedAt: Date.now() };

  const state = createInitialState();
  let ui!: ReturnType<typeof createUi>;
  let logger!: Logger;
  let popout: ReturnType<typeof openResultsPopout> | null = null;

  let persisted: PersistedState = loadState();
  applyTheme(persisted.theme);

  const persist = (next: PersistedState) => {
    persisted = next;
    saveState(persisted);
  };

  const onOpen = () => openModal(ui);
  const onClose = () => {
    if (state.running) {
      logger.log('[WARN] Close disabled while running. Use Cancel first.');
      return;
    }
    closeModal(ui);
  };

  const onStart = () => {
    // Ensure latest values are stored (some controls fire on blur)
    const scrape: ScrapeOptions = {
      paginateAllPages: !!ui.paginate.checked,
      setShowTo100: !!ui.show100.checked,
      columnMode: ui.columns.value as ScrapeOptions['columnMode'],
      requirePurchaseId: !!ui.requirePurchaseId.checked,
      requireVin: !!ui.requireVin.checked,
      requireStockNumber: !!ui.requireStockNumber.checked,
      debug: !!ui.debug.checked,
      maxConcurrency: Math.max(1, Number.parseInt(ui.maxConcurrency.value || '1', 10) || 1),
    };

    const uniqueness: UniquenessOptions = {
      enabled: !!ui.uniqueEnabled.checked,
      keyFields: {
        vin: !!ui.uniqueKeyVin.checked,
        stock: !!ui.uniqueKeyStock.checked,
        pid: !!ui.uniqueKeyPid.checked,
      },
      strategy: 'latest_by_date',
      dateColumn: {
        mode: ui.uniqueDateMode.value === 'manual' ? 'manual' : 'auto',
        header: ui.uniqueDateHeader.value || '',
      },
    };

    persist({ ...persisted, scrape, uniqueness });

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
      getPopoutOptions: () => persisted.popout,
      setPopoutOptions: (next: PopoutOptions) => {
        persist({ ...persisted, popout: next });
      },
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

  ui = createUi(persisted, {
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

    onScrapeOptionsChange: (opts: ScrapeOptions) => {
      persist({ ...persisted, scrape: opts });
    },
    onUniquenessOptionsChange: (opts: UniquenessOptions) => {
      persist({ ...persisted, uniqueness: opts });
    },
    onPopoutOptionsChange: (opts: PopoutOptions) => {
      // Preserve selectedColumnsByName so UI changes don't wipe state
      persist({
        ...persisted,
        popout: {
          ...persisted.popout,
          copyIncludeHeaders: opts.copyIncludeHeaders,
          persistSelectedColumns: opts.persistSelectedColumns,
        },
      });
    },
    onThemeOptionsChange: (opts: ThemeOptions) => {
      persist({ ...persisted, theme: opts });
      applyTheme(opts);
    },
    onUiStateChange: (uiState: UiState) => {
      persist({ ...persisted, ui: uiState });
    },

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
