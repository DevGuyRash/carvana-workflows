import { browserApi } from './browser-api';

export interface RustRuntime {
  detect_site(href: string): string;
  list_workflows(site: string): unknown;
  run_workflow(site: string, workflowId: string, input?: Record<string, string>): unknown;
  capture_jira_filter_table(): unknown;
}

let runtimePromise: Promise<RustRuntime> | null = null;

export function loadRuntime(): Promise<RustRuntime> {
  if (runtimePromise) {
    return runtimePromise;
  }

  runtimePromise = (async () => {
    const ext = browserApi() as any;
    const wasmModuleUrl = ext.runtime.getURL('pkg/cv_ext_wasm.js');
    const wasmModule = await import(wasmModuleUrl);
    await wasmModule.default();

    return {
      detect_site: wasmModule.detect_site,
      list_workflows: wasmModule.list_workflows,
      run_workflow: (site: string, workflowId: string, input?: Record<string, string>) => {
        const inputJson = input === undefined ? undefined : JSON.stringify(input);
        return wasmModule.run_workflow(site, workflowId, inputJson);
      },
      capture_jira_filter_table: wasmModule.capture_jira_filter_table,
    } as RustRuntime;
  })();

  return runtimePromise;
}
