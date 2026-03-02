export type ToastVariant = 'success' | 'warning' | 'error' | 'info';
interface ToastOptions { message: string; variant?: ToastVariant; duration?: number; }
const CFG: Record<ToastVariant, { icon: string; color: string; glow: string }> = {
  success: { icon: '✓', color: '#34d399', glow: 'rgba(52,211,153,0.15)' },
  warning: { icon: '⚠', color: '#fbbf24', glow: 'rgba(251,191,36,0.15)' },
  error: { icon: '✕', color: '#f87171', glow: 'rgba(248,113,113,0.15)' },
  info: { icon: 'ℹ', color: '#22d3ee', glow: 'rgba(34,211,238,0.15)' },
};
let container: HTMLDivElement | null = null;
function ensureContainer(): HTMLDivElement {
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  Object.assign(container.style, { position: 'fixed', top: '16px', right: '16px', zIndex: '10000', display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' });
  document.body.appendChild(container);
  return container;
}
export function showToast(options: ToastOptions): void {
  const { message, variant = 'info', duration = 4000 } = options;
  const c = CFG[variant]; const host = ensureContainer();
  const toast = document.createElement('div');
  Object.assign(toast.style, {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px',
    borderRadius: 'var(--cv-radius-md)', background: 'rgba(15, 23, 42, 0.85)',
    border: '1px solid var(--cv-border)', borderLeft: `3px solid ${c.color}`,
    color: 'var(--cv-text-primary)', fontSize: '13px',
    boxShadow: `var(--cv-shadow-lg), 0 0 30px ${c.glow}`,
    pointerEvents: 'auto', opacity: '0', transform: 'translateX(30px) scale(0.95)',
    transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)', maxWidth: '380px',
    backdropFilter: 'var(--cv-blur-heavy)',
  });
  const icon = document.createElement('span');
  Object.assign(icon.style, { fontSize: '14px', fontWeight: '700', color: c.color, flexShrink: '0' });
  icon.textContent = c.icon; toast.appendChild(icon);
  const text = document.createElement('span'); text.textContent = message; text.style.flex = '1'; text.style.lineHeight = '1.4'; toast.appendChild(text);
  const close = document.createElement('button');
  Object.assign(close.style, { background: 'none', border: 'none', color: 'var(--cv-text-muted)', cursor: 'pointer', fontSize: '16px', padding: '0', lineHeight: '1', flexShrink: '0', transition: 'color var(--cv-transition)' });
  close.textContent = '×';
  close.addEventListener('mouseenter', () => { close.style.color = 'var(--cv-text-primary)'; });
  close.addEventListener('mouseleave', () => { close.style.color = 'var(--cv-text-muted)'; });
  close.addEventListener('click', () => dismiss()); toast.appendChild(close);
  host.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0) scale(1)'; });
  function dismiss() { toast.style.opacity = '0'; toast.style.transform = 'translateX(30px) scale(0.95)'; setTimeout(() => toast.remove(), 300); }
  if (duration > 0) setTimeout(dismiss, duration);
}
