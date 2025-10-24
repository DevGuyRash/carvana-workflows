import { beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../src/storage';
import {
  getActiveProfile,
  getProfileValues,
  profileLabel,
  readProfiles,
  saveProfileValues,
  setActiveProfile
} from '../src/profiles';

type GmKey = string;

describe('profile persistence', () => {
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

  it('provides defaults when nothing saved', () => {
    const state = readProfiles(store, 'wf.demo');
    expect(state.active).toBe('p1');
    expect(state.profiles.p1).toBeUndefined();
    expect(profileLabel(state.active)).toBe('Profile 1');
  });

  it('persists and retrieves profile values', () => {
    saveProfileValues(store, 'wf.demo', 'p2', { foo: 'bar', count: 3 });
    expect(getActiveProfile(store, 'wf.demo')).toBe('p1');

    setActiveProfile(store, 'wf.demo', 'p2');
    expect(getActiveProfile(store, 'wf.demo')).toBe('p2');
    const values = getProfileValues(store, 'wf.demo', 'p2');
    expect(values).toEqual({ foo: 'bar', count: 3 });
  });

  it('migrates legacy single-profile storage', () => {
    const g = globalThis as any;
    g.GM_setValue('spec:wf:opts:legacy', JSON.stringify({ legacy: true }));

    const state = readProfiles(store, 'legacy');
    expect(state.profiles.p1).toEqual({ legacy: true });
    expect(mem.has('spec:wf:opts:legacy')).toBe(false);
  });

  it('keeps separate profiles isolated', () => {
    saveProfileValues(store, 'wf.demo', 'p1', { one: 1 });
    saveProfileValues(store, 'wf.demo', 'p3', { three: 3 });
    expect(getProfileValues(store, 'wf.demo', 'p1')).toEqual({ one: 1 });
    expect(getProfileValues(store, 'wf.demo', 'p3')).toEqual({ three: 3 });
    expect(getProfileValues(store, 'wf.demo', 'p2')).toEqual({});
  });
});
