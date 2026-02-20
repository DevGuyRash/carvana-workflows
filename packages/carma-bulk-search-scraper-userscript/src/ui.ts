import { BASE_SEARCH_URL, STYLE_ID, STYLE_TEXT } from './constants';
import { el } from './dom';
import type { AppUi, PersistedState, PopoutOptions, ScrapeOptions, ThemeOptions, UiState, UniquenessOptions } from './types';

export interface UiHandlers {
  onStart: () => void;
  onCancel: () => void;
  onDownloadCsv: () => void;
  onCopyCsv: () => void | Promise<void>;
  onDownloadJson: () => void;
  onCopyJson: () => void | Promise<void>;
  onPopoutTable: () => void;
  onCopyStock: () => void | Promise<void>;
  onCopyVin: () => void | Promise<void>;
  onCopyPid: () => void | Promise<void>;
  onCopyReference: () => void | Promise<void>;

  onScrapeOptionsChange: (opts: ScrapeOptions) => void;
  onUniquenessOptionsChange: (opts: UniquenessOptions) => void;
  onPopoutOptionsChange: (opts: PopoutOptions) => void;
  onThemeOptionsChange: (opts: ThemeOptions) => void;
  onUiStateChange: (state: UiState) => void;

  onClose: () => void;
}

function addStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = el('style', { id: STYLE_ID });
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}

function readScrapeOptionsFromUi(inputs: {
  paginate: HTMLInputElement;
  show100: HTMLInputElement;
  columns: HTMLSelectElement;
  maxConcurrency: HTMLInputElement;
  requirePurchaseId: HTMLInputElement;
  requireVin: HTMLInputElement;
  requireStockNumber: HTMLInputElement;
  debug: HTMLInputElement;
}): ScrapeOptions {
  const parsedConcurrency = Number.parseInt(inputs.maxConcurrency.value, 10);
  return {
    paginateAllPages: !!inputs.paginate.checked,
    setShowTo100: !!inputs.show100.checked,
    columnMode: inputs.columns.value as ScrapeOptions['columnMode'],
    requirePurchaseId: !!inputs.requirePurchaseId.checked,
    requireVin: !!inputs.requireVin.checked,
    requireStockNumber: !!inputs.requireStockNumber.checked,
    debug: !!inputs.debug.checked,
    maxConcurrency: Number.isFinite(parsedConcurrency) && parsedConcurrency > 0 ? parsedConcurrency : 1,
  };
}

function readUniquenessOptionsFromUi(inputs: {
  enabled: HTMLInputElement;
  keyVin: HTMLInputElement;
  keyStock: HTMLInputElement;
  keyPid: HTMLInputElement;
  dateMode: HTMLSelectElement;
  dateHeader: HTMLInputElement;
}): UniquenessOptions {
  return {
    enabled: !!inputs.enabled.checked,
    keyFields: {
      vin: !!inputs.keyVin.checked,
      stock: !!inputs.keyStock.checked,
      pid: !!inputs.keyPid.checked,
    },
    strategy: 'latest_by_date',
    dateColumn: {
      mode: inputs.dateMode.value === 'manual' ? 'manual' : 'auto',
      header: inputs.dateHeader.value || '',
    },
  };
}

function readPopoutOptionsFromUi(inputs: {
  includeHeaders: HTMLInputElement;
  persistSelectedColumns: HTMLInputElement;
}): PopoutOptions {
  return {
    copyIncludeHeaders: !!inputs.includeHeaders.checked,
    persistSelectedColumns: !!inputs.persistSelectedColumns.checked,
    selectedColumnsByName: [],
  };
}

function readThemeOptionsFromUi(inputs: {
  primary: HTMLInputElement;
  accent: HTMLInputElement;
}): ThemeOptions {
  return {
    primary: inputs.primary.value || '#16a34a',
    accent: inputs.accent.value || '#183558',
  };
}

function createActionSection(title: string, buttons: HTMLElement[]): HTMLDivElement {
  const section = el('div', { class: 'cbss-actions-section' }) as HTMLDivElement;
  section.appendChild(el('div', { class: 'cbss-actions-title' }, title));
  section.appendChild(el('div', { class: 'cbss-actions' }, buttons));
  return section;
}

