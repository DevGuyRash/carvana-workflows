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

interface FilterSkipCounts {
  purchaseId: number;
  vin: number;
  stockNumber: number;
}

interface UniquenessMetrics {
  enabled: boolean;
  keysBuilt: number;
  missingKey: number;
  duplicatesSeen: number;
  replaced: number;
  ignored: number;
}

interface TermDebugEntry {
  term: string;
  status: 'ok' | 'empty' | 'failed';
  durationMs: number;
  rowsSeen: number;
  rowsKept: number;
  blocks: number;
  error?: string;
}

interface RunMetrics {
  startedAtMs: number;
  workerCount: number;
  termsTotal: number;
  termsProcessed: number;
  termsFailed: number;
  termsEmpty: number;
  blocksScraped: number;
  pagesVisited: number;
  rowsSeen: number;
  rowsExported: number;
  skipByFilter: FilterSkipCounts;
  uniqueness: UniquenessMetrics;
  expectedCountMismatches: number;
  debugTerms: TermDebugEntry[];
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

function evaluateRowFilters(row: Record<string, unknown>, filters: {
  requirePurchaseId: boolean;
  requireVin: boolean;
  requireStockNumber: boolean;
}): { keep: boolean; failed: { purchaseId: boolean; vin: boolean; stockNumber: boolean } } {
  const failed = { purchaseId: false, vin: false, stockNumber: false };

  if (filters.requirePurchaseId) {
    const value = getRowValueByHeaderLike(row, [/purchase\s*id/i, /latest\s*purchase\s*purchase\s*id/i]);
    failed.purchaseId = !isMeaningfulValue(value, PURCHASE_ID_BLANK_MATCHERS);
  }

  if (filters.requireVin) {
    const value = getRowValueByHeaderLike(row, [/^vin$/i, /latest\s*purchase\s*vin/i]);
    failed.vin = !isMeaningfulValue(value, VIN_BLANK_MATCHERS);
  }

  if (filters.requireStockNumber) {
    const value = getRowValueByHeaderLike(row, [/stock\s*number/i, /latest\s*purchase\s*stock\s*number/i]);
    failed.stockNumber = !isMeaningfulValue(value, STOCK_NUMBER_BLANK_MATCHERS);
  }

  return { keep: !(failed.purchaseId || failed.vin || failed.stockNumber), failed };
}

function createRunMetrics(workerCount: number, termsTotal: number, uniqueEnabled: boolean): RunMetrics {
  return {
    startedAtMs: Date.now(),
    workerCount,
    termsTotal,
    termsProcessed: 0,
    termsFailed: 0,
    termsEmpty: 0,
    blocksScraped: 0,
    pagesVisited: 0,
    rowsSeen: 0,
    rowsExported: 0,
    skipByFilter: { purchaseId: 0, vin: 0, stockNumber: 0 },
    uniqueness: {
      enabled: uniqueEnabled,
      keysBuilt: 0,
      missingKey: 0,
      duplicatesSeen: 0,
      replaced: 0,
      ignored: 0,
    },
    expectedCountMismatches: 0,
    debugTerms: [],
  };
}

function formatSummary(metrics: RunMetrics, elapsedMs: number, exportedRows: number, debugEnabled: boolean): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('================ RUN SUMMARY ================');
  lines.push(`Workers            : ${metrics.workerCount}`);
  lines.push(`Duration           : ${(elapsedMs / 1000).toFixed(2)}s`);
  lines.push(`Terms              : total=${metrics.termsTotal}, processed=${metrics.termsProcessed}, empty=${metrics.termsEmpty}, failed=${metrics.termsFailed}`);
  lines.push(`Blocks / Pages     : blocks=${metrics.blocksScraped}, pages=${metrics.pagesVisited}`);
  lines.push(`Rows               : seen=${metrics.rowsSeen}, exported=${exportedRows}`);
  lines.push('');
  lines.push('Filters (skipped):');
  lines.push(`  Purchase ID      : ${metrics.skipByFilter.purchaseId}`);
  lines.push(`  VIN              : ${metrics.skipByFilter.vin}`);
  lines.push(`  Stock Number     : ${metrics.skipByFilter.stockNumber}`);
  lines.push('');
  lines.push(`Uniqueness         : ${metrics.uniqueness.enabled ? 'enabled' : 'disabled'}`);
  lines.push(`  Keys built       : ${metrics.uniqueness.keysBuilt}`);
  lines.push(`  Missing key pass : ${metrics.uniqueness.missingKey}`);
  lines.push(`  Duplicates seen  : ${metrics.uniqueness.duplicatesSeen}`);
  lines.push(`  Replaced         : ${metrics.uniqueness.replaced}`);
  lines.push(`  Ignored          : ${metrics.uniqueness.ignored}`);

