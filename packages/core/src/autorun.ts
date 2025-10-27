import { Store } from './storage';

export interface LastRunInfo {
  href: string;
  at: number;
}

export interface WorkflowRunPrefs {
  auto: boolean;
  repeat: boolean;
  lastRun?: LastRunInfo;
}

export const AUTO_REPEAT_MIN_INTERVAL_MS = 5000;

type RawPrefs = {
  auto?: boolean;
  repeat?: boolean;
  lastRun?: LastRunInfo | null;
};

const keyFor = (workflowId: string) => `wf:autorun:${workflowId}`;

function sanitizeLastRun(raw: any): LastRunInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const href = typeof raw.href === 'string' ? raw.href : '';
  const at = typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : Date.now();
  if (!href) return undefined;
  return { href, at };
}

function sanitizePrefs(raw: any): WorkflowRunPrefs {
  const auto = raw?.auto === true;
  const repeat = auto && raw?.repeat === true;
  const lastRun = sanitizeLastRun(raw?.lastRun);
  return { auto, repeat, lastRun };
}

function persist(store: Store, workflowId: string, prefs: WorkflowRunPrefs): WorkflowRunPrefs {
  const payload: RawPrefs = {
    auto: prefs.auto,
    repeat: prefs.repeat
  };
  if (prefs.lastRun) {
    payload.lastRun = prefs.lastRun;
  }
  store.set(keyFor(workflowId), payload);
  return prefs;
}

export function getRunPrefs(store: Store, workflowId: string): WorkflowRunPrefs {
  const raw = store.get<RawPrefs | undefined>(keyFor(workflowId), undefined);
  return sanitizePrefs(raw);
}

export type RunPrefsPatch = Partial<Omit<WorkflowRunPrefs, 'lastRun'>> & {
  lastRun?: LastRunInfo | null;
};

export function updateRunPrefs(store: Store, workflowId: string, patch: RunPrefsPatch): WorkflowRunPrefs {
  const current = getRunPrefs(store, workflowId);
  const hasLastRun = Object.prototype.hasOwnProperty.call(patch, 'lastRun');
  let next: RawPrefs = {
    auto: patch.auto ?? current.auto,
    repeat: patch.repeat ?? current.repeat,
    lastRun: hasLastRun ? patch.lastRun ?? null : current.lastRun ?? null
  };

  if (patch.auto === true && current.auto === false && !hasLastRun) {
    next.lastRun = null;
  }

  const sanitized = sanitizePrefs(next);
  return persist(store, workflowId, sanitized);
}

export function markAutoRun(store: Store, workflowId: string, info: { href: string; at?: number }): WorkflowRunPrefs {
  return updateRunPrefs(store, workflowId, {
    lastRun: { href: info.href, at: info.at ?? Date.now() }
  });
}

export function shouldAutoRun(
  prefs: WorkflowRunPrefs,
  href: string,
  options?: { now?: number; force?: boolean }
): boolean {
  if (!prefs.auto) return false;
  if (options?.force) return true;

  const now = options?.now ?? Date.now();
  const last = prefs.lastRun;
  if (!last) return true;
  if (last.href !== href) return true;
  if (!prefs.repeat) return false;
  return now - last.at >= AUTO_REPEAT_MIN_INTERVAL_MS;
}
