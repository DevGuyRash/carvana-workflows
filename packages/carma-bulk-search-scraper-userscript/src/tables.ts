import type { BlockInfo } from './types';
import { cleanText } from './utils';

export function getBlocksWithTables(doc: Document): BlockInfo[] {
  const blocks = Array.from(doc.querySelectorAll('.cpl__block'));
  return blocks
    .map((block) => {
      const table = block.querySelector('table[data-testid="data-table"]') as HTMLTableElement | null;
      if (!table) return null;
      const titleEl = block.querySelector('.cpl__block__header-title');
      const rawTitle = cleanText(titleEl ? titleEl.textContent : '');
      return { block, table, rawTitle };
    })
    .filter(Boolean) as BlockInfo[];
}

export function parseCountFromTitle(rawTitle: string): number | null {
  const match = rawTitle.match(/\((\d+)\)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function baseTitle(rawTitle: string): string {
  return cleanText(rawTitle.replace(/\s*\(\d+\)\s*$/, '')) || rawTitle;
}

export function scrapeCurrentPageRows(table: HTMLTableElement): { headers: string[]; rows: Record<string, string>[] } {
  const theadRows = Array.from(table.querySelectorAll('thead tr'));
  const headerRow = theadRows[theadRows.length - 1];
  const headers = Array.from(headerRow.querySelectorAll('th')).map((th, idx) => {
    const text = cleanText(th.innerText);
    if (text) return text;
    if (idx === headerRow.querySelectorAll('th').length - 1) return 'View';
    return `Column ${idx + 1}`;
  });

  const tbody = table.querySelector('tbody');
  const trs = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];

  const rows = trs.map((tr) => {
    const tds = Array.from(tr.querySelectorAll('td'));
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      const td = tds[i];
      obj[key] = td ? cleanText(td.innerText) : '';
    }
    return obj;
  });

  return { headers, rows };
}
