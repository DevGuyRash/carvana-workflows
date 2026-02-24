export interface CardOptions {
  title?: string;
  subtitle?: string;
  actions?: HTMLElement[];
}

export function createCard(options: CardOptions = {}): HTMLDivElement {
  const card = document.createElement('div');
  Object.assign(card.style, {
    background: 'var(--cv-bg-secondary)',
    border: '1px solid var(--cv-border)',
    borderRadius: 'var(--cv-radius-md)',
    overflow: 'hidden',
    transition: 'all var(--cv-transition)',
    backdropFilter: 'var(--cv-blur)',
    boxShadow: 'var(--cv-shadow-sm)',
  });

  card.addEventListener('mouseenter', () => {
    card.style.borderColor = 'var(--cv-border-active)';
    card.style.boxShadow = 'var(--cv-shadow-md), 0 0 20px rgba(59, 130, 246, 0.06)';
    card.style.transform = 'translateY(-1px)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.borderColor = 'var(--cv-border)';
    card.style.boxShadow = 'var(--cv-shadow-sm)';
    card.style.transform = 'translateY(0)';
  });

  if (options.title || options.actions) {
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px', borderBottom: '1px solid var(--cv-border)',
    });
    const titleGroup = document.createElement('div');
    if (options.title) {
      const titleEl = document.createElement('div');
      Object.assign(titleEl.style, { fontSize: '13px', fontWeight: '600', color: 'var(--cv-text-primary)', letterSpacing: '-0.01em' });
      titleEl.textContent = options.title;
      titleGroup.appendChild(titleEl);
    }
    if (options.subtitle) {
      const subEl = document.createElement('div');
      Object.assign(subEl.style, { fontSize: '11px', color: 'var(--cv-text-muted)', marginTop: '2px' });
      subEl.textContent = options.subtitle;
      titleGroup.appendChild(subEl);
    }
    header.appendChild(titleGroup);
    if (options.actions) {
      const actionsEl = document.createElement('div');
      Object.assign(actionsEl.style, { display: 'flex', gap: '6px' });
      for (const action of options.actions) actionsEl.appendChild(action);
      header.appendChild(actionsEl);
    }
    card.appendChild(header);
  }

  const body = document.createElement('div');
  Object.assign(body.style, { padding: '14px 18px' });
  body.dataset.slot = 'body';
  card.appendChild(body);
  return card;
}

export function getCardBody(card: HTMLDivElement): HTMLDivElement {
  return card.querySelector('[data-slot="body"]') as HTMLDivElement;
}
