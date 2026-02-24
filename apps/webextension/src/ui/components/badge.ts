export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  success: { bg: 'rgba(52, 211, 153, 0.12)', text: '#34d399', border: 'rgba(52, 211, 153, 0.2)' },
  warning: { bg: 'rgba(251, 191, 36, 0.12)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.2)' },
  error: { bg: 'rgba(248, 113, 113, 0.12)', text: '#f87171', border: 'rgba(248, 113, 113, 0.2)' },
  info: { bg: 'rgba(34, 211, 238, 0.12)', text: '#22d3ee', border: 'rgba(34, 211, 238, 0.2)' },
  neutral: { bg: 'rgba(148, 163, 184, 0.08)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.12)' },
};

export function createBadge(text: string, variant: BadgeVariant = 'neutral'): HTMLSpanElement {
  const badge = document.createElement('span');
  const s = VARIANT_STYLES[variant];
  Object.assign(badge.style, {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: '9999px',
    fontSize: '10px',
    fontWeight: '600',
    lineHeight: '1.4',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    background: s.bg,
    color: s.text,
    border: `1px solid ${s.border}`,
    backdropFilter: 'blur(8px)',
    whiteSpace: 'nowrap',
  });
  badge.textContent = text;
  return badge;
}
