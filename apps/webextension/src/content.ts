import type { RuntimeCommand, RuntimeResponse } from './shared/messages';
import { loadRuntime, RustRuleDefinition, RustRuntime } from './shared/runtime';

let wasmRuntime: RustRuntime | null = null;
let autoRunObserver: MutationObserver | null = null;
let autoRunTimer: number | null = null;
let autoRunInFlight = false;
let lastAutoRunAt = 0;
let syncWriteTimer: number | null = null;
const pendingSyncPayloads = new Map<string, unknown>();

const AUTO_RUN_DEBOUNCE_MS = 750;
const AUTO_RUN_MIN_INTERVAL_MS = 5000;
const MENU_STATE_EVENT = 'cv:menu-state-change';
const MENU_STORAGE_KEYS = [
  { localKey: 'cv.menu.jira.jql.state.v1', syncKey: 'cv_sync_menu_jira_jql_v1' },
  { localKey: 'cv.menu.carma.state.v1', syncKey: 'cv_sync_menu_carma_v1' },
];

type EnvelopeLike = {
  version?: number;
  updatedAtMs?: number;
  payload?: unknown;
};

async function ensureRuntime(): Promise<RustRuntime | null> {
  if (wasmRuntime) return wasmRuntime;
  wasmRuntime = await loadRuntime();
  return wasmRuntime;
}

async function storageGet<T>(key: string, fallback: T): Promise<T> {
  return await new Promise<T>((resolve) => {
    try {
      chrome.storage.local.get([key], (result) => {
        const errorText = chrome.runtime.lastError?.message;
        if (errorText) {
          resolve(fallback);
          return;
        }
        const value = result?.[key];
        resolve(value === undefined ? fallback : (value as T));
      });
    } catch {
      resolve(fallback);
    }
  });
}

function hasElementForTrigger(trigger: unknown): boolean {
  if (!trigger || typeof trigger !== 'object') return true;
  const triggerRecord = trigger as Record<string, unknown>;
  if (!('on_element_appear' in triggerRecord)) return true;

  const payload = triggerRecord.on_element_appear;
  if (!payload || typeof payload !== 'object') return true;
  const selector = (payload as Record<string, unknown>).selector;
  if (typeof selector !== 'string' || selector.trim().length === 0) return true;

  try {
    return document.querySelector(selector) !== null;
  } catch {
    return false;
  }
}

function isAutoTrigger(trigger: unknown): boolean {
  if (typeof trigger === 'string') {
    return trigger !== 'on_demand';
  }
  if (trigger && typeof trigger === 'object') {
    return 'on_element_appear' in (trigger as Record<string, unknown>);
  }
  return false;
}

function urlPatternMatches(urlPattern: string | null | undefined, url: string): boolean {
  if (!urlPattern || typeof urlPattern !== 'string') return true;
  const pattern = urlPattern.trim();
  if (!pattern) return true;

  try {
    const regex = new RegExp(pattern);
    return regex.test(url);
  } catch {
    return url.includes(pattern);
  }
}

function classifyRuleExecution(
  result: unknown,
): { status: 'success' | 'failed' | 'partial' | 'error'; error?: string } {
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
  await reconcileMenuStateSync();
  installMenuStateSyncBridge();

  scheduleAutoRun('init', 150);
  window.addEventListener('hashchange', () => scheduleAutoRun('hashchange'));
  window.addEventListener('popstate', () => scheduleAutoRun('popstate'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleAutoRun('visible', 200);
    }
  });

  const attachMutationObserver = () => {
    if (autoRunObserver) {
      autoRunObserver.disconnect();
    }

    if (!document.body) return;
    autoRunObserver = new MutationObserver(() => {
      scheduleAutoRun('mutation');
    });
    autoRunObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'aria-hidden', 'aria-busy'],
    });
  };

  if (document.body) {
    attachMutationObserver();
  } else {
    window.addEventListener('DOMContentLoaded', attachMutationObserver, { once: true });
  }
}

function parseLocalEnvelope(raw: string | null): EnvelopeLike | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as EnvelopeLike;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function readLocalEnvelope(localKey: string): EnvelopeLike | null {
  try {
    return parseLocalEnvelope(window.localStorage.getItem(localKey));
  } catch {
    return null;
  }
}

function writeLocalEnvelope(localKey: string, envelope: EnvelopeLike): void {
  try {
    window.localStorage.setItem(localKey, JSON.stringify(envelope));
  } catch {
    // ignore quota/unavailable cases
  }
}

