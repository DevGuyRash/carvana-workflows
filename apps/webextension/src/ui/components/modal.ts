export interface ModalOptions {
  title: string;
  width?: string;
  onClose?: () => void;
}

export function createModal(options: ModalOptions): { overlay: HTMLDivElement; body: HTMLDivElement; footer: HTMLDivElement; close: () => void } {
  const { title, width = '480px', onClose } = options;

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    opacity: '0',
    transition: 'opacity 200ms ease',
  });

  const dialog = document.createElement('div');
  Object.assign(dialog.style, {
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid var(--cv-border)',
    borderRadius: 'var(--cv-radius-lg)',
    backdropFilter: 'var(--cv-blur-heavy)',
    boxShadow: 'var(--cv-shadow-lg), var(--cv-shadow-glow)',
    width,
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    transform: 'scale(0.95)',
    transition: 'transform 200ms ease',
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--cv-border)',
    flexShrink: '0',
  });

  const titleEl = document.createElement('h2');
  Object.assign(titleEl.style, {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--cv-text-primary)',
    margin: '0',
    letterSpacing: '-0.01em',
  });
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const closeBtn = document.createElement('button');
  Object.assign(closeBtn.style, {
    background: 'none',
    border: 'none',
    color: 'var(--cv-text-muted)',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '0',
    lineHeight: '1',
    transition: 'color var(--cv-transition)',
  });
  closeBtn.textContent = '×';
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = 'var(--cv-text-primary)'; });
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = 'var(--cv-text-muted)'; });
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  Object.assign(body.style, {
    padding: '20px',
    overflow: 'auto',
    flex: '1',
  });

  const footer = document.createElement('div');
  Object.assign(footer.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '12px 20px',
    borderTop: '1px solid var(--cv-border)',
    flexShrink: '0',
  });

  dialog.appendChild(header);
  dialog.appendChild(body);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);

  function close() {
    overlay.style.opacity = '0';
    dialog.style.transform = 'scale(0.95)';
    setTimeout(() => {
      overlay.remove();
      onClose?.();
    }, 200);
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    dialog.style.transform = 'scale(1)';
  });

  return { overlay, body, footer, close };
}

export function createButton(text: string, variant: 'primary' | 'secondary' | 'danger' = 'secondary'): HTMLButtonElement {
  const btn = document.createElement('button');
  const styles: Record<string, Record<string, string>> = {
    primary: {
      background: 'var(--cv-accent-gradient)',
      color: '#fff',
      border: 'none',
    },
    secondary: {
      background: 'rgba(148, 163, 184, 0.08)',
      color: 'var(--cv-text-primary)',
      border: '1px solid var(--cv-border)',
      backdropFilter: 'blur(8px)',
    },
    danger: {
      background: 'rgba(248, 113, 113, 0.15)',
      color: '#f87171',
      border: '1px solid rgba(248, 113, 113, 0.2)',
    },
  };
  Object.assign(btn.style, {
    padding: '8px 16px',
    borderRadius: 'var(--cv-radius-sm)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all var(--cv-transition)',
    ...styles[variant],
  });
  btn.textContent = text;
  btn.addEventListener('mouseenter', () => {
    if (variant === 'primary') {
      btn.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.3)';
    } else {
      btn.style.opacity = '0.85';
    }
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.boxShadow = 'none';
    btn.style.opacity = '1';
  });
  return btn;
}