  if (debugEnabled) {
    lines.push('');
    lines.push('Debug diagnostics:');
    lines.push(`  Expected mismatches: ${metrics.expectedCountMismatches}`);
    for (const entry of metrics.debugTerms) {
      const err = entry.error ? ` | error=${entry.error}` : '';
      lines.push(`  - ${entry.term} | ${entry.status} | ${entry.durationMs}ms | blocks=${entry.blocks} | seen=${entry.rowsSeen} | kept=${entry.rowsKept}${err}`);
    }
  }

  lines.push('============================================');
  return lines.join('\n');
}

async function scrapeBlockPages(params: {
  termInfo: TermInfo;
  blockInfo: BlockInfo;
  scrapeOpts: ScrapeOptions;
  uniqueOpts: UniquenessOptions;
  ctx: ScrapeContext;
  metrics: RunMetrics;
  termStats: { rowsSeen: number; rowsKept: number; blocks: number };
}): Promise<{ name: string; expectedCount: number | null; totalSeen: number; totalKept: number }> {
  const { termInfo, blockInfo, scrapeOpts, uniqueOpts, ctx, metrics, termStats } = params;
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
    root.querySelector('table[data-testid="data-table"]') as HTMLTableElement | null
  );

  const normalizedUnique = normalizeUniquenessOptions(uniqueOpts);
  const filters = {
    requirePurchaseId: scrapeOpts.requirePurchaseId,
    requireVin: scrapeOpts.requireVin,
    requireStockNumber: scrapeOpts.requireStockNumber,
  };

  if (scrapeOpts.columnMode !== 'none') {
    logger.log(`[INFO] [${rawTitle || name}] Applying columns: ${scrapeOpts.columnMode}...`);
    try {
      const result = await applyColumns(resolveBlock(), scrapeOpts.columnMode);
      if (result.reason === 'already_all' || result.reason === 'already_key') {
        logger.log(`[INFO] Columns already satisfied (${scrapeOpts.columnMode}).`);
      } else if (result.applied) {
        logger.log(`[OK] Columns updated (${result.reason}).`);
      } else if (result.reason === 'no_button') {
        logger.logDebug('Edit Columns button not found; skipping.');
      } else {
        logger.logDebug(`Columns not applied (${result.reason}).`);
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
      } else if (result.reason === 'already') {
        logger.log('[INFO] Already Show 100.');
      } else if (result.reason === 'no_show_button') {
        logger.log('[WARN] Page size dropdown not found; leaving current size.');
      } else if (result.reason === 'no_target_item') {
        logger.log('[WARN] Show 100 option not found; leaving current size.');
      } else {
        logger.logDebug(`Page size unchanged (${result.reason}).`);
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

  termStats.blocks += 1;
  metrics.blocksScraped += 1;

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

    metrics.pagesVisited += 1;

    const liveTable = resolveTable(resolveBlock());
    if (!liveTable) {
      logger.log(`[WARN] Table not found on page ${page}.`);
      continue;
    }
    const { rows } = scrapeCurrentPageRows(liveTable);
    totalSeen += rows.length;
    metrics.rowsSeen += rows.length;
    termStats.rowsSeen += rows.length;

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

      // Keep existing row-acceptance behavior while additionally tracking skip reasons.
      const keepByLegacyFilter = shouldKeepRow(out, filters);
      const filterEval = evaluateRowFilters(out, filters);

      if (!keepByLegacyFilter || !filterEval.keep) {
        if (filterEval.failed.purchaseId) metrics.skipByFilter.purchaseId += 1;
        if (filterEval.failed.vin) metrics.skipByFilter.vin += 1;
        if (filterEval.failed.stockNumber) metrics.skipByFilter.stockNumber += 1;
        continue;
      }

      if (!normalizedUnique.enabled) {
        state.rows.push(out);
        totalKept++;
        termStats.rowsKept += 1;
        continue;
      }

      const key = buildUniquenessKey(out, normalizedUnique.keyFields);
      if (!key) {
        metrics.uniqueness.missingKey += 1;
        state.rows.push(out);
        totalKept++;
        termStats.rowsKept += 1;
        continue;
      }

      metrics.uniqueness.keysBuilt += 1;

      const candidateTs = parseRowDateMs(out, normalizedUnique);
      const existing = state.uniqueIndex.get(key);
      if (!existing) {
        state.rows.push(out);
        state.uniqueIndex.set(key, { index: state.rows.length - 1, ts: candidateTs });
        totalKept++;
        termStats.rowsKept += 1;
        continue;
      }

      metrics.uniqueness.duplicatesSeen += 1;

      const replace = shouldReplaceDuplicate({
        existingTs: existing.ts,
        candidateTs,
        strategy: normalizedUnique.strategy,
      });

      if (replace) {
        state.rows[existing.index] = out;
        state.uniqueIndex.set(key, { index: existing.index, ts: candidateTs });
        metrics.uniqueness.replaced += 1;
        if (scrapeOpts.debug) logger.logDebug(`[INFO] Replaced duplicate for key: ${key}`);
      } else {
        metrics.uniqueness.ignored += 1;
        if (scrapeOpts.debug) logger.logDebug(`[INFO] Ignored duplicate for key: ${key}`);
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
      metrics.expectedCountMismatches += 1;
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
  const metrics = createRunMetrics(workerCount, terms.length, uniqueOpts.enabled);

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

      const termStarted = Date.now();
      const termStats = { rowsSeen: 0, rowsKept: 0, blocks: 0 };
      let termStatus: TermDebugEntry['status'] = 'ok';
      let termError = '';

      workerLogger.log(`\n[INFO] (${idx + 1}/${terms.length}) ${termInfo.term}`);

      try {
        await loadIntoIframe(iframe, termInfo.url);
        workerLogger.log(`[INFO] Loaded iframe: ${termInfo.url}`);
      } catch (error) {
        termStatus = 'failed';
        termError = `load: ${(error as Error).message}`;
        workerLogger.log(`[WARN] Failed to load ${termInfo.url}: ${(error as Error).message}`);
        metrics.termsFailed += 1;
        metrics.termsProcessed += 1;
        if (scrapeOpts.debug) {
          metrics.debugTerms.push({
            term: termInfo.term,
            status: termStatus,
            durationMs: Date.now() - termStarted,
            rowsSeen: termStats.rowsSeen,
            rowsKept: termStats.rowsKept,
            blocks: termStats.blocks,
            error: termError,
          });
        }
        continue;
      }

      const doc = iframe.contentDocument;
      if (!doc) {
        termStatus = 'failed';
        termError = 'no iframe document';
        workerLogger.log('[WARN] No iframe document; skipping.');
        metrics.termsFailed += 1;
        metrics.termsProcessed += 1;
        if (scrapeOpts.debug) {
          metrics.debugTerms.push({
            term: termInfo.term,
            status: termStatus,
            durationMs: Date.now() - termStarted,
            rowsSeen: termStats.rowsSeen,
            rowsKept: termStats.rowsKept,
            blocks: termStats.blocks,
            error: termError,
          });
        }
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
        termStatus = 'failed';
        termError = `render: ${(error as Error).message}`;
        workerLogger.log(`[WARN] Results did not render in time: ${(error as Error).message}`);
        metrics.termsFailed += 1;
        metrics.termsProcessed += 1;
        if (scrapeOpts.debug) {
          metrics.debugTerms.push({
            term: termInfo.term,
            status: termStatus,
            durationMs: Date.now() - termStarted,
            rowsSeen: termStats.rowsSeen,
            rowsKept: termStats.rowsKept,
            blocks: termStats.blocks,
            error: termError,
          });
        }
        continue;
      }

      if (renderState === 'empty') {
        termStatus = 'empty';
        workerLogger.log('[INFO] No results found on this page.');
        metrics.termsEmpty += 1;
        metrics.termsProcessed += 1;
        if (scrapeOpts.debug) {
          metrics.debugTerms.push({
            term: termInfo.term,
            status: termStatus,
            durationMs: Date.now() - termStarted,
            rowsSeen: termStats.rowsSeen,
            rowsKept: termStats.rowsKept,
            blocks: termStats.blocks,
          });
        }
        continue;
      }

      const blocks = getBlocksWithTables(doc);
      if (!blocks.length) {
        termStatus = 'failed';
        termError = 'no tables found';
        workerLogger.log('[WARN] No tables found on this page.');
        metrics.termsFailed += 1;
        metrics.termsProcessed += 1;
        if (scrapeOpts.debug) {
          metrics.debugTerms.push({
            term: termInfo.term,
            status: termStatus,
            durationMs: Date.now() - termStarted,
            rowsSeen: termStats.rowsSeen,
            rowsKept: termStats.rowsKept,
            blocks: termStats.blocks,
            error: termError,
          });
        }
        continue;
      }

      for (const blockInfo of blocks) {
        if (state.abort) break;
        try {
          await scrapeBlockPages({ termInfo, blockInfo, scrapeOpts, uniqueOpts, ctx: workerCtx, metrics, termStats });
        } catch (error) {
          workerLogger.log(`[WARN] Error scraping block: ${(error as Error).message}`);
          termStatus = 'failed';
          termError = `block: ${(error as Error).message}`;
        }
      }

      metrics.termsProcessed += 1;
      if (termStatus === 'failed') {
        metrics.termsFailed += 1;
      }

      if (scrapeOpts.debug) {
        metrics.debugTerms.push({
          term: termInfo.term,
          status: termStatus,
          durationMs: Date.now() - termStarted,
          rowsSeen: termStats.rowsSeen,
          rowsKept: termStats.rowsKept,
          blocks: termStats.blocks,
          error: termError || undefined,
        });
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

  metrics.rowsExported = state.rows.length;
  const elapsedMs = Date.now() - metrics.startedAtMs;

  logger.log(`\n[OK] Done. Total exported rows: ${state.rows.length}`);
  logger.log(formatSummary(metrics, elapsedMs, state.rows.length, scrapeOpts.debug));
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

