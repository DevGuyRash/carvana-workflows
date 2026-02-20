import type { PersistedState, PopoutOptions, ScrapeOptions, ThemeOptions, UiState, UniquenessOptions } from './types';

export const LS_OPTIONS_V1_KEY = 'carmaBulkSearchScraper.options.v1';
export const LS_STATE_V2_KEY = 'carmaBulkSearchScraper.state.v2';

export const BASE_SEARCH_URL = 'https://carma.cvnacorp.com/research/search/';

export const DEFAULT_SCRAPE_OPTIONS: ScrapeOptions = {
  paginateAllPages: true,
  setShowTo100: true,
  columnMode: 'all',
  requirePurchaseId: false,
  requireVin: false,
  requireStockNumber: false,
  debug: false,
  maxConcurrency: 1,
};

export const DEFAULT_UNIQUENESS_OPTIONS: UniquenessOptions = {
  enabled: false,
  keyFields: { vin: true, stock: true, pid: true },
  strategy: 'latest_by_date',
  dateColumn: { mode: 'auto', header: '' },
};

export const DEFAULT_POPOUT_OPTIONS: PopoutOptions = {
  copyIncludeHeaders: false,
  persistSelectedColumns: true,
  selectedColumnsByName: [],
};

export const DEFAULT_THEME_OPTIONS: ThemeOptions = {
  primary: '#16a34a',
  primaryHover: '#15803d',
  primaryActive: '#166534',
  primaryText: '#ffffff',
  secondary: '#f3f4f6',
  secondaryHover: '#e5e7eb',
  secondaryActive: '#d1d5db',
  secondaryText: '#111827',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  surfaceMuted: '#eef2ff',
  text: '#0f172a',
  textMuted: '#5a6b85',
  border: '#cfd6e4',
  focusRing: '#2563eb',
  statusBg: '#0b1220',
  statusText: '#e5e7eb',
  tabBg: '#f1f5f9',
  tabActiveBg: '#ffffff',
  tabText: '#183558',
  buttonBg: '#ffffff',
  buttonHoverBg: '#f8fafc',
  buttonActiveBg: '#eef2f7',
  buttonText: '#0f172a',
  accent: '#183558',
};

export const DEFAULT_UI_STATE: UiState = {
  mainTab: 'actions',
  settingsTab: 'scrape',
};

export const DEFAULT_PERSISTED_STATE: PersistedState = {
  version: 2,
  scrape: DEFAULT_SCRAPE_OPTIONS,
  uniqueness: DEFAULT_UNIQUENESS_OPTIONS,
  popout: DEFAULT_POPOUT_OPTIONS,
  theme: DEFAULT_THEME_OPTIONS,
  ui: DEFAULT_UI_STATE,
};

export const PURCHASE_ID_BLANK_MATCHERS: Array<string | RegExp> = [
  /no purchase\(s\) found\.?/i,
];

export const STOCK_NUMBER_BLANK_MATCHERS: Array<string | RegExp> = [
  // e.g. /^no stock number$/i,
];

export const VIN_BLANK_MATCHERS: Array<string | RegExp> = [
  // e.g. /^no vin$/i,
];

export const STYLE_ID = 'carma-bulk-search-scraper-styles';

