export type ColumnMode = 'all' | 'none' | 'key';

export type RowValue = string | number;
export type ScrapedRow = Record<string, RowValue>;

export interface Options {
  paginateAllPages: boolean;
  setShowTo100: boolean;
  columnMode: ColumnMode;
  requirePurchaseId: boolean;
  requireVin: boolean;
  requireStockNumber: boolean;
  debug: boolean;
  maxConcurrency: number;
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
}

export interface AppUi {
  overlay: HTMLDivElement;
  terms: HTMLTextAreaElement;
  paginate: HTMLInputElement;
  show100: HTMLInputElement;
  columns: HTMLSelectElement;
  maxConcurrency: HTMLInputElement;
  requirePurchaseId: HTMLInputElement;
  requireVin: HTMLInputElement;
  requireStockNumber: HTMLInputElement;
  debug: HTMLInputElement;
  start: HTMLButtonElement;
  cancel: HTMLButtonElement;
  status: HTMLPreElement;
  iframeHost: HTMLDivElement;
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
