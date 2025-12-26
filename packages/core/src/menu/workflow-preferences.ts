import type { WorkflowDefinition } from '../types';
import { Store } from '../storage';

const PREFS_VERSION = 2 as const;
const STORAGE_PREFIX = 'wf:menu:prefs:';

export type WorkflowPreferencesState = {
  version: typeof PREFS_VERSION;
  order: string[];
  hiddenInActions: string[];
};

export type WorkflowVisibilityLists = {
  ordered: WorkflowDefinition[];
  hidden: WorkflowDefinition[];
};

const DEFAULT_STATE: WorkflowPreferencesState = {
  version: PREFS_VERSION,
  order: [],
  hiddenInActions: []
};

function sanitizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry);
  }
  return out;
}

function cloneState(state: WorkflowPreferencesState): WorkflowPreferencesState {
  return {
    version: PREFS_VERSION,
    order: [...state.order],
    hiddenInActions: [...state.hiddenInActions]
  };
}

function statesEqual(a: WorkflowPreferencesState, b: WorkflowPreferencesState): boolean {
  if (a.order.length !== b.order.length || a.hiddenInActions.length !== b.hiddenInActions.length) return false;
  for (let i = 0; i < a.order.length; i += 1) {
    if (a.order[i] !== b.order[i]) return false;
  }
  for (let i = 0; i < a.hiddenInActions.length; i += 1) {
    if (a.hiddenInActions[i] !== b.hiddenInActions[i]) return false;
  }
  return true;
}

export class WorkflowPreferencesService {
  private store: Store;
  private key: string;
  private state: WorkflowPreferencesState;

  constructor(store: Store, pageId: string){
    this.store = store;
    this.key = `${STORAGE_PREFIX}${pageId}`;
    this.state = this.load();
  }

  getOrderIds(): readonly string[] {
    return this.state.order;
  }

  getHiddenIds(): readonly string[] {
    return this.state.hiddenInActions;
  }

  isHidden(workflowId: string): boolean {
    return this.state.hiddenInActions.includes(workflowId);
  }

  partition(workflows: readonly WorkflowDefinition[]): WorkflowVisibilityLists {
    const runtimeIds = workflows.map(w => w.id);
    const reconciled = this.reconcile(runtimeIds);
    const hiddenSet = new Set(reconciled.hiddenInActions);
    const byId = new Map(workflows.map(w => [w.id, w] as const));

    const ordered: WorkflowDefinition[] = [];
    const hidden: WorkflowDefinition[] = [];

    for (const id of reconciled.order) {
      const wf = byId.get(id);
      if (!wf) continue;
      if (hiddenSet.has(id)) hidden.push(wf);
      else ordered.push(wf);
    }

    return { ordered, hidden };
  }

  applyMove(workflows: readonly WorkflowDefinition[], workflowId: string, targetIndex: number): WorkflowVisibilityLists {
    const runtimeIds = workflows.map(w => w.id);
    const reconciled = this.reconcile(runtimeIds);
    const hiddenSet = new Set(reconciled.hiddenInActions);
    if (hiddenSet.has(workflowId)) {
      return this.partition(workflows);
    }

    const visibleIds = reconciled.order.filter(id => !hiddenSet.has(id));
    const currentIndex = visibleIds.indexOf(workflowId);
    if (currentIndex === -1) {
      return this.partition(workflows);
    }

    const boundedIndex = Math.max(0, Math.min(targetIndex, visibleIds.length - 1));
    if (currentIndex === boundedIndex) {
      return this.partition(workflows);
    }

    visibleIds.splice(currentIndex, 1);
    visibleIds.splice(boundedIndex, 0, workflowId);

    const visibleQueue = [...visibleIds];
    const nextOrder: string[] = [];
    for (const id of reconciled.order) {
      if (hiddenSet.has(id)) {
        nextOrder.push(id);
        continue;
      }
      const next = visibleQueue.shift();
      if (next) nextOrder.push(next);
    }
    for (const id of visibleQueue) {
      nextOrder.push(id);
    }

    const nextState: WorkflowPreferencesState = {
      version: PREFS_VERSION,
      order: nextOrder,
      hiddenInActions: reconciled.hiddenInActions
    };

    this.persist(nextState);
    return this.partition(workflows);
  }

