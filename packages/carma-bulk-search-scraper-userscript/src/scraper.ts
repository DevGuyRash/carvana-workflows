import { applyColumns, setPageSize } from './columns';
import { downloadText, rowsToCsv } from './export';
import { getRowValueByHeaderLike, isMeaningfulValue, shouldKeepRow } from './filters';
import { loadIntoIframe } from './iframe';
import type { Logger } from './logger';
import { clickNextPage, getPaginationInfo, goToFirstPageIfNeeded } from './pagination';
import { baseTitle, getBlocksWithTables, parseCountFromTitle, scrapeCurrentPageRows } from './tables';
import { parseTerms } from './terms';
import type { AppState, AppUi, BlockInfo, ScrapeOptions, TermInfo, UniquenessOptions } from './types';
import { cleanText, waitFor } from './utils';
import { PURCHASE_ID_BLANK_MATCHERS, STOCK_NUMBER_BLANK_MATCHERS, VIN_BLANK_MATCHERS } from './constants';
import { buildUniquenessKey, normalizeUniquenessOptions, parseRowDateMs, shouldReplaceDuplicate } from './uniqueness';

export interface ScrapeContext {
  state: AppState;
  ui: AppUi;
  logger: Logger;
}

function normalizeSegment(value: string, blankMatchers: Array<string | RegExp>): string {
  return isMeaningfulValue(value, blankMatchers) ? cleanText(value) : '';
}

function buildReference(row: Record<string, unknown>): string {
  const stockRaw = getRowValueByHeaderLike(row, [
    /latest\s*purchase\s*stock\s*number/i,
    /latestpurchasestocknumber/i,
    /stock\s*number/i,
    /stocknumber/i,
  ]);
  const vinRaw = getRowValueByHeaderLike(row, [
    /latest\s*purchase\s*vin/i,
    /latestpurchasevin/i,
    /^vin$/i,
  ]);
  const purchaseIdRaw = getRowValueByHeaderLike(row, [
    /latest\s*purchase\s*purchase\s*id/i,
    /latestpurchasepurchaseid/i,
    /purchase\s*id/i,
    /purchaseid/i,
  ]);

  const stock = normalizeSegment(stockRaw, STOCK_NUMBER_BLANK_MATCHERS);
  const vin = normalizeSegment(vinRaw, VIN_BLANK_MATCHERS);
  const purchaseId = normalizeSegment(purchaseIdRaw, PURCHASE_ID_BLANK_MATCHERS);

  if (!stock && !vin && !purchaseId) return '';

  return `HUB-${stock || 'STOCK'}-${vin || 'VIN'}-${purchaseId || 'PID'}`;
}

function hasEmptyResults(doc: Document): boolean {
  const blocks = Array.from(doc.querySelectorAll('.cpl__block'));
  for (const block of blocks) {
    const title = cleanText(block.querySelector('.cpl__block__header-title')?.textContent || '');
    if (!/\(\s*0\s*\)/.test(title)) continue;
    const blockText = cleanText(block.textContent || '');
    if (/no\s+results/i.test(blockText)) return true;
    if (/no\s+\w+\s+found/i.test(blockText)) return true;
  }

  const bodyText = cleanText(doc.body?.innerText || '');
  if (!bodyText) return false;
  if (/no\s+results/i.test(bodyText)) return true;
  if (/no\s+customers?\s+found/i.test(bodyText)) return true;
  return false;
}

function readScrapeOptions(ui: AppUi): ScrapeOptions {
  return {
    paginateAllPages: !!ui.paginate.checked,
    setShowTo100: !!ui.show100.checked,
    columnMode: ui.columns.value as ScrapeOptions['columnMode'],
    requirePurchaseId: !!ui.requirePurchaseId.checked,
    requireVin: !!ui.requireVin.checked,
    requireStockNumber: !!ui.requireStockNumber.checked,
    debug: !!ui.debug.checked,
    maxConcurrency: Math.max(1, Number.parseInt(ui.maxConcurrency.value || '1', 10) || 1),
  };
}



