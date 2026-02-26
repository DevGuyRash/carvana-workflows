import { createBadge, BadgeVariant } from './ui/components/badge';
import { createButton } from './ui/components/modal';
import { sendTabMessage, queryActiveTab, sendRuntimeMessage } from './shared/webext-async';
import type { RuntimeResponse } from './shared/messages';
import type { UiRuleSummary } from './shared/runtime';

interface DetectedSite {
  site: string;
  siteKey: string;
  url: string;
  tabId: number;
}

// RuleInfo replaced by UiRuleSummary from WASM bridge



function el(tag: string, styles: Record<string, string> = {}): HTMLElement {
  const element = document.createElement(tag);
  Object.assign(element.style, styles);
  return element;
}

async function detectCurrentSite(): Promise<DetectedSite | null> {
  try {
    const tab = await queryActiveTab();
    if (!tab?.url || !tab.id) return null;
    const response = await sendRuntimeMessage<
      { kind: 'detect-site'; payload: { url: string } },
      RuntimeResponse
    >({
      kind: 'detect-site',
      payload: { url: tab.url },
    });
    const payload = (response?.data ?? {}) as Record<string, unknown>;
    const siteKey = typeof payload.site === 'string' ? payload.site : 'unsupported';
    if (siteKey === 'unsupported') return null;
    return { site: siteKey.charAt(0).toUpperCase() + siteKey.slice(1), siteKey, url: tab.url, tabId: tab.id };
  } catch {
    return null;
  }
}

async function loadRulesForSite(tabId: number, siteKey: string): Promise<UiRuleSummary[]> {
  try {
    const response = await sendTabMessage<
      { kind: 'get-ui-rules'; payload: { site: string } },
      RuntimeResponse
    >(tabId, {
      kind: 'get-ui-rules',
      payload: { site: siteKey },
    });
    if (!response?.ok || !Array.isArray(response.data)) return [];
    return response.data as UiRuleSummary[];
  } catch {
    return [];
  }
}

