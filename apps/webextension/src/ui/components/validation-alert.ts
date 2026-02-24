export type AlertVariant = 'pending' | 'validating' | 'valid' | 'invalid' | 'error' | 'dismissed';

export interface ValidationAlertOptions {
  variant?: AlertVariant;
  title?: string;
  message?: string;
  details?: string[];
  onDismiss?: () => void;
  onRetry?: () => void;
  persistent?: boolean;
}

const VARIANT_CFG: Record<AlertVariant, { icon: string; color: string; bg: string; border: string; glow: string }> = {
  pending:    { icon: '\u23F3', color: 'var(--cv-text-muted)',   bg: 'rgba(148, 163, 184, 0.06)', border: 'var(--cv-border)',                glow: 'transparent' },
  validating: { icon: '\u26A1', color: 'var(--cv-accent)',       bg: 'rgba(59, 130, 246, 0.06)',  border: 'rgba(59, 130, 246, 0.25)',        glow: 'rgba(59, 130, 246, 0.08)' },
  valid:      { icon: '\u2713', color: 'var(--cv-success)',      bg: 'rgba(52, 211, 153, 0.06)', border: 'rgba(52, 211, 153, 0.25)',        glow: 'rgba(52, 211, 153, 0.08)' },
  invalid:    { icon: '\u2715', color: 'var(--cv-error)',        bg: 'rgba(248, 113, 113, 0.06)', border: 'rgba(248, 113, 113, 0.25)',       glow: 'rgba(248, 113, 113, 0.08)' },
  error:      { icon: '\u26A0', color: 'var(--cv-warning)',      bg: 'rgba(251, 191, 36, 0.06)', border: 'rgba(251, 191, 36, 0.25)',        glow: 'rgba(251, 191, 36, 0.08)' },
  dismissed:  { icon: '',       color: 'transparent',            bg: 'transparent',               border: 'transparent',                      glow: 'transparent' },
};

export class ValidationAlert {
  private root: HTMLDivElement;
  private iconEl: HTMLSpanElement;
  private titleEl: HTMLSpanElement;
  private messageEl: HTMLDivElement;
  private detailsList: HTMLUListElement;
  private actionsRow: HTMLDivElement;
  private retryBtn: HTMLButtonElement;
  private dismissBtn: HTMLButtonElement;
  private opts: ValidationAlertOptions;
  private mounted = false;

