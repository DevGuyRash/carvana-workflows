export function createPageShell(): { root: HTMLDivElement; header: HTMLElement; main: HTMLElement } {
  const root = document.createElement('div');
  Object.assign(root.style, {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--cv-bg-primary)',
    color: 'var(--cv-text-primary)',
  });

  const header = document.createElement('header');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'var(--cv-blur-heavy)',
    borderBottom: '1px solid var(--cv-border)',
    flexShrink: '0',
  });

  const brand = document.createElement('div');
  Object.assign(brand.style, { display: 'flex', alignItems: 'center', gap: '10px' });

  const logo = document.createElement('span');
  logo.textContent = '⚡';
  logo.style.fontSize = '18px';
  brand.appendChild(logo);

  const title = document.createElement('span');
  Object.assign(title.style, {
    fontSize: '15px',
    fontWeight: '700',
    background: 'var(--cv-accent-gradient)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  });
  title.textContent = 'Carvana Extension';
  brand.appendChild(title);

  const version = document.createElement('span');
  Object.assign(version.style, {
    fontSize: '11px',
    color: 'var(--cv-text-muted)',
    background: 'rgba(148, 163, 184, 0.08)',
    padding: '2px 8px',
    borderRadius: 'var(--cv-radius-sm)',
    border: '1px solid var(--cv-border)',
    backdropFilter: 'blur(8px)',
  });
  version.textContent = 'v0.2.0';
  brand.appendChild(version);

  header.appendChild(brand);

  const main = document.createElement('main');
  Object.assign(main.style, {
    flex: '1',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  });

  root.appendChild(header);
  root.appendChild(main);

  return { root, header, main };
}
