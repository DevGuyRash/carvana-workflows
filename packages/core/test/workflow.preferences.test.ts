import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkflowDefinition } from '../src/types';
import { Store } from '../src/storage';
import { WorkflowPreferencesService } from '../src/menu/workflow-preferences';

type GmKey = string;

const makeWorkflows = (ids: string[]): WorkflowDefinition[] => ids.map(id => ({
  id,
  label: id,
  steps: []
}));

describe('workflow preferences service', () => {
  let mem: Map<GmKey, string>;
  let store: Store;

  beforeEach(() => {
    mem = new Map();
    const g = globalThis as any;
    g.GM_getValue = (key: string) => mem.get(key);
    g.GM_setValue = (key: string, value: string) => { mem.set(key, value); };
    g.GM_deleteValue = (key: string) => { mem.delete(key); };
    g.GM_listValues = () => Array.from(mem.keys());
    store = new Store('spec');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reconciles persisted order with runtime workflows and filters invalid entries', () => {
    mem.set('spec:wf:menu:prefs:page', JSON.stringify({
      version: 1,
      order: ['wf.two', 'wf.ghost', { bad: true }, 'wf.one', 'wf.one'],
      hidden: ['wf.one', 'wf.ghost', 42]
    }));

    const service = new WorkflowPreferencesService(store, 'page');
    const workflows = makeWorkflows(['wf.one', 'wf.two', 'wf.three']);
    const lists = service.partition(workflows);

    expect(lists.ordered.map(w => w.id)).toEqual(['wf.two', 'wf.three']);
    expect(lists.hidden.map(w => w.id)).toEqual(['wf.one']);

    const persisted = store.get('wf:menu:prefs:page', null);
    expect(persisted).not.toBeNull();
    expect(persisted?.order).toEqual(['wf.two', 'wf.one', 'wf.three']);
    expect(persisted?.hidden).toEqual(['wf.one']);
  });

  it('toggles hidden state deterministically and exposes visibility helpers', () => {
    const service = new WorkflowPreferencesService(store, 'page');
    const workflows = makeWorkflows(['wf.one', 'wf.two', 'wf.three']);
    service.partition(workflows);

    let lists = service.toggleHidden(workflows, 'wf.two');
    expect(lists.hidden.map(w => w.id)).toEqual(['wf.two']);
    expect(lists.ordered.map(w => w.id)).toEqual(['wf.one', 'wf.three']);
    expect(service.isHidden('wf.two')).toBe(true);

    lists = service.toggleHidden(workflows, 'wf.two', false);
    expect(lists.hidden).toHaveLength(0);
    expect(lists.ordered.map(w => w.id)).toEqual(['wf.one', 'wf.two', 'wf.three']);
    expect(service.isHidden('wf.two')).toBe(false);

    const persisted = store.get('wf:menu:prefs:page', null);
    expect(persisted?.hidden).toEqual([]);
    expect(persisted?.order).toEqual(['wf.one', 'wf.two', 'wf.three']);
  });

  it('falls back to defaults when stored version mismatches', () => {
    mem.set('spec:wf:menu:prefs:page', JSON.stringify({
      version: 0,
      order: ['wf.legacy'],
      hidden: ['wf.legacy']
    }));

    const service = new WorkflowPreferencesService(store, 'page');
    const workflows = makeWorkflows(['wf.one', 'wf.two']);
    const lists = service.partition(workflows);

    expect(lists.ordered.map(w => w.id)).toEqual(['wf.one', 'wf.two']);
    expect(lists.hidden).toHaveLength(0);

    const persisted = store.get('wf:menu:prefs:page', null);
    expect(persisted).not.toBeNull();
    expect(persisted?.version).toBe(1);
    expect(persisted?.order).toEqual(['wf.one', 'wf.two']);
    expect(persisted?.hidden).toEqual([]);
  });

  it('warns and retains in-memory state when persistence fails', () => {
    const storageError = new Error('storage offline');
    const g = globalThis as any;
    g.GM_setValue = vi.fn(() => { throw storageError; });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const service = new WorkflowPreferencesService(store, 'page');
    const workflows = makeWorkflows(['wf.one', 'wf.two']);
    const lists = service.applyMove(workflows, 'wf.two', 0);

    expect(lists.ordered.map(w => w.id)).toEqual(['wf.two', 'wf.one']);
    expect(service.getOrderIds()).toEqual(['wf.two', 'wf.one']);
    expect(warnSpy).toHaveBeenCalledWith('workflow-preferences: persist failed', storageError);
    expect(mem.size).toBe(0);
  });

  it('reorders visible workflows while leaving hidden entries untouched', () => {
    mem.set('spec:wf:menu:prefs:page', JSON.stringify({
      version: 1,
      order: ['wf.one', 'wf.two', 'wf.three'],
      hidden: ['wf.three']
    }));

    const service = new WorkflowPreferencesService(store, 'page');
    const workflows = makeWorkflows(['wf.one', 'wf.two', 'wf.three']);
    const lists = service.applyMove(workflows, 'wf.two', 0);

    expect(lists.ordered.map(w => w.id)).toEqual(['wf.two', 'wf.one']);
    expect(lists.hidden.map(w => w.id)).toEqual(['wf.three']);

    const persisted = store.get('wf:menu:prefs:page', null);
    expect(persisted?.order).toEqual(['wf.two', 'wf.one', 'wf.three']);
    expect(persisted?.hidden).toEqual(['wf.three']);

    const unchanged = service.applyMove(workflows, 'wf.three', 0);
    expect(unchanged.ordered.map(w => w.id)).toEqual(['wf.two', 'wf.one']);
    expect(unchanged.hidden.map(w => w.id)).toEqual(['wf.three']);
    expect(store.get('wf:menu:prefs:page', null)).toEqual(persisted);
  });

  it('restores defaults to align with runtime workflows and clear hidden state', () => {
    mem.set('spec:wf:menu:prefs:page', JSON.stringify({
      version: 1,
      order: ['wf.two', 'wf.one'],
      hidden: ['wf.one']
    }));

    const service = new WorkflowPreferencesService(store, 'page');
    const workflows = makeWorkflows(['wf.one', 'wf.two', 'wf.three']);
    const lists = service.restoreDefaults(workflows);

    expect(lists.ordered.map(w => w.id)).toEqual(['wf.one', 'wf.two', 'wf.three']);
    expect(lists.hidden).toHaveLength(0);

    const persisted = store.get('wf:menu:prefs:page', null);
    expect(persisted?.order).toEqual(['wf.one', 'wf.two', 'wf.three']);
    expect(persisted?.hidden).toEqual([]);
  });
});
