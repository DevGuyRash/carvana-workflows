import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Store } from '../src/storage';
import {
  AUTO_REPEAT_MIN_INTERVAL_MS,
  getRunPrefs,
  markAutoRun,
  shouldAutoRun,
  updateRunPrefs
} from '../src/autorun';

type GmKey = string;

describe('workflow auto-run preferences', () => {
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

  it('defaults to auto=false repeat=false', () => {
    const prefs = getRunPrefs(store, 'wf.demo');
    expect(prefs.auto).toBe(false);
    expect(prefs.repeat).toBe(false);
    expect(prefs.lastRun).toBeUndefined();
  });

  it('enables auto and repeat, persisting state', () => {
    updateRunPrefs(store, 'wf.demo', { auto: true, repeat: true });
    const prefs = getRunPrefs(store, 'wf.demo');
    expect(prefs.auto).toBe(true);
    expect(prefs.repeat).toBe(true);
    expect(prefs.lastRun).toBeUndefined();

    updateRunPrefs(store, 'wf.demo', { auto: false });
    const after = getRunPrefs(store, 'wf.demo');
    expect(after.auto).toBe(false);
    expect(after.repeat).toBe(false);
  });

  it('decides when to auto-run based on href, repeat, and interval', () => {
    updateRunPrefs(store, 'wf.demo', { auto: true });
    const href = 'https://example.test/foo';
    let prefs = getRunPrefs(store, 'wf.demo');
    expect(shouldAutoRun(prefs, href)).toBe(true);

    markAutoRun(store, 'wf.demo', { href, at: 1000 });
    prefs = getRunPrefs(store, 'wf.demo');
    expect(shouldAutoRun(prefs, href, { now: 2000 })).toBe(false);

    updateRunPrefs(store, 'wf.demo', { repeat: true });
    prefs = getRunPrefs(store, 'wf.demo');
    expect(shouldAutoRun(prefs, href, { now: 2000 })).toBe(false);
    expect(shouldAutoRun(prefs, href, { now: 1000 + AUTO_REPEAT_MIN_INTERVAL_MS + 1 })).toBe(true);
  });

  it('re-runs when context token changes even without repeat', () => {
    updateRunPrefs(store, 'wf.demo', { auto: true, repeat: false });
    const href = 'https://example.test/foo';
    markAutoRun(store, 'wf.demo', { href, at: 1000, context: 'expanded' });
    const prefs = getRunPrefs(store, 'wf.demo');
    expect(shouldAutoRun(prefs, href, { context: 'expanded' })).toBe(false);
    expect(shouldAutoRun(prefs, href, { context: 'collapsed' })).toBe(true);
  });

  it('forces run when requested', () => {
    updateRunPrefs(store, 'wf.demo', { auto: true });
    markAutoRun(store, 'wf.demo', { href: 'https://example.test/foo', at: 1000 });
    const prefs = getRunPrefs(store, 'wf.demo');
    expect(shouldAutoRun(prefs, 'https://example.test/foo')).toBe(false);
    expect(shouldAutoRun(prefs, 'https://example.test/foo', { force: true })).toBe(true);
  });
});
