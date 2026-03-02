import { DataTable, DataTableColumn } from './data-table';
import { showToast } from './toast';

export interface ResultArtifact {
  type: 'table' | 'json' | 'text';
  title?: string;
  columns?: DataTableColumn[];
  rows?: Record<string, string>[];
  json?: unknown;
  text?: string;
  meta?: Record<string, string>;
}

export interface ResultViewerOptions {
  artifact: ResultArtifact;
  onDownload?: (filename: string, mime: string, data: string) => void;
  onCopy?: (data: string) => void;
}

function toolbarBtn(label: string, icon: string): HTMLButtonElement {
  const btn = document.createElement('button');
  Object.assign(btn.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    fontSize: '11px',
    fontWeight: '600',
    background: 'rgba(148, 163, 184, 0.08)',
    color: 'var(--cv-text-secondary)',
    border: '1px solid var(--cv-border)',
    borderRadius: 'var(--cv-radius-sm)',
    cursor: 'pointer',
    transition: 'all var(--cv-transition)',
    backdropFilter: 'blur(8px)',
  });
  const ico = document.createElement('span');
  ico.textContent = icon;
  ico.style.fontSize = '12px';
  btn.appendChild(ico);
  const txt = document.createElement('span');
  txt.textContent = label;
  btn.appendChild(txt);
  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(148, 163, 184, 0.18)';
    btn.style.borderColor = 'var(--cv-border-active)';
    btn.style.color = 'var(--cv-text-primary)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'rgba(148, 163, 184, 0.08)';
    btn.style.borderColor = 'var(--cv-border)';
    btn.style.color = 'var(--cv-text-secondary)';
  });
  return btn;
}

function serializeCSV(columns: DataTableColumn[], rows: Record<string, string>[]): string {
  const header = columns.map((c) => '"' + c.label.replace(/"/g, '""') + '"').join(',');
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = row[c.key] ?? '';
      return '"' + v.replace(/"/g, '""') + '"';
    }).join(',')
  ).join('\n');
  return header + '\n' + body;
}

function serializeJSON(artifact: ResultArtifact): string {
  if (artifact.type === 'json') return JSON.stringify(artifact.json, null, 2);
  if (artifact.type === 'table' && artifact.rows) return JSON.stringify(artifact.rows, null, 2);
  return artifact.text ?? '';
}

function triggerDownload(filename: string, mime: string, data: string): void {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}

