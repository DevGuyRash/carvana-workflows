import { applyColumns, setPageSize } from './columns';
import { downloadText, rowsToCsv } from './export';
import { shouldKeepRow } from './filters';
import { loadIntoIframe } from './iframe';
import type { Logger } from './logger';
import { clickNextPage, getPaginationInfo, goToFirstPageIfNeeded } from './pagination';
import { saveOptions } from './storage';
import { baseTitle, getBlocksWithTables, parseCountFromTitle, scrapeCurrentPageRows } from './tables';
import { parseTerms } from './terms';
import type { AppState, AppUi, BlockInfo, Options, TermInfo } from './types';
import { cleanText, waitFor } from './utils';

export interface ScrapeContext {
  state: AppState;
  ui: AppUi;
  logger: Logger;
}

function readOptions(ui: AppUi): Options {
  return {
    paginateAllPages: !!ui.paginate.checked,
    setShowTo100: !!ui.show100.checked,
    columnMode: ui.columns.value as Options['columnMode'],
    requirePurchaseId: !!ui.requirePurchaseId.checked,
    requireVin: !!ui.requireVin.checked,
    requireStockNumber: !!ui.requireStockNumber.checked,
    debug: !!ui.debug.checked,
  };
}

async function scrapeBlockPages(params: {
  termInfo: TermInfo;
  blockInfo: BlockInfo;
  opts: Options;
  ctx: ScrapeContext;
}): Promise<{ name: string; expectedCount: number | null; totalSeen: number; totalKept: number }> {
  const { termInfo, blockInfo, opts, ctx } = params;
  const { state, logger } = ctx;
  const { block, table, rawTitle } = blockInfo;
  const expectedCount = parseCountFromTitle(rawTitle);
  const name = baseTitle(rawTitle) || 'Table';

  if (opts.columnMode !== 'none') {
    logger.log(`?? [${rawTitle || name}] Applying columns: ${opts.columnMode}...`);
    try {
      const result = await applyColumns(block, opts.columnMode);
      if (result.reason === 'already_all' || result.reason === 'already_key') {
        logger.log(`   ??  Columns already satisfied (${opts.columnMode}).`);
      } else if (result.applied) {
        logger.log(`   ? Columns updated (${result.reason}).`);
      } else {
        if (result.reason === 'no_button') {
          logger.logDebug('Edit Columns button not found; skipping.');
        } else {
          logger.logDebug(`Columns not applied (${result.reason}).`);
        }
      }
    } catch (error) {
      logger.log(`   ??  Failed to apply columns: ${(error as Error).message}`);
    }
  }

  if (opts.setShowTo100) {
    logger.log(`?? [${rawTitle || name}] Setting page size: Show 100...`);
    try {
      const result = await setPageSize(block, 100);
      if (result.changed) {
        logger.log('   ? Set page size to Show 100.');
      } else {
        if (result.reason === 'already') {
          logger.log('   ??  Already Show 100.');
        } else if (result.reason === 'no_show_button') {
          logger.logDebug('Show <N> button not found; skipping page-size.');
        } else {
          logger.logDebug(`Page size unchanged (${result.reason}).`);
        }
      }
    } catch (error) {
      logger.log(`   ??  Failed to set page size: ${(error as Error).message}`);
    }
  }

  const pi0 = getPaginationInfo(block);
  logger.logDebug(`Pagination detected: current=${pi0.current} total=${pi0.total}`);

  let totalSeen = 0;
  let totalKept = 0;

  if (opts.paginateAllPages && pi0.total > 1) {
    try {
      await goToFirstPageIfNeeded(block);
    } catch (error) {
      logger.logDebug(`Could not force page 1: ${(error as Error).message}`);
    }
  }

  const pi = getPaginationInfo(block);
  const pagesToScrape = opts.paginateAllPages ? pi.total : 1;

  if (!opts.paginateAllPages || pi.total <= 1) {
    logger.log(`?? [${rawTitle || name}] Scraping current page only.`);
  } else {
    logger.log(`?? [${rawTitle || name}] Scraping all pages (${pi.total}).`);
  }

  for (let page = 1; page <= pagesToScrape; page++) {
    if (state.abort) {
      logger.log('? Aborted by user.');
      break;
    }

    try {
      await waitFor(() => {
        const t = block.querySelector('table[data-testid="data-table"]') as HTMLTableElement | null;
        if (!t) return null;
        const body = t.querySelector('tbody');
        if (!body) return null;
        return t;
      }, { timeoutMs: 15000, intervalMs: 100, debugLabel: 'table render' });
    } catch (error) {
      logger.log(`   ??  Table not ready on page ${page}: ${(error as Error).message}`);
      continue;
    }

    const { rows } = scrapeCurrentPageRows(table);
    totalSeen += rows.length;

    const filters = {
      requirePurchaseId: opts.requirePurchaseId,
      requireVin: opts.requireVin,
      requireStockNumber: opts.requireStockNumber,
    };

    for (const row of rows) {
      const out = {
        searchTerm: termInfo.term,
        searchUrl: termInfo.url,
        table: name,
        page,
        ...row,
      };

      if (shouldKeepRow(out, filters)) {
        state.rows.push(out);
        totalKept++;
      }
    }

    logger.logDebug(`Page ${page}: seen=${rows.length}, kept=${totalKept} (cumulative)`);

    if (page < pagesToScrape) {
      try {
        await clickNextPage(block, page + 1);
      } catch (error) {
        logger.log(`   ??  Failed to go to next page (${page + 1}): ${(error as Error).message}`);
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

  const opts = readOptions(ui);
  saveOptions(opts);

  const terms = parseTerms(ui.terms.value);
  logger.clear();
  state.rows = [];
  state.abort = false;

  if (!terms.length) {
    logger.log('No search terms provided.');
    return;
  }

  state.running = true;
  ui.start.disabled = true;
  ui.cancel.disabled = false;

  logger.log(`Starting. Terms: ${terms.length}`);
  logger.log(`Options: ${JSON.stringify({
    paginateAllPages: opts.paginateAllPages,
    setShowTo100: opts.setShowTo100,
    columnMode: opts.columnMode,
    requirePurchaseId: opts.requirePurchaseId,
    requireVin: opts.requireVin,
    requireStockNumber: opts.requireStockNumber,
    debug: opts.debug,
  })}`);

  const iframe = ui.iframe;

  for (let i = 0; i < terms.length; i++) {
    const termInfo = terms[i];
    if (state.abort) break;

    logger.log(`\n(${i + 1}/${terms.length}) ${termInfo.term}`);

    try {
      await loadIntoIframe(iframe, termInfo.url);
      logger.log(`?? Loaded iframe: ${termInfo.url}`);
    } catch (error) {
      logger.log(`??  Failed to load ${termInfo.url}: ${(error as Error).message}`);
      continue;
    }

    const doc = iframe.contentDocument;
    if (!doc) {
      logger.log('??  No iframe document; skipping.');
      continue;
    }

    try {
      await waitFor(() => {
        const hasTable = doc.querySelector('table[data-testid="data-table"]');
        if (hasTable) return true;
        const text = cleanText(doc.body?.innerText || '');
        if (text && /no\s+results/i.test(text)) return true;
        return false;
      }, { timeoutMs: 20000, intervalMs: 200, debugLabel: 'results render' });
    } catch (error) {
      logger.log(`??  Results did not render in time: ${(error as Error).message}`);
      continue;
    }

    const blocks = getBlocksWithTables(doc);
    if (!blocks.length) {
      logger.log('??  No tables found on this page.');
      continue;
    }

    for (const blockInfo of blocks) {
      if (state.abort) break;
      try {
        await scrapeBlockPages({ termInfo, blockInfo, opts, ctx });
      } catch (error) {
        logger.log(`??  Error scraping block: ${(error as Error).message}`);
      }
    }

    logger.log(`   Total exported rows: ${state.rows.length}`);
  }

  state.running = false;
  ui.start.disabled = false;
  ui.cancel.disabled = true;

  state.lastJson = JSON.stringify(state.rows, null, 2);
  state.lastCsv = rowsToCsv(state.rows);

  logger.log(`\nDone. Total exported rows: ${state.rows.length}`);
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