function setTabActive(buttons: HTMLButtonElement[], activeKey: string, attr: string): void {
  for (const btn of buttons) {
    const key = btn.getAttribute(attr) || '';
    btn.classList.toggle('active', key === activeKey);
  }
}

function addButtonClickFeedback(button: HTMLButtonElement, hostWindow: Window): void {
  if (button.disabled) return;
  button.classList.remove('cbss-clicked');
  void button.getBoundingClientRect();
  button.classList.add('cbss-clicked');
  hostWindow.setTimeout(() => {
    button.classList.remove('cbss-clicked');
  }, 220);
}

export function createUi(persisted: PersistedState, handlers: UiHandlers): AppUi {
  addStyles();

  const overlay = el('div', { class: 'cbss-overlay', id: 'cbss-overlay' }) as HTMLDivElement;
  const modal = el('div', { class: 'cbss-modal' }) as HTMLDivElement;

  const header = el('div', { class: 'cbss-header' }, [
    el('div', { class: 'cbss-title' }, 'Carma Bulk Search Scraper'),
    el('button', { class: 'cbss-close', title: 'Close', onclick: handlers.onClose }, 'x'),
  ]) as HTMLDivElement;

  const body = el('div', { class: 'cbss-body' }) as HTMLDivElement;

  const left = el('div', { class: 'cbss-left' }) as HTMLDivElement;
  const termsLabel = el('label', { class: 'cbss-label' }, 'Search terms (line, comma, semicolon, pipe, or tab separated)') as HTMLLabelElement;
  const terms = el('textarea', { class: 'cbss-textarea', placeholder: 'STOCK_NUMBER\nCUSTOMER_NAME\nEMAIL_ADDRESS\nPHONE_NUMBER' }) as HTMLTextAreaElement;
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
    el('div', { class: 'cbss-small', style: 'margin-top:6px;' }, 'Privacy note: search terms are not persisted in localStorage.'),
  ]) as HTMLDivElement;

  left.appendChild(termsLabel);
  left.appendChild(terms);
  left.appendChild(hint);

  const right = el('div', { class: 'cbss-right' }) as HTMLDivElement;
  const card = el('div', { class: 'cbss-card' }) as HTMLDivElement;

  const mainTabs = el('div', { class: 'cbss-tabs', style: 'margin-bottom:4px;' }) as HTMLDivElement;
  const tabActions = el('button', { class: 'cbss-tab', type: 'button', 'data-main-tab': 'actions' }, 'Actions') as HTMLButtonElement;
  const tabSettings = el('button', { class: 'cbss-tab', type: 'button', 'data-main-tab': 'settings' }, 'Settings') as HTMLButtonElement;
  mainTabs.appendChild(tabActions);
  mainTabs.appendChild(tabSettings);

  const actionsPanel = el('div', { id: 'cbss-actions-panel' }) as HTMLDivElement;
  const settingsPanel = el('div', { id: 'cbss-settings-panel' }) as HTMLDivElement;

  // --- Actions panel controls
  const start = el('button', { class: 'cbss-btn cbss-btn-primary', onclick: handlers.onStart }, 'Start') as HTMLButtonElement;
  const cancel = el('button', {
    class: 'cbss-btn cbss-btn-secondary',
    disabled: true,
    onclick: handlers.onCancel,
  }, 'Cancel') as HTMLButtonElement;

  const downloadCsv = el('button', { class: 'cbss-btn', onclick: handlers.onDownloadCsv }, 'Download CSV') as HTMLButtonElement;
  const copyCsv = el('button', { class: 'cbss-btn', onclick: handlers.onCopyCsv }, 'Copy CSV') as HTMLButtonElement;
  const downloadJson = el('button', { class: 'cbss-btn', onclick: handlers.onDownloadJson }, 'Download JSON') as HTMLButtonElement;
  const copyJson = el('button', { class: 'cbss-btn', onclick: handlers.onCopyJson }, 'Copy JSON') as HTMLButtonElement;

  const popoutTable = el('button', { class: 'cbss-btn', onclick: handlers.onPopoutTable }, 'Popout Table') as HTMLButtonElement;

  const copyStock = el('button', { class: 'cbss-btn', onclick: handlers.onCopyStock }, 'Copy Stock') as HTMLButtonElement;
  const copyVin = el('button', { class: 'cbss-btn', onclick: handlers.onCopyVin }, 'Copy VIN') as HTMLButtonElement;
  const copyPid = el('button', { class: 'cbss-btn', onclick: handlers.onCopyPid }, 'Copy PID') as HTMLButtonElement;
  const copyReference = el('button', { class: 'cbss-btn', onclick: handlers.onCopyReference }, 'Copy Reference') as HTMLButtonElement;

  const actionGrid = el('div', { class: 'cbss-actions-grid' }) as HTMLDivElement;
  actionGrid.appendChild(createActionSection('Run', [start, cancel]));
  actionGrid.appendChild(createActionSection('Export Data', [downloadCsv, copyCsv, downloadJson, copyJson]));
  actionGrid.appendChild(createActionSection('Quick Copy', [copyStock, copyVin, copyPid, copyReference]));
  actionGrid.appendChild(createActionSection('Table Tools', [popoutTable]));

  actionsPanel.appendChild(actionGrid);

  // --- Settings panel controls
  const settingsTabs = el('div', { class: 'cbss-tabs', style: 'margin-top:2px;' }) as HTMLDivElement;
  const tabScrape = el('button', { class: 'cbss-tab', type: 'button', 'data-settings-tab': 'scrape' }, 'Scrape') as HTMLButtonElement;
  const tabUnique = el('button', { class: 'cbss-tab', type: 'button', 'data-settings-tab': 'uniqueness' }, 'Uniqueness') as HTMLButtonElement;
  const tabPopout = el('button', { class: 'cbss-tab', type: 'button', 'data-settings-tab': 'popout' }, 'Popout') as HTMLButtonElement;
  const tabTheme = el('button', { class: 'cbss-tab', type: 'button', 'data-settings-tab': 'theme' }, 'Theme') as HTMLButtonElement;
  settingsTabs.appendChild(tabScrape);
  settingsTabs.appendChild(tabUnique);
  settingsTabs.appendChild(tabPopout);
  settingsTabs.appendChild(tabTheme);

  const settingsPanels = el('div', { class: 'cbss-settings-panels' }) as HTMLDivElement;

  const panelScrape = el('div', { class: 'cbss-settings-panel', 'data-settings-panel': 'scrape' }) as HTMLDivElement;
  const panelUnique = el('div', { class: 'cbss-settings-panel', 'data-settings-panel': 'uniqueness' }) as HTMLDivElement;
  const panelPopout = el('div', { class: 'cbss-settings-panel', 'data-settings-panel': 'popout' }) as HTMLDivElement;
  const panelTheme = el('div', { class: 'cbss-settings-panel', 'data-settings-panel': 'theme' }) as HTMLDivElement;

  // Scrape settings (existing)
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

  const requirePurchaseId = el('input', { type: 'checkbox', id: 'cbss-requirePurchaseId' }) as HTMLInputElement;
  const requireVin = el('input', { type: 'checkbox', id: 'cbss-requireVin' }) as HTMLInputElement;
  const requireStockNumber = el('input', { type: 'checkbox', id: 'cbss-requireStockNumber' }) as HTMLInputElement;

  panelScrape.appendChild(el('h4', {}, 'Scrape Options'));
  panelScrape.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [paginate, ' Paginate through all pages']),
  ]));
  panelScrape.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [show100, ' Set page size to ', el('strong', {}, 'Show 100')]),
  ]));
  panelScrape.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [' Parallel workers ', maxConcurrency]),
  ]));
  panelScrape.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [debug, ' Debug mode (verbose)']),
  ]));

  panelScrape.appendChild(el('div', { class: 'cbss-row', style: 'margin-top:8px;align-items:flex-start;' }, [
    el('div', { style: 'flex:0 0 70px;font-weight:800;color:var(--cbss-accent,#183558);padding-top:6px;' }, 'Columns:'),
    el('div', { style: 'flex:1;' }, [columns]),
  ]));

  panelScrape.appendChild(el('h4', { style: 'margin-top:10px;' }, 'Row filters (if checked, the column must be non-empty)'));
  panelScrape.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [requirePurchaseId, ' Purchase ID']),
    el('label', { style: 'margin-left:10px;' }, [requireVin, ' VIN']),
    el('label', { style: 'margin-left:10px;' }, [requireStockNumber, ' Stock Number']),
  ]));

  // Uniqueness settings
  const uniqueEnabled = el('input', { type: 'checkbox', id: 'cbss-unique-enabled' }) as HTMLInputElement;
  const uniqueKeyVin = el('input', { type: 'checkbox', id: 'cbss-unique-key-vin' }) as HTMLInputElement;
  const uniqueKeyStock = el('input', { type: 'checkbox', id: 'cbss-unique-key-stock' }) as HTMLInputElement;
  const uniqueKeyPid = el('input', { type: 'checkbox', id: 'cbss-unique-key-pid' }) as HTMLInputElement;

  const uniqueDateMode = el('select', { class: 'cbss-select', id: 'cbss-unique-date-mode' }, [
    el('option', { value: 'auto' }, 'Auto-detect (recommended)'),
    el('option', { value: 'manual' }, 'Manual header name'),
  ]) as HTMLSelectElement;

  const uniqueDateHeader = el('input', { class: 'cbss-text', id: 'cbss-unique-date-header', placeholder: 'e.g. Date' }) as HTMLInputElement;

  panelUnique.appendChild(el('h4', {}, 'Collect Unique Only'));
  panelUnique.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [uniqueEnabled, ' Only keep one row per unique key']),
  ]));
  panelUnique.appendChild(el('div', { class: 'cbss-row' }, [
    el('div', { style: 'font-weight:800;color:var(--cbss-accent,#183558);flex:0 0 120px;' }, 'Unique by:'),
    el('label', {}, [uniqueKeyVin, ' VIN']),
    el('label', { style: 'margin-left:10px;' }, [uniqueKeyStock, ' Stock']),
    el('label', { style: 'margin-left:10px;' }, [uniqueKeyPid, ' PID']),
  ]));
  panelUnique.appendChild(el('div', { class: 'cbss-row' }, [
    el('div', { style: 'font-weight:800;color:var(--cbss-accent,#183558);flex:0 0 120px;' }, 'Winner:'),
    el('div', { class: 'cbss-small' }, 'Latest by Date/Time column (fallback: last seen if missing)'),
  ]));
  panelUnique.appendChild(el('div', { class: 'cbss-row', style: 'align-items:flex-start;' }, [
    el('div', { style: 'font-weight:800;color:var(--cbss-accent,#183558);flex:0 0 120px;padding-top:6px;' }, 'Date column:'),
    el('div', { style: 'flex:1;' }, [
      uniqueDateMode,
      el('div', { style: 'margin-top:8px;' }, [uniqueDateHeader]),
      el('div', { class: 'cbss-small', style: 'margin-top:6px;' }, 'If manual, match the header text exactly.'),
    ]),
  ]));

  // Popout settings
  const popoutIncludeHeaders = el('input', { type: 'checkbox', id: 'cbss-popout-include-headers' }) as HTMLInputElement;
  const popoutPersistSelectedColumns = el('input', { type: 'checkbox', id: 'cbss-popout-persist-cols' }) as HTMLInputElement;

  panelPopout.appendChild(el('h4', {}, 'Popout Settings'));
  panelPopout.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [popoutIncludeHeaders, ' Include headers when copying (visible/selection)']),
  ]));
  panelPopout.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, [popoutPersistSelectedColumns, ' Persist selected columns across popout reopen']),
  ]));
  panelPopout.appendChild(el('div', { class: 'cbss-small' }, 'Tip: Click column headers in the popout to select columns; selection is stateful.'));

  // Theme settings
  const themePrimary = el('input', { type: 'color', id: 'cbss-theme-primary' }) as HTMLInputElement;
  const themeAccent = el('input', { type: 'color', id: 'cbss-theme-accent' }) as HTMLInputElement;

  panelTheme.appendChild(el('h4', {}, 'Theme'));
  panelTheme.appendChild(el('div', { class: 'cbss-row' }, [
    el('label', {}, ['Primary ', themePrimary]),
    el('label', { style: 'margin-left:12px;' }, ['Accent ', themeAccent]),
  ]));
  panelTheme.appendChild(el('div', { class: 'cbss-small' }, 'Theme colors are saved to localStorage and apply immediately.'));

  settingsPanels.appendChild(panelScrape);
  settingsPanels.appendChild(panelUnique);
  settingsPanels.appendChild(panelPopout);
  settingsPanels.appendChild(panelTheme);

  settingsPanel.appendChild(settingsTabs);
  settingsPanel.appendChild(settingsPanels);

  card.appendChild(mainTabs);
  card.appendChild(actionsPanel);
  card.appendChild(settingsPanel);
  right.appendChild(card);

  body.appendChild(left);
  body.appendChild(right);

  const statusWrap = el('div', { class: 'cbss-status-wrap' }) as HTMLDivElement;
  const statusTitle = el('div', { class: 'cbss-status-title' }, 'Status') as HTMLDivElement;
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

  // Initialize from persisted state
  const scrape = persisted.scrape;
  paginate.checked = !!scrape.paginateAllPages;
  show100.checked = !!scrape.setShowTo100;
  columns.value = scrape.columnMode || 'all';
  maxConcurrency.value = String(scrape.maxConcurrency || 1);
  requirePurchaseId.checked = !!scrape.requirePurchaseId;
  requireVin.checked = !!scrape.requireVin;
  requireStockNumber.checked = !!scrape.requireStockNumber;
  debug.checked = !!scrape.debug;

  const uniq = persisted.uniqueness;
  uniqueEnabled.checked = !!uniq.enabled;
  uniqueKeyVin.checked = !!uniq.keyFields?.vin;
  uniqueKeyStock.checked = !!uniq.keyFields?.stock;
  uniqueKeyPid.checked = !!uniq.keyFields?.pid;
  uniqueDateMode.value = uniq.dateColumn?.mode === 'manual' ? 'manual' : 'auto';
  uniqueDateHeader.value = uniq.dateColumn?.header || '';

  const pop = persisted.popout;
  popoutIncludeHeaders.checked = !!pop.copyIncludeHeaders;
  popoutPersistSelectedColumns.checked = !!pop.persistSelectedColumns;

  const theme = persisted.theme;
  themePrimary.value = theme.primary || '#16a34a';
  themeAccent.value = theme.accent || '#183558';

  const updateUniqueUi = () => {
    const manual = uniqueDateMode.value === 'manual';
    uniqueDateHeader.disabled = !manual;
    uniqueDateHeader.style.opacity = manual ? '1' : '0.6';
  };
  updateUniqueUi();

  // Wiring - options persistence
  const scrapeInputs = { paginate, show100, columns, maxConcurrency, requirePurchaseId, requireVin, requireStockNumber, debug };
  const notifyScrape = () => handlers.onScrapeOptionsChange(readScrapeOptionsFromUi(scrapeInputs));
  [paginate, show100, columns, requirePurchaseId, requireVin, requireStockNumber, debug].forEach((input) => {
    input.addEventListener('change', notifyScrape);
  });
  maxConcurrency.addEventListener('input', notifyScrape);
  maxConcurrency.addEventListener('change', notifyScrape);

  const uniqueInputs = { enabled: uniqueEnabled, keyVin: uniqueKeyVin, keyStock: uniqueKeyStock, keyPid: uniqueKeyPid, dateMode: uniqueDateMode, dateHeader: uniqueDateHeader };
  const notifyUnique = () => handlers.onUniquenessOptionsChange(readUniquenessOptionsFromUi(uniqueInputs));
  [uniqueEnabled, uniqueKeyVin, uniqueKeyStock, uniqueKeyPid, uniqueDateMode].forEach((input) => {
    input.addEventListener('change', () => {
      updateUniqueUi();
      notifyUnique();
    });
  });
  uniqueDateHeader.addEventListener('input', notifyUnique);
  uniqueDateHeader.addEventListener('change', notifyUnique);

  const popoutInputs = { includeHeaders: popoutIncludeHeaders, persistSelectedColumns: popoutPersistSelectedColumns };
  const notifyPopout = () => handlers.onPopoutOptionsChange(readPopoutOptionsFromUi(popoutInputs));
  [popoutIncludeHeaders, popoutPersistSelectedColumns].forEach((input) => {
    input.addEventListener('change', notifyPopout);
  });

  const themeInputs = { primary: themePrimary, accent: themeAccent };
  const notifyTheme = () => handlers.onThemeOptionsChange(readThemeOptionsFromUi(themeInputs));
  themePrimary.addEventListener('input', notifyTheme);
  themeAccent.addEventListener('input', notifyTheme);

  // Tabs state
  const mainTabButtons = [tabActions, tabSettings];
  const settingsTabButtons = [tabScrape, tabUnique, tabPopout, tabTheme];

  const setMainTab = (tab: UiState['mainTab']) => {
    actionsPanel.style.display = tab === 'actions' ? 'block' : 'none';
    settingsPanel.style.display = tab === 'settings' ? 'block' : 'none';
    setTabActive(mainTabButtons, tab, 'data-main-tab');
  };

  const setSettingsTab = (tab: UiState['settingsTab']) => {
    setTabActive(settingsTabButtons, tab, 'data-settings-tab');
    const panels = Array.from(settingsPanels.querySelectorAll<HTMLElement>('.cbss-settings-panel'));
    for (const p of panels) {
      const key = p.getAttribute('data-settings-panel') || '';
      p.classList.toggle('active', key === tab);
    }
  };

  const uiState = persisted.ui;
  setMainTab(uiState.mainTab);
  setSettingsTab(uiState.settingsTab);

  overlay.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const button = target.closest('button') as HTMLButtonElement | null;
    if (!button) return;
    addButtonClickFeedback(button, window);
  });

  tabActions.addEventListener('click', () => {
    setMainTab('actions');
    handlers.onUiStateChange({ mainTab: 'actions', settingsTab: persisted.ui.settingsTab });
  });
  tabSettings.addEventListener('click', () => {
    setMainTab('settings');
    handlers.onUiStateChange({ mainTab: 'settings', settingsTab: persisted.ui.settingsTab });
  });

  tabScrape.addEventListener('click', () => {
    setSettingsTab('scrape');
    handlers.onUiStateChange({ mainTab: 'settings', settingsTab: 'scrape' });
  });
  tabUnique.addEventListener('click', () => {
    setSettingsTab('uniqueness');
    handlers.onUiStateChange({ mainTab: 'settings', settingsTab: 'uniqueness' });
  });
  tabPopout.addEventListener('click', () => {
    setSettingsTab('popout');
    handlers.onUiStateChange({ mainTab: 'settings', settingsTab: 'popout' });
  });
  tabTheme.addEventListener('click', () => {
    setSettingsTab('theme');
    handlers.onUiStateChange({ mainTab: 'settings', settingsTab: 'theme' });
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

    uniqueEnabled,
    uniqueKeyVin,
    uniqueKeyStock,
    uniqueKeyPid,
    uniqueDateMode,
    uniqueDateHeader,

    popoutIncludeHeaders,
    popoutPersistSelectedColumns,

    themePrimary,
    themeAccent,

    start,
    cancel,
    status,
    iframeHost,
    popout: popoutTable,
    copyStock,
    copyVin,
    copyPid,
    copyReference,
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
  }, 'Bulk Search') as HTMLButtonElement;
  btn.addEventListener('click', () => {
    addButtonClickFeedback(btn, window);
  });
  document.body.appendChild(btn);
}
