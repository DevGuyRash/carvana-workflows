import { BASE_SEARCH_URL } from './constants';
import type { TermInfo } from './types';
import { cleanText } from './utils';

export function normalizeTermFromLine(rawLine: string): string | null {
  const line = cleanText(rawLine);
  if (!line) return null;

  if (/^https?:\/\//i.test(line)) {
    try {
      const url = new URL(line);
      const idx = url.pathname.indexOf('/research/search/');
      if (idx >= 0) {
        const part = url.pathname.slice(idx + '/research/search/'.length);
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      }
    } catch {
      // fall through
    }
  }

  return line;
}

export function parseTerms(text: string): TermInfo[] {
  const lines = (text || '').split(/\r?\n/);
  const terms: TermInfo[] = [];
  for (const raw of lines) {
    const term = normalizeTermFromLine(raw);
    if (!term) continue;
    const encoded = encodeURIComponent(term);
    terms.push({ term, encoded, url: `${BASE_SEARCH_URL}${encoded}` });
  }
  return terms;
}
