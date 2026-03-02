export function createPanelShell(): { root: HTMLDivElement; header: HTMLDivElement; content: HTMLDivElement } {
  const root = document.createElement('div');
  Object.assign(root.style, {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--cv-bg-primary)',
    color: 'var(--cv-text-primary)',
    fontSize: '13px',
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'var(--cv-blur-heavy)',
    borderBottom: '1px solid var(--cv-border)',
    flexShrink: '0',
  });

  const title = document.createElement('span');
  Object.assign(title.style, {
    fontSize: '14px',
    fontWeight: '600',
    background: 'var(--cv-accent-gradient)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  });
  title.textContent = 'Carvana Extension';
  header.appendChild(title);

  const content = document.createElement('div');
  Object.assign(content.style, {
    flex: '1',
    overflow: 'auto',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  });

  root.appendChild(header);
  root.appendChild(content);

  return { root, header, content };
}
