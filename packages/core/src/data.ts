import type { SelectorSpec, TakeSpec } from './types';
import { findAll, findOne } from './selector';
import { normalizeWhitespace } from './utils';

export function takeFromElement(el: Element, take: TakeSpec|undefined): string {
  const t = take ?? 'text';
  if (t === 'text') return (el.textContent || '').trim();
  if (t === 'html') return (el as HTMLElement).innerHTML;
  if (t === 'value') return (el as HTMLInputElement).value || '';
  if (t === 'href') return (el as HTMLAnchorElement).href || '';
  if (t === 'raw')  return (el as any).textContent ?? '';
  if (typeof t === 'object' && 'attribute' in t) return el.getAttribute(t.attribute) || '';
  return '';
}

/** Extract up to `limit` items using a base list selector and per-field specs. */
export function extractListData(
  list: SelectorSpec,
  fields: { key: string; take: TakeSpec; from?: SelectorSpec }[],
  limit = 20,
  opts?: { visibleOnly?: boolean }
): Record<string, string>[] {
  const rows = findAll(list, { visibleOnly: !!opts?.visibleOnly });
  const out: Record<string, string>[] = [];
  for (let i=0; i<rows.length && i<limit; i++){
    const row = rows[i];
    const obj: Record<string, string> = {};
    for (const f of fields){
      const target = f.from ? (findOne(f.from, { root: row, visibleOnly: !!opts?.visibleOnly }) ?? row) : row;
      if (!target) { obj[f.key] = ''; continue; }
      obj[f.key] = takeFromElement(target, f.take);
    }
    out.push(obj);
  }
  return out;
}

const DEFAULT_HISTORY_TEXT_LIMIT = 600;
const DEFAULT_HISTORY_PATH_LIMIT = 280;
const TRUNCATION_SUFFIX = '...';

const digitsRegex = /\d/g;

function maskDigits(input: string): string {
  return input.replace(digitsRegex, '#');
}

function truncateHistoryValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= TRUNCATION_SUFFIX.length) {
    return value.slice(0, maxLength);
  }
  return `${value.slice(0, maxLength - TRUNCATION_SUFFIX.length)}${TRUNCATION_SUFFIX}`;
}

export function sanitizeHistoryText(value: unknown, options?: { maxLength?: number }): string {
  if (value == null) return '';
  const normalized = normalizeWhitespace(String(value));
  const masked = maskDigits(normalized);
  const limit = options?.maxLength ?? DEFAULT_HISTORY_TEXT_LIMIT;
  return truncateHistoryValue(masked, limit);
}

export function sanitizeHistoryPath(value: unknown): string {
  if (value == null) return '';
  const normalized = normalizeWhitespace(String(value));
  const masked = maskDigits(normalized);
  return truncateHistoryValue(masked, DEFAULT_HISTORY_PATH_LIMIT);
}

export function sanitizeHistoryHtml(value: unknown, options?: { maxLength?: number }): string {
  if (value == null) return '';
  const trimmed = String(value).replace(/\s+/g, ' ').trim();
  const masked = maskDigits(trimmed);
  const limit = options?.maxLength ?? DEFAULT_HISTORY_TEXT_LIMIT;
  return truncateHistoryValue(masked, limit);
}
