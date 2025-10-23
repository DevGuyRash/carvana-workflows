import { Engine, Store, Registry } from '@cv/core';
import { JiraFallbackPage } from './pages/fallback-demo';

declare global {
  interface Window { __cvBootedJira?: boolean }
}

(async () => {
  if ((window as any).__cvBootedJira) {
    console.warn('[CV] Jira userscript already booted; skipping duplicate init.');
    return;
  }
  (window as any).__cvBootedJira = true;

  const store = new Store('cv:jira');
  const registry: Registry = { pages: [JiraFallbackPage] }; // demos only
  const engine = new Engine(registry, store);
  await engine.boot();
})();
