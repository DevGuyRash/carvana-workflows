import { Store } from './storage';

export type ProfileId = 'p1' | 'p2' | 'p3';

export interface WorkflowProfiles {
  active: ProfileId;
  profiles: Record<ProfileId, Record<string, any> | undefined>;
  enabled: boolean;
}

export const PROFILE_SLOTS: ReadonlyArray<{ id: ProfileId; label: string; shortLabel: string }> = [
  { id: 'p1', label: 'Profile 1', shortLabel: 'P1' },
  { id: 'p2', label: 'Profile 2', shortLabel: 'P2' },
  { id: 'p3', label: 'Profile 3', shortLabel: 'P3' }
];

const PROFILE_IDS = PROFILE_SLOTS.map(slot => slot.id) as ProfileId[];

const profileKey = (workflowId: string) => `wf:profiles:${workflowId}`;

function isPlainObject(value: any): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  const sc = (globalThis as any).structuredClone;
  if (typeof sc === 'function') {
    try { return sc(value); } catch { /* fall back */ }
  }
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as unknown as T;
  if (Array.isArray(value)) return value.map(v => deepClone(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      out[k] = deepClone(v);
    }
    return out as T;
  }
  return value;
}

function sanitize(
  store: Store,
  workflowId: string,
  raw: any,
  defaults?: { enabled?: boolean; active?: ProfileId }
): WorkflowProfiles {
  const requestedDefaultActive = defaults?.active && PROFILE_IDS.includes(defaults.active)
    ? defaults.active
    : PROFILE_IDS[0];
  const defaultActive = requestedDefaultActive;
  const defaultEnabled = defaults?.enabled ?? true;
  let changed = false;
  const active = PROFILE_IDS.includes(raw?.active) ? (raw.active as ProfileId) : requestedDefaultActive;
  if (active !== raw?.active) changed = true;

  const profiles: Record<ProfileId, Record<string, any> | undefined> = {
    p1: undefined,
    p2: undefined,
    p3: undefined
  };

  const source = isPlainObject(raw?.profiles) ? raw.profiles : {};
  if (!isPlainObject(raw?.profiles) && raw?.profiles != null) changed = true;

  for (const id of PROFILE_IDS) {
    const val = source[id];
    if (isPlainObject(val)) {
      profiles[id] = deepClone(val);
    } else if (val != null) {
      changed = true;
    }
  }

  let enabled: boolean;
  if (raw?.enabled === true || raw?.enabled === false) {
    enabled = raw.enabled;
  } else {
    enabled = defaultEnabled;
    if (raw?.enabled != null) changed = true;
  }

  // Legacy migration from single-option storage
  const legacyKey = `wf:opts:${workflowId}`;
  if (!profiles[defaultActive]) {
    const hasLegacy = store.keys().includes(legacyKey);
    if (hasLegacy) {
      const legacy = store.get<Record<string, any>>(legacyKey, {} as any);
      profiles[defaultActive] = deepClone(legacy);
      store.delete(legacyKey);
      changed = true;
    }
  }

  const state: WorkflowProfiles = { active, profiles, enabled };
  if (changed) persist(store, workflowId, state);
  return state;
}

function persist(store: Store, workflowId: string, state: WorkflowProfiles): void {
  const payload: { active: ProfileId; profiles: Record<string, Record<string, any>>; enabled: boolean } = {
    active: state.active,
    profiles: {} as Record<string, Record<string, any>>,
    enabled: state.enabled
  };
  for (const id of PROFILE_IDS) {
    const val = state.profiles[id];
    if (val && Object.keys(val).length > 0) {
      payload.profiles[id] = deepClone(val);
    }
  }
  store.set(profileKey(workflowId), payload);
}

export function readProfiles(
  store: Store,
  workflowId: string,
  defaults?: { enabled?: boolean; active?: ProfileId }
): WorkflowProfiles {
  const raw = store.get<any>(profileKey(workflowId), {
    active: defaults?.active && PROFILE_IDS.includes(defaults.active) ? defaults.active : PROFILE_IDS[0],
    profiles: {},
    enabled: defaults?.enabled ?? true
  });
  return sanitize(store, workflowId, raw, defaults);
}

export function getActiveProfile(store: Store, workflowId: string): ProfileId {
  return readProfiles(store, workflowId).active;
}

export function setActiveProfile(store: Store, workflowId: string, profileId: ProfileId): WorkflowProfiles {
  const state = readProfiles(store, workflowId);
  if (state.active !== profileId) {
    state.active = profileId;
    persist(store, workflowId, state);
  }
  return state;
}

export function getProfileValues(store: Store, workflowId: string, profileId: ProfileId): Record<string, any> {
  const state = readProfiles(store, workflowId);
  return deepClone(state.profiles[profileId] ?? {});
}

export function saveProfileValues(store: Store, workflowId: string, profileId: ProfileId, values: Record<string, any>): WorkflowProfiles {
  const state = readProfiles(store, workflowId);
  state.profiles[profileId] = deepClone(values);
  persist(store, workflowId, state);
  return state;
}

export function profileLabel(profileId: ProfileId): string {
  const slot = PROFILE_SLOTS.find(s => s.id === profileId);
  return slot ? slot.label : profileId;
}

export function setProfilesEnabled(store: Store, workflowId: string, enabled: boolean): WorkflowProfiles {
  const state = readProfiles(store, workflowId);
  if (state.enabled !== enabled) {
    state.enabled = enabled;
    persist(store, workflowId, state);
  }
  return state;
}

export function getProfilesEnabled(
  store: Store,
  workflowId: string,
  defaults?: { enabled?: boolean; active?: ProfileId }
): boolean {
  return readProfiles(store, workflowId, defaults).enabled;
}
