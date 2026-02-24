import { createPanelShell } from './ui/layouts/panel-shell';
import { createCard, getCardBody } from './ui/components/card';
import { createBadge } from './ui/components/badge';
import { createButton } from './ui/components/modal';
import { showToast } from './ui/components/toast';
import { createResultViewer, ResultArtifact } from './ui/components/result-viewer';
import { ProgressTracker } from './ui/components/progress-tracker';
import { ValidationAlert } from './ui/components/validation-alert';
import { sendRuntimeMessage, sendTabMessage, queryActiveTab } from './shared/webext-async';
import type { RuntimeResponse } from './shared/messages';
import type { RustRuleDefinition } from './shared/runtime';

interface RuleSummary {
  id: string;
  label: string;
  site: string;
  category: string;
}

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

const LONG_RUNNING_RULES = new Set([
  'jira.jql.builder',
  'carma.bulk.search.scrape',
  'oracle.invoice.create',
]);

const VALIDATION_RULES = new Set([
  'oracle.invoice.validation.alert',
]);

const DATA_CAPTURE_RULES = new Set([
  'jira.issue.capture.table',
  'carma.bulk.search.scrape',
]);

async function detectSite(): Promise<string | null> {
  try {
    const tab = await queryActiveTab();
    if (!tab?.url) return null;
    const response = await sendRuntimeMessage<
      { kind: 'detect-site'; payload: { url: string } },
      RuntimeResponse
    >({
      kind: 'detect-site',
      payload: { url: tab.url },
    });
    if (!response?.ok) return null;
    const payload = (response.data ?? {}) as Record<string, unknown>;
    const site = typeof payload.site === 'string' ? payload.site : 'unsupported';
    return site === 'unsupported' ? null : site;
  } catch {
    return null;
  }
}

function normalizeCategory(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized === 'ui_enhancement') return 'UI';
  if (normalized === 'data_capture') return 'Data';
  if (normalized === 'form_automation') return 'Form';
  if (normalized === 'navigation') return 'Nav';
  if (normalized === 'validation') return 'Check';
  return category;
}

async function loadRulesForSite(site: string): Promise<RuleSummary[]> {
  try {
    const tab = await queryActiveTab();
    if (!tab?.id) return [];

    const response = await sendTabMessage<
      { kind: 'get-rules'; payload: { site: string } },
      RuntimeResponse
    >(tab.id, {
      kind: 'get-rules',
      payload: { site },
    });

    if (!response?.ok || !Array.isArray(response.data)) return [];
    const rules = response.data as RustRuleDefinition[];
    return rules
      .filter((rule) => rule.site === site)
      .filter((rule) => typeof rule.priority === 'number' && rule.priority < 200)
      .map((rule) => ({
        id: rule.id,
        label: rule.label,
        site: rule.site,
        category: normalizeCategory(rule.category),
      }));
  } catch {
    return [];
  }
}

