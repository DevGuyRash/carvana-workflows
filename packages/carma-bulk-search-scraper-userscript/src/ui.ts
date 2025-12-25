import { BASE_SEARCH_URL, STYLE_ID, STYLE_TEXT } from './constants';
import { el } from './dom';
import type { AppUi, Options } from './types';

export interface UiHandlers {
  onStart: () => void;
  onCancel: () => void;
  onDownloadCsv: () => void;
  onCopyCsv: () => void | Promise<void>;
  onDownloadJson: () => void;
  onCopyJson: () => void | Promise<void>;
  onOptionsChange: (opts: Options) => void;
  onClose: () => void;
}

function addStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = el('style', { id: STYLE_ID });
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}

function readOptionsFromUi(inputs: {
  paginate: HTMLInputElement;
  show100: HTMLInputElement;
  columns: HTMLSelectElement;
  maxConcurrency: HTMLInputElement;
  requirePurchaseId: HTMLInputElement;
  requireVin: HTMLInputElement;
  requireStockNumber: HTMLInputElement;
  debug: HTMLInputElement;
}): Options {
  const parsedConcurrency = Number.parseInt(inputs.maxConcurrency.value, 10);
  return {
    paginateAllPages: !!inputs.paginate.checked,
    setShowTo100: !!inputs.show100.checked,
    columnMode: inputs.columns.value as Options['columnMode'],
    requirePurchaseId: !!inputs.requirePurchaseId.checked,
    requireVin: !!inputs.requireVin.checked,
    requireStockNumber: !!inputs.requireStockNumber.checked,
    debug: !!inputs.debug.checked,
    maxConcurrency: Number.isFinite(parsedConcurrency) && parsedConcurrency > 0 ? parsedConcurrency : 1,
  };
}

