export function getByPath(obj: any, path: string): any {
  const parts = path.split('.').map(s => s.trim()).filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Replace {{ path }} occurrences with values from ctx (e.g. ctx.opt.maxLinks). */
export function renderTemplate(str: string, ctx: Record<string, any>): string {
  return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, g1) => {
    const val = getByPath(ctx, g1);
    return val == null ? '' : String(val);
  });
}

/** Deeply walk any object/array and template all string leaves. */
export function deepRenderTemplates<T>(value: T, ctx: Record<string, any>): T {
  if (typeof value === 'string') return renderTemplate(value, ctx) as unknown as T;
  if (Array.isArray(value)) return value.map(v => deepRenderTemplates(v, ctx)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: any = Array.isArray(value) ? [] : {};
    for (const [k, v] of Object.entries(value as any)) {
      out[k] = deepRenderTemplates(v, ctx);
    }
    return out;
  }
  return value;
}
