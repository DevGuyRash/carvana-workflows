export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

export interface DataTableOptions {
  columns: DataTableColumn[];
  data: Record<string, string>[];
  pageSize?: number;
  searchable?: boolean;
  exportable?: boolean;
  popout?: boolean;
  title?: string;
  onRowClick?: (row: Record<string, string>, index: number) => void;
}

type SortDir = 'asc' | 'desc' | null;

export class DataTable {
  private root: HTMLDivElement;
  private columns: DataTableColumn[];
  private allData: Record<string, string>[];
  private filteredData: Record<string, string>[];
  private pageSize: number;
  private currentPage: number = 0;
  private sortKey: string | null = null;
  private sortDir: SortDir = null;
  private searchQuery: string = '';
  private tableBody!: HTMLTableSectionElement;
  private paginationEl!: HTMLDivElement;
  private countEl!: HTMLSpanElement;
  private options: DataTableOptions;

  constructor(options: DataTableOptions) {
    this.options = options;
    this.columns = options.columns;
    this.allData = options.data;
    this.filteredData = [...options.data];
    this.pageSize = options.pageSize ?? 25;
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      background: 'var(--cv-bg-secondary)',
      border: '1px solid var(--cv-border)',
      borderRadius: 'var(--cv-radius-md)',
      overflow: 'hidden',
      backdropFilter: 'var(--cv-blur)',
    });
    this.buildToolbar();
    this.buildTable();
    this.buildPagination();
    this.refresh();
  }

  getElement(): HTMLDivElement {
    return this.root;
  }

  setData(data: Record<string, string>[]): void {
    this.allData = data;
    this.currentPage = 0;
    this.applyFilter();
  }

  private buildToolbar(): void {
    const toolbar = document.createElement('div');
    Object.assign(toolbar.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px',
      borderBottom: '1px solid var(--cv-border)',
      gap: '8px',
      flexWrap: 'wrap',
    });

    const left = document.createElement('div');
    Object.assign(left.style, { display: 'flex', alignItems: 'center', gap: '8px', flex: '1' });

    if (this.options.title) {
      const title = document.createElement('span');
      Object.assign(title.style, { fontWeight: '600', fontSize: '13px', color: 'var(--cv-text-primary)' });
      title.textContent = this.options.title;
      left.appendChild(title);
    }

    this.countEl = document.createElement('span');
    Object.assign(this.countEl.style, { fontSize: '12px', color: 'var(--cv-text-muted)' });
    left.appendChild(this.countEl);

    toolbar.appendChild(left);

    const right = document.createElement('div');
    Object.assign(right.style, { display: 'flex', alignItems: 'center', gap: '6px' });

    if (this.options.searchable !== false) {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Filter...';
      Object.assign(input.style, {
        padding: '5px 10px',
        fontSize: '12px',
        background: 'var(--cv-bg-glass)',
        border: '1px solid var(--cv-border)',
        borderRadius: 'var(--cv-radius-sm)',
        color: 'var(--cv-text-primary)',
        outline: 'none',
        width: '160px',
        backdropFilter: 'var(--cv-blur)',
        transition: 'all var(--cv-transition)',
      });
      input.addEventListener('focus', () => {
        input.style.borderColor = 'var(--cv-border-active)';
        input.style.boxShadow = '0 0 0 3px var(--cv-accent-glow)';
      });
      input.addEventListener('blur', () => {
        input.style.borderColor = 'var(--cv-border)';
        input.style.boxShadow = 'none';
      });
      input.addEventListener('input', () => {
        this.searchQuery = input.value.trim().toLowerCase();
        this.currentPage = 0;
        this.applyFilter();
      });
      right.appendChild(input);
    }

    if (this.options.exportable !== false) {
      const csvBtn = this.makeToolbarBtn('CSV');
      csvBtn.addEventListener('click', () => this.exportCSV());
      right.appendChild(csvBtn);

      const jsonBtn = this.makeToolbarBtn('JSON');
      jsonBtn.addEventListener('click', () => this.exportJSON());
      right.appendChild(jsonBtn);
    }

    if (this.options.popout) {
      const popBtn = this.makeToolbarBtn('⧉ Pop Out');
      popBtn.addEventListener('click', () => this.popout());
      right.appendChild(popBtn);
    }

    toolbar.appendChild(right);
    this.root.appendChild(toolbar);
  }

  private makeToolbarBtn(text: string): HTMLButtonElement {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: '500',
      background: 'rgba(148, 163, 184, 0.08)',
      color: 'var(--cv-text-secondary)',
      border: '1px solid var(--cv-border)',
      borderRadius: 'var(--cv-radius-sm)',
      cursor: 'pointer',
      transition: 'all var(--cv-transition)',
      backdropFilter: 'blur(8px)',
    });
    btn.textContent = text;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(148, 163, 184, 0.15)';
      btn.style.borderColor = 'var(--cv-border-active)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(148, 163, 184, 0.08)';
      btn.style.borderColor = 'var(--cv-border)';
    });
    return btn;
  }

  private buildTable(): void {
    const tableWrapper = document.createElement('div');
    Object.assign(tableWrapper.style, { overflow: 'auto', flex: '1' });

    const table = document.createElement('table');
    Object.assign(table.style, {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '12px',
    });

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const col of this.columns) {
      const th = document.createElement('th');
      Object.assign(th.style, {
        position: 'sticky',
        top: '0',
        background: 'var(--cv-bg-primary)',
        padding: '8px 12px',
        textAlign: 'left',
        fontWeight: '600',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--cv-text-muted)',
        borderBottom: '1px solid var(--cv-border)',
        cursor: col.sortable !== false ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      });
      if (col.width) th.style.width = col.width;

      const labelSpan = document.createElement('span');
      labelSpan.textContent = col.label;
      th.appendChild(labelSpan);

      if (col.sortable !== false) {
        const sortIcon = document.createElement('span');
        sortIcon.style.marginLeft = '4px';
        sortIcon.dataset.sortKey = col.key;
        th.appendChild(sortIcon);
        th.addEventListener('click', () => this.toggleSort(col.key));
      }
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    this.tableBody = document.createElement('tbody');
    table.appendChild(this.tableBody);
    tableWrapper.appendChild(table);
    this.root.appendChild(tableWrapper);
  }

  private buildPagination(): void {
    this.paginationEl = document.createElement('div');
    Object.assign(this.paginationEl.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderTop: '1px solid var(--cv-border)',
      fontSize: '12px',
      color: 'var(--cv-text-muted)',
    });
    this.root.appendChild(this.paginationEl);
  }

  private toggleSort(key: string): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : this.sortDir === 'desc' ? null : 'asc';
      if (this.sortDir === null) this.sortKey = null;
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.applyFilter();
  }

  private applyFilter(): void {
    let data = this.allData;
    if (this.searchQuery) {
      data = data.filter(row =>
        Object.values(row).some(v => v.toLowerCase().includes(this.searchQuery))
      );
    }
    if (this.sortKey && this.sortDir) {
      const key = this.sortKey;
      const dir = this.sortDir === 'asc' ? 1 : -1;
      data = [...data].sort((a, b) => {
        const va = a[key] ?? '';
        const vb = b[key] ?? '';
        return va.localeCompare(vb, undefined, { numeric: true }) * dir;
      });
    }
    this.filteredData = data;
    this.refresh();
  }

  private refresh(): void {
    const totalPages = Math.max(1, Math.ceil(this.filteredData.length / this.pageSize));
    if (this.currentPage >= totalPages) this.currentPage = totalPages - 1;

    const start = this.currentPage * this.pageSize;
    const pageData = this.filteredData.slice(start, start + this.pageSize);

    this.tableBody.innerHTML = '';

    if (pageData.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = this.columns.length;
      Object.assign(td.style, {
        padding: '24px',
        textAlign: 'center',
        color: 'var(--cv-text-muted)',
      });
      td.textContent = 'No data';
      tr.appendChild(td);
      this.tableBody.appendChild(tr);
    } else {
      for (let i = 0; i < pageData.length; i++) {
        const row = pageData[i];
        const tr = document.createElement('tr');
        Object.assign(tr.style, {
          borderBottom: '1px solid var(--cv-border)',
          transition: 'background var(--cv-transition)',
          cursor: this.options.onRowClick ? 'pointer' : 'default',
        });
        tr.addEventListener('mouseenter', () => { tr.style.background = 'rgba(59, 130, 246, 0.04)'; });
        tr.addEventListener('mouseleave', () => { tr.style.background = 'transparent'; });

        if (this.options.onRowClick) {
          const idx = start + i;
          tr.addEventListener('click', () => this.options.onRowClick?.(row, idx));
        }

        for (const col of this.columns) {
          const td = document.createElement('td');
          Object.assign(td.style, {
            padding: '8px 12px',
            color: 'var(--cv-text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '300px',
          });
          td.textContent = row[col.key] ?? '';
          td.title = row[col.key] ?? '';
          tr.appendChild(td);
        }
        this.tableBody.appendChild(tr);
      }
    }

    this.countEl.textContent = `${this.filteredData.length} rows`;

    this.paginationEl.innerHTML = '';
    const info = document.createElement('span');
    info.textContent = `Page ${this.currentPage + 1} of ${totalPages}`;
    this.paginationEl.appendChild(info);

    const navDiv = document.createElement('div');
    Object.assign(navDiv.style, { display: 'flex', gap: '4px' });

    const prevBtn = this.makeToolbarBtn('← Prev');
    prevBtn.style.opacity = this.currentPage === 0 ? '0.4' : '1';
    prevBtn.addEventListener('click', () => {
      if (this.currentPage > 0) { this.currentPage--; this.refresh(); }
    });
    navDiv.appendChild(prevBtn);

    const nextBtn = this.makeToolbarBtn('Next →');
    nextBtn.style.opacity = this.currentPage >= totalPages - 1 ? '0.4' : '1';
    nextBtn.addEventListener('click', () => {
      if (this.currentPage < totalPages - 1) { this.currentPage++; this.refresh(); }
    });
    navDiv.appendChild(nextBtn);

    this.paginationEl.appendChild(navDiv);

    const sortIcons = this.root.querySelectorAll('[data-sort-key]');
    for (let i = 0; i < sortIcons.length; i++) {
      const el = sortIcons[i];
      const htmlEl = el as HTMLElement;
      const key = htmlEl.dataset.sortKey;
      if (key === this.sortKey) {
        htmlEl.textContent = this.sortDir === 'asc' ? ' ↑' : this.sortDir === 'desc' ? ' ↓' : '';
      } else {
        htmlEl.textContent = '';
      }
    }
  }

  exportCSV(): void {
    const header = this.columns.map(c => c.label).join(',');
    const rows = this.filteredData.map(row =>
      this.columns.map(c => {
        const val = row[c.key] ?? '';
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    this.downloadBlob(csv, 'data.csv', 'text/csv');
  }

  exportJSON(): void {
    const json = JSON.stringify(this.filteredData, null, 2);
    this.downloadBlob(json, 'data.json', 'application/json');
  }

  private downloadBlob(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  popout(): void {
    const popup = window.open('', '_blank', 'width=1000,height=600');
    if (!popup) return;
    const doc = popup.document;
    doc.title = this.options.title ?? 'Data Table';
    const style = doc.createElement('style');
    style.textContent = `
      :root {
        --cv-bg-primary: #0f172a; --cv-bg-secondary: rgba(30, 41, 59, 0.8); --cv-bg-surface: #334155;
        --cv-bg-glass: rgba(30, 41, 59, 0.6);
        --cv-text-primary: #f1f5f9; --cv-text-secondary: #cbd5e1; --cv-text-muted: #94a3b8;
        --cv-accent: #3b82f6; --cv-accent-hover: #2563eb;
        --cv-accent-gradient: linear-gradient(135deg, #3b82f6, #6366f1);
        --cv-accent-glow: rgba(59, 130, 246, 0.15);
        --cv-border: rgba(71, 85, 105, 0.6); --cv-border-active: #3b82f6;
        --cv-success: #22c55e; --cv-warning: #f59e0b; --cv-error: #ef4444; --cv-info: #06b6d4;
        --cv-radius-sm: 6px; --cv-radius-md: 10px; --cv-radius-lg: 14px;
        --cv-font: 'Inter', ui-sans-serif, system-ui, sans-serif;
        --cv-font-mono: 'JetBrains Mono', ui-monospace, monospace;
        --cv-shadow-sm: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
        --cv-shadow-md: 0 4px 12px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2);
        --cv-shadow-lg: 0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3);
        --cv-shadow-glow: 0 0 30px rgba(59, 130, 246, 0.08);
        --cv-blur: blur(12px); --cv-blur-heavy: blur(20px);
        --cv-transition: 150ms ease;
      }
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: var(--cv-font); background: var(--cv-bg-primary); color: var(--cv-text-primary); padding: 16px; }
    `;
    doc.head.appendChild(style);

    const newTable = new DataTable({ ...this.options, data: this.filteredData, popout: false });
    doc.body.appendChild(newTable.getElement());
  }
}
