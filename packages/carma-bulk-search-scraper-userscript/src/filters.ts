import { PURCHASE_ID_BLANK_MATCHERS, STOCK_NUMBER_BLANK_MATCHERS, VIN_BLANK_MATCHERS } from './constants';
import { cleanText } from './utils';

export function getRowValueByHeaderLike(row: Record<string, unknown>, patterns: Array<string | RegExp>): string {
  const keys = Object.keys(row);
  for (const pattern of patterns) {
    const re = typeof pattern === 'string' ? new RegExp(`^${pattern}$`, 'i') : pattern;
    const key = keys.find((k) => re.test(cleanText(k)));
    if (key) return String(row[key] ?? '');
  }
  return '';
}

export function isMeaningfulValue(value: string, blankMatchers: Array<string | RegExp> = []): boolean {
  const text = cleanText(value);
  if (!text) return false;
  if (/^(null|undefined)$/i.test(text)) return false;

  const lowered = text.toLowerCase();
  for (const matcher of blankMatchers) {
    if (!matcher) continue;
    if (typeof matcher === 'string') {
      const matchText = cleanText(matcher);
      if (matchText && lowered === matchText.toLowerCase()) return false;
    } else if (matcher instanceof RegExp) {
      if (matcher.test(text)) return false;
    }
  }
  return true;
}

export function shouldKeepRow(row: Record<string, unknown>, filters: {
  requirePurchaseId: boolean;
  requireVin: boolean;
  requireStockNumber: boolean;
}): boolean {
  if (filters.requirePurchaseId) {
    const value = getRowValueByHeaderLike(row, [/purchase\s*id/i, /purchaseid/i]);
    if (!isMeaningfulValue(value, PURCHASE_ID_BLANK_MATCHERS)) return false;
  }
  if (filters.requireVin) {
    const value = getRowValueByHeaderLike(row, [/^vin$/i]);
    if (!isMeaningfulValue(value, VIN_BLANK_MATCHERS)) return false;
  }
  if (filters.requireStockNumber) {
    const value = getRowValueByHeaderLike(row, [/stock\s*number/i, /stocknumber/i]);
    if (!isMeaningfulValue(value, STOCK_NUMBER_BLANK_MATCHERS)) return false;
  }

  return true;
}
