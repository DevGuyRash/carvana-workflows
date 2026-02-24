import { createPanelShell } from './ui/layouts/panel-shell';
import { createCard, getCardBody } from './ui/components/card';
import { createBadge } from './ui/components/badge';
import { createButton } from './ui/components/modal';
import { showToast } from './ui/components/toast';
import { sendRuntimeMessage, sendTabMessage, queryActiveTab } from './shared/webext-async';

interface RuleSummary {
  id: string;
  label: string;
  site: string;
  category: string;
}

const BUILTIN_RULES: Record<string, RuleSummary[]> = {
  jira: [
    { id: 'jira.jql.builder', label: 'Search Builder', site: 'jira', category: 'UI' },
    { id: 'jira.issue.capture.table', label: 'Capture Table', site: 'jira', category: 'Data' },
  ],
  oracle: [
    { id: 'oracle.search.invoice.expand', label: 'Expand Invoice', site: 'oracle', category: 'Nav' },
    { id: 'oracle.invoice.validation.alert', label: 'Validation Alert', site: 'oracle', category: 'Check' },
    { id: 'oracle.invoice.create', label: 'Create Invoice', site: 'oracle', category: 'Form' },
  ],
  carma: [
    { id: 'carma.bulk.search.scrape', label: 'Bulk Scrape', site: 'carma', category: 'Data' },
  ],
};

const SITE_ACCENT: Record<string, string> = {
  jira: '#22d3ee',
  oracle: '#fbbf24',
  carma: '#34d399',
};

const SITE_LABEL: Record<string, string> = {
  jira: 'Jira',
  oracle: 'Oracle',
  carma: 'Carma',
};

async function detectSite(): Promise<string | null> {
  try {
    const tab = await queryActiveTab();
    if (!tab?.url) return null;
    if (tab.url.includes('jira.carvana.com')) return 'jira';
    if (tab.url.includes('fa.us2.oraclecloud.com')) return 'oracle';
    if (tab.url.includes('carma.cvnacorp.com')) return 'carma';
    return null;
  } catch {
    return null;
  }
}

