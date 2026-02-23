import {
  DEFAULT_PERSISTED_STATE,
  DEFAULT_POPOUT_OPTIONS,
  DEFAULT_SCRAPE_OPTIONS,
  DEFAULT_THEME_OPTIONS,
  DEFAULT_UI_STATE,
  DEFAULT_UNIQUENESS_OPTIONS,
  LS_OPTIONS_V1_KEY,
  LS_STATE_V2_KEY,
} from './constants';
import type { PersistedState, PopoutOptions, ScrapeOptions, ThemeOptions, UiState, UniquenessOptions } from './types';
import { safeJsonParse } from './utils';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeScrapeOptions(saved: unknown): ScrapeOptions {
  if (!isRecord(saved)) return { ...DEFAULT_SCRAPE_OPTIONS };
  return {
    ...DEFAULT_SCRAPE_OPTIONS,
    paginateAllPages: typeof saved.paginateAllPages === 'boolean' ? saved.paginateAllPages : DEFAULT_SCRAPE_OPTIONS.paginateAllPages,
    setShowTo100: typeof saved.setShowTo100 === 'boolean' ? saved.setShowTo100 : DEFAULT_SCRAPE_OPTIONS.setShowTo100,
    columnMode: (saved.columnMode === 'all' || saved.columnMode === 'none' || saved.columnMode === 'key') ? saved.columnMode : DEFAULT_SCRAPE_OPTIONS.columnMode,
    requirePurchaseId: typeof saved.requirePurchaseId === 'boolean' ? saved.requirePurchaseId : DEFAULT_SCRAPE_OPTIONS.requirePurchaseId,
    requireVin: typeof saved.requireVin === 'boolean' ? saved.requireVin : DEFAULT_SCRAPE_OPTIONS.requireVin,
    requireStockNumber: typeof saved.requireStockNumber === 'boolean' ? saved.requireStockNumber : DEFAULT_SCRAPE_OPTIONS.requireStockNumber,
    debug: typeof saved.debug === 'boolean' ? saved.debug : DEFAULT_SCRAPE_OPTIONS.debug,
    maxConcurrency: typeof saved.maxConcurrency === 'number' && Number.isFinite(saved.maxConcurrency) ? Math.max(1, Math.floor(saved.maxConcurrency)) : DEFAULT_SCRAPE_OPTIONS.maxConcurrency,
  };
}

function mergeUniquenessOptions(saved: unknown): UniquenessOptions {
  if (!isRecord(saved)) return { ...DEFAULT_UNIQUENESS_OPTIONS, keyFields: { ...DEFAULT_UNIQUENESS_OPTIONS.keyFields }, dateColumn: { ...DEFAULT_UNIQUENESS_OPTIONS.dateColumn } };

  const keyFieldsRaw = isRecord(saved.keyFields) ? saved.keyFields : {};
  const dateColumnRaw = isRecord(saved.dateColumn) ? saved.dateColumn : {};

  const strategy = saved.strategy;
  const normalizedStrategy = (strategy === 'latest_by_date' || strategy === 'first_seen' || strategy === 'last_seen') ? strategy : DEFAULT_UNIQUENESS_OPTIONS.strategy;

  const modeRaw = dateColumnRaw.mode;
  const normalizedMode = (modeRaw === 'auto' || modeRaw === 'manual') ? modeRaw : DEFAULT_UNIQUENESS_OPTIONS.dateColumn.mode;

  return {
    ...DEFAULT_UNIQUENESS_OPTIONS,
    enabled: saved.enabled === true,
    strategy: normalizedStrategy,
    keyFields: {
      vin: keyFieldsRaw.vin !== false,
      stock: keyFieldsRaw.stock !== false,
      pid: keyFieldsRaw.pid !== false,
    },
    dateColumn: {
      mode: normalizedMode,
      header: typeof dateColumnRaw.header === 'string' ? dateColumnRaw.header : DEFAULT_UNIQUENESS_OPTIONS.dateColumn.header,
    },
  };
}

