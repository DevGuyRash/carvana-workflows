import type { Options } from './types';

export const LS_KEY = 'carmaBulkSearchScraper.options.v1';
export const BASE_SEARCH_URL = 'https://carma.cvnacorp.com/research/search/';

export const DEFAULTS: Options = {
  paginateAllPages: true,
  setShowTo100: true,
  columnMode: 'all',
  requirePurchaseId: false,
  requireVin: false,
  requireStockNumber: false,
  debug: false,
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
  .cbss-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:999999;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:24px;}
  .cbss-modal{background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.25);width:min(1200px,96vw);max-height:90vh;display:flex;flex-direction:column;}
  .cbss-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e6e8ef;}
  .cbss-title{font-size:18px;font-weight:700;color:#183558;}
  .cbss-close{border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#183558;padding:4px 8px;}
  .cbss-body{display:flex;gap:16px;padding:16px;overflow:auto;}
  .cbss-left{flex:1 1 65%;min-width:420px;}
  .cbss-right{flex:0 0 360px;}
  .cbss-label{font-weight:700;color:#183558;margin-bottom:6px;display:block;}
  .cbss-textarea{width:100%;min-height:190px;border:1px solid #cfd6e4;border-radius:8px;padding:10px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:12px;resize:vertical;}
  .cbss-hint{margin-top:8px;color:#5a6b85;font-size:12px;line-height:1.35;}
  .cbss-card{border:1px solid #dbe2ef;border-radius:10px;padding:14px;}
  .cbss-card h4{margin:0 0 10px 0;font-size:14px;color:#183558;}
  .cbss-row{display:flex;align-items:center;gap:8px;margin:6px 0;}
  .cbss-row label{display:flex;align-items:center;gap:8px;color:#183558;font-size:13px;}
  .cbss-row input[type="checkbox"]{transform:translateY(1px);}
  .cbss-select{width:100%;border:1px solid #cfd6e4;border-radius:8px;padding:6px 10px;font-size:13px;background:#fff;}
  .cbss-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
  .cbss-btn{border:1px solid #cfd6e4;border-radius:10px;background:#fff;padding:8px 12px;font-weight:700;cursor:pointer;}
  .cbss-btn:disabled{opacity:.5;cursor:not-allowed;}
  .cbss-btn-primary{background:#16a34a;border-color:#16a34a;color:#fff;}
  .cbss-btn-secondary{background:#f3f4f6;color:#111827;border-color:#d1d5db;}
  .cbss-status-wrap{padding:0 16px 16px 16px;}
  .cbss-status-title{font-weight:700;color:#183558;margin:10px 0 6px 0;}
  .cbss-status{background:#0b1220;color:#e5e7eb;border-radius:10px;padding:12px;min-height:190px;max-height:340px;overflow:auto;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:12px;white-space:pre-wrap;}
  .cbss-fab{position:fixed;right:16px;bottom:16px;z-index:999998;border-radius:999px;background:#183558;color:#fff;border:0;padding:10px 14px;font-weight:800;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);} 
  .cbss-small{font-size:12px;color:#5a6b85;}
`;
