import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '../src/workflow';
import { Store } from '../src/storage';
import { updateRunPrefs, getRunPrefs, AUTO_REPEAT_MIN_INTERVAL_MS } from '../src/autorun';
import type { PageDefinition, WorkflowDefinition } from '../src/types';

type GmKey = string;

describe('Engine auto-run integration', () => {
  let mem: Map<GmKey, string>;
  let store: Store;
  let page: PageDefinition;
  let workflow: WorkflowDefinition;

  beforeEach(() => {
    mem = new Map();
    const g = globalThis as any;
    g.GM_getValue = (key: string) => mem.get(key);
    g.GM_setValue = (key: string, value: string) => { mem.set(key, value); };
    g.GM_deleteValue = (key: string) => { mem.delete(key); };
    g.GM_listValues = () => Array.from(mem.keys());
    g.GM_registerMenuCommand = vi.fn();
    g.alert = vi.fn();
    store = new Store('spec');

    document.title = 'Auto Run Test';
    workflow = {
      id: 'demo.auto',
      label: 'Auto Demo',
      steps: []
    };
    page = {
      id: 'demo',
      label: 'Demo Page',
      detector: { exists: { selector: 'html' } },
      workflows: [workflow]
    };
  });

  it('runs auto workflow once when repeat disabled', async () => {
    updateRunPrefs(store, workflow.id, { auto: true });
    const engine = new Engine({ pages: [page] }, store);
    const runSpy = vi.spyOn(engine as any, 'runWorkflow');

    await (engine as any).handleAutoRun(page);
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenLastCalledWith(workflow, false, { silent: true });

    await (engine as any).handleAutoRun(page);
    expect(runSpy).toHaveBeenCalledTimes(1);

    const prefs = getRunPrefs(store, workflow.id);
    expect(prefs.lastRun?.href).toBe(globalThis.location.href);
  });

  it('respects repeat intervals when enabled', async () => {
    vi.useFakeTimers();
    const start = new Date('2024-01-01T00:00:00.000Z');
    vi.setSystemTime(start);

    updateRunPrefs(store, workflow.id, { auto: true, repeat: true });
    const engine = new Engine({ pages: [page] }, store);
    const runSpy = vi.spyOn(engine as any, 'runWorkflow');

    await (engine as any).handleAutoRun(page);
    expect(runSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(start.getTime() + AUTO_REPEAT_MIN_INTERVAL_MS - 100));
    await (engine as any).handleAutoRun(page);
    expect(runSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(start.getTime() + AUTO_REPEAT_MIN_INTERVAL_MS + 2000));
    await (engine as any).handleAutoRun(page);
    expect(runSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
