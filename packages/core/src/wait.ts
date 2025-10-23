import type { SelectorSpec, WaitOptions } from './types';
import { findOne } from './selector';
import { sleep, now } from './utils';

export async function waitForElement(spec: SelectorSpec, opts?: WaitOptions): Promise<Element>{
  const timeoutMs = opts?.timeoutMs ?? 15000;
  const poll = opts?.pollIntervalMs ?? 200;
  const visibleOnly = !!opts?.visibleOnly;
  const stableMs = opts?.minStabilityMs ?? 0;
  const start = now();

  const existing = findOne(spec, { visibleOnly });
  if (existing) return existing;

  return new Promise<Element>((resolve, reject) => {
    let timer: number|undefined;
    let stableTimer: number|undefined;
    const observer = new MutationObserver(() => {
      const el = findOne(spec, { visibleOnly });
      if (!el) return;
      if (stableMs <= 0) {
        cleanup(); resolve(el); return;
      }
      if (stableTimer) clearTimeout(stableTimer);
      stableTimer = window.setTimeout(() => { cleanup(); resolve(el); }, stableMs);
    });

    const cleanup = () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
      if (stableTimer) window.clearTimeout(stableTimer);
    };

    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    // Timeout fallback
    timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout after ${timeoutMs}ms waiting for element`));
    }, timeoutMs);

    // Poll fallback (covers attribute-only changes that MO might miss for performance reasons)
    (async () => {
      while (now() - start < timeoutMs){
        const el = findOne(spec, { visibleOnly });
        if (el) { cleanup(); resolve(el); return; }
        await sleep(poll);
      }
    })();
  });
}

export function onDocumentReady(): Promise<void>{
  if (document.readyState === 'complete' || document.readyState === 'interactive') return Promise.resolve();
  return new Promise(res => {
    document.addEventListener('DOMContentLoaded', () => res(), { once: true });
  });
}
