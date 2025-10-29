import { Engine, Store, Registry, updateRunPrefs } from '@cv/core';
import { OracleMainPage } from './pages/oracle';
import { OracleInvoiceValidationAlertWorkflow } from './workflows/oracle-invoice-validation-alert';

declare global {
  interface Window { __cvBootedOracle?: boolean }
}

const ensureAutoRunDefaults = (store: Store): void => {
  const autorunKey = `wf:autorun:${OracleInvoiceValidationAlertWorkflow.id}`;
  const sentinel = Symbol('autorun-default');
  const existing = store.get<symbol | Record<string, unknown>>(autorunKey, sentinel);
  if (existing === sentinel) {
    updateRunPrefs(store, OracleInvoiceValidationAlertWorkflow.id, { auto: true, repeat: false });
  }
};

(async () => {
  if ((window as any).__cvBootedOracle) {
    console.warn('[CV] Oracle userscript already booted; skipping duplicate init.');
    return;
  }
  (window as any).__cvBootedOracle = true;

  const store = new Store('cv:oracle');
  ensureAutoRunDefaults(store);
  const registry: Registry = { pages: [OracleMainPage] };
  const engine = new Engine(registry, store);
  await engine.boot();
})();
