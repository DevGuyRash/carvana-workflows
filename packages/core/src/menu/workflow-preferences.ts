import type { WorkflowDefinition } from '../types';
import { Store } from '../storage';

const PREFS_VERSION = 1 as const;
const STORAGE_PREFIX = 'wf:menu:prefs:';

export type WorkflowPreferencesState = {
  version: typeof PREFS_VERSION;
  order: string[];
  hidden: string[];
};

export type WorkflowVisibilityLists = {
  ordered: WorkflowDefinition[];
  hidden: WorkflowDefinition[];
};

const DEFAULT_STATE: WorkflowPreferencesState = {
  version: PREFS_VERSION,
  order: [],
  hidden: []
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
    hidden: [...state.hidden]
  };
}

function statesEqual(a: WorkflowPreferencesState, b: WorkflowPreferencesState): boolean {
  if (a.order.length !== b.order.length || a.hidden.length !== b.hidden.length) return false;
  for (let i = 0; i < a.order.length; i += 1) {
    if (a.order[i] !== b.order[i]) return false;
  }
  for (let i = 0; i < a.hidden.length; i += 1) {
    if (a.hidden[i] !== b.hidden[i]) return false;
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
    return this.state.hidden;
  }

  isHidden(workflowId: string): boolean {
    return this.state.hidden.includes(workflowId);
  }

  partition(workflows: readonly WorkflowDefinition[]): WorkflowVisibilityLists {
    const runtimeIds = workflows.map(w => w.id);
    const reconciled = this.reconcile(runtimeIds);
    const hiddenSet = new Set(reconciled.hidden);
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
    const hiddenSet = new Set(reconciled.hidden);
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
      hidden: reconciled.hidden
    };

    this.persist(nextState);
    return this.partition(workflows);
  }

  toggleHidden(workflows: readonly WorkflowDefinition[], workflowId: string, nextHidden?: boolean): WorkflowVisibilityLists {
    const runtimeIds = workflows.map(w => w.id);
    const reconciled = this.reconcile(runtimeIds);
    const hiddenSet = new Set(reconciled.hidden);
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
      hidden: Array.from(hiddenSet)
    };

    this.persist(nextState);
    return this.partition(workflows);
  }

  restoreDefaults(workflows: readonly WorkflowDefinition[]): WorkflowVisibilityLists {
    const runtimeIds = workflows.map(w => w.id);
    const nextState: WorkflowPreferencesState = {
      version: PREFS_VERSION,
      order: [...runtimeIds],
      hidden: []
    };
    this.persist(nextState);
    return this.partition(workflows);
  }

  private load(): WorkflowPreferencesState {
    const raw = this.store.get<WorkflowPreferencesState | null>(this.key, null);
    if (!raw || typeof raw !== 'object') {
      return cloneState(DEFAULT_STATE);
    }
    if (raw.version !== PREFS_VERSION) {
      return cloneState(DEFAULT_STATE);
    }
    return {
      version: PREFS_VERSION,
      order: sanitizeIds(raw.order),
      hidden: sanitizeIds(raw.hidden)
    };
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

    const nextHidden = this.state.hidden.filter(id => runtimeSet.has(id));
    const nextState: WorkflowPreferencesState = {
      version: PREFS_VERSION,
      order: nextOrder,
      hidden: nextHidden
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
