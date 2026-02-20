import { PURCHASE_ID_BLANK_MATCHERS, STOCK_NUMBER_BLANK_MATCHERS, VIN_BLANK_MATCHERS } from './constants';
import { getRowValueByHeaderLike, isMeaningfulValue } from './filters';
import type { ScrapedRow } from './types';
import { cleanText } from './utils';

export type QuickCopyField = 'stock' | 'vin' | 'pid' | 'reference';

const STOCK_PATTERNS = [
  /latest\s*purchase\s*stock\s*number/i,
  /latestpurchasestocknumber/i,
  /stock\s*number/i,
  /stocknumber/i,
];

const VIN_PATTERNS = [
  /latest\s*purchase\s*vin/i,
  /latestpurchasevin/i,
  /^vin$/i,
];

const PID_PATTERNS = [
  /latest\s*purchase\s*purchase\s*id/i,
  /latestpurchasepurchaseid/i,
  /purchase\s*id/i,
  /purchaseid/i,
];

export function escapeTsv(value: unknown): string {
  return value === null || typeof value === 'undefined' ? '' : String(value);
}

export function buildRowTsv(
  rows: Array<Record<string, unknown>>,
  columns: string[],
  includeHeaders: boolean,
): string {
  if (!rows.length || !columns.length) return '';

  const lines: string[] = [];
  if (includeHeaders) {
    lines.push(columns.join('\t'));
  }

  for (const row of rows) {
    lines.push(columns.map((col) => escapeTsv(row[col])).join('\t'));
  }

  return lines.join('\n');
}

export function buildSelectedCellTsv(params: {
  rows: ScrapedRow[];
  columns: string[];
  selectedCells: Set<string>;
  includeHeaders: boolean;
}): string {
  const {
    rows,
    columns,
    selectedCells,
    includeHeaders,
  } = params;

  if (!selectedCells.size) return '';

  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  let maxCol = Number.NEGATIVE_INFINITY;

  for (const key of selectedCells) {
    const [rStr, cStr] = key.split(':');
    const r = Number.parseInt(rStr, 10);
    const c = Number.parseInt(cStr, 10);
    if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
    minRow = Math.min(minRow, r);
    maxRow = Math.max(maxRow, r);
    minCol = Math.min(minCol, c);
    maxCol = Math.max(maxCol, c);
  }

  if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) return '';

  const lines: string[] = [];
  const cols = columns.slice(minCol, maxCol + 1);
  if (!cols.length) return '';

  if (includeHeaders) {
    lines.push(cols.join('\t'));
  }

  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
    const row = rows[rowIndex];
    const line = cols.map((_, colOffset) => {
      const colIndex = minCol + colOffset;
      if (!selectedCells.has(`${rowIndex}:${colIndex}`)) return '';
      const colName = columns[colIndex];
      return escapeTsv(row?.[colName]);
    });
    lines.push(line.join('\t'));
  }

  return lines.join('\n');
}

function readQuickField(row: ScrapedRow, field: QuickCopyField): string {
  if (field === 'reference') {
    return cleanText(String(row.Reference ?? ''));
  }

  if (field === 'stock') {
    const value = getRowValueByHeaderLike(row, STOCK_PATTERNS);
    return isMeaningfulValue(value, STOCK_NUMBER_BLANK_MATCHERS) ? cleanText(value) : '';
  }

  if (field === 'vin') {
    const value = getRowValueByHeaderLike(row, VIN_PATTERNS);
    return isMeaningfulValue(value, VIN_BLANK_MATCHERS) ? cleanText(value) : '';
  }

  const value = getRowValueByHeaderLike(row, PID_PATTERNS);
  return isMeaningfulValue(value, PURCHASE_ID_BLANK_MATCHERS) ? cleanText(value) : '';
}

export function extractQuickCopyValues(rows: ScrapedRow[], field: QuickCopyField): string[] {
  const values: string[] = [];

  for (const row of rows) {
    const value = readQuickField(row, field);
    if (!value) continue;
    values.push(value);
  }

  return values;
}

export function quickCopyText(rows: ScrapedRow[], field: QuickCopyField): string {
  return extractQuickCopyValues(rows, field).join('\n');
}