export const STYLE_TEXT = `
  .cbss-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:999999;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:20px;}
  .cbss-modal{background:var(--cbss-surface,#fff);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.25);width:min(1200px,96vw);max-height:94vh;display:flex;flex-direction:column;}
  .cbss-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--cbss-border,#e6e8ef);gap:8px;}
  .cbss-title{font-size:18px;font-weight:800;color:var(--cbss-accent,#183558);}
  .cbss-close{border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:var(--cbss-accent,#183558);padding:4px 8px;border-radius:8px;transition:transform .05s ease, background-color .12s ease;}

  .cbss-body{display:flex;gap:16px;padding:16px;overflow:hidden;flex:1 1 auto;min-height:0;}
  .cbss-left{flex:1 1 60%;min-width:320px;min-height:0;display:flex;flex-direction:column;}
  .cbss-right{flex:0 0 420px;min-height:0;overflow:auto;}

  .cbss-label{font-weight:800;color:var(--cbss-accent,#183558);margin-bottom:6px;display:block;}
  .cbss-textarea{width:100%;flex:1 1 auto;height:auto;min-height:140px;border:1px solid var(--cbss-border,#cfd6e4);border-radius:8px;padding:10px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:12px;resize:vertical;background:var(--cbss-surface,#fff);color:var(--cbss-text,#0f172a);}
  .cbss-hint{margin-top:8px;color:var(--cbss-text-muted,#5a6b85);font-size:12px;line-height:1.35;}

  .cbss-card{border:1px solid var(--cbss-border,#dbe2ef);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--cbss-surface,#fff);}
  .cbss-card h4{margin:0;font-size:14px;color:var(--cbss-accent,#183558);}
  .cbss-row{display:flex;align-items:center;gap:8px;margin:4px 0;}
  .cbss-row label{display:flex;align-items:center;gap:8px;color:var(--cbss-tab-text,#183558);font-size:13px;}
  .cbss-row input[type="checkbox"]{transform:translateY(1px);}
  .cbss-number{width:88px;border:1px solid var(--cbss-border,#cfd6e4);border-radius:8px;padding:4px 8px;font-size:13px;background:var(--cbss-surface,#fff);color:var(--cbss-text,#0f172a);}
  .cbss-select{width:100%;border:1px solid var(--cbss-border,#cfd6e4);border-radius:8px;padding:6px 10px;font-size:13px;background:var(--cbss-surface,#fff);color:var(--cbss-text,#0f172a);}
  .cbss-text{width:100%;border:1px solid var(--cbss-border,#cfd6e4);border-radius:8px;padding:6px 10px;font-size:13px;background:var(--cbss-surface,#fff);color:var(--cbss-text,#0f172a);}

  .cbss-actions-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:6px;}
  .cbss-actions-section{border:1px solid var(--cbss-border,#dbe2ef);border-radius:10px;padding:10px;background:var(--cbss-surface-alt,#f8fafc);display:flex;flex-direction:column;gap:8px;min-width:0;}
  .cbss-actions-title{font-size:12px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;color:var(--cbss-tab-text,#345072);}
  .cbss-actions{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));}

  .cbss-btn{border:1px solid var(--cbss-border,#cfd6e4);border-radius:10px;background:var(--cbss-button-bg,#fff);color:var(--cbss-button-text,#0f172a);padding:8px 12px;font-weight:800;cursor:pointer;transition:transform .05s ease, background-color .12s ease, box-shadow .12s ease, opacity .12s ease, color .12s ease;}
  .cbss-btn:hover{background:var(--cbss-button-hover,#f8fafc);box-shadow:0 1px 10px rgba(15,23,42,.06);}
  .cbss-btn:active{transform:translateY(1px);background:var(--cbss-button-active,#eef2f7);}
  .cbss-btn:focus-visible{outline:2px solid var(--cbss-focus-ring,#2563eb);outline-offset:2px;}
  .cbss-btn:disabled{opacity:.5;cursor:not-allowed;box-shadow:none;transform:none;}
  .cbss-btn.cbss-clicked{animation:cbss-click-pulse .22s ease-out;background:var(--cbss-surface-muted,#e7edf8);box-shadow:0 0 0 3px color-mix(in srgb, var(--cbss-focus-ring,#2563eb) 35%, transparent);}

  .cbss-btn-primary{background:var(--cbss-primary,#16a34a);border-color:var(--cbss-primary,#16a34a);color:var(--cbss-primary-text,#fff);}
  .cbss-btn-primary:hover{background:var(--cbss-primary-hover,#15803d);border-color:var(--cbss-primary-hover,#15803d);filter:none;box-shadow:0 2px 14px rgba(22,163,74,.28);}
  .cbss-btn-primary:active{background:var(--cbss-primary-active,#166534);border-color:var(--cbss-primary-active,#166534);}
  .cbss-btn-primary.cbss-clicked{background:var(--cbss-primary-hover,#15803d);box-shadow:0 0 0 3px color-mix(in srgb, var(--cbss-primary,#16a34a) 28%, transparent);}

  .cbss-btn-secondary{background:var(--cbss-secondary,#f3f4f6);color:var(--cbss-secondary-text,#111827);border-color:var(--cbss-border,#d1d5db);}
  .cbss-btn-secondary:hover{background:var(--cbss-secondary-hover,#e5e7eb);}
  .cbss-btn-secondary:active{background:var(--cbss-secondary-active,#d1d5db);}

  .cbss-close:hover{background:color-mix(in srgb, var(--cbss-accent,#183558) 10%, transparent);}
  .cbss-close:active{transform:translateY(1px);}
  .cbss-close:focus-visible{outline:2px solid var(--cbss-focus-ring,#2563eb);outline-offset:2px;}
  .cbss-close.cbss-clicked{animation:cbss-click-pulse .22s ease-out;background:color-mix(in srgb, var(--cbss-focus-ring,#2563eb) 20%, transparent);}

  .cbss-tabs{display:flex;gap:6px;background:var(--cbss-tab-bg,#f1f5f9);border-radius:12px;padding:4px;}
  .cbss-tab{flex:1;border:0;background:transparent;color:var(--cbss-tab-text,#183558);padding:8px 10px;border-radius:10px;font-weight:900;cursor:pointer;opacity:.72;transition:opacity .12s ease, background-color .12s ease, transform .05s ease;}
  .cbss-tab:hover{opacity:.95;background:color-mix(in srgb, var(--cbss-tab-text,#183558) 8%, transparent);}
  .cbss-tab:active{transform:translateY(1px);}
  .cbss-tab.active{opacity:1;background:var(--cbss-tab-active-bg,#fff);box-shadow:0 1px 10px rgba(15,23,42,.08);}
  .cbss-tab:focus-visible{outline:2px solid var(--cbss-focus-ring,#2563eb);outline-offset:2px;}
  .cbss-tab.cbss-clicked{animation:cbss-click-pulse .22s ease-out;background:color-mix(in srgb, var(--cbss-focus-ring,#2563eb) 25%, transparent);}

  .cbss-main-panels{position:relative;min-height:370px;}
  .cbss-main-panel{position:absolute;inset:0;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(4px);transition:opacity .14s ease, transform .14s ease;}
  .cbss-main-panel.active{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0);}

  .cbss-settings-panels{position:relative;min-height:300px;}
  .cbss-settings-panel{position:absolute;inset:0;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(4px);transition:opacity .14s ease, transform .14s ease;overflow:auto;padding-right:2px;}
  .cbss-settings-panel.active{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0);}

  .cbss-theme-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;}
  .cbss-theme-grid label{display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--cbss-tab-text,#183558);font-size:12px;}

  .cbss-status-wrap{padding:0 16px 16px 16px;display:flex;flex-direction:column;min-height:0;}
  .cbss-status-title{font-weight:800;color:var(--cbss-accent,#183558);margin:8px 0 6px 0;}
  .cbss-status{background:var(--cbss-status-bg,#0b1220);color:var(--cbss-status-text,#e5e7eb);border-radius:10px;padding:12px;height:clamp(150px,24vh,340px);overflow:auto;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:12px;white-space:pre-wrap;}

  .cbss-fab{position:fixed;right:16px;bottom:16px;z-index:999998;border-radius:999px;background:var(--cbss-accent,#183558);color:var(--cbss-primary-text,#fff);border:0;padding:10px 14px;font-weight:900;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);transition:transform .08s ease, box-shadow .12s ease, filter .12s ease;}
  .cbss-fab:hover{filter:brightness(1.05);box-shadow:0 10px 22px rgba(0,0,0,.28);}
  .cbss-fab:active{transform:translateY(1px);}
  .cbss-fab:focus-visible{outline:2px solid var(--cbss-focus-ring,#2563eb);outline-offset:2px;}
  .cbss-fab.cbss-clicked{animation:cbss-click-pulse .22s ease-out;box-shadow:0 0 0 4px color-mix(in srgb, var(--cbss-accent,#183558) 30%, transparent),0 8px 20px rgba(0,0,0,.26);}

  .cbss-small{font-size:12px;color:var(--cbss-text-muted,#5a6b85);}
  .cbss-iframe-host{position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;}
  .cbss-iframe{width:1px;height:1px;border:0;visibility:hidden;}

  @keyframes cbss-click-pulse{
    0%{transform:translateY(0) scale(1);}
    35%{transform:translateY(1px) scale(.98);}
    100%{transform:translateY(0) scale(1);}
  }

  @media (max-width:980px){
    .cbss-actions-grid{grid-template-columns:1fr;}
    .cbss-main-panels{min-height:420px;}
    .cbss-settings-panels{min-height:340px;}
    .cbss-theme-grid{grid-template-columns:1fr;}
  }

  @media (max-width:900px){
    .cbss-overlay{padding:12px;}
    .cbss-body{flex-direction:column;gap:12px;padding:12px;}
    .cbss-left{min-width:0;flex:0 0 auto;}
    .cbss-right{flex:1 1 auto;width:100%;max-height:52vh;}
    .cbss-modal{max-height:96vh;}
  }

  @media (max-width:640px){
    .cbss-overlay{align-items:stretch;padding:8px;}
    .cbss-modal{max-height:100vh;height:100%;}
    .cbss-header{padding:10px 12px;}
    .cbss-body{padding:10px;gap:10px;}
    .cbss-status-wrap{padding:0 10px 10px 10px;}
    .cbss-status{height:clamp(120px,22vh,220px);}
    .cbss-right{max-height:46vh;}
  }
`;
