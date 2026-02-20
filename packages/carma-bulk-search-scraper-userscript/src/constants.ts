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
  maxConcurrency: 1,
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
  .cbss-modal{background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.25);width:min(1200px,96vw);max-height:94vh;display:flex;flex-direction:column;}
  .cbss-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e6e8ef;gap:8px;}
  .cbss-title{font-size:18px;font-weight:700;color:#183558;}
  .cbss-close{border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#183558;padding:4px 8px;}

  .cbss-body{display:flex;gap:16px;padding:16px;overflow:hidden;flex:1 1 auto;min-height:0;}
  .cbss-left{flex:1 1 60%;min-width:320px;min-height:0;display:flex;flex-direction:column;}
  .cbss-right{flex:0 0 380px;min-height:0;overflow:auto;}

  .cbss-label{font-weight:700;color:#183558;margin-bottom:6px;display:block;}
  .cbss-textarea{width:100%;height:clamp(150px,28vh,320px);min-height:140px;border:1px solid #cfd6e4;border-radius:8px;padding:10px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:12px;resize:vertical;}
  .cbss-hint{margin-top:8px;color:#5a6b85;font-size:12px;line-height:1.35;}

  .cbss-card{border:1px solid #dbe2ef;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;}
  .cbss-card h4{margin:0;font-size:14px;color:#183558;}
  .cbss-row{display:flex;align-items:center;gap:8px;margin:4px 0;}
  .cbss-row label{display:flex;align-items:center;gap:8px;color:#183558;font-size:13px;}
  .cbss-row input[type="checkbox"]{transform:translateY(1px);}
  .cbss-number{width:88px;border:1px solid #cfd6e4;border-radius:8px;padding:4px 8px;font-size:13px;}
  .cbss-select{width:100%;border:1px solid #cfd6e4;border-radius:8px;padding:6px 10px;font-size:13px;background:#fff;}

  .cbss-actions-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:6px;}
  .cbss-actions-section{border:1px solid #dbe2ef;border-radius:10px;padding:10px;background:#f8fafc;display:flex;flex-direction:column;gap:8px;min-width:0;}
  .cbss-actions-title{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#345072;}
  .cbss-actions{display:flex;gap:8px;flex-wrap:wrap;}
  .cbss-btn{border:1px solid #cfd6e4;border-radius:10px;background:#fff;padding:8px 12px;font-weight:700;cursor:pointer;}
  .cbss-btn:disabled{opacity:.5;cursor:not-allowed;}
  .cbss-btn-primary{background:#16a34a;border-color:#16a34a;color:#fff;}
  .cbss-btn-secondary{background:#f3f4f6;color:#111827;border-color:#d1d5db;}

  .cbss-status-wrap{padding:0 16px 16px 16px;display:flex;flex-direction:column;min-height:0;}
  .cbss-status-title{font-weight:700;color:#183558;margin:8px 0 6px 0;}
  .cbss-status{background:#0b1220;color:#e5e7eb;border-radius:10px;padding:12px;height:clamp(150px,24vh,340px);overflow:auto;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:12px;white-space:pre-wrap;}

  .cbss-fab{position:fixed;right:16px;bottom:16px;z-index:999998;border-radius:999px;background:#183558;color:#fff;border:0;padding:10px 14px;font-weight:800;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);} 
  .cbss-small{font-size:12px;color:#5a6b85;}
  .cbss-iframe-host{position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;}
  .cbss-iframe{width:1px;height:1px;border:0;visibility:hidden;}

  @media (max-width: 1080px){
    .cbss-actions-grid{grid-template-columns:1fr;}
  }

  @media (max-width: 980px){
    .cbss-overlay{padding:12px;}
    .cbss-body{flex-direction:column;gap:12px;padding:12px;}
    .cbss-left{min-width:0;flex:0 0 auto;}
    .cbss-right{flex:1 1 auto;width:100%;max-height:48vh;}
    .cbss-modal{max-height:96vh;}
  }

  @media (max-height: 760px){
    .cbss-overlay{align-items:stretch;padding:8px;}
    .cbss-modal{max-height:100vh;height:100%;}
    .cbss-header{padding:10px 12px;}
    .cbss-body{padding:10px;gap:10px;}
    .cbss-status-wrap{padding:0 10px 10px 10px;}
    .cbss-status{height:clamp(120px,22vh,220px);}
    .cbss-right{max-height:42vh;}
  }
`;
