import { beforeEach, describe, expect, it } from 'vitest';
import { LS_OPTIONS_V1_KEY, LS_STATE_V2_KEY } from './constants';
import { loadState, saveState } from './storage';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string): string | null {
      return values.has(key) ? values.get(key) ?? null : null;
    },
    key(index: number): string | null {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      values.delete(String(key));
    },
    setItem(key: string, value: string): void {
      values.set(String(key), String(value));
    },
  };
}

function installDeterministicLocalStorage(): Storage {
  const memoryStorage = createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    enumerable: true,
    writable: true,
  });
  return memoryStorage;
}

const storage = installDeterministicLocalStorage();

describe('storage state v2', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('migrates legacy v1 options into v2 state', () => {
    storage.setItem(LS_OPTIONS_V1_KEY, JSON.stringify({
      paginateAllPages: false,
      setShowTo100: false,
      columnMode: 'key',
      maxConcurrency: 3,
      debug: true,
    }));

    const state = loadState();

    expect(state.version).toBe(2);
    expect(state.scrape.paginateAllPages).toBe(false);
    expect(state.scrape.setShowTo100).toBe(false);
    expect(state.scrape.columnMode).toBe('key');
    expect(state.scrape.maxConcurrency).toBe(3);
    expect(state.scrape.debug).toBe(true);

    const persisted = storage.getItem(LS_STATE_V2_KEY);
    expect(persisted).toBeTruthy();
  });

  it('merges partial v2 state with defaults', () => {
    storage.setItem(LS_STATE_V2_KEY, JSON.stringify({
      version: 2,
      scrape: { maxConcurrency: 4 },
      uniqueness: { enabled: true, keyFields: { vin: true, stock: false, pid: false } },
      popout: { copyIncludeHeaders: true },
      theme: { accent: '#123456' },
      ui: { mainTab: 'settings' },
    }));

    const state = loadState();

    expect(state.scrape.maxConcurrency).toBe(4);
    expect(state.scrape.paginateAllPages).toBe(true);
    expect(state.uniqueness.enabled).toBe(true);
    expect(state.uniqueness.keyFields.stock).toBe(false);
    expect(state.uniqueness.keyFields.vin).toBe(true);
    expect(state.popout.copyIncludeHeaders).toBe(true);
    expect(state.popout.persistSelectedColumns).toBe(true);
    expect(state.theme.accent).toBe('#123456');
    expect(state.theme.primary).toBe('#16a34a');
    expect(state.ui.mainTab).toBe('settings');
    expect(state.ui.settingsTab).toBe('scrape');
  });

  it('saves and loads v2 state round trip', () => {
    const state = loadState();
    state.scrape.maxConcurrency = 2;
    state.popout.copyIncludeHeaders = true;
    state.popout.selectedColumnsByName = ['VIN', 'PID'];
    state.ui.mainTab = 'settings';
    state.ui.settingsTab = 'popout';

    saveState(state);

    const loaded = loadState();
    expect(loaded.scrape.maxConcurrency).toBe(2);
    expect(loaded.popout.copyIncludeHeaders).toBe(true);
    expect(loaded.popout.selectedColumnsByName).toEqual(['VIN', 'PID']);
    expect(loaded.ui.mainTab).toBe('settings');
    expect(loaded.ui.settingsTab).toBe('popout');
  });
});
