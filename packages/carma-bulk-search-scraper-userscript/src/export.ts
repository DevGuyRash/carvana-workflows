import { el } from './dom';

export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = el('a', { href: url, download: filename });
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = el('textarea', { style: 'position:fixed;left:-9999px;top:-9999px;' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function rowsToCsv(rows: Record<string, string>[]): string {
  if (!rows.length) return '';

  const preferred = ['searchTerm', 'searchUrl', 'table', 'page'];
  const cols: string[] = [];
  const seen = new Set<string>();

  const addCol = (col: string | undefined) => {
    if (!col) return;
    if (seen.has(col)) return;
    seen.add(col);
    cols.push(col);
  };

  for (const col of preferred) addCol(col);
  for (const row of rows) {
    for (const key of Object.keys(row)) addCol(key);
  }

  const esc = (value: unknown) => {
    const str = value === null || typeof value === 'undefined' ? '' : String(value);
    if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  };

  const lines: string[] = [];
  lines.push(cols.map(esc).join(','));
  for (const row of rows) {
    lines.push(cols.map((col) => esc(row[col])).join(','));
  }
  return lines.join('\n');
}
