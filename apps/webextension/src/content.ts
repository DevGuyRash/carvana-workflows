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

    const result = await wasm.run_rule(payload.site, payload.ruleId, payload.context ?? null);
    if (result && typeof result === 'object') {
      const responseLike = result as Record<string, unknown>;
      if (typeof responseLike.ok === 'boolean' && !responseLike.ok) {
        return { ok: false, error: String(responseLike.error ?? responseLike.message ?? 'Rule execution failed'), data: result };
      }

      const status = typeof responseLike.status === 'string' ? responseLike.status.toLowerCase() : '';
      if (status === 'error' || status === 'failed' || status === 'partial') {
        return {
          ok: false,
          error: String(responseLike.error ?? responseLike.message ?? `Rule execution ended with status: ${status}`),
          data: result,
        };
      }
    }

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

    const rules = wasm.list_rules(site);

    const classifyRuleExecution = (
      result: unknown,
    ): { status: 'success' | 'failed' | 'partial' | 'error'; error?: string } => {
      if (!result || typeof result !== 'object') {
        return { status: 'success' };
      }

      const responseLike = result as Record<string, unknown>;
      if (typeof responseLike.ok === 'boolean' && !responseLike.ok) {
        return {
          status: 'failed',
          error: String(responseLike.error ?? responseLike.message ?? 'Rule execution failed'),
        };
      }

      const status = typeof responseLike.status === 'string' ? responseLike.status.toLowerCase() : '';
      if (status === 'partial') {
        return {
          status: 'partial',
          error: String(responseLike.error ?? responseLike.message ?? 'Rule execution ended with partial status'),
        };
      }
      if (status === 'failed' || status === 'error') {
        return {
          status: status === 'failed' ? 'failed' : 'error',
          error: String(responseLike.error ?? responseLike.message ?? `Rule execution ended with status: ${status}`),
        };
      }

      return { status: 'success' };
    };

    const results: unknown[] = [];
    for (const rule of rules) {
      const ruleId = rule.id;
      try {
        const result = await wasm.run_rule(site, ruleId, null);
        const classified = classifyRuleExecution(result);
        if (classified.status === 'success') {
          results.push({ ruleId, status: 'success', data: result });
        } else {
          results.push({ ruleId, status: classified.status, error: classified.error, data: result });
        }
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

async function handleDetectSite(payload: { url: string }): Promise<RuntimeResponse> {
  const wasm = await ensureRuntime();
  if (!wasm) return { ok: false, error: 'WASM runtime not loaded' };
  return { ok: true, data: { site: wasm.detect_site(payload.url) } };
}

async function handleClipboardWrite(payload: { text: string }): Promise<RuntimeResponse> {
  const text = payload.text;
  if (typeof text !== 'string' || text.length === 0) return { ok: false, error: 'No text to copy' };

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch {
    // fall back to a selection-based copy strategy
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) {
      return { ok: false, error: 'Clipboard write failed' };
    }

    return { ok: true };
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
        handler = handleRunRule(message.payload);
        break;
      case 'run-rule-with-result-mode':
        handler = handleRunRule(message.payload);
        break;
      case 'run-auto-rules':
        handler = handleRunAutoRules(message.payload);
        break;
      case 'capture-table':
        handler = handleCaptureTable();
        break;
      case 'detect-site':
        handler = handleDetectSite(message.payload);
        break;
      case 'get-rules':
        handler = handleListRules(message.payload);
        break;
      case 'clipboard-write':
        handler = handleClipboardWrite(message.payload);
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