  toggleHidden(workflows: readonly WorkflowDefinition[], workflowId: string, nextHidden?: boolean): WorkflowVisibilityLists {
    const runtimeIds = workflows.map(w => w.id);
    const reconciled = this.reconcile(runtimeIds);
    const hiddenSet = new Set(reconciled.hiddenInActions);
    const shouldHide = typeof nextHidden === 'boolean' ? nextHidden : !hiddenSet.has(workflowId);

    let changed = false;
    if (shouldHide) {
      if (!hiddenSet.has(workflowId)) {
        hiddenSet.add(workflowId);
        changed = true;
      }
    } else {
      if (hiddenSet.delete(workflowId)) {
        changed = true;
      }
    }

    if (!changed) {
      return this.partition(workflows);
    }

    const nextState: WorkflowPreferencesState = {
      version: PREFS_VERSION,
      order: reconciled.order,
      hiddenInActions: Array.from(hiddenSet)
    };

    this.persist(nextState);
    return this.partition(workflows);
  }

  restoreDefaults(workflows: readonly WorkflowDefinition[]): WorkflowVisibilityLists {
    const runtimeIds = workflows.map(w => w.id);
    const nextState: WorkflowPreferencesState = {
      version: PREFS_VERSION,
      order: [...runtimeIds],
      hiddenInActions: []
    };
    this.persist(nextState);
    return this.partition(workflows);
  }

  private migrateLegacy(raw: Record<string, unknown>): WorkflowPreferencesState | null {
    const order = sanitizeIds(raw.order);
    let hidden = sanitizeIds(raw.hiddenInActions);
    if (!hidden.length) hidden = sanitizeIds(raw.hidden);
    if (!hidden.length) hidden = sanitizeIds(raw.hiddenWorkflows);
    if (!hidden.length) hidden = sanitizeIds(raw.hiddenIds);
    if (!hidden.length && raw.showInActions && typeof raw.showInActions === 'object') {
      const map = raw.showInActions as Record<string, unknown>;
      hidden = Object.entries(map)
        .filter(([, value]) => value === false)
        .map(([id]) => id);
    }
    if (!order.length && !hidden.length) return null;
    return {
      version: PREFS_VERSION,
      order,
      hiddenInActions: hidden
    };
  }

  private load(): WorkflowPreferencesState {
    const raw = this.store.get<Record<string, unknown> | null>(this.key, null);
    if (!raw || typeof raw !== 'object') {
      return cloneState(DEFAULT_STATE);
    }
    if ((raw as WorkflowPreferencesState).version === PREFS_VERSION) {
      return {
        version: PREFS_VERSION,
        order: sanitizeIds((raw as WorkflowPreferencesState).order),
        hiddenInActions: sanitizeIds((raw as WorkflowPreferencesState).hiddenInActions)
      };
    }

    const migrated = this.migrateLegacy(raw);
    if (migrated) {
      this.persist(migrated);
      return migrated;
    }
    return cloneState(DEFAULT_STATE);
  }

  private reconcile(workflowIds: readonly string[]): WorkflowPreferencesState {
    const runtimeIds = Array.from(workflowIds);
    const runtimeSet = new Set(runtimeIds);
    const nextOrder: string[] = [];
    const seen = new Set<string>();

    for (const id of this.state.order) {
      if (!runtimeSet.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      nextOrder.push(id);
    }

    for (const id of runtimeIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      nextOrder.push(id);
    }

    const nextHidden = this.state.hiddenInActions.filter(id => runtimeSet.has(id));
    const nextState: WorkflowPreferencesState = {
      version: PREFS_VERSION,
      order: nextOrder,
      hiddenInActions: nextHidden
    };

    if (!statesEqual(this.state, nextState)) {
      this.persist(nextState);
    } else {
      this.state = nextState;
    }

    return nextState;
  }

  private persist(state: WorkflowPreferencesState){
    const cloned = cloneState(state);
    this.state = cloned;
    try {
      this.store.set(this.key, cloned);
    } catch (err) {
      console.warn('workflow-preferences: persist failed', err);
    }
  }
}
