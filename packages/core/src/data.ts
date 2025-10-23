import type { SelectorSpec, TakeSpec } from './types';
import { findAll, findOne } from './selector';

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