function readUniquenessOptions(ui: AppUi): UniquenessOptions {
  return {
    enabled: !!ui.uniqueEnabled.checked,
    keyFields: {
      vin: !!ui.uniqueKeyVin.checked,
      stock: !!ui.uniqueKeyStock.checked,
      pid: !!ui.uniqueKeyPid.checked,
    },
    strategy: 'latest_by_date',
    dateColumn: {
      mode: (ui.uniqueDateMode.value === 'manual') ? 'manual' : 'auto',
      header: ui.uniqueDateHeader.value || '',
    },
  };
}
async function scrapeBlockPages(params: {
  termInfo: TermInfo;
  blockInfo: BlockInfo;
  scrapeOpts: ScrapeOptions;
  uniqueOpts: UniquenessOptions;
  ctx: ScrapeContext;
}): Promise<{ name: string; expectedCount: number | null; totalSeen: number; totalKept: number }> {
  const { termInfo, blockInfo, scrapeOpts, uniqueOpts, ctx } = params;
  const { state, logger } = ctx;
  const { block, rawTitle } = blockInfo;
  const expectedCount = parseCountFromTitle(rawTitle);
  const name = baseTitle(rawTitle) || 'Table';
  const resolveBlock = (): HTMLElement => {
    const doc = block.ownerDocument;
    if (block.isConnected) return block as HTMLElement;
    if (!doc) return block as HTMLElement;
    const blocks = Array.from(doc.querySelectorAll('.cpl__block')) as HTMLElement[];
    if (!blocks.length) return block as HTMLElement;
    if (rawTitle) {
      const match = blocks.find((b) => cleanText(b.querySelector('.cpl__block__header-title')?.textContent || '') === rawTitle);
      if (match) return match;
    }
    return blocks[0];
  };
  const resolveTable = (root: ParentNode): HTMLTableElement | null => (
    root.querySelector('table[data-testid=\"data-table\"]') as HTMLTableElement | null
  );

  if (scrapeOpts.columnMode !== 'none') {
    logger.log(`[INFO] [${rawTitle || name}] Applying columns: ${scrapeOpts.columnMode}...`);
    try {
      const result = await applyColumns(resolveBlock(), scrapeOpts.columnMode);
      if (result.reason === 'already_all' || result.reason === 'already_key') {
        logger.log(`[INFO] Columns already satisfied (${scrapeOpts.columnMode}).`);
      } else if (result.applied) {
        logger.log(`[OK] Columns updated (${result.reason}).`);
      } else {
        if (result.reason === 'no_button') {
          logger.logDebug('Edit Columns button not found; skipping.');
        } else {
          logger.logDebug(`Columns not applied (${result.reason}).`);
        }
      }
    } catch (error) {
      logger.log(`[WARN] Failed to apply columns: ${(error as Error).message}`);
    }
  }

  if (scrapeOpts.setShowTo100) {
    logger.log(`[INFO] [${rawTitle || name}] Setting page size: Show 100...`);
    try {
      const result = await setPageSize(resolveBlock(), 100);
      if (result.changed) {
        logger.log('[OK] Set page size to Show 100.');
      } else {
        if (result.reason === 'already') {
          logger.log('[INFO] Already Show 100.');
        } else if (result.reason === 'no_show_button') {
          logger.log('[WARN] Page size dropdown not found; leaving current size.');
        } else if (result.reason === 'no_target_item') {
          logger.log('[WARN] Show 100 option not found; leaving current size.');
        } else {
          logger.logDebug(`Page size unchanged (${result.reason}).`);
        }
      }
    } catch (error) {
      logger.log(`[WARN] Failed to set page size: ${(error as Error).message}`);
    }
  }

  const pi0 = getPaginationInfo(resolveBlock());
  logger.logDebug(`Pagination detected: current=${pi0.current} total=${pi0.total}`);

  let totalSeen = 0;
  let totalKept = 0;

  if (scrapeOpts.paginateAllPages && pi0.total > 1) {
    try {
      await goToFirstPageIfNeeded(resolveBlock());
    } catch (error) {
      logger.logDebug(`Could not force page 1: ${(error as Error).message}`);
    }
  }

  const pi = getPaginationInfo(resolveBlock());
  const pagesToScrape = scrapeOpts.paginateAllPages ? pi.total : 1;

  if (!scrapeOpts.paginateAllPages || pi.total <= 1) {
    logger.log(`[INFO] [${rawTitle || name}] Scraping current page only.`);
  } else {
    logger.log(`[INFO] [${rawTitle || name}] Scraping all pages (${pi.total}).`);
  }

  for (let page = 1; page <= pagesToScrape; page++) {
    if (state.abort) {
      logger.log('[WARN] Aborted by user.');
      break;
    }

    try {
      await waitFor(() => {
        const t = resolveTable(resolveBlock());
        if (!t) return null;
        const body = t.querySelector('tbody');
        if (!body) return null;
        return t;
      }, { timeoutMs: 15000, intervalMs: 100, debugLabel: 'table render' });
    } catch (error) {
      logger.log(`[WARN] Table not ready on page ${page}: ${(error as Error).message}`);
      continue;
    }

    const liveTable = resolveTable(resolveBlock());
    if (!liveTable) {
      logger.log(`[WARN] Table not found on page ${page}.`);
      continue;
    }
    const { rows } = scrapeCurrentPageRows(liveTable);
    totalSeen += rows.length;

    const filters = {
      requirePurchaseId: scrapeOpts.requirePurchaseId,
      requireVin: scrapeOpts.requireVin,
      requireStockNumber: scrapeOpts.requireStockNumber,
    };

    for (const row of rows) {
      const out = {
        searchTerm: termInfo.term,
        searchUrl: termInfo.url,
        table: name,
        page,
        Reference: '',
        ...row,
      };
      out.Reference = buildReference(out);

      if (shouldKeepRow(out, filters)) {
        const normalizedUnique = normalizeUniquenessOptions(uniqueOpts);
        if (!normalizedUnique.enabled) {
          state.rows.push(out);
          totalKept++;
          continue;
        }

        const key = buildUniquenessKey(out, normalizedUnique.keyFields);
        if (!key) {
          state.rows.push(out);
          totalKept++;
          continue;
        }

        const candidateTs = parseRowDateMs(out, normalizedUnique);
        const existing = state.uniqueIndex.get(key);
        if (!existing) {
          state.rows.push(out);
          state.uniqueIndex.set(key, { index: state.rows.length - 1, ts: candidateTs });
          totalKept++;
          continue;
        }

        const replace = shouldReplaceDuplicate({
          existingTs: existing.ts,
          candidateTs,
          strategy: normalizedUnique.strategy,
        });

        if (replace) {
          state.rows[existing.index] = out;
          state.uniqueIndex.set(key, { index: existing.index, ts: candidateTs });
          if (scrapeOpts.debug) logger.logDebug(`[INFO] Replaced duplicate for key: ${key}`);
        } else {
          if (scrapeOpts.debug) logger.logDebug(`[INFO] Ignored duplicate for key: ${key}`);
        }
      }
    }

    logger.logDebug(`Page ${page}: seen=${rows.length}, kept=${totalKept} (cumulative)`);

    if (page < pagesToScrape) {
      try {
        await clickNextPage(resolveBlock(), page + 1);
      } catch (error) {
        logger.log(`[WARN] Failed to go to next page (${page + 1}): ${(error as Error).message}`);
        break;
      }
    }
  }

  if (ctx.ui.debug?.checked && expectedCount !== null) {
    if (totalSeen !== expectedCount) {
      logger.logDebug(`Count mismatch for "${rawTitle}": title=${expectedCount}, scrapedRows=${totalSeen}. (This can be normal if filters/paging/permissions differ.)`);
    } else {
      logger.logDebug(`Count check OK for "${rawTitle}": ${expectedCount} rows.`);
    }
  }

  return { name, expectedCount, totalSeen, totalKept };
}