export function createUi(options: Options, handlers: UiHandlers): AppUi {
  addStyles();

  const overlay = el('div', { class: 'cbss-overlay', id: 'cbss-overlay' });
  const modal = el('div', { class: 'cbss-modal' });

  const header = el('div', { class: 'cbss-header' }, [
    el('div', { class: 'cbss-title' }, 'Carma Bulk Search Scraper'),
    el('button', { class: 'cbss-close', title: 'Close', onclick: handlers.onClose }, 'x'),
  ]);

  const body = el('div', { class: 'cbss-body' });

  const left = el('div', { class: 'cbss-left' });
  const termsLabel = el('label', { class: 'cbss-label' }, 'Search terms (one per line)');
  const terms = el('textarea', { class: 'cbss-textarea', placeholder: '2004200036\nJohn Doe\njohn.doe@example.com\n5551234567' });
  const hint = el('div', { class: 'cbss-hint' }, [
    el('div', {}, [
      'Each line becomes: ',
      el('code', {}, `${BASE_SEARCH_URL}<encoded term>`),
    ]),
    el('div', {}, [
      'Tip: you can paste full URLs too; the script will extract the term after ',
      el('code', {}, '/research/search/'),
      '.',
    ]),
  ]);

  left.appendChild(termsLabel);
  left.appendChild(terms);
  left.appendChild(hint);

  const right = el('div', { class: 'cbss-right' });
  const card = el('div', { class: 'cbss-card' });

  const optionsTitle = el('h4', {}, 'Options');

  const paginate = el('input', { type: 'checkbox', id: 'cbss-paginate' }) as HTMLInputElement;
  const show100 = el('input', { type: 'checkbox', id: 'cbss-show100' }) as HTMLInputElement;
  const maxConcurrency = el('input', {
    type: 'number',
    id: 'cbss-maxConcurrency',
    class: 'cbss-number',
    min: '1',
    max: '8',
    step: '1',
  }) as HTMLInputElement;
  const debug = el('input', { type: 'checkbox', id: 'cbss-debug' }) as HTMLInputElement;

  const columns = el('select', { class: 'cbss-select', id: 'cbss-columns' }, [
    el('option', { value: 'all' }, 'Enable ALL columns'),
    el('option', { value: 'key' }, 'Enable key columns (Purchase ID / VIN / Stock Number)'),
    el('option', { value: 'none' }, 'Leave columns unchanged'),
  ]) as HTMLSelectElement;

  const rowFiltersTitle = el('h4', { style: 'margin-top:12px;' }, 'Row filters (if checked, the column must be non-empty)');

  const requirePurchaseId = el('input', { type: 'checkbox', id: 'cbss-requirePurchaseId' }) as HTMLInputElement;
  const requireVin = el('input', { type: 'checkbox', id: 'cbss-requireVin' }) as HTMLInputElement;
  const requireStockNumber = el('input', { type: 'checkbox', id: 'cbss-requireStockNumber' }) as HTMLInputElement;

  const start = el('button', { class: 'cbss-btn cbss-btn-primary', onclick: handlers.onStart }, 'Start') as HTMLButtonElement;
  const cancel = el('button', {
    class: 'cbss-btn cbss-btn-secondary',
    disabled: true,
    onclick: handlers.onCancel,
  }, 'Cancel') as HTMLButtonElement;

  const downloadCsv = el('button', { class: 'cbss-btn', onclick: handlers.onDownloadCsv }, 'Download CSV');
  const copyCsv = el('button', { class: 'cbss-btn', onclick: handlers.onCopyCsv }, 'Copy CSV');
  const downloadJson = el('button', { class: 'cbss-btn', onclick: handlers.onDownloadJson }, 'Download JSON');
  const copyJson = el('button', { class: 'cbss-btn', onclick: handlers.onCopyJson }, 'Copy JSON');

  const actions = el('div', { class: 'cbss-actions' }, [start, cancel]);
  const exports = el('div', { class: 'cbss-actions' }, [downloadCsv, copyCsv, downloadJson, copyJson]);

  card.appendChild(optionsTitle);
  card.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [paginate, ' Paginate through all pages']),
  ]));
  card.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [show100, ' Set page size to ', el('strong', {}, 'Show 100')]),
  ]));
  card.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [' Parallel workers ', maxConcurrency]),
  ]));
  card.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [debug, ' Debug mode (verbose)']),
  ]));

  card.appendChild(el('div', { class: 'cbss-row', style: 'margin-top:8px;align-items:flex-start;' }, [
    el('div', { style: 'flex:0 0 70px;font-weight:700;color:#183558;padding-top:6px;' }, 'Columns:'),
    el('div', { style: 'flex:1;' }, [columns]),
  ]));

  card.appendChild(rowFiltersTitle);
  card.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [requirePurchaseId, ' Purchase ID']),
    el('label', { style: 'margin-left:10px;' }, [requireVin, ' VIN']),
    el('label', { style: 'margin-left:10px;' }, [requireStockNumber, ' Stock Number']),
  ]));

  card.appendChild(actions);
  card.appendChild(exports);

  right.appendChild(card);

  body.appendChild(left);
  body.appendChild(right);

  const statusWrap = el('div', { class: 'cbss-status-wrap' });
  const statusTitle = el('div', { class: 'cbss-status-title' }, 'Status');
  const status = el('pre', { class: 'cbss-status' }) as HTMLPreElement;
  statusWrap.appendChild(statusTitle);
  statusWrap.appendChild(status);

  const iframeHost = el('div', { class: 'cbss-iframe-host' }) as HTMLDivElement;

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(statusWrap);
  modal.appendChild(iframeHost);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  paginate.checked = !!options.paginateAllPages;
  show100.checked = !!options.setShowTo100;
  columns.value = options.columnMode || 'all';
  maxConcurrency.value = String(options.maxConcurrency || 1);
  requirePurchaseId.checked = !!options.requirePurchaseId;
  requireVin.checked = !!options.requireVin;
  requireStockNumber.checked = !!options.requireStockNumber;
  debug.checked = !!options.debug;

  const inputs = {
    paginate,
    show100,
    columns,
    maxConcurrency,
    requirePurchaseId,
    requireVin,
    requireStockNumber,
    debug,
  };
  const notifyOptions = () => handlers.onOptionsChange(readOptionsFromUi(inputs));
  [paginate, show100, columns, maxConcurrency, requirePurchaseId, requireVin, requireStockNumber, debug].forEach((input) => {
    input.addEventListener('change', notifyOptions);
  });

  return {
    overlay,
    terms,
    paginate,
    show100,
    columns,
    maxConcurrency,
    requirePurchaseId,
    requireVin,
    requireStockNumber,
    debug,
    start,
    cancel,
    status,
    iframeHost,
  };
}

export function openModal(ui: AppUi): void {
  ui.overlay.style.display = 'flex';
}

export function closeModal(ui: AppUi): void {
  ui.overlay.style.display = 'none';
}

export function installFab(onOpen: () => void): void {
  if (document.getElementById('cbss-fab')) return;
  const btn = el('button', {
    class: 'cbss-fab',
    id: 'cbss-fab',
    title: 'Open Carma Bulk Search Scraper',
    onclick: onOpen,
  }, 'Bulk Search');
  document.body.appendChild(btn);
}