async function init() {
  const { root, content } = createPanelShell();

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @keyframes cv-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes cv-card-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes cv-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
  `;
  document.head.appendChild(styleTag);

  const site = await detectSite();

  if (!site) {
    /* ── Empty state ── */
    const emptyWrap = document.createElement('div');
    Object.assign(emptyWrap.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      gap: '16px',
      textAlign: 'center',
    });

    const globe = document.createElement('div');
    Object.assign(globe.style, {
      fontSize: '48px',
      lineHeight: '1',
      opacity: '0.25',
      animation: 'cv-float 4s ease-in-out infinite',
      filter: 'grayscale(0.5)',
    });
    globe.textContent = '\uD83C\uDF10';
    emptyWrap.appendChild(globe);

    const emptyTitle = document.createElement('div');
    Object.assign(emptyTitle.style, {
      fontSize: '14px',
      fontWeight: '600',
      color: '#64748b',
      letterSpacing: '-0.01em',
    });
    emptyTitle.textContent = 'No supported site detected';
    emptyWrap.appendChild(emptyTitle);

    const emptyHint = document.createElement('div');
    Object.assign(emptyHint.style, {
      fontSize: '12px',
      color: '#475569',
      maxWidth: '220px',
      lineHeight: '1.5',
    });
    emptyHint.textContent = 'Navigate to Jira, Oracle Cloud, or Carma to unlock available automation rules.';
    emptyWrap.appendChild(emptyHint);

    content.appendChild(emptyWrap);
  } else {
    const accent = SITE_ACCENT[site] ?? '#3b82f6';
    const displayName = SITE_LABEL[site] ?? site;

    /* ── Site detection section ── */
    const siteRow = document.createElement('div');
    Object.assign(siteRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      background: 'var(--cv-bg-glass, rgba(15, 23, 42, 0.4))',
      borderRadius: '10px',
      border: '1px solid var(--cv-border, rgba(148, 163, 184, 0.1))',
      marginBottom: '4px',
    });

    const siteDot = document.createElement('span');
    Object.assign(siteDot.style, {
      width: '9px',
      height: '9px',
      borderRadius: '50%',
      display: 'inline-block',
      flexShrink: '0',
      background: accent,
      boxShadow: `0 0 10px ${accent}66`,
      animation: 'cv-pulse 2s ease-in-out infinite',
    });
    siteRow.appendChild(siteDot);

    const siteLabel = document.createElement('span');
    Object.assign(siteLabel.style, {
      fontSize: '13px',
      color: '#94a3b8',
    });
    siteLabel.textContent = 'Connected to';
    siteRow.appendChild(siteLabel);

    const siteBadge = document.createElement('span');
    Object.assign(siteBadge.style, {
      fontSize: '12px',
      fontWeight: '700',
      color: accent,
      background: `${accent}15`,
      border: `1px solid ${accent}33`,
      padding: '2px 10px',
      borderRadius: '9999px',
      letterSpacing: '0.02em',
    });
    siteBadge.textContent = displayName;
    siteRow.appendChild(siteBadge);

    content.appendChild(siteRow);

    /* ── Rule cards ── */
    const rules = BUILTIN_RULES[site] ?? [];
    for (let idx = 0; idx < rules.length; idx++) {
      const rule = rules[idx];
      const card = createCard({ title: rule.label });

      Object.assign(card.style, {
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid var(--cv-border, rgba(148, 163, 184, 0.1))',
        borderLeft: `3px solid ${accent}`,
        borderRadius: '12px',
        transition: 'var(--cv-transition, 200ms cubic-bezier(0.4, 0, 0.2, 1))',
        animation: `cv-card-in 350ms ease ${idx * 60}ms both`,
        cursor: 'default',
      });
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = `0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px ${accent}44`;
        card.style.borderColor = `${accent}66`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
        card.style.borderColor = 'var(--cv-border, rgba(148, 163, 184, 0.1))';
        card.style.borderLeft = `3px solid ${accent}`;
      });

      const body = getCardBody(card);
      Object.assign(body.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      });

      const catBadge = createBadge(rule.category, 'neutral');
      Object.assign(catBadge.style, {
        background: 'var(--cv-bg-glass, rgba(15, 23, 42, 0.4))',
        border: '1px solid var(--cv-border, rgba(148, 163, 184, 0.1))',
        borderRadius: '9999px',
        fontSize: '10px',
        fontWeight: '600',
        padding: '2px 8px',
        color: '#94a3b8',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      });
      body.appendChild(catBadge);

      const runBtn = createButton('\u25B6 Run', 'primary');
      Object.assign(runBtn.style, {
        padding: '6px 14px',
        fontSize: '11px',
        fontWeight: '700',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        border: 'none',
        color: '#ffffff',
        cursor: 'pointer',
        transition: 'var(--cv-transition, 200ms cubic-bezier(0.4, 0, 0.2, 1))',
        boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)',
      });
      runBtn.addEventListener('mouseenter', () => {
        runBtn.style.boxShadow = '0 0 18px rgba(59, 130, 246, 0.5)';
        runBtn.style.transform = 'scale(1.06)';
      });
      runBtn.addEventListener('mouseleave', () => {
        runBtn.style.boxShadow = '0 0 0 0 rgba(59, 130, 246, 0)';
        runBtn.style.transform = 'scale(1)';
      });
      runBtn.addEventListener('click', async () => {
        showToast({ message: `Running: ${rule.label}`, variant: 'info' });
        try {
          const tab = await queryActiveTab();
          if (tab?.id) {
            await sendTabMessage(tab.id, {
              kind: 'run-rule' as const,
              payload: { ruleId: rule.id, site: rule.site },
            });
            showToast({ message: `\u2713 ${rule.label} complete`, variant: 'success' });
          }
        } catch {
          showToast({ message: `\u2715 ${rule.label} failed`, variant: 'error' });
        }
      });
      body.appendChild(runBtn);
      content.appendChild(card);
    }
  }

  /* ── Open Full Control Center ── */
  const openFull = createButton('Open Full Control Center', 'secondary');
  Object.assign(openFull.style, {
    width: '100%',
    padding: '12px',
    marginTop: '8px',
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
  openFull.addEventListener('mouseenter', () => {
    openFull.style.borderColor = '#3b82f6';
    openFull.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.25)';
    openFull.style.color = '#e2e8f0';
  });
  openFull.addEventListener('mouseleave', () => {
    openFull.style.borderColor = 'var(--cv-border-active, rgba(59, 130, 246, 0.4))';
    openFull.style.boxShadow = 'none';
    openFull.style.color = '#94a3b8';
  });
  openFull.addEventListener('click', () => {
    const extUrl = chrome.runtime.getURL('extension.html');
    chrome.tabs.create({ url: extUrl });
  });
  content.appendChild(openFull);

  const app = document.getElementById('app');
  if (app) {
    app.appendChild(root);
  } else {
    document.body.appendChild(root);
  }
}

init();
