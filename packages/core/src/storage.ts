/**
 * Storage via GM_* with namespacing.
 */
/* global GM_getValue, GM_setValue, GM_listValues, GM_deleteValue */
export class Store {
  private ns: string;
  constructor(namespace: string){
    this.ns = namespace;
  }
  private k(key: string){ return `${this.ns}:${key}`; }

  get<T>(key: string, fallback: T): T {
    try {
      const raw = GM_getValue(this.k(key));
      if (raw == null) return fallback;
      return JSON.parse(String(raw));
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T){
    GM_setValue(this.k(key), JSON.stringify(value));
  }

  delete(key: string){
    GM_deleteValue(this.k(key));
  }

  keys(): string[]{
    const all = GM_listValues();
    return all.filter(k => k.startsWith(`${this.ns}:`)).map(k => k.slice(this.ns.length + 1));
  }

  exportAll(): Record<string, any> {
    const out: Record<string, any> = {};
    for (const k of this.keys()){
      out[k] = this.get(k, null);
    }
    return out;
  }

  importAll(obj: Record<string, any>){
    for (const [k, v] of Object.entries(obj)){
      this.set(k, v);
    }
  }
}
