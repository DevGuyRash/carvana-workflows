import { Engine, Store, Registry } from '@cv/core';
import { OracleMainPage } from './pages/oracle';

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
  const registry: Registry = { pages: [OracleMainPage] };
  const engine = new Engine(registry, store);
  await engine.boot();
})();