export async function runScrape(ctx: ScrapeContext): Promise<void> {
  const { state, ui, logger } = ctx;
  if (state.running) return;

  const scrapeOpts = readScrapeOptions(ui);

  const uniqueOpts = normalizeUniquenessOptions(readUniquenessOptions(ui));

  const terms = parseTerms(ui.terms.value);
  logger.clear();
  state.rows = [];
  state.uniqueIndex = new Map();
  state.abort = false;

  if (!terms.length) {
    logger.log('[WARN] No search terms provided.');
    return;
  }

  state.running = true;
  ui.start.disabled = true;
  ui.cancel.disabled = false;

  logger.log(`[INFO] Starting. Terms: ${terms.length}`);
  logger.log(`[INFO] Options: ${JSON.stringify({
    paginateAllPages: scrapeOpts.paginateAllPages,
    setShowTo100: scrapeOpts.setShowTo100,
    columnMode: scrapeOpts.columnMode,
    requirePurchaseId: scrapeOpts.requirePurchaseId,
    requireVin: scrapeOpts.requireVin,
    requireStockNumber: scrapeOpts.requireStockNumber,
    debug: scrapeOpts.debug,
    maxConcurrency: scrapeOpts.maxConcurrency,
  })}`);

  const normalizedConcurrency = Math.max(1, Math.floor(scrapeOpts.maxConcurrency || 1));
  const workerCount = Math.min(normalizedConcurrency, terms.length);
  if (workerCount > 1) {
    logger.log(`[INFO] Parallel workers: ${workerCount}`);
  }

  ui.iframeHost.textContent = '';
  const iframes = Array.from({ length: workerCount }, () => {
    const iframe = document.createElement('iframe');
    iframe.className = 'cbss-iframe';
    ui.iframeHost.appendChild(iframe);
    return iframe;
  });

  let nextIndex = 0;
  const getNext = () => {
    if (nextIndex >= terms.length) return null;
    const idx = nextIndex;
    nextIndex += 1;
    return { idx, termInfo: terms[idx] };
  };

  const makeWorkerLogger = (prefix: string): Logger => ({
    log: (line) => logger.log(`${prefix}${line}`),
    logDebug: (line) => logger.logDebug(`${prefix}${line}`),
    clear: logger.clear,
  });

  const workerLoop = async (workerId: number, iframe: HTMLIFrameElement): Promise<void> => {
    const prefix = workerCount > 1 ? `[W${workerId}] ` : '';
    const workerLogger = prefix ? makeWorkerLogger(prefix) : logger;
    const workerCtx = { ...ctx, logger: workerLogger };

    while (true) {
      if (state.abort) break;
      const next = getNext();
      if (!next) break;
      const { idx, termInfo } = next;

      workerLogger.log(`\n[INFO] (${idx + 1}/${terms.length}) ${termInfo.term}`);

      try {
        await loadIntoIframe(iframe, termInfo.url);
        workerLogger.log(`[INFO] Loaded iframe: ${termInfo.url}`);
      } catch (error) {
        workerLogger.log(`[WARN] Failed to load ${termInfo.url}: ${(error as Error).message}`);
        continue;
      }

      const doc = iframe.contentDocument;
      if (!doc) {
        workerLogger.log('[WARN] No iframe document; skipping.');
        continue;
      }

      let renderState: 'table' | 'empty';
      try {
        renderState = await waitFor(() => {
          const hasTable = doc.querySelector('table[data-testid="data-table"]');
          if (hasTable) return 'table';
          if (hasEmptyResults(doc)) return 'empty';
          return null;
        }, { timeoutMs: 20000, intervalMs: 200, debugLabel: 'results render' });
      } catch (error) {
        workerLogger.log(`[WARN] Results did not render in time: ${(error as Error).message}`);
        continue;
      }

      if (renderState === 'empty') {
        workerLogger.log('[INFO] No results found on this page.');
        continue;
      }

      const blocks = getBlocksWithTables(doc);
      if (!blocks.length) {
        workerLogger.log('[WARN] No tables found on this page.');
        continue;
      }

      for (const blockInfo of blocks) {
        if (state.abort) break;
        try {
          await scrapeBlockPages({ termInfo, blockInfo, scrapeOpts, uniqueOpts, ctx: workerCtx });
        } catch (error) {
          workerLogger.log(`[WARN] Error scraping block: ${(error as Error).message}`);
        }
      }

      workerLogger.log(`[INFO] Total exported rows: ${state.rows.length}`);
    }
  };

  await Promise.all(iframes.map((iframe, idx) => workerLoop(idx + 1, iframe)));
  ui.iframeHost.textContent = '';

  state.running = false;
  ui.start.disabled = false;
  ui.cancel.disabled = true;

  state.lastJson = JSON.stringify(state.rows, null, 2);
  state.lastCsv = rowsToCsv(state.rows);

  logger.log(`\n[OK] Done. Total exported rows: ${state.rows.length}`);
}

export function exportCsv(state: AppState): string {
  const csv = state.lastCsv || rowsToCsv(state.rows);
  state.lastCsv = csv;
  return csv;
}

export function exportJson(state: AppState): string {
  const json = state.lastJson || JSON.stringify(state.rows, null, 2);
  state.lastJson = json;
  return json;
}

export function downloadCsv(state: AppState): void {
  const csv = exportCsv(state);
  downloadText(`carma-search-export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`, csv, 'text/csv');
}

export function downloadJson(state: AppState): void {
  const json = exportJson(state);
  downloadText(`carma-search-export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`, json, 'application/json');
}
