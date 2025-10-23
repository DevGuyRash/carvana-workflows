import { Engine, Store, Registry } from '@cv/core';
import { OracleFallbackPage } from './pages/fallback-demo';

declare global {
  interface Window { __cvBootedOracle?: boolean }
}

(async () => {
  if ((window as any).__cvBootedOracle) {
    console.warn('[CV] Oracle userscript already booted; skipping duplicate init.');
    return;
  }
  (window as any).__cvBootedOracle = true;

  const store = new Store('cv:oracle');
  const registry: Registry = { pages: [OracleFallbackPage] }; // demos only
  const engine = new Engine(registry, store);
  await engine.boot();
})();
