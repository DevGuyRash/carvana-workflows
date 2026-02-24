import { browserApi } from './browser-api';

export interface RustRuntime {
  detect_site(href: string): string;
  list_rules(site: string): unknown;
  list_workflows(site: string): unknown;
  run_workflow(site: string, workflowId: string, inputJson?: string | null): unknown;
  capture_jira_filter_table(): unknown;
  get_builtin_themes(): unknown;
  default_settings(): unknown;
}

let runtimePromise: Promise<RustRuntime | null> | null = null;

export function loadRuntime(): Promise<RustRuntime | null> {
  if (runtimePromise) {
    return runtimePromise;
  }

  runtimePromise = (async () => {
    try {
      const ext = browserApi() as any;
      const wasmModuleUrl = ext.runtime.getURL('pkg/cv_ext_wasm.js');
      const wasmModule = await import(wasmModuleUrl);
      await wasmModule.default();

      const runtime: RustRuntime = {
        detect_site: wasmModule.detect_site,
        list_rules: wasmModule.list_rules,
        list_workflows: wasmModule.list_workflows,
        run_workflow: wasmModule.run_workflow,
        capture_jira_filter_table: wasmModule.capture_jira_filter_table,
        get_builtin_themes: wasmModule.get_builtin_themes,
        default_settings: wasmModule.default_settings,
      };

      (globalThis as any).__cv_wasm = runtime;
      return runtime;
    } catch (err) {
      console.error('[cv-ext] Failed to load WASM runtime:', err);
      return null;
    }
  })();

  return runtimePromise;
}
