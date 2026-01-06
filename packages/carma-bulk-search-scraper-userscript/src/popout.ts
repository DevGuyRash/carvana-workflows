import type { Logger } from './logger';
import type { ScrapedRow } from './types';

export interface PopoutHandle {
  update: () => void;
  focus: () => void;
  close: () => void;
  isClosed: () => boolean;
}

const POP_TITLE = 'Carma Bulk Search Scraper - Results';
const PREFERRED_COLUMNS = ['searchTerm', 'searchUrl', 'table', 'page', 'Reference'];
const CHUNK_SIZE = 250;
const ROW_HEADER_LABEL = '#';
const STYLE_ID = 'cbss-popout-style';

function escapeTsv(value: unknown): string {
  return value === null || typeof value === 'undefined' ? '' : String(value);
}

async function copyText(win: Window, text: string): Promise<boolean> {
  try {
    await win.navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = win.document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '-9999px';
      win.document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = win.document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root{color-scheme:light;}
    html,body{height:100%;margin:0;}
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f7f8fb;color:#0f172a;}
    .cbss-popout{display:flex;flex-direction:column;height:100%;}
    .cbss-popout-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff;border-bottom:1px solid #e2e8f0;}
    .cbss-popout-title{font-weight:800;font-size:16px;color:#0f172a;}
    .cbss-popout-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
    .cbss-popout-btn{border:1px solid #cbd5f5;border-radius:8px;background:#fff;padding:6px 10px;font-weight:700;cursor:pointer;}
    .cbss-popout-status{font-size:12px;color:#475569;}
    .cbss-popout-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;}
    .cbss-popout-table-wrap{flex:1 1 auto;min-height:0;overflow:auto;border-top:1px solid #e2e8f0;}
    table{border-collapse:collapse;width:max(100%,1200px);background:#fff;}
    thead th{position:sticky;top:0;background:#0f172a;color:#f8fafc;font-size:12px;text-align:left;padding:8px;border-bottom:1px solid #0f172a;z-index:2;}
    thead th.cbss-col-selected{background:#1d4ed8;}
    thead th.cbss-row-header{width:44px;text-align:right;padding-right:10px;}
    tbody td{font-size:12px;padding:6px 8px;border-bottom:1px solid #eef2f7;vertical-align:top;white-space:nowrap;}
    tbody td.cbss-row-header{text-align:right;padding-right:10px;color:#64748b;background:#f1f5f9;position:sticky;left:0;z-index:1;}
    tbody tr:nth-child(even) td.cbss-row-header{background:#e2e8f0;}
    tbody tr:nth-child(even) td{background:#f8fafc;}
    table, thead, tbody, tr, td, th{user-select:none;-webkit-user-select:none;-moz-user-select:none;}
    tbody td.cbss-col-selected{background:#eff6ff;}
    tbody tr.cbss-row-selected td{background:#fee2e2;}
    tbody td.cbss-cell-selected{background:#fef3c7;outline:1px solid #f59e0b;}
    .cbss-inline-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:999999;display:flex;align-items:center;justify-content:center;padding:24px;}
    .cbss-inline-modal{background:#fff;border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.35);width:min(1400px,96vw);height:min(92vh,900px);overflow:hidden;}
  `;
  doc.head.appendChild(style);
}

function createResultsView(params: {
  hostWindow: Window;
  doc: Document;
  mount: HTMLElement;
  inline: boolean;
  getRows: () => ScrapedRow[];
  getRunning: () => boolean;
  logger: Logger;
  onClose?: () => void;
}): PopoutHandle {
  const {
    hostWindow,
    doc,
    mount,
    inline,
    getRows,
    getRunning,
    logger,
    onClose,
  } = params;

  ensureStyles(doc);

  const root = doc.createElement('div');
  root.className = 'cbss-popout';

  const header = doc.createElement('div');
  header.className = 'cbss-popout-header';

  const title = doc.createElement('div');
  title.className = 'cbss-popout-title';
  title.textContent = POP_TITLE;

  const actions = doc.createElement('div');
  actions.className = 'cbss-popout-actions';

  const status = doc.createElement('div');
  status.className = 'cbss-popout-status';
  status.textContent = 'Rows: 0';

  const refreshBtn = doc.createElement('button');
  refreshBtn.className = 'cbss-popout-btn';
  refreshBtn.textContent = 'Refresh';

  const copyVisibleBtn = doc.createElement('button');
  copyVisibleBtn.className = 'cbss-popout-btn';
  copyVisibleBtn.textContent = 'Copy Visible';

  const copySelectionBtn = doc.createElement('button');
  copySelectionBtn.className = 'cbss-popout-btn';
  copySelectionBtn.textContent = 'Copy Selection';

  actions.appendChild(status);
  actions.appendChild(refreshBtn);
  actions.appendChild(copyVisibleBtn);
  actions.appendChild(copySelectionBtn);

  let closeBtn: HTMLButtonElement | null = null;
  if (inline) {
    closeBtn = doc.createElement('button');
    closeBtn.className = 'cbss-popout-btn';
    closeBtn.textContent = 'Close';
    actions.appendChild(closeBtn);
  }

  header.appendChild(title);
  header.appendChild(actions);

  const body = doc.createElement('div');
  body.className = 'cbss-popout-body';

  const tableWrap = doc.createElement('div');
  tableWrap.className = 'cbss-popout-table-wrap';

  const table = doc.createElement('table');
  const thead = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  thead.appendChild(headRow);
  const tbody = doc.createElement('tbody');
  table.appendChild(thead);
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  body.appendChild(tableWrap);

  root.appendChild(header);
  root.appendChild(body);
  mount.appendChild(root);

  const state = {
    columns: [] as string[],
    seen: new Set<string>(),
    lastRendered: 0,
    updating: false,
    queued: false,
  };

  const selection = {
    mode: null as 'cell' | 'row' | 'col' | null,
    cells: new Set<string>(),
    rows: new Set<number>(),
    cols: new Set<number>(),
    anchor: null as { row: number; col: number; mode: 'cell' | 'row' | 'col' } | null,
  };

  const drag = {
    active: false,
    didDrag: false,
    suppressClick: false,
    mode: null as 'cell' | 'row' | 'col' | null,
    anchorRow: 0,
    anchorCol: 0,
  };

  const setStatus = () => {
    const rows = getRows();
    const running = getRunning();
    const rendered = Math.min(state.lastRendered, rows.length);
    const now = new Date().toLocaleTimeString();
    let selectionLabel = '';
    if (selection.mode === 'row') selectionLabel = ` | Rows selected: ${selection.rows.size}`;
    if (selection.mode === 'col') selectionLabel = ` | Cols selected: ${selection.cols.size}`;
    if (selection.mode === 'cell') selectionLabel = ` | Cells selected: ${selection.cells.size}`;
    status.textContent = `Rows: ${rows.length} | Rendered: ${rendered} | ${running ? 'Live' : 'Idle'} | ${now}${selectionLabel}`;
  };

  const addColumn = (col: string) => {
    const colIndex = state.columns.length;
    state.columns.push(col);
    state.seen.add(col);
    const th = doc.createElement('th');
    th.textContent = col;
    th.setAttribute('data-col-index', String(colIndex));
    if (selection.mode === 'col' && selection.cols.has(colIndex)) {
      th.classList.add('cbss-col-selected');
    }
    headRow.appendChild(th);
  };

  const ensureRowHeader = () => {
    if (headRow.querySelector('th.cbss-row-header')) return;
    const th = doc.createElement('th');
    th.textContent = ROW_HEADER_LABEL;
    th.className = 'cbss-row-header';
    th.setAttribute('data-row-header', '1');
    headRow.insertBefore(th, headRow.firstChild);
  };

  const resetTable = () => {
    state.columns = [];
    state.seen = new Set<string>();
    state.lastRendered = 0;
    headRow.textContent = '';
    tbody.textContent = '';
    selection.mode = null;
    selection.cells.clear();
    selection.rows.clear();
    selection.cols.clear();
    selection.anchor = null;
    ensureRowHeader();
  };

  const ensurePreferredColumns = () => {
    ensureRowHeader();
    for (const col of PREFERRED_COLUMNS) {
      if (!state.seen.has(col)) addColumn(col);
    }
  };

  const ensureNewColumns = async (rows: ScrapedRow[], startIndex: number): Promise<void> => {
    const newCols: string[] = [];
    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      for (const key of Object.keys(row)) {
        if (state.seen.has(key)) continue;
        state.seen.add(key);
        newCols.push(key);
      }
    }

    if (!newCols.length) return;
    for (const col of newCols) addColumn(col);

    const existingRows = Array.from(tbody.querySelectorAll('tr'));
    if (!existingRows.length) return;

    const firstNewIndex = state.columns.length - newCols.length;
    let idx = 0;
    await new Promise<void>((resolve) => {
      const step = () => {
        const end = Math.min(idx + CHUNK_SIZE, existingRows.length);
        for (; idx < end; idx++) {
          const tr = existingRows[idx] as HTMLTableRowElement;
          const rowIndex = Number.parseInt(tr.getAttribute('data-row-index') || '', 10);
          for (let c = 0; c < newCols.length; c++) {
            const colIndex = firstNewIndex + c;
            const cell = doc.createElement('td');
            cell.setAttribute('data-row-index', Number.isFinite(rowIndex) ? String(rowIndex) : '');
            cell.setAttribute('data-col-index', String(colIndex));
            if (selection.mode === 'col' && selection.cols.has(colIndex)) {
              cell.classList.add('cbss-col-selected');
            }
            if (selection.mode === 'cell' && Number.isFinite(rowIndex) && selection.cells.has(`${rowIndex}:${colIndex}`)) {
              cell.classList.add('cbss-cell-selected');
            }
            tr.appendChild(cell);
          }
        }
        if (idx < existingRows.length) {
          hostWindow.setTimeout(step, 0);
        } else {
          resolve();
        }
      };
      step();
    });
  };

  const appendRows = async (rows: ScrapedRow[], startIndex: number): Promise<void> => {
    let idx = startIndex;
    await new Promise<void>((resolve) => {
      const step = () => {
        const end = Math.min(idx + CHUNK_SIZE, rows.length);
        const frag = doc.createDocumentFragment();
        for (; idx < end; idx++) {
          const row = rows[idx];
          const tr = doc.createElement('tr');
          tr.setAttribute('data-row-index', String(idx));
          if (selection.mode === 'row' && selection.rows.has(idx)) {
            tr.classList.add('cbss-row-selected');
          }
          const rowHeader = doc.createElement('td');
          rowHeader.className = 'cbss-row-header';
          rowHeader.textContent = String(idx + 1);
          rowHeader.setAttribute('data-row-index', String(idx));
          rowHeader.setAttribute('data-row-header', '1');
          tr.appendChild(rowHeader);
          for (let colIndex = 0; colIndex < state.columns.length; colIndex++) {
            const col = state.columns[colIndex];
            const td = doc.createElement('td');
            const value = row[col];
            td.textContent = value === null || typeof value === 'undefined' ? '' : String(value);
            td.setAttribute('data-row-index', String(idx));
            td.setAttribute('data-col-index', String(colIndex));
            if (selection.mode === 'col' && selection.cols.has(colIndex)) {
              td.classList.add('cbss-col-selected');
            }
            if (selection.mode === 'cell' && selection.cells.has(`${idx}:${colIndex}`)) {
              td.classList.add('cbss-cell-selected');
            }
            tr.appendChild(td);
          }
          frag.appendChild(tr);
        }
        tbody.appendChild(frag);
        if (idx < rows.length) {
          hostWindow.setTimeout(step, 0);
        } else {
          resolve();
        }
      };
      step();
    });
  };

  const update = async () => {
    if (!root.isConnected) return;
    if (state.updating) {
      state.queued = true;
      return;
    }
    state.updating = true;

    do {
      state.queued = false;
      const rows = getRows();
      if (rows.length < state.lastRendered) {
        resetTable();
      }

      if (!state.columns.length) {
        ensurePreferredColumns();
      }

      await ensureNewColumns(rows, state.lastRendered);
      await appendRows(rows, state.lastRendered);
      state.lastRendered = rows.length;
      setStatus();
    } while (state.queued);

    state.updating = false;
  };

  const clearCellSelection = () => {
    selection.cells.clear();
    Array.from(tbody.querySelectorAll('.cbss-cell-selected')).forEach((el) => el.classList.remove('cbss-cell-selected'));
  };

  const clearColSelection = () => {
    selection.cols.clear();
    Array.from(headRow.querySelectorAll('.cbss-col-selected')).forEach((el) => el.classList.remove('cbss-col-selected'));
    Array.from(tbody.querySelectorAll('.cbss-col-selected')).forEach((el) => el.classList.remove('cbss-col-selected'));
  };

  const clearRowSelection = () => {
    selection.rows.clear();
    Array.from(tbody.querySelectorAll('tr.cbss-row-selected')).forEach((el) => el.classList.remove('cbss-row-selected'));
  };

  const setMode = (mode: 'cell' | 'row' | 'col') => {
    if (selection.mode === mode) return;
    clearCellSelection();
    clearColSelection();
    clearRowSelection();
    selection.mode = mode;
    selection.anchor = null;
  };

  const getRowElement = (row: number): HTMLTableRowElement | null => (
    tbody.querySelector(`tr[data-row-index="${row}"]`) as HTMLTableRowElement | null
  );

  const getCellElement = (row: number, col: number): HTMLTableCellElement | null => {
    const rowEl = getRowElement(row);
    if (!rowEl) return null;
    return rowEl.querySelector(`td[data-col-index="${col}"]`) as HTMLTableCellElement | null;
  };

  const setCellSelected = (row: number, col: number, select: boolean) => {
    const key = `${row}:${col}`;
    if (select) {
      selection.cells.add(key);
    } else {
      selection.cells.delete(key);
    }
    const cell = getCellElement(row, col);
    if (cell) {
      cell.classList.toggle('cbss-cell-selected', select);
    }
  };

  const setRowSelected = (row: number, select: boolean) => {
    if (select) selection.rows.add(row);
    else selection.rows.delete(row);
    const rowEl = getRowElement(row);
    if (rowEl) rowEl.classList.toggle('cbss-row-selected', select);
  };

  const setColSelected = (col: number, select: boolean) => {
    if (select) selection.cols.add(col);
    else selection.cols.delete(col);
    const th = headRow.querySelector(`th[data-col-index="${col}"]`) as HTMLTableCellElement | null;
    if (th) th.classList.toggle('cbss-col-selected', select);
    const rows = Array.from(tbody.querySelectorAll('tr'));
    for (const tr of rows) {
      const cell = tr.querySelector(`td[data-col-index="${col}"]`) as HTMLTableCellElement | null;
      if (cell) cell.classList.toggle('cbss-col-selected', select);
    }
  };

  const areAllCellsSelected = (minRow: number, maxRow: number, minCol: number, maxCol: number): boolean => {
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (!selection.cells.has(`${r}:${c}`)) return false;
      }
    }
    return true;
  };

  const areAllRowsSelected = (minRow: number, maxRow: number): boolean => {
    for (let r = minRow; r <= maxRow; r++) {
      if (!selection.rows.has(r)) return false;
    }
    return true;
  };

  const areAllColsSelected = (minCol: number, maxCol: number): boolean => {
    for (let c = minCol; c <= maxCol; c++) {
      if (!selection.cols.has(c)) return false;
    }
    return true;
  };

  const selectCellRange = (minRow: number, maxRow: number, minCol: number, maxCol: number) => {
    clearCellSelection();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        setCellSelected(r, c, true);
      }
    }
  };

  const selectRowRange = (minRow: number, maxRow: number) => {
    clearRowSelection();
    for (let r = minRow; r <= maxRow; r++) {
      setRowSelected(r, true);
    }
  };

  const selectColRange = (minCol: number, maxCol: number) => {
    clearColSelection();
    for (let c = minCol; c <= maxCol; c++) {
      setColSelected(c, true);
    }
  };

  const handleCellClick = (row: number, col: number, isShift: boolean, isCtrl: boolean) => {
    setMode('cell');
    const anchor = selection.anchor;
    if (isShift && anchor && anchor.mode === 'cell') {
      const minRow = Math.min(anchor.row, row);
      const maxRow = Math.max(anchor.row, row);
      const minCol = Math.min(anchor.col, col);
      const maxCol = Math.max(anchor.col, col);
      const shouldSelect = isCtrl ? !areAllCellsSelected(minRow, maxRow, minCol, maxCol) : true;
      if (!isCtrl) clearCellSelection();
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          setCellSelected(r, c, shouldSelect);
        }
      }
    } else {
      if (!isCtrl) clearCellSelection();
      const key = `${row}:${col}`;
      const isSelected = selection.cells.has(key);
      setCellSelected(row, col, isCtrl ? !isSelected : true);
      selection.anchor = { row, col, mode: 'cell' };
    }
    setStatus();
  };

  const handleRowClick = (row: number, isShift: boolean, isCtrl: boolean) => {
    setMode('row');
    const anchor = selection.anchor;
    if (isShift && anchor && anchor.mode === 'row') {
      const minRow = Math.min(anchor.row, row);
      const maxRow = Math.max(anchor.row, row);
      const shouldSelect = isCtrl ? !areAllRowsSelected(minRow, maxRow) : true;
      if (!isCtrl) clearRowSelection();
      for (let r = minRow; r <= maxRow; r++) {
        setRowSelected(r, shouldSelect);
      }
    } else {
      if (!isCtrl) clearRowSelection();
      const isSelected = selection.rows.has(row);
      setRowSelected(row, isCtrl ? !isSelected : true);
      selection.anchor = { row, col: 0, mode: 'row' };
    }
    setStatus();
  };

  const handleColClick = (col: number, isShift: boolean, isCtrl: boolean) => {
    setMode('col');
    const anchor = selection.anchor;
    if (isShift && anchor && anchor.mode === 'col') {
      const minCol = Math.min(anchor.col, col);
      const maxCol = Math.max(anchor.col, col);
      const shouldSelect = isCtrl ? !areAllColsSelected(minCol, maxCol) : true;
      if (!isCtrl) clearColSelection();
      for (let c = minCol; c <= maxCol; c++) {
        setColSelected(c, shouldSelect);
      }
    } else {
      if (!isCtrl) clearColSelection();
      const isSelected = selection.cols.has(col);
      setColSelected(col, isCtrl ? !isSelected : true);
      selection.anchor = { row: 0, col, mode: 'col' };
    }
    setStatus();
  };

  const buildTsv = (rows: ScrapedRow[], columns: string[]): string => {
    const lines: string[] = [];
    lines.push(columns.join('\t'));
    for (const row of rows) {
      lines.push(columns.map((col) => escapeTsv(row[col])).join('\t'));
    }
    return lines.join('\n');
  };

  const copyVisible = async () => {
    const rows = getRows().slice(0, state.lastRendered);
    const tsv = buildTsv(rows, state.columns);
    const ok = await copyText(hostWindow, tsv);
    logger.log(ok ? '[OK] Copied visible table.' : '[ERROR] Failed to copy visible table.');
  };

  const copySelection = async () => {
    const rows = getRows().slice(0, state.lastRendered);
    if (selection.mode === 'row' && selection.rows.size) {
      const rowIndexes = Array.from(selection.rows).sort((a, b) => a - b);
      const selectedRows = rowIndexes.map((idx) => rows[idx]).filter(Boolean);
      const tsv = buildTsv(selectedRows, state.columns);
      const ok = await copyText(hostWindow, tsv);
      logger.log(ok ? '[OK] Copied selected rows.' : '[ERROR] Failed to copy selected rows.');
      return;
    }

    if (selection.mode === 'col' && selection.cols.size) {
      const colIndexes = Array.from(selection.cols).sort((a, b) => a - b);
      const cols = colIndexes.map((idx) => state.columns[idx]).filter(Boolean);
      const tsv = buildTsv(rows, cols);
      const ok = await copyText(hostWindow, tsv);
      logger.log(ok ? '[OK] Copied selected columns.' : '[ERROR] Failed to copy selected columns.');
      return;
    }

    if (selection.mode === 'cell' && selection.cells.size) {
      let minRow = Number.POSITIVE_INFINITY;
      let maxRow = Number.NEGATIVE_INFINITY;
      let minCol = Number.POSITIVE_INFINITY;
      let maxCol = Number.NEGATIVE_INFINITY;
      for (const key of selection.cells) {
        const [rStr, cStr] = key.split(':');
        const r = Number.parseInt(rStr, 10);
        const c = Number.parseInt(cStr, 10);
        if (Number.isNaN(r) || Number.isNaN(c)) continue;
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
      }
      if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) {
        logger.log('[WARN] No valid selected cells to copy.');
        return;
      }
      const cols = state.columns.slice(minCol, maxCol + 1);
      const slicedRows = rows.slice(minRow, maxRow + 1);
      const lines: string[] = [];
      lines.push(cols.join('\t'));
      for (let r = 0; r < slicedRows.length; r++) {
        const rowIndex = minRow + r;
        const row = slicedRows[r];
        const line = cols.map((_, cIdx) => {
          const colIndex = minCol + cIdx;
          if (!selection.cells.has(`${rowIndex}:${colIndex}`)) return '';
          const colName = state.columns[colIndex];
          return escapeTsv(row?.[colName]);
        });
        lines.push(line.join('\t'));
      }
      const ok = await copyText(hostWindow, lines.join('\n'));
      logger.log(ok ? '[OK] Copied selected cells.' : '[ERROR] Failed to copy selected cells.');
      return;
    }

    logger.log('[WARN] No selection to copy.');
  };

  table.addEventListener('click', (event) => {
    if (drag.suppressClick) {
      drag.suppressClick = false;
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const cell = target.closest('td,th') as HTMLElement | null;
    if (!cell) return;

    const isCtrl = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    if (cell.tagName === 'TH') {
      const colIndex = cell.getAttribute('data-col-index');
      if (colIndex !== null) {
        handleColClick(Number.parseInt(colIndex, 10), isShift, isCtrl);
      }
      return;
    }

    if (cell.tagName === 'TD') {
      const rowIndex = cell.getAttribute('data-row-index');
      if (rowIndex === null) return;
      const row = Number.parseInt(rowIndex, 10);
      if (cell.getAttribute('data-row-header') === '1') {
        handleRowClick(row, isShift, isCtrl);
        return;
      }
      const colIndex = cell.getAttribute('data-col-index');
      if (colIndex !== null) {
        handleCellClick(row, Number.parseInt(colIndex, 10), isShift, isCtrl);
      }
    }
  });

  table.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const cell = target.closest('td,th') as HTMLElement | null;
    if (!cell) return;
    const isShift = event.shiftKey;
    const isCtrl = event.ctrlKey || event.metaKey;
    if (isShift || isCtrl) return;

    event.preventDefault();

    drag.active = true;
    drag.didDrag = false;
    drag.mode = null;

    if (cell.tagName === 'TH') {
      const colIndex = cell.getAttribute('data-col-index');
      if (colIndex !== null) {
        const col = Number.parseInt(colIndex, 10);
        drag.mode = 'col';
        drag.anchorCol = col;
        setMode('col');
        selectColRange(col, col);
        selection.anchor = { row: 0, col, mode: 'col' };
        setStatus();
      }
      return;
    }

    const rowIndex = cell.getAttribute('data-row-index');
    if (rowIndex === null) return;
    const row = Number.parseInt(rowIndex, 10);

    if (cell.getAttribute('data-row-header') === '1') {
      drag.mode = 'row';
      drag.anchorRow = row;
      setMode('row');
      selectRowRange(row, row);
      selection.anchor = { row, col: 0, mode: 'row' };
      setStatus();
      return;
    }

    const colIndex = cell.getAttribute('data-col-index');
    if (colIndex === null) return;
    const col = Number.parseInt(colIndex, 10);
    drag.mode = 'cell';
    drag.anchorRow = row;
    drag.anchorCol = col;
    setMode('cell');
    selectCellRange(row, row, col, col);
    selection.anchor = { row, col, mode: 'cell' };
    setStatus();
  });

  table.addEventListener('mousemove', (event) => {
    if (!drag.active || !drag.mode) return;
    if (!(event.buttons & 1)) {
      drag.active = false;
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) return;
    const cell = target.closest('td,th') as HTMLElement | null;
    if (!cell) return;

    event.preventDefault();

    if (drag.mode === 'col') {
      const colIndex = cell.getAttribute('data-col-index');
      if (colIndex === null) return;
      const col = Number.parseInt(colIndex, 10);
      if (col !== drag.anchorCol) drag.didDrag = true;
      const minCol = Math.min(drag.anchorCol, col);
      const maxCol = Math.max(drag.anchorCol, col);
      selectColRange(minCol, maxCol);
      setStatus();
      return;
    }

    const rowIndex = cell.getAttribute('data-row-index');
    if (rowIndex === null) return;
    const row = Number.parseInt(rowIndex, 10);

    if (drag.mode === 'row') {
      if (row !== drag.anchorRow) drag.didDrag = true;
      const minRow = Math.min(drag.anchorRow, row);
      const maxRow = Math.max(drag.anchorRow, row);
      selectRowRange(minRow, maxRow);
      setStatus();
      return;
    }

    const colIndex = cell.getAttribute('data-col-index');
    if (colIndex === null) return;
    const col = Number.parseInt(colIndex, 10);
    if (row !== drag.anchorRow || col !== drag.anchorCol) drag.didDrag = true;
    const minRow = Math.min(drag.anchorRow, row);
    const maxRow = Math.max(drag.anchorRow, row);
    const minCol = Math.min(drag.anchorCol, col);
    const maxCol = Math.max(drag.anchorCol, col);
    selectCellRange(minRow, maxRow, minCol, maxCol);
    setStatus();
  });

  const stopDrag = () => {
    if (!drag.active) return;
    drag.active = false;
    if (drag.didDrag) {
      drag.suppressClick = true;
    }
  };

  hostWindow.addEventListener('mouseup', stopDrag);
  hostWindow.addEventListener('blur', stopDrag);

  const onKeydown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      void copySelection();
    }
  };

  hostWindow.addEventListener('keydown', onKeydown);

  copyVisibleBtn.addEventListener('click', () => {
    void copyVisible();
  });

  copySelectionBtn.addEventListener('click', () => {
    void copySelection();
  });

  refreshBtn.addEventListener('click', () => {
    void update();
  });

  const interval = hostWindow.setInterval(() => {
    if (getRunning()) {
      void update();
    }
  }, 1500);

  const cleanup = () => {
    hostWindow.clearInterval(interval);
    hostWindow.removeEventListener('keydown', onKeydown);
    hostWindow.removeEventListener('mouseup', stopDrag);
    hostWindow.removeEventListener('blur', stopDrag);
  };

  const handle: PopoutHandle = {
    update: () => {
      void update();
    },
    focus: () => {
      try {
        hostWindow.focus();
      } catch {
        // ignore
      }
    },
    close: () => {
      cleanup();
      if (onClose) onClose();
    },
    isClosed: () => !root.isConnected,
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      handle.close();
    });
  }

  void update();

  return handle;
}

function openResultsInline(params: {
  getRows: () => ScrapedRow[];
  getRunning: () => boolean;
  logger: Logger;
}): PopoutHandle {
  const { getRows, getRunning, logger } = params;
  const doc = document;
  ensureStyles(doc);
  const overlay = doc.createElement('div');
  overlay.className = 'cbss-inline-overlay';
  const modal = doc.createElement('div');
  modal.className = 'cbss-inline-modal';
  overlay.appendChild(modal);
  doc.body.appendChild(overlay);

  return createResultsView({
    hostWindow: window,
    doc,
    mount: modal,
    inline: true,
    getRows,
    getRunning,
    logger,
    onClose: () => {
      overlay.remove();
    },
  });
}

export function openResultsPopout(params: {
  getRows: () => ScrapedRow[];
  getRunning: () => boolean;
  logger: Logger;
}): PopoutHandle | null {
  const { getRows, getRunning, logger } = params;
  const win = window.open('', 'cbss-results-popout', 'width=1300,height=800');
  if (!win) {
    logger.log('[WARN] Popout blocked. Opening inline view.');
    return openResultsInline({ getRows, getRunning, logger });
  }

  try {
    const doc = win.document;
    doc.title = POP_TITLE;
    doc.body.innerHTML = '';
    return createResultsView({
      hostWindow: win,
      doc,
      mount: doc.body,
      inline: false,
      getRows,
      getRunning,
      logger,
      onClose: () => {
        try {
          win.close();
        } catch {
          // ignore
        }
      },
    });
  } catch {
    try {
      win.close();
    } catch {
      // ignore
    }
    logger.log('[WARN] Popout inaccessible. Opening inline view.');
    return openResultsInline({ getRows, getRunning, logger });
  }
}