async function runRule(tabId: number, ruleId: string, siteKey: string, statusEl: HTMLElement): Promise<void> {
  statusEl.textContent = '\u23F3 Running\u2026';
  statusEl.style.color = '#3b82f6';
  statusEl.style.opacity = '1';
  try {
    const result = await sendTabMessage(tabId, {
      kind: 'run-rule',
      payload: { ruleId, site: siteKey },
    });
    if (!result || typeof result !== 'object') {
      throw new Error('Rule execution did not return a response');
    }
    const responseLike = result as Record<string, unknown> | undefined;
    if (responseLike?.ok === false) {
      throw new Error(String(responseLike.error ?? 'Rule execution failed'));
    }
    const status = typeof responseLike?.status === 'string' ? responseLike.status.toLowerCase() : '';
    if (status === 'failed' || status === 'error' || status === 'partial') {
      throw new Error(String(responseLike?.error ?? `Rule execution ended with status: ${status}`));
    }
    statusEl.textContent = '\u2713 Done';
    statusEl.style.color = '#34d399';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    statusEl.textContent = '\u2715 Failed';
    statusEl.style.color = '#f87171';
    statusEl.title = msg;
  }
  setTimeout(() => {
    statusEl.style.opacity = '0';
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.style.opacity = '1';
      statusEl.title = '';
    }, 300);
  }, 3000);
}

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @keyframes cv-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes cv-fade-in {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleTag);

  const container = el('div', {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: 'var(--cv-bg-primary, #080c14)',
    minWidth: '320px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  });

  /* ── Header ── */
  const header = el('div', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  });

  const titleGroup = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
  const logo = el('span', { fontSize: '18px', lineHeight: '1' });
  logo.textContent = '\u26A1';
  titleGroup.appendChild(logo);

  const title = el('span', {
    fontSize: '15px',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    background: 'var(--cv-accent-gradient, linear-gradient(135deg, #3b82f6, #8b5cf6))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  });
  title.textContent = 'Carvana Extension';
  titleGroup.appendChild(title);
  header.appendChild(titleGroup);

  const version = el('span', {
    fontSize: '10px',
    fontWeight: '600',
    color: '#60a5fa',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    padding: '2px 8px',
    borderRadius: '9999px',
    letterSpacing: '0.04em',
  });
  version.textContent = 'v0.2.0';
  header.appendChild(version);
  container.appendChild(header);

  container.appendChild(el('div', {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.15), transparent)',
  }));

  /* ── Site detection ── */
  const siteData = await detectCurrentSite();

  const siteRow = el('div', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: 'var(--cv-bg-glass, rgba(15, 23, 42, 0.4))',
    borderRadius: '10px',
    border: '1px solid var(--cv-border, rgba(148, 163, 184, 0.1))',
  });

  const siteLabel = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });

  const siteDot = el('span', {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: '0',
    background: siteData ? '#34d399' : '#475569',
    boxShadow: siteData ? '0 0 8px rgba(52, 211, 153, 0.4)' : 'none',
    animation: siteData ? 'cv-pulse 2s ease-in-out infinite' : 'none',
  });
  siteLabel.appendChild(siteDot);

  const siteText = el('span', {
    fontSize: '13px',
    fontWeight: siteData ? '600' : '500',
    color: siteData ? '#e2e8f0' : '#64748b',
  });
  siteText.textContent = siteData ? siteData.site : 'No supported site';
  siteLabel.appendChild(siteText);
  siteRow.appendChild(siteLabel);
  siteRow.appendChild(createBadge(siteData ? 'Connected' : 'Idle', siteData ? 'success' : 'neutral'));
  container.appendChild(siteRow);

  /* ── Rules list ── */
  if (siteData) {
    const rules = await loadRulesForSite(siteData.tabId, siteData.siteKey);
    const accent = rules.length > 0 ? rules[0].site_accent : '#3b82f6';

    if (rules.length > 0) {
      const rulesHeader = el('div', {
        fontSize: '10px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#64748b',
        padding: '4px 0 0',
      });
      rulesHeader.textContent = `Available Rules (${rules.length})`;
      container.appendChild(rulesHeader);

      const statusEl = el('div', {
        fontSize: '11px',
        textAlign: 'center',
        minHeight: '16px',
        transition: 'opacity 300ms ease',
      });

      for (const rule of rules) {
        const row = el('div', {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '10px',
          border: '1px solid var(--cv-border, rgba(148, 163, 184, 0.1))',
          borderLeft: `3px solid ${accent}`,
          gap: '10px',
          transition: 'var(--cv-transition, 200ms cubic-bezier(0.4, 0, 0.2, 1))',
          cursor: 'default',
          animation: 'cv-fade-in 300ms ease both',
        });
        row.addEventListener('mouseenter', () => {
          row.style.background = 'rgba(15, 23, 42, 0.7)';
          row.style.transform = 'scale(1.01)';
          row.style.borderColor = 'rgba(59, 130, 246, 0.25)';
        });
        row.addEventListener('mouseleave', () => {
          row.style.background = 'rgba(15, 23, 42, 0.5)';
          row.style.transform = 'scale(1)';
          row.style.borderColor = 'var(--cv-border, rgba(148, 163, 184, 0.1))';
          row.style.borderLeft = `3px solid ${accent}`;
        });

        const info = el('div', { display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '0' });
        const name = el('span', {
          fontSize: '12px',
          fontWeight: '600',
          color: '#e2e8f0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        });
        name.textContent = rule.label;
        info.appendChild(name);

        const catBadge = createBadge(rule.category, (rule.category_variant ?? 'neutral') as BadgeVariant);
        info.appendChild(catBadge);
        row.appendChild(info);

        const runBtn = createButton('\u25B6', 'primary');
        Object.assign(runBtn.style, {
          padding: '6px 14px',
          fontSize: '11px',
          flexShrink: '0',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          border: 'none',
          color: '#ffffff',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'var(--cv-transition, 200ms cubic-bezier(0.4, 0, 0.2, 1))',
          boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)',
        });
        runBtn.title = `Run: ${rule.label}`;
        runBtn.addEventListener('mouseenter', () => {
          runBtn.style.boxShadow = '0 0 16px rgba(59, 130, 246, 0.45)';
          runBtn.style.transform = 'scale(1.05)';
        });
        runBtn.addEventListener('mouseleave', () => {
          runBtn.style.boxShadow = '0 0 0 0 rgba(59, 130, 246, 0)';
          runBtn.style.transform = 'scale(1)';
        });
        runBtn.addEventListener('click', () => runRule(siteData.tabId, rule.id, siteData.siteKey, statusEl));
        row.appendChild(runBtn);

        container.appendChild(row);
      }

      container.appendChild(statusEl);
    }
  }

  container.appendChild(el('div', {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.15), transparent)',
  }));

  /* ── Open Control Center ── */
  const openBtn = createButton('Open Control Center', 'secondary');
  Object.assign(openBtn.style, {
    width: '100%',
    padding: '10px',
    fontSize: '12px',
    fontWeight: '600',
    background: 'var(--cv-bg-glass, rgba(15, 23, 42, 0.4))',
    border: '1px solid var(--cv-border-active, rgba(59, 130, 246, 0.4))',
    borderRadius: '10px',
    color: '#94a3b8',
    cursor: 'pointer',
    transition: 'var(--cv-transition, 200ms cubic-bezier(0.4, 0, 0.2, 1))',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  });
  openBtn.addEventListener('mouseenter', () => {
    openBtn.style.borderColor = '#3b82f6';
    openBtn.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.25)';
    openBtn.style.color = '#e2e8f0';
  });
  openBtn.addEventListener('mouseleave', () => {
    openBtn.style.borderColor = 'var(--cv-border-active, rgba(59, 130, 246, 0.4))';
    openBtn.style.boxShadow = 'none';
    openBtn.style.color = '#94a3b8';
  });
  openBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('extension.html') });
    window.close();
  });
  container.appendChild(openBtn);

  app.appendChild(container);
}

init();