function parseResultToArtifact(ruleId: string, ruleLabel: string, raw: unknown): ResultArtifact | null {
  if (!raw || typeof raw !== 'object') return null;
  const resp = raw as Record<string, unknown>;
  const data = resp.data ?? resp;

  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    const rows = data as Record<string, string>[];
    const keys = Object.keys(rows[0]);
    return {
      type: 'table',
      title: ruleLabel,
      columns: keys.map((k) => ({ key: k, label: k, sortable: true })),
      rows,
      meta: { Rule: ruleId, Rows: String(rows.length), Captured: new Date().toLocaleTimeString() },
    };
  }

  if (typeof data === 'object' && data !== null) {
    return {
      type: 'json',
      title: ruleLabel,
      json: data,
      meta: { Rule: ruleId, Captured: new Date().toLocaleTimeString() },
    };
  }

  return {
    type: 'text',
    title: ruleLabel,
    text: String(data),
    meta: { Rule: ruleId },
  };
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
    @keyframes cv-progress-indeterminate {
      0%   { transform: translateX(-100%); }
      50%  { transform: translateX(0%); }
      100% { transform: translateX(100%); }
    }
  `;
  document.head.appendChild(styleTag);

  const site = await detectSite();

  if (!site) {
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
      boxShadow: '0 0 10px ' + accent + '66',
      animation: 'cv-pulse 2s ease-in-out infinite',
    });
    siteRow.appendChild(siteDot);

    const siteLabel = document.createElement('span');
    Object.assign(siteLabel.style, { fontSize: '13px', color: '#94a3b8' });
    siteLabel.textContent = 'Connected to';
    siteRow.appendChild(siteLabel);

    const siteBadge = document.createElement('span');
    Object.assign(siteBadge.style, {
      fontSize: '12px',
      fontWeight: '700',
      color: accent,
      background: accent + '15',
      border: '1px solid ' + accent + '33',
      padding: '2px 10px',
      borderRadius: '9999px',
      letterSpacing: '0.02em',
    });
    siteBadge.textContent = displayName;
    siteRow.appendChild(siteBadge);

    content.appendChild(siteRow);

    const resultArea = document.createElement('div');
    Object.assign(resultArea.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    });

    const rules = await loadRulesForSite(site);
    for (let idx = 0; idx < rules.length; idx++) {
      const rule = rules[idx];
      const card = createCard({ title: rule.label });

      Object.assign(card.style, {
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid var(--cv-border, rgba(148, 163, 184, 0.1))',
        borderLeft: '3px solid ' + accent,
        borderRadius: '12px',
        transition: 'var(--cv-transition, 200ms cubic-bezier(0.4, 0, 0.2, 1))',
        animation: 'cv-card-in 350ms ease ' + (idx * 60) + 'ms both',
        cursor: 'default',
      });
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px ' + accent + '44';
        card.style.borderColor = accent + '66';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
        card.style.borderColor = 'var(--cv-border, rgba(148, 163, 184, 0.1))';
        card.style.borderLeft = '3px solid ' + accent;
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
        const isLongRunning = LONG_RUNNING_RULES.has(rule.id);
        const isValidation = VALIDATION_RULES.has(rule.id);
        const isDataCapture = DATA_CAPTURE_RULES.has(rule.id);

        let tracker: ProgressTracker | null = null;
        let alert: ValidationAlert | null = null;

        if (isLongRunning) {
          tracker = new ProgressTracker({
            title: rule.label,
            status: 'running',
            message: 'Executing workflow\u2026',
            steps: [
              { id: 'init', label: 'Initialize', status: 'running' },
              { id: 'exec', label: 'Execute actions', status: 'idle' },
              { id: 'collect', label: 'Collect results', status: 'idle' },
            ],
            onCancel: () => {
              tracker?.update({ status: 'cancelled', message: 'Cancelled by user' });
              showToast({ message: rule.label + ' cancelled', variant: 'warning' });
            },
          });
          resultArea.prepend(tracker.getElement());
        } else if (isValidation) {
          alert = new ValidationAlert({
            variant: 'validating',
            title: rule.label,
            message: 'Running validation checks\u2026',
          });
          alert.mount(resultArea);
        } else {
          showToast({ message: 'Running: ' + rule.label, variant: 'info' });
        }

        try {
          const tab = await queryActiveTab();
          if (!tab?.id) throw new Error('No active tab');

          if (tracker) {
            tracker.update({
              steps: [
                { id: 'init', label: 'Initialize', status: 'success' },
                { id: 'exec', label: 'Execute actions', status: 'running' },
                { id: 'collect', label: 'Collect results', status: 'idle' },
              ],
              progress: 33,
            });
          }

          const result = await sendTabMessage(tab.id, {
            kind: 'run-rule-with-result-mode' as const,
            payload: { ruleId: rule.id, site: rule.site, resultMode: 'return' },
          });

          if (tracker) {
            tracker.update({
              status: 'success',
              progress: 100,
              message: 'Workflow complete',
              steps: [
                { id: 'init', label: 'Initialize', status: 'success' },
                { id: 'exec', label: 'Execute actions', status: 'success' },
                { id: 'collect', label: 'Collect results', status: 'success' },
              ],
            });
          }

          if (alert) {
            const resp = result as Record<string, unknown> | undefined;
            const ok = resp?.ok !== false;
            alert.update({
              variant: ok ? 'valid' : 'invalid',
              title: ok ? 'Validation passed' : 'Validation failed',
              message: ok ? 'All checks completed successfully.' : String((resp as any)?.error ?? 'Check details below.'),
              onRetry: () => runBtn.click(),
            });
          }

          if (isDataCapture || (!isValidation && !isLongRunning)) {
            const artifact = parseResultToArtifact(rule.id, rule.label, result);
            if (artifact) {
              const viewer = createResultViewer({
                artifact,
                onDownload: (filename, mime, data) => {
                  void sendRuntimeMessage({ kind: 'download-result', payload: { filename, mime, data } });
                },
                onCopy: (data) => {
                  void sendRuntimeMessage({ kind: 'copy-result', payload: { data } });
                },
              });
              resultArea.prepend(viewer);
            }
          }

          if (!isLongRunning && !isValidation) {
            showToast({ message: '\u2713 ' + rule.label + ' complete', variant: 'success' });
          }

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (tracker) {
            tracker.update({ status: 'error', message: msg });
          } else if (alert) {
            alert.update({
              variant: 'error',
              title: 'Validation error',
              message: msg,
              onRetry: () => runBtn.click(),
            });
          } else {
            showToast({ message: '\u2715 ' + rule.label + ' failed', variant: 'error' });
          }
        }
      });

      body.appendChild(runBtn);
      content.appendChild(card);
    }

    content.appendChild(resultArea);
  }

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
