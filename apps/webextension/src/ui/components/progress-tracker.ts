export type WorkflowStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

export interface WorkflowStep {
  id: string;
  label: string;
  status: WorkflowStatus;
  detail?: string;
}

export interface ProgressTrackerOptions {
  title: string;
  steps?: WorkflowStep[];
  status?: WorkflowStatus;
  message?: string;
  progress?: number;
  onCancel?: () => void;
}

const STATUS_CFG: Record<WorkflowStatus, { color: string; icon: string; glow: string }> = {
  idle:      { color: 'var(--cv-text-muted)',  icon: '\u25CB', glow: 'transparent' },
  running:   { color: 'var(--cv-accent)',       icon: '\u23F3', glow: 'var(--cv-accent-glow)' },
  success:   { color: 'var(--cv-success)',      icon: '\u2713', glow: 'rgba(52, 211, 153, 0.15)' },
  error:     { color: 'var(--cv-error)',        icon: '\u2715', glow: 'rgba(248, 113, 113, 0.15)' },
  cancelled: { color: 'var(--cv-warning)',      icon: '\u25A0', glow: 'rgba(251, 191, 36, 0.15)' },
};

export class ProgressTracker {
  private root: HTMLDivElement;
  private titleEl: HTMLSpanElement;
  private statusIconEl: HTMLSpanElement;
  private messageEl: HTMLDivElement;
  private progressBar: HTMLDivElement;
  private progressFill: HTMLDivElement;
  private stepsContainer: HTMLDivElement;
  private cancelBtn: HTMLButtonElement;
  private stepEls: Map<string, { row: HTMLDivElement; icon: HTMLSpanElement; label: HTMLSpanElement; detail: HTMLSpanElement }> = new Map();
  private opts: ProgressTrackerOptions;