async function copyToClipboard(data: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(data);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = data;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

export function createResultViewer(options: ResultViewerOptions): HTMLDivElement {
  const { artifact, onDownload, onCopy } = options;

  const root = document.createElement('div');
  Object.assign(root.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    background: 'var(--cv-bg-secondary)',
    border: '1px solid var(--cv-border)',
    borderRadius: 'var(--cv-radius-md)',
    overflow: 'hidden',
    backdropFilter: 'var(--cv-blur)',
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid var(--cv-border)',
    background: 'rgba(15, 23, 42, 0.4)',
    flexWrap: 'wrap',
    gap: '8px',
  });

  const titleArea = document.createElement('div');
  Object.assign(titleArea.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: '1',
  });

  const typeIcon = document.createElement('span');
  typeIcon.style.fontSize = '14px';
  if (artifact.type === 'table') typeIcon.textContent = '\u{1F4CA}';
  else if (artifact.type === 'json') typeIcon.textContent = '\u{1F4C4}';
  else typeIcon.textContent = '\u{1F4DD}';
  titleArea.appendChild(typeIcon);

  const titleEl = document.createElement('span');
  Object.assign(titleEl.style, {
    fontWeight: '600',
    fontSize: '13px',
    color: 'var(--cv-text-primary)',
  });
  titleEl.textContent = artifact.title ?? 'Result';
  titleArea.appendChild(titleEl);

  if (artifact.type === 'table' && artifact.rows) {
    const countBadge = document.createElement('span');
    Object.assign(countBadge.style, {
      fontSize: '10px',
      fontWeight: '600',
      color: 'var(--cv-accent)',
      background: 'var(--cv-accent-glow)',
      padding: '1px 8px',
      borderRadius: '9999px',
      border: '1px solid var(--cv-border)',
    });
    countBadge.textContent = artifact.rows.length + ' rows';
    titleArea.appendChild(countBadge);
  }

  header.appendChild(titleArea);

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  });

  const copyBtn = toolbarBtn('Copy', '\u{1F4CB}');
  copyBtn.addEventListener('click', async () => {
    const text = artifact.type === 'table' && artifact.columns && artifact.rows
      ? serializeCSV(artifact.columns, artifact.rows)
      : serializeJSON(artifact);
    if (onCopy) {
      onCopy(text);
    } else {
      await copyToClipboard(text);
    }
    showToast({ message: 'Copied to clipboard', variant: 'success', duration: 2000 });
  });
  actions.appendChild(copyBtn);

  if (artifact.type === 'table' && artifact.columns && artifact.rows) {
    const csvBtn = toolbarBtn('CSV', '\u2B07');
    csvBtn.addEventListener('click', () => {
      const csv = serializeCSV(artifact.columns!, artifact.rows!);
      const filename = (artifact.title ?? 'export').replace(/[^a-zA-Z0-9_-]/g, '_') + '.csv';
      if (onDownload) {
        onDownload(filename, 'text/csv', csv);
      } else {
        triggerDownload(filename, 'text/csv', csv);
      }
      showToast({ message: 'Downloaded ' + filename, variant: 'success', duration: 2000 });
    });
    actions.appendChild(csvBtn);
  }

  const jsonBtn = toolbarBtn('JSON', '{}');
  jsonBtn.addEventListener('click', () => {
    const json = serializeJSON(artifact);
    const filename = (artifact.title ?? 'export').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
    if (onDownload) {
      onDownload(filename, 'application/json', json);
    } else {
      triggerDownload(filename, 'application/json', json);
    }
    showToast({ message: 'Downloaded ' + filename, variant: 'success', duration: 2000 });
  });
  actions.appendChild(jsonBtn);

  header.appendChild(actions);
  root.appendChild(header);

  if (artifact.meta) {
    const metaBar = document.createElement('div');
    Object.assign(metaBar.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '8px 14px',
      borderBottom: '1px solid var(--cv-border)',
      background: 'rgba(15, 23, 42, 0.25)',
      fontSize: '11px',
    });
    for (const [key, val] of Object.entries(artifact.meta)) {
      const pair = document.createElement('span');
      pair.style.color = 'var(--cv-text-muted)';
      const kSpan = document.createElement('span');
      kSpan.style.color = 'var(--cv-text-secondary)';
      kSpan.textContent = key + ': ';
      pair.appendChild(kSpan);
      pair.append(val);
      metaBar.appendChild(pair);
    }
    root.appendChild(metaBar);
  }

  const body = document.createElement('div');
  Object.assign(body.style, {
    flex: '1',
    overflow: 'auto',
  });

  if (artifact.type === 'table' && artifact.columns && artifact.rows) {
    const table = new DataTable({
      columns: artifact.columns,
      data: artifact.rows,
      searchable: true,
      exportable: false,
      pageSize: 50,
    });
    body.appendChild(table.getElement());
  } else if (artifact.type === 'json') {
    const pre = document.createElement('pre');
    Object.assign(pre.style, {
      padding: '14px',
      fontSize: '12px',
      fontFamily: 'var(--cv-font-mono)',
      color: 'var(--cv-text-primary)',
      lineHeight: '1.6',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      margin: '0',
    });
    pre.textContent = JSON.stringify(artifact.json, null, 2);
    body.appendChild(pre);
  } else {
    const textBlock = document.createElement('div');
    Object.assign(textBlock.style, {
      padding: '14px',
      fontSize: '13px',
      color: 'var(--cv-text-primary)',
      lineHeight: '1.6',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    });
    textBlock.textContent = artifact.text ?? '';
    body.appendChild(textBlock);
  }

  root.appendChild(body);
  return root;
}
