import { PURCHASE_ID_BLANK_MATCHERS, STOCK_NUMBER_BLANK_MATCHERS, VIN_BLANK_MATCHERS } from './constants';
import { getRowValueByHeaderLike, isMeaningfulValue } from './filters';
import type { ScrapedRow, UniqueStrategy, UniquenessKeyFields, UniquenessOptions } from './types';
import { cleanText } from './utils';

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

const AUTO_DATE_PATTERNS: Array<string | RegExp> = [
  /^date$/i,
  /created/i,
  /updated/i,
  /last\s*modified/i,
  /timestamp/i,
  /purchase\s*date/i,
];

function readField(row: ScrapedRow, kind: 'vin' | 'stock' | 'pid'): string {
  if (kind === 'vin') {
    const value = getRowValueByHeaderLike(row, VIN_PATTERNS);
    return isMeaningfulValue(value, VIN_BLANK_MATCHERS) ? cleanText(value) : '';
  }
  if (kind === 'stock') {
    const value = getRowValueByHeaderLike(row, STOCK_PATTERNS);
    return isMeaningfulValue(value, STOCK_NUMBER_BLANK_MATCHERS) ? cleanText(value) : '';
  }
  const value = getRowValueByHeaderLike(row, PID_PATTERNS);
  return isMeaningfulValue(value, PURCHASE_ID_BLANK_MATCHERS) ? cleanText(value) : '';
}

export function buildUniquenessKey(row: ScrapedRow, keyFields: UniquenessKeyFields): string | null {
  const parts: string[] = [];

  const useVin = keyFields.vin === true;
  const useStock = keyFields.stock === true;
  const usePid = keyFields.pid === true;

  if (!useVin && !useStock && !usePid) return null;

  if (useVin) {
    const vin = readField(row, 'vin');
    if (!vin) return null;
    parts.push(`vin=${vin}`);
  }

  if (useStock) {
    const stock = readField(row, 'stock');
    if (!stock) return null;
    parts.push(`stock=${stock}`);
  }

  if (usePid) {
    const pid = readField(row, 'pid');
    if (!pid) return null;
    parts.push(`pid=${pid}`);
  }

  return parts.join('|');
}

function tryParseDateMs(text: string): number | null {
  if (!text) return null;
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return parsed;
  return parseUsDateTime(text);
}

export function findAutoDateHeader(keys: string[], row?: ScrapedRow): string | null {
  let firstMatch: string | null = null;

  for (const pattern of AUTO_DATE_PATTERNS) {
    const re = typeof pattern === 'string' ? new RegExp(`^${pattern}$`, 'i') : pattern;
    const matches = keys.filter((k) => re.test(cleanText(k)));
    if (matches.length === 0) continue;
    if (!row) return matches[0];
    if (!firstMatch) firstMatch = matches[0];

    const parseable = matches.find((k) => {
      const raw = row[k];
      const text = cleanText(raw);
      return tryParseDateMs(text) !== null;
    });
    if (parseable) return parseable;
  }
  return firstMatch;
}

function parseUsDateTime(text: string): number | null {
  const m = text.match(/^\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2})(?::(\d{2}))(?::(\d{2}))?\s*(AM|PM)?)?\s*$/i);
  if (!m) return null;

  const month = Number.parseInt(m[1], 10);
  const day = Number.parseInt(m[2], 10);
  let year = Number.parseInt(m[3], 10);
  if (year < 100) year = year >= 70 ? 1900 + year : 2000 + year;

  let hour = m[4] ? Number.parseInt(m[4], 10) : 0;
  const minute = m[5] ? Number.parseInt(m[5], 10) : 0;
  const second = m[6] ? Number.parseInt(m[6], 10) : 0;
  const ampm = (m[7] || '').toUpperCase();

  if (ampm === 'AM') {
    if (hour === 12) hour = 0;
  } else if (ampm === 'PM') {
    if (hour < 12) hour += 12;
  }

  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null;

  const dt = new Date(year, month - 1, day, hour, minute, second, 0);
  const ts = dt.getTime();
  return Number.isFinite(ts) ? ts : null;
}

export function parseRowDateMs(row: ScrapedRow, opts: UniquenessOptions): number | null {
  const keys = Object.keys(row);
  let header: string | null = null;

  if (opts.dateColumn.mode === 'manual') {
    const desired = cleanText(opts.dateColumn.header);
    if (desired) {
      header = keys.find((k) => cleanText(k).toLowerCase() === desired.toLowerCase()) || null;
    }
  }

  if (!header) {
    header = findAutoDateHeader(keys, row);
  }

  if (!header) return null;

  const raw = row[header];
  const text = cleanText(raw);
  if (!text) return null;

  return tryParseDateMs(text);
}

export function shouldReplaceDuplicate(params: {
  existingTs: number | null;
  candidateTs: number | null;
  strategy: UniqueStrategy;
}): boolean {
  const { existingTs, candidateTs, strategy } = params;

  if (strategy === 'first_seen') return false;
  if (strategy === 'last_seen') return true;

  if (candidateTs !== null && existingTs !== null) return candidateTs > existingTs;
  if (candidateTs !== null && existingTs === null) return true;
  if (candidateTs === null && existingTs !== null) return false;

  return true;
}

export function normalizeUniquenessOptions(opts: UniquenessOptions): UniquenessOptions {
  const hasKey = !!(opts.keyFields.vin || opts.keyFields.stock || opts.keyFields.pid);
  if (!opts.enabled) return opts;
  if (hasKey) return opts;

  return {
    ...opts,
    keyFields: { vin: true, stock: true, pid: true },
  };
}
