export type ColumnMode = 'all' | 'none' | 'key';

export type RowValue = string | number;
export type ScrapedRow = Record<string, RowValue>;

export interface ScrapeOptions {
  paginateAllPages: boolean;
  setShowTo100: boolean;
  columnMode: ColumnMode;
  requirePurchaseId: boolean;
  requireVin: boolean;
  requireStockNumber: boolean;
  debug: boolean;
  maxConcurrency: number;
}

export type UniqueStrategy = 'latest_by_date' | 'first_seen' | 'last_seen';

export interface UniquenessKeyFields {
  vin: boolean;
  stock: boolean;
  pid: boolean;
}

export interface DateColumnSetting {
  mode: 'auto' | 'manual';
  header: string;
}

export interface UniquenessOptions {
  enabled: boolean;
  keyFields: UniquenessKeyFields;
  strategy: UniqueStrategy;
  dateColumn: DateColumnSetting;
}

export interface PopoutOptions {
  copyIncludeHeaders: boolean;
  persistSelectedColumns: boolean;
  selectedColumnsByName: string[];
}

export interface ThemeOptions {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryText: string;
  secondary: string;
  secondaryHover: string;
  secondaryActive: string;
  secondaryText: string;
  surface: string;
  surfaceAlt: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  focusRing: string;
  statusBg: string;
  statusText: string;
  tabBg: string;
  tabActiveBg: string;
  tabText: string;
  buttonBg: string;
  buttonHoverBg: string;
  buttonActiveBg: string;
  buttonText: string;
  accent: string;
}

export type MainTab = 'actions' | 'settings';
export type SettingsTab = 'scrape' | 'uniqueness' | 'popout' | 'theme';

export interface UiState {
  mainTab: MainTab;
  settingsTab: SettingsTab;
}

export interface PersistedState {
  version: 2;
  scrape: ScrapeOptions;
  uniqueness: UniquenessOptions;
  popout: PopoutOptions;
  theme: ThemeOptions;
  ui: UiState;
}

export interface TermInfo {
  term: string;
  encoded: string;
  url: string;
}

export interface BlockInfo {
  block: Element;
  table: HTMLTableElement;
  rawTitle: string;
}

export interface AppState {
  running: boolean;
  abort: boolean;
  rows: ScrapedRow[];
  lastCsv: string;
  lastJson: string;
  uniqueIndex: Map<string, { index: number; ts: number | null }>;
}

export interface AppUi {
  overlay: HTMLDivElement;
  terms: HTMLTextAreaElement;

  // Scrape settings
  paginate: HTMLInputElement;
  show100: HTMLInputElement;
  columns: HTMLSelectElement;
  maxConcurrency: HTMLInputElement;
  requirePurchaseId: HTMLInputElement;
  requireVin: HTMLInputElement;
  requireStockNumber: HTMLInputElement;
  debug: HTMLInputElement;

  // Uniqueness settings
  uniqueEnabled: HTMLInputElement;
  uniqueKeyVin: HTMLInputElement;
  uniqueKeyStock: HTMLInputElement;
  uniqueKeyPid: HTMLInputElement;
  uniqueDateMode: HTMLSelectElement;
  uniqueDateHeader: HTMLInputElement;

  // Popout settings
  popoutIncludeHeaders: HTMLInputElement;
  popoutPersistSelectedColumns: HTMLInputElement;

  // Theme settings
  themeInputs: Record<keyof ThemeOptions, HTMLInputElement>;

  // Actions
  start: HTMLButtonElement;
  cancel: HTMLButtonElement;
  status: HTMLPreElement;
  iframeHost: HTMLDivElement;
  popout: HTMLButtonElement;
  copyStock: HTMLButtonElement;
  copyVin: HTMLButtonElement;
  copyPid: HTMLButtonElement;
  copyReference: HTMLButtonElement;
}

export interface PaginationInfo {
  input: HTMLInputElement | null;
  current: number;
  total: number;
  pagerTextEl?: HTMLElement;
}

export interface PaginationButtons {
  first: HTMLButtonElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  last: HTMLButtonElement;
}
