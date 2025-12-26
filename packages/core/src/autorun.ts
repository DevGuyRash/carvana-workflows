import { Store } from './storage';

export interface LastRunInfo {
  href: string;
  at: number;
  context?: string;
}

export interface WorkflowRunPrefs {
  auto: boolean;
  repeat: boolean;
  lastRun?: LastRunInfo;
}

export const AUTO_REPEAT_MIN_INTERVAL_MS = 5000;
const PREFS_VERSION = 2 as const;

type LegacyPrefs = {
  auto?: boolean;
  repeat?: boolean;
  lastRun?: LastRunInfo | null;
};

type TriggerPrefs = {
  version: typeof PREFS_VERSION;
  triggers?: {
    auto?: { enabled?: boolean };
    repeat?: { enabled?: boolean };
  };
  lastRun?: LastRunInfo | null;
};

const keyFor = (workflowId: string) => `wf:autorun:${workflowId}`;

function sanitizeLastRun(raw: any): LastRunInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const href = typeof raw.href === 'string' ? raw.href : '';
  const at = typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : Date.now();
  const context = typeof raw.context === 'string' ? raw.context : undefined;
  if (!href) return undefined;
  return { href, at, context };
}

function normalizePrefs(raw: any): { prefs: WorkflowRunPrefs; needsMigration: boolean } {
  if (!raw || typeof raw !== 'object') {
    return { prefs: { auto: false, repeat: false }, needsMigration: false };
  }

  if ('triggers' in raw) {
    const auto = raw?.triggers?.auto?.enabled === true;
    const repeat = auto && raw?.triggers?.repeat?.enabled === true;
    const lastRun = sanitizeLastRun(raw?.lastRun);
    const needsMigration = raw?.version !== PREFS_VERSION;
    return { prefs: { auto, repeat, lastRun }, needsMigration };
  }

  const auto = raw?.auto === true;
  const repeat = auto && raw?.repeat === true;
  const lastRun = sanitizeLastRun(raw?.lastRun);
  return { prefs: { auto, repeat, lastRun }, needsMigration: true };
}

function persist(store: Store, workflowId: string, prefs: WorkflowRunPrefs): WorkflowRunPrefs {
  const payload: TriggerPrefs = {
    version: PREFS_VERSION,
    triggers: {
      auto: { enabled: prefs.auto },
      repeat: { enabled: prefs.repeat }
    }
  };
  if (prefs.lastRun) payload.lastRun = prefs.lastRun;
  store.set(keyFor(workflowId), payload);
  return prefs;
}

export function getRunPrefs(store: Store, workflowId: string): WorkflowRunPrefs {
  const raw = store.get<LegacyPrefs | TriggerPrefs | undefined>(keyFor(workflowId), undefined);
  const { prefs, needsMigration } = normalizePrefs(raw);
  if (needsMigration) {
    try {
      persist(store, workflowId, prefs);
    } catch {
      // ignore migration failures
    }
  }
  return prefs;
}

export type RunPrefsPatch = Partial<Omit<WorkflowRunPrefs, 'lastRun'>> & {
  lastRun?: LastRunInfo | null;
};

export function updateRunPrefs(store: Store, workflowId: string, patch: RunPrefsPatch): WorkflowRunPrefs {
  const current = getRunPrefs(store, workflowId);
  const hasLastRun = Object.prototype.hasOwnProperty.call(patch, 'lastRun');
  const next = {
    auto: patch.auto ?? current.auto,
    repeat: patch.repeat ?? current.repeat,
    lastRun: hasLastRun ? patch.lastRun ?? undefined : current.lastRun
  } satisfies WorkflowRunPrefs;

  if (patch.auto === true && current.auto === false && !hasLastRun) {
    next.lastRun = undefined;
  }

  const auto = next.auto === true;
  const repeat = auto && next.repeat === true;
  const lastRun = sanitizeLastRun(next.lastRun);
  return persist(store, workflowId, { auto, repeat, lastRun });
}

export function markAutoRun(
  store: Store,
  workflowId: string,
  info: { href: string; at?: number; context?: string }
): WorkflowRunPrefs {
  return updateRunPrefs(store, workflowId, {
    lastRun: { href: info.href, at: info.at ?? Date.now(), context: info.context }
  });
}

export function shouldAutoRun(
  prefs: WorkflowRunPrefs,
  href: string,
  options?: { now?: number; force?: boolean; context?: string }
): boolean {
  if (!prefs.auto) return false;
  if (options?.force) return true;

  const now = options?.now ?? Date.now();
  const last = prefs.lastRun;
  if (!last) return true;
  if (options?.context && last.context && options.context !== last.context) return true;
  if (last.href !== href) return true;
  if (!prefs.repeat) return false;
  return now - last.at >= AUTO_REPEAT_MIN_INTERVAL_MS;
}