async function storageSyncGet<T>(key: string): Promise<T | null> {
  return await new Promise<T | null>((resolve) => {
    try {
      chrome.storage.sync.get([key], (result) => {
        const err = chrome.runtime.lastError?.message;
        if (err) {
          resolve(null);
          return;
        }
        resolve((result?.[key] as T | undefined) ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

function storageSyncSet(patch: Record<string, unknown>): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      chrome.storage.sync.set(patch, () => resolve());
    } catch {
      resolve();
    }
  });
}

function newerEnvelope(local: EnvelopeLike | null, remote: EnvelopeLike | null): EnvelopeLike | null {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  const localTs = Number(local.updatedAtMs ?? 0);
  const remoteTs = Number(remote.updatedAtMs ?? 0);
  return remoteTs > localTs ? remote : local;
}

async function reconcileMenuStateSync(): Promise<void> {
  for (const keyPair of MENU_STORAGE_KEYS) {
    const local = readLocalEnvelope(keyPair.localKey);
    const remote = await storageSyncGet<EnvelopeLike>(keyPair.syncKey);
    const winner = newerEnvelope(local, remote);
    if (!winner) continue;
    if (!local || Number(winner.updatedAtMs ?? 0) > Number(local.updatedAtMs ?? 0)) {
      writeLocalEnvelope(keyPair.localKey, winner);
    }
    if (!remote || Number(winner.updatedAtMs ?? 0) > Number(remote.updatedAtMs ?? 0)) {
      pendingSyncPayloads.set(keyPair.syncKey, winner);
    }
  }
  flushPendingSyncWritesSoon();
}

function flushPendingSyncWritesSoon(): void {
  if (syncWriteTimer !== null) {
    window.clearTimeout(syncWriteTimer);
  }
  syncWriteTimer = window.setTimeout(async () => {
    syncWriteTimer = null;
    if (pendingSyncPayloads.size === 0) return;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of pendingSyncPayloads) {
      patch[key] = value;
    }
    pendingSyncPayloads.clear();
    await storageSyncSet(patch);
  }, 600);
}

function queueSyncMirrorFromLocalKey(localKey: string): void {
  const keyPair = MENU_STORAGE_KEYS.find((entry) => entry.localKey === localKey);
  if (!keyPair) return;
  const envelope = readLocalEnvelope(localKey);
  if (!envelope) return;
  pendingSyncPayloads.set(keyPair.syncKey, envelope);
  flushPendingSyncWritesSoon();
}

function installMenuStateSyncBridge(): void {
  document.addEventListener(MENU_STATE_EVENT, (event: Event) => {
    const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
    const localKey = detail?.storageKey;
    if (typeof localKey !== 'string') return;
    queueSyncMirrorFromLocalKey(localKey);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const keyPair of MENU_STORAGE_KEYS) {
      const delta = changes[keyPair.syncKey];
      if (!delta || delta.newValue === undefined) continue;
      const remote = delta.newValue as EnvelopeLike;
      const local = readLocalEnvelope(keyPair.localKey);
      if (Number(remote?.updatedAtMs ?? 0) > Number(local?.updatedAtMs ?? 0)) {
        writeLocalEnvelope(keyPair.localKey, remote);
      }
    }
  });
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

    const settings = await storageGet<Record<string, unknown>>('cv_settings', { auto_run_rules: true });
    if (settings?.auto_run_rules === false) {
      return { ok: true, data: { skipped: true, reason: 'auto_run_rules_disabled' } };
    }

    const site = wasm.detect_site(payload.url);
    if (site === 'unsupported') return { ok: true, data: { site: 'unsupported', skipped: true } };

    const rules = wasm.list_rules(site) as RustRuleDefinition[];
    const states = await storageGet<Record<string, boolean>>('cv_rules_state', {});
    const autoRules = rules.filter((rule) =>
      states[rule.id] !== false &&
      isAutoTrigger(rule.trigger) &&
      urlPatternMatches(rule.url_pattern, payload.url) &&
      hasElementForTrigger(rule.trigger),
    );

    const results: unknown[] = [];
    for (const rule of autoRules) {
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

    return { ok: true, data: { site, results, ruleCount: autoRules.length } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runAutoRulesNow(reason: string): Promise<void> {
  if (autoRunInFlight) return;

  const now = Date.now();
  if (now - lastAutoRunAt < AUTO_RUN_MIN_INTERVAL_MS) {
    return;
  }

  autoRunInFlight = true;
  lastAutoRunAt = now;
  try {
    const response = await handleRunAutoRules({ url: window.location.href });
    if (!response.ok) {
      console.warn('[cv-ext] auto-run failed:', response.error ?? 'unknown error');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[cv-ext] auto-run failed (${reason}):`, msg);
  } finally {
    autoRunInFlight = false;
  }
}

function scheduleAutoRun(reason: string, delayMs = AUTO_RUN_DEBOUNCE_MS): void {
  if (autoRunTimer !== null) {
    window.clearTimeout(autoRunTimer);
  }
  autoRunTimer = window.setTimeout(() => {
    void runAutoRulesNow(reason);
  }, delayMs);
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

async function handleGetUiRules(payload: { site: string }): Promise<RuntimeResponse> {
  try {
    const wasm = await ensureRuntime();
    if (!wasm) return { ok: false, error: 'WASM runtime not loaded' };

    if (typeof wasm.ui_rules_for_site === 'function') {
      const result = wasm.ui_rules_for_site(payload.site);
      return { ok: true, data: result };
    }

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
      case 'get-ui-rules':
        handler = handleGetUiRules(message.payload);
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