  constructor(options: ValidationAlertOptions = {}) {
    this.opts = { variant: 'pending', ...options };

    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px 14px',
      borderRadius: 'var(--cv-radius-md)',
      border: '1px solid var(--cv-border)',
      backdropFilter: 'var(--cv-blur)',
      transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      opacity: '0',
      transform: 'translateY(6px)',
    });

    const topRow = document.createElement('div');
    Object.assign(topRow.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
    });

    const leftGroup = document.createElement('div');
    Object.assign(leftGroup.style, { display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '0' });

    this.iconEl = document.createElement('span');
    Object.assign(this.iconEl.style, {
      fontSize: '14px',
      fontWeight: '700',
      lineHeight: '1',
      flexShrink: '0',
      transition: 'color var(--cv-transition)',
    });
    leftGroup.appendChild(this.iconEl);

    this.titleEl = document.createElement('span');
    Object.assign(this.titleEl.style, {
      fontWeight: '600',
      fontSize: '13px',
      color: 'var(--cv-text-primary)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
    leftGroup.appendChild(this.titleEl);

    topRow.appendChild(leftGroup);

    this.actionsRow = document.createElement('div');
    Object.assign(this.actionsRow.style, { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: '0' });

    this.retryBtn = document.createElement('button');
    Object.assign(this.retryBtn.style, {
      padding: '3px 10px',
      fontSize: '10px',
      fontWeight: '600',
      borderRadius: 'var(--cv-radius-sm)',
      border: '1px solid var(--cv-border)',
      background: 'rgba(148, 163, 184, 0.08)',
      color: 'var(--cv-text-secondary)',
      cursor: 'pointer',
      transition: 'all var(--cv-transition)',
      display: 'none',
    });
    this.retryBtn.textContent = '\u21BB Retry';
    this.retryBtn.addEventListener('mouseenter', () => {
      this.retryBtn.style.background = 'rgba(148, 163, 184, 0.18)';
      this.retryBtn.style.borderColor = 'var(--cv-border-active)';
    });
    this.retryBtn.addEventListener('mouseleave', () => {
      this.retryBtn.style.background = 'rgba(148, 163, 184, 0.08)';
      this.retryBtn.style.borderColor = 'var(--cv-border)';
    });
    this.retryBtn.addEventListener('click', () => this.opts.onRetry?.());
    this.actionsRow.appendChild(this.retryBtn);

    this.dismissBtn = document.createElement('button');
    Object.assign(this.dismissBtn.style, {
      background: 'none',
      border: 'none',
      color: 'var(--cv-text-muted)',
      cursor: 'pointer',
      fontSize: '16px',
      padding: '0 2px',
      lineHeight: '1',
      transition: 'color var(--cv-transition)',
      display: 'none',
    });
    this.dismissBtn.textContent = '\u00D7';
    this.dismissBtn.addEventListener('mouseenter', () => { this.dismissBtn.style.color = 'var(--cv-text-primary)'; });
    this.dismissBtn.addEventListener('mouseleave', () => { this.dismissBtn.style.color = 'var(--cv-text-muted)'; });
    this.dismissBtn.addEventListener('click', () => this.dismiss());
    this.actionsRow.appendChild(this.dismissBtn);

    topRow.appendChild(this.actionsRow);
    this.root.appendChild(topRow);

    this.messageEl = document.createElement('div');
    Object.assign(this.messageEl.style, {
      fontSize: '12px',
      color: 'var(--cv-text-muted)',
      lineHeight: '1.5',
      display: 'none',
    });
    this.root.appendChild(this.messageEl);

    this.detailsList = document.createElement('ul');
    Object.assign(this.detailsList.style, {
      margin: '0',
      paddingLeft: '18px',
      fontSize: '11px',
      color: 'var(--cv-text-muted)',
      lineHeight: '1.6',
      display: 'none',
      listStyleType: 'disc',
    });
    this.root.appendChild(this.detailsList);

    this.applyVariant();
  }

  getElement(): HTMLDivElement {
    return this.root;
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
    this.mounted = true;
    requestAnimationFrame(() => {
      this.root.style.opacity = '1';
      this.root.style.transform = 'translateY(0)';
    });
  }

  unmount(): void {
    this.root.style.opacity = '0';
    this.root.style.transform = 'translateY(6px)';
    setTimeout(() => {
      this.root.remove();
      this.mounted = false;
    }, 300);
  }

  update(patch: Partial<ValidationAlertOptions>): void {
    if (patch.variant !== undefined) this.opts.variant = patch.variant;
    if (patch.title !== undefined) this.opts.title = patch.title;
    if (patch.message !== undefined) this.opts.message = patch.message;
    if (patch.details !== undefined) this.opts.details = patch.details;
    if (patch.onDismiss !== undefined) this.opts.onDismiss = patch.onDismiss;
    if (patch.onRetry !== undefined) this.opts.onRetry = patch.onRetry;
    this.applyVariant();
  }

  dismiss(): void {
    if (this.opts.onDismiss) this.opts.onDismiss();
    this.unmount();
  }

  private applyVariant(): void {
    const variant = this.opts.variant ?? 'pending';
    if (variant === 'dismissed') {
      this.unmount();
      return;
    }

    const cfg = VARIANT_CFG[variant];

    this.root.style.background = cfg.bg;
    this.root.style.borderColor = cfg.border;
    this.root.style.boxShadow = '0 0 20px ' + cfg.glow;

    this.iconEl.textContent = cfg.icon;
    this.iconEl.style.color = cfg.color;

    if (variant === 'validating') {
      this.iconEl.animate(
        [{ opacity: '1' }, { opacity: '0.4' }, { opacity: '1' }],
        { duration: 1000, iterations: Infinity, easing: 'ease-in-out' },
      );
    } else {
      this.iconEl.getAnimations().forEach((a) => a.cancel());
    }

    this.titleEl.textContent = this.opts.title ?? this.defaultTitle(variant);

    if (this.opts.message) {
      this.messageEl.textContent = this.opts.message;
      this.messageEl.style.display = 'block';
    } else {
      this.messageEl.style.display = 'none';
    }

    if (this.opts.details && this.opts.details.length > 0) {
      this.detailsList.innerHTML = '';
      for (const d of this.opts.details) {
        const li = document.createElement('li');
        li.textContent = d;
        this.detailsList.appendChild(li);
      }
      this.detailsList.style.display = 'block';
    } else {
      this.detailsList.style.display = 'none';
    }

    const showRetry = (variant === 'error' || variant === 'invalid') && !!this.opts.onRetry;
    this.retryBtn.style.display = showRetry ? 'inline-flex' : 'none';

    const showDismiss = !this.opts.persistent && variant !== 'validating';
    this.dismissBtn.style.display = showDismiss ? 'block' : 'none';
  }

  private defaultTitle(variant: AlertVariant): string {
    switch (variant) {
      case 'pending': return 'Pending validation';
      case 'validating': return 'Validating\u2026';
      case 'valid': return 'Validation passed';
      case 'invalid': return 'Validation failed';
      case 'error': return 'Validation error';
      default: return '';
    }
  }
}