  constructor(options: ProgressTrackerOptions) {
    this.opts = options;

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

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderBottom: '1px solid var(--cv-border)',
      background: 'rgba(15, 23, 42, 0.4)',
      gap: '8px',
    });

    const left = document.createElement('div');
    Object.assign(left.style, { display: 'flex', alignItems: 'center', gap: '8px', flex: '1' });

    this.statusIconEl = document.createElement('span');
    Object.assign(this.statusIconEl.style, { fontSize: '14px', fontWeight: '700', lineHeight: '1', transition: 'all var(--cv-transition)' });
    left.appendChild(this.statusIconEl);

    this.titleEl = document.createElement('span');
    Object.assign(this.titleEl.style, { fontWeight: '600', fontSize: '13px', color: 'var(--cv-text-primary)' });
    this.titleEl.textContent = options.title;
    left.appendChild(this.titleEl);

    header.appendChild(left);

    this.cancelBtn = document.createElement('button');
    Object.assign(this.cancelBtn.style, {
      padding: '4px 12px',
      fontSize: '11px',
      fontWeight: '500',
      background: 'rgba(248, 113, 113, 0.1)',
      color: 'var(--cv-error)',
      border: '1px solid rgba(248, 113, 113, 0.2)',
      borderRadius: 'var(--cv-radius-sm)',
      cursor: 'pointer',
      transition: 'all var(--cv-transition)',
      display: options.onCancel ? 'inline-flex' : 'none',
    });
    this.cancelBtn.textContent = 'Cancel';
    this.cancelBtn.addEventListener('mouseenter', () => {
      this.cancelBtn.style.background = 'rgba(248, 113, 113, 0.2)';
      this.cancelBtn.style.borderColor = 'rgba(248, 113, 113, 0.4)';
    });
    this.cancelBtn.addEventListener('mouseleave', () => {
      this.cancelBtn.style.background = 'rgba(248, 113, 113, 0.1)';
      this.cancelBtn.style.borderColor = 'rgba(248, 113, 113, 0.2)';
    });
    this.cancelBtn.addEventListener('click', () => options.onCancel?.());
    header.appendChild(this.cancelBtn);

    this.root.appendChild(header);

    const progressWrap = document.createElement('div');
    Object.assign(progressWrap.style, { padding: '0', background: 'rgba(15, 23, 42, 0.25)' });

    this.progressBar = document.createElement('div');
    Object.assign(this.progressBar.style, {
      height: '3px',
      width: '100%',
      background: 'rgba(148, 163, 184, 0.08)',
      overflow: 'hidden',
    });

    this.progressFill = document.createElement('div');
    Object.assign(this.progressFill.style, {
      height: '100%',
      width: '0%',
      background: 'var(--cv-accent-gradient)',
      borderRadius: '2px',
      transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
    });
    this.progressBar.appendChild(this.progressFill);
    progressWrap.appendChild(this.progressBar);
    this.root.appendChild(progressWrap);

    this.messageEl = document.createElement('div');
    Object.assign(this.messageEl.style, {
      padding: '8px 14px',
      fontSize: '12px',
      color: 'var(--cv-text-muted)',
      lineHeight: '1.4',
      display: 'none',
      borderBottom: '1px solid var(--cv-border)',
    });
    this.root.appendChild(this.messageEl);

    this.stepsContainer = document.createElement('div');
    Object.assign(this.stepsContainer.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
    });
    this.root.appendChild(this.stepsContainer);

    this.render();
  }

  getElement(): HTMLDivElement {
    return this.root;
  }

  update(patch: Partial<ProgressTrackerOptions>): void {
    if (patch.title !== undefined) this.opts.title = patch.title;
    if (patch.steps !== undefined) this.opts.steps = patch.steps;
    if (patch.status !== undefined) this.opts.status = patch.status;
    if (patch.message !== undefined) this.opts.message = patch.message;
    if (patch.progress !== undefined) this.opts.progress = patch.progress;
    this.render();
  }

  private render(): void {
    const status = this.opts.status ?? 'idle';
    const cfg = STATUS_CFG[status];

    this.statusIconEl.textContent = cfg.icon;
    this.statusIconEl.style.color = cfg.color;
    this.titleEl.textContent = this.opts.title;

    if (status === 'running') {
      this.statusIconEl.animate(
        [{ opacity: '1' }, { opacity: '0.4' }, { opacity: '1' }],
        { duration: 1200, iterations: Infinity, easing: 'ease-in-out' },
      );
    } else {
      this.statusIconEl.getAnimations().forEach((a) => a.cancel());
    }

    const showCancel = status === 'running' && this.opts.onCancel;
    this.cancelBtn.style.display = showCancel ? 'inline-flex' : 'none';

    const pct = this.opts.progress ?? 0;
    this.progressFill.style.width = Math.min(100, Math.max(0, pct)) + '%';
    this.progressFill.style.background = status === 'error'
      ? 'var(--cv-error)'
      : status === 'success'
        ? 'var(--cv-success)'
        : 'var(--cv-accent-gradient)';

    if (status === 'running' && pct === 0) {
      this.progressFill.style.width = '100%';
      this.progressFill.style.animation = 'cv-progress-indeterminate 1.8s ease-in-out infinite';
    } else {
      this.progressFill.style.animation = 'none';
    }

    if (this.opts.message) {
      this.messageEl.textContent = this.opts.message;
      this.messageEl.style.display = 'block';
      this.messageEl.style.color = status === 'error' ? 'var(--cv-error)' : 'var(--cv-text-muted)';
    } else {
      this.messageEl.style.display = 'none';
    }

    if (this.opts.steps) {
      for (const step of this.opts.steps) {
        const existing = this.stepEls.get(step.id);
        if (existing) {
          const sCfg = STATUS_CFG[step.status];
          existing.icon.textContent = sCfg.icon;
          existing.icon.style.color = sCfg.color;
          existing.label.style.color = step.status === 'running'
            ? 'var(--cv-text-primary)'
            : step.status === 'success'
              ? 'var(--cv-text-secondary)'
              : 'var(--cv-text-muted)';
          existing.detail.textContent = step.detail ?? '';
          existing.detail.style.display = step.detail ? 'block' : 'none';
        } else {
          this.addStepRow(step);
        }
      }
    }
  }

  private addStepRow(step: WorkflowStep): void {
    const sCfg = STATUS_CFG[step.status];

    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '8px 14px',
      borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
      transition: 'background var(--cv-transition)',
    });
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(148, 163, 184, 0.03)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

    const icon = document.createElement('span');
    Object.assign(icon.style, {
      fontSize: '12px',
      fontWeight: '700',
      lineHeight: '1.5',
      width: '16px',
      textAlign: 'center',
      flexShrink: '0',
      color: sCfg.color,
    });
    icon.textContent = sCfg.icon;
    row.appendChild(icon);

    const textWrap = document.createElement('div');
    Object.assign(textWrap.style, { display: 'flex', flexDirection: 'column', gap: '2px', flex: '1', minWidth: '0' });

    const label = document.createElement('span');
    Object.assign(label.style, {
      fontSize: '12px',
      fontWeight: '500',
      color: step.status === 'running' ? 'var(--cv-text-primary)' : 'var(--cv-text-muted)',
      lineHeight: '1.5',
    });
    label.textContent = step.label;
    textWrap.appendChild(label);

    const detail = document.createElement('span');
    Object.assign(detail.style, {
      fontSize: '11px',
      color: 'var(--cv-text-muted)',
      lineHeight: '1.4',
      display: step.detail ? 'block' : 'none',
    });
    detail.textContent = step.detail ?? '';
    textWrap.appendChild(detail);

    row.appendChild(textWrap);
    this.stepsContainer.appendChild(row);
    this.stepEls.set(step.id, { row, icon, label, detail });
  }
}
