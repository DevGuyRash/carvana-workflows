export const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export function now(){ return performance.now ? performance.now() : Date.now(); }

export function toRegExp(m: {regex: string, flags?: string}){
  try { return new RegExp(m.regex, m.flags); } catch { return null; }
}

export function normalizeWhitespace(s: string){
  return s.replace(/\s+/g, ' ').trim();
}

export function isVisible(el: Element){
  const style = getComputedStyle(el as HTMLElement);
  if (!style) return false;
  if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false;
  const rect = (el as HTMLElement).getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) return true;
  if ((el as HTMLElement).getClientRects().length > 0) return true;
  // Fallback for layout-less environments (e.g., jsdom) where geometry is zeroed out.
  return true;
}

export function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export function uniqueId(prefix='id'){
  return `${prefix}-${Math.random().toString(36).slice(2,10)}`;
}