function mergePopoutOptions(saved: unknown): PopoutOptions {
  if (!isRecord(saved)) return { ...DEFAULT_POPOUT_OPTIONS, selectedColumnsByName: [] };
  return {
    ...DEFAULT_POPOUT_OPTIONS,
    copyIncludeHeaders: saved.copyIncludeHeaders === true,
    persistSelectedColumns: saved.persistSelectedColumns !== false,
    selectedColumnsByName: Array.isArray(saved.selectedColumnsByName)
      ? saved.selectedColumnsByName.filter((x) => typeof x === 'string')
      : [],
  };
}

function mergeThemeOptions(saved: unknown): ThemeOptions {
  if (!isRecord(saved)) return { ...DEFAULT_THEME_OPTIONS };

  const merged = { ...DEFAULT_THEME_OPTIONS };
  const keys = Object.keys(DEFAULT_THEME_OPTIONS) as Array<keyof ThemeOptions>;
  for (const key of keys) {
    const value = saved[key];
    if (typeof value === 'string' && value.trim()) {
      merged[key] = value;
    }
  }

  // Backwards compatibility for older state where only primary/accent existed.
  if (!saved.primaryHover && merged.primary) merged.primaryHover = merged.primary;
  if (!saved.primaryActive && merged.primary) merged.primaryActive = merged.primary;
  if (!saved.primaryText) merged.primaryText = DEFAULT_THEME_OPTIONS.primaryText;

  return merged;
}

function mergeUiState(saved: unknown): UiState {
  if (!isRecord(saved)) return { ...DEFAULT_UI_STATE };
  const mainTab = saved.mainTab === 'settings' ? 'settings' : 'actions';
  const settingsTab = (saved.settingsTab === 'scrape' || saved.settingsTab === 'uniqueness' || saved.settingsTab === 'popout' || saved.settingsTab === 'theme')
    ? saved.settingsTab
    : DEFAULT_UI_STATE.settingsTab;
  return { mainTab, settingsTab };
}

function mergeState(saved: unknown): PersistedState {
  if (!isRecord(saved) || saved.version !== 2) {
    return { ...DEFAULT_PERSISTED_STATE };
  }

  return {
    version: 2,
    scrape: mergeScrapeOptions(saved.scrape),
    uniqueness: mergeUniquenessOptions(saved.uniqueness),
    popout: mergePopoutOptions(saved.popout),
    theme: mergeThemeOptions(saved.theme),
    ui: mergeUiState(saved.ui),
  };
}

function migrateV1(): PersistedState | null {
  const v1 = safeJsonParse<Record<string, unknown>>(localStorage.getItem(LS_OPTIONS_V1_KEY), {});
  const hasAny = Object.keys(v1 || {}).length > 0;
  if (!hasAny) return null;

  const next: PersistedState = {
    version: 2,
    scrape: mergeScrapeOptions(v1),
    uniqueness: { ...DEFAULT_UNIQUENESS_OPTIONS, keyFields: { ...DEFAULT_UNIQUENESS_OPTIONS.keyFields }, dateColumn: { ...DEFAULT_UNIQUENESS_OPTIONS.dateColumn } },
    popout: { ...DEFAULT_POPOUT_OPTIONS, selectedColumnsByName: [] },
    theme: { ...DEFAULT_THEME_OPTIONS },
    ui: { ...DEFAULT_UI_STATE },
  };

  return next;
}

export function loadState(): PersistedState {
  const raw = safeJsonParse<unknown>(localStorage.getItem(LS_STATE_V2_KEY), null);
  if (raw) return mergeState(raw);

  const migrated = migrateV1();
  if (migrated) {
    saveState(migrated);
    return migrated;
  }

  return { ...DEFAULT_PERSISTED_STATE };
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(LS_STATE_V2_KEY, JSON.stringify(state));
}
