import type { RuntimeCommand, RuntimeResponse } from './shared/messages';
import { loadRuntime, RustRuntime } from './shared/runtime';

let wasmRuntime: RustRuntime | null = null;

async function ensureRuntime(): Promise<RustRuntime | null> {
  if (wasmRuntime) return wasmRuntime;
  wasmRuntime = await loadRuntime();
  return wasmRuntime;
}

async function initializeContentScript(): Promise<void> {
  const wasm = await ensureRuntime();
  if (!wasm) {
    console.warn('[cv-ext] WASM runtime not available in content script');
    return;
  }

  const site = wasm.detect_site(window.location.href);
  if (site === 'unsupported') return;

  console.log(`[cv-ext] Detected site: ${site}`);
}

async function handleRunRule(payload: { ruleId: string; site: string; context?: string }): Promise<RuntimeResponse> {
  try {
    const wasm = await ensureRuntime();
    if (!wasm) return { ok: false, error: 'WASM runtime not loaded' };

    const result = await wasm.run_workflow(payload.site, payload.ruleId, payload.context ?? null);
    return { ok: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cv-ext] Rule execution failed:', msg);
    return { ok: false, error: msg };
  }
}

async function handleRunAutoRules(payload: { url: string }): Promise<RuntimeResponse> {
  try {
    const wasm = await ensureRuntime();
    if (!wasm) return { ok: false, error: 'WASM runtime not loaded' };

    const site = wasm.detect_site(payload.url);
    if (site === 'unsupported') return { ok: true, data: { site: 'unsupported', skipped: true } };

    let rules: unknown[];
    try {
      const raw = wasm.list_rules(site);
      rules = Array.isArray(raw) ? raw : [];
    } catch {
      rules = [];
    }

    const results: unknown[] = [];
    for (const rule of rules) {
      const ruleId = typeof rule === 'object' && rule !== null ? (rule as any).id : String(rule);
      try {
        const result = await wasm.run_workflow(site, ruleId, null);
        results.push({ ruleId, status: 'success', data: result });
      } catch (err) {
        results.push({ ruleId, status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { ok: true, data: { site, results } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handleCaptureTable(): Promise<RuntimeResponse> {
  try {
    const wasm = await ensureRuntime();
    if (!wasm) return { ok: false, error: 'WASM runtime not loaded' };

    const data = await wasm.capture_jira_filter_table();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handleListRules(payload: { site: string }): Promise<RuntimeResponse> {
  try {
    const wasm = await ensureRuntime();
    if (!wasm) return { ok: false, error: 'WASM runtime not loaded' };

    const rules = wasm.list_rules(payload.site);
    return { ok: true, data: rules };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: RuntimeCommand,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: RuntimeResponse) => void,
  ) => {
    const kind = message?.kind;
    if (!kind) return;

    let handler: Promise<RuntimeResponse>;

    switch (kind) {
      case 'run-rule':
        handler = handleRunRule((message as any).payload);
        break;
      case 'run-rule-with-result-mode':
        handler = handleRunRule((message as any).payload);
        break;
      case 'run-auto-rules':
        handler = handleRunAutoRules((message as any).payload);
        break;
      case 'capture-table':
        handler = handleCaptureTable();
        break;
      case 'get-rules':
        handler = handleListRules((message as any).payload);
        break;
      default:
        return;
    }

    handler.then(sendResponse).catch((err) => {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
    });
    return true;
  },
);

void initializeContentScript();
