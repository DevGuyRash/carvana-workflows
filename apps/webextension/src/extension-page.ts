import { createPageShell } from './ui/layouts/page-shell';
import { createTabs, TabDef } from './ui/components/tabs';
import { createCard, getCardBody } from './ui/components/card';
import { createBadge, BadgeVariant } from './ui/components/badge';
import { createToggle } from './ui/components/toggle';
import { createSearchInput } from './ui/components/search-input';
import { DataTable, DataTableColumn } from './ui/components/data-table';
import { createFormField } from './ui/components/form-field';
import { createButton } from './ui/components/modal';
import { showToast } from './ui/components/toast';
import { storageGet, storageSet, sendRuntimeMessage } from './shared/webext-async';
import { createResultViewer, ResultArtifact } from './ui/components/result-viewer';
import { ProgressTracker } from './ui/components/progress-tracker';
import { ValidationAlert } from './ui/components/validation-alert';
import { loadCapturedData, saveCapturedData } from './shared/storage-bridge';
import { loadRuntime, UiRuleSummary } from './shared/runtime';

/* ─── Shared types ──────────────────────────────────────────────── */

interface SiteStatus {
  name: string;
  label: string;
  icon: string;
  connected: boolean;
  accentColor: string;
}

const SITES: SiteStatus[] = [
  { name: 'jira', label: 'Jira', icon: '🎫', connected: false, accentColor: '#22d3ee' },
  { name: 'oracle', label: 'Oracle FA', icon: '🏢', connected: false, accentColor: '#fbbf24' },
  { name: 'carma', label: 'Carma', icon: '🚗', connected: false, accentColor: '#34d399' },
];

let BUILTIN_RULES: UiRuleSummary[] = [];

async function loadBuiltinRules(): Promise<UiRuleSummary[]> {
  const wasm = await loadRuntime();
  if (!wasm) return [];
  const persistedStates = await storageGet<Record<string, boolean>>('cv_rules_state', {});

  if (wasm.ui_all_rules) {
    const summaries = wasm.ui_all_rules() as UiRuleSummary[];
    for (const rule of summaries) {
      if (persistedStates[rule.id] !== undefined) {
        rule.enabled = persistedStates[rule.id];
      }
    }
    return summaries;
  }

  const sites = ['jira', 'oracle', 'carma'];
  const rules: UiRuleSummary[] = [];

  for (const site of sites) {
    try {
      if (wasm.ui_rules_for_site) {
        const siteRules = wasm.ui_rules_for_site(site) as UiRuleSummary[];
        for (const rule of siteRules) {
          if (persistedStates[rule.id] !== undefined) {
            rule.enabled = persistedStates[rule.id];
          }
          rules.push(rule);
        }
      }
    } catch {
      // continue collecting from other sites
    }
  }

  return rules.sort((a, b) => a.label.localeCompare(b.label));
}


/* ─── Rule-run helpers (extracted from the Run-button handler) ─── */

interface RunFeedbackContext {
  tracker: ProgressTracker | null;
  alert: ValidationAlert | null;
  resultSlot: HTMLDivElement;
}
function classifyRule(rule: UiRuleSummary) {
  return {
    isDataCapture: rule.is_data_capture,
    isValidation: rule.is_validation,
    isLongRunning: rule.is_long_running,
  };
}

function runtimeFailureMessage(result: unknown): string | null {
  if (!result || typeof result !== 'object') return 'Rule execution did not return a response';
  const responseLike = result as Record<string, unknown>;
  if (responseLike.ok === false) {
    return String(responseLike.error ?? responseLike.message ?? 'Rule execution failed');
  }
  const status = typeof responseLike.status === 'string' ? responseLike.status.toLowerCase() : '';
  if (status === 'failed' || status === 'error' || status === 'partial') {
    return String(responseLike.error ?? responseLike.message ?? `Rule execution ended with status: ${status}`);
  }
  return null;
}

function initRunFeedback(
  rule: UiRuleSummary,
  card: HTMLElement,
): RunFeedbackContext {
  const { isLongRunning, isValidation } = classifyRule(rule);

  let tracker: ProgressTracker | null = null;
  let alert: ValidationAlert | null = null;
  const resultSlot = document.createElement('div');
  Object.assign(resultSlot.style, { marginTop: '8px' });
  card.appendChild(resultSlot);

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
    resultSlot.appendChild(tracker.getElement());
  } else if (isValidation) {
    alert = new ValidationAlert({
      variant: 'validating',
      title: rule.label,
      message: 'Running validation checks\u2026',
    });
    alert.mount(resultSlot);
  } else {
    showToast({ message: 'Running: ' + rule.label, variant: 'info' });
  }

  return { tracker, alert, resultSlot };
}

function advanceTrackerToExec(tracker: ProgressTracker): void {
  tracker.update({
    steps: [
      { id: 'init', label: 'Initialize', status: 'success' },
      { id: 'exec', label: 'Execute actions', status: 'running' },
      { id: 'collect', label: 'Collect results', status: 'idle' },
    ],
    progress: 33,
  });
}

function finalizeTracker(tracker: ProgressTracker): void {
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

function handleValidationResult(
  alert: ValidationAlert,
  result: unknown,
  retryFn: () => void,
): void {
  const resp = result as Record<string, unknown> | undefined;
  const ok = resp?.ok !== false;
  alert.update({
    variant: ok ? 'valid' : 'invalid',
    title: ok ? 'Validation passed' : 'Validation failed',
    message: ok ? 'All checks completed successfully.' : String((resp as any)?.error ?? 'See details.'),
    onRetry: retryFn,
  });
}

function handleDataCaptureResult(
  rule: UiRuleSummary,
  result: unknown,
  resultSlot: HTMLElement,
): void {
  const resp = (result ?? {}) as Record<string, unknown>;
  const data = resp.data ?? resp;
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    const rows = data as Record<string, string>[];
    const cols = Object.keys(rows[0]).map((k) => ({ key: k, label: k, sortable: true }));
    const artifact: ResultArtifact = {
      type: 'table',
      title: rule.label,
      columns: cols,
      rows,
      meta: { Rule: rule.id, Rows: String(rows.length), Captured: new Date().toLocaleTimeString() },
    };
    const viewer = createResultViewer({
      artifact,
      onDownload: (filename, mime, d) => {
        void sendRuntimeMessage({ kind: 'download-result', payload: { filename, mime, data: d } });
      },
      onCopy: (d) => {
        void sendRuntimeMessage({ kind: 'copy-result', payload: { data: d } });
      },
    });
    resultSlot.appendChild(viewer);
    void saveCapturedData(rule.site + '_' + rule.id, rows).catch(() => {});
  }
}

function handleRunError(
  err: unknown,
  rule: UiRuleSummary,
  ctx: RunFeedbackContext,
  retryFn: () => void,
): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (ctx.tracker) {
    ctx.tracker.update({ status: 'error', message: msg });
  } else if (ctx.alert) {
    ctx.alert.update({ variant: 'error', title: 'Error', message: msg, onRetry: retryFn });
  } else {
    showToast({ message: 'Cannot execute: not on ' + rule.site + ' page', variant: 'error' });
  }
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function gradientText(el: HTMLElement): void {
  Object.assign(el.style, {
    background: 'var(--cv-accent-gradient)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  });
}

function sectionHeading(text: string): HTMLElement {
  const h = document.createElement('h2');
  Object.assign(h.style, {
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--cv-text-muted)',
    padding: '0',
    margin: '0',
  });
  h.textContent = text;
  return h;
}

function createContainer(): HTMLDivElement {
  const c = document.createElement('div');
  Object.assign(c.style, {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    overflow: 'auto',
  });
  return c;
}

function emptyState(icon: string, message: string): HTMLDivElement {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    gap: '12px',
  });
  const ico = document.createElement('div');
  Object.assign(ico.style, { fontSize: '48px', opacity: '0.25', lineHeight: '1' });
  ico.textContent = icon;
  wrap.appendChild(ico);
  const msg = document.createElement('div');
  Object.assign(msg.style, {
    fontSize: '13px',
    color: 'var(--cv-text-muted)',
    textAlign: 'center',
    maxWidth: '280px',
    lineHeight: '1.5',
  });
  msg.textContent = message;
  wrap.appendChild(msg);
  return wrap;
}

function pulsingDot(color: string): HTMLSpanElement {
  const dot = document.createElement('span');
  Object.assign(dot.style, {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
    boxShadow: `0 0 6px ${color}`,
    flexShrink: '0',
  });
  if (color !== 'rgba(148, 163, 184, 0.3)') {
    dot.animate(
      [{ opacity: '1', boxShadow: `0 0 6px ${color}` }, { opacity: '0.4', boxShadow: `0 0 2px ${color}` }],
      { duration: 1500, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
    );
  }
  return dot;
}

function statItem(label: string, value: string, accent = false): HTMLDivElement {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1',
    minWidth: '0',
  });
  const num = document.createElement('div');
  Object.assign(num.style, { fontSize: '24px', fontWeight: '700', lineHeight: '1' });
  if (accent) gradientText(num);
  else num.style.color = 'var(--cv-text-primary)';
  num.textContent = value;
  wrap.appendChild(num);
  const lbl = document.createElement('div');
  Object.assign(lbl.style, { fontSize: '11px', color: 'var(--cv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' });
  lbl.textContent = label;
  wrap.appendChild(lbl);
  return wrap;
}

function glowButton(text: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  Object.assign(btn.style, {
    padding: '6px 16px',
    borderRadius: '9999px',
    border: '1px solid var(--cv-border)',
    background: 'var(--cv-bg-glass)',
    color: 'var(--cv-text-secondary)',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all var(--cv-transition)',
    backdropFilter: 'var(--cv-blur)',
    whiteSpace: 'nowrap',
  });
  btn.textContent = text;
  btn.addEventListener('mouseenter', () => {
    Object.assign(btn.style, {
      background: 'rgba(59, 130, 246, 0.12)',
      borderColor: 'var(--cv-border-active)',
      color: 'var(--cv-accent)',
      boxShadow: '0 0 16px rgba(59, 130, 246, 0.15)',
    });
  });
  btn.addEventListener('mouseleave', () => {
    Object.assign(btn.style, {
      background: 'var(--cv-bg-glass)',
      borderColor: 'var(--cv-border)',
      color: 'var(--cv-text-secondary)',
      boxShadow: 'none',
    });
  });
  btn.addEventListener('click', onClick);
  return btn;
}

/* ─── Dashboard ─────────────────────────────────────────────────── */

function renderDashboard(): HTMLElement {
  const container = createContainer();

  const titleRow = document.createElement('div');
  Object.assign(titleRow.style, { display: 'flex', alignItems: 'center', gap: '10px' });
  const title = document.createElement('h1');
  Object.assign(title.style, { fontSize: '20px', fontWeight: '700', margin: '0', lineHeight: '1.2' });
  title.textContent = 'Command Center';
  gradientText(title);
  titleRow.appendChild(title);
  const dot = pulsingDot('#3b82f6');
  Object.assign(dot.style, { width: '6px', height: '6px' });
  titleRow.appendChild(dot);
  container.appendChild(titleRow);

  /* ── Site status grid ── */
  container.appendChild(sectionHeading('Connected Sites'));
  const siteGrid = document.createElement('div');
  Object.assign(siteGrid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  });

  for (const site of SITES) {
    const card = document.createElement('div');
    Object.assign(card.style, {
      position: 'relative',
      background: 'var(--cv-bg-secondary)',
      border: '1px solid var(--cv-border)',
      borderRadius: 'var(--cv-radius-md)',
      overflow: 'hidden',
      backdropFilter: 'var(--cv-blur)',
      transition: 'all var(--cv-transition)',
      cursor: 'default',
    });
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = 'var(--cv-border-active)';
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = 'var(--cv-shadow-glow)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = 'var(--cv-border)';
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
    });

    const gradBar = document.createElement('div');
    Object.assign(gradBar.style, {
      height: '3px',
      background: `linear-gradient(90deg, ${site.accentColor}, transparent)`,
      opacity: '0.7',
    });
    card.appendChild(gradBar);

    const body = document.createElement('div');
    Object.assign(body.style, { padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' });

    const topRow = document.createElement('div');
    Object.assign(topRow.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
    const iconWrap = document.createElement('div');
    Object.assign(iconWrap.style, { fontSize: '28px', lineHeight: '1' });
    iconWrap.textContent = site.icon;
    topRow.appendChild(iconWrap);
    const statusDot = pulsingDot(site.connected ? '#34d399' : 'rgba(148, 163, 184, 0.3)');
    topRow.appendChild(statusDot);
    body.appendChild(topRow);

    const nameEl = document.createElement('div');
    Object.assign(nameEl.style, { fontSize: '14px', fontWeight: '600', color: 'var(--cv-text-primary)' });
    nameEl.textContent = site.label;
    body.appendChild(nameEl);

    const rulesCount = BUILTIN_RULES.filter(r => r.site === site.name).length;
    const metaRow = document.createElement('div');
    Object.assign(metaRow.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
    const rulesTxt = document.createElement('span');
    Object.assign(rulesTxt.style, { fontSize: '11px', color: 'var(--cv-text-muted)' });
    rulesTxt.textContent = `Rules: ${rulesCount} active`;
    metaRow.appendChild(rulesTxt);
    metaRow.appendChild(createBadge(site.connected ? 'Connected' : 'Idle', site.connected ? 'success' : 'neutral'));
    body.appendChild(metaRow);

    card.appendChild(body);
    siteGrid.appendChild(card);
  }
  container.appendChild(siteGrid);

  /* ── Quick Actions ── */
  container.appendChild(sectionHeading('Quick Actions'));
  const actionsRow = document.createElement('div');
  Object.assign(actionsRow.style, { display: 'flex', gap: '10px', flexWrap: 'wrap' });

  const quickRules = BUILTIN_RULES.slice(0, 3);
  for (const rule of quickRules) {
    const pill = glowButton(`▶ ${rule.label.split(': ')[1] ?? rule.label}`, () => {
      void sendRuntimeMessage({ kind: 'run-rule', payload: { ruleId: rule.id, site: rule.site } })
        .then((result) => {
          const runtimeFailure = runtimeFailureMessage(result);
          if (runtimeFailure) {
            showToast({ message: runtimeFailure, variant: 'error' });
          }
        })
        .catch(() => {
          showToast({ message: `Cannot execute: not on ${rule.site} page`, variant: 'error' });
        });
    });
    actionsRow.appendChild(pill);
  }
  container.appendChild(actionsRow);

  /* ── System Status ── */
  container.appendChild(sectionHeading('System Status'));
  const statusCard = createCard({ title: 'Overview' });
  const statusBody = getCardBody(statusCard);
  Object.assign(statusBody.style, { display: 'flex', gap: '24px', padding: '20px 18px' });
  statusBody.appendChild(statItem('Rules', String(BUILTIN_RULES.length), true));
  statusBody.appendChild(statItem('Sites', String(SITES.length), true));
  statusBody.appendChild(statItem('Theme', 'Midnight', false));
  container.appendChild(statusCard);

  /* ── Recent Activity ── */
  container.appendChild(sectionHeading('Recent Activity'));
  const recentCard = createCard({ title: 'Activity Feed' });
  const recentBody = getCardBody(recentCard);
  recentBody.appendChild(emptyState('📡', 'No recent rule executions. Run a rule to see activity here.'));
  container.appendChild(recentCard);

  return container;
}

/* ─── Rules ─────────────────────────────────────────────────────── */

function renderRules(): HTMLElement {
  const container = createContainer();

  /* ── Toolbar ── */
  const toolbar = document.createElement('div');
  Object.assign(toolbar.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  });

  const search = createSearchInput({
    placeholder: 'Search rules...',
    onSearch: (query) => { filterRules(query); },
  });
  search.style.flex = '1';
  search.style.maxWidth = '360px';
  toolbar.appendChild(search);

  const addBtn = createButton('+ Add Rule', 'primary');
  Object.assign(addBtn.style, {
    background: 'var(--cv-accent-gradient)',
    border: 'none',
    boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
    transition: 'all var(--cv-transition)',
  });
  addBtn.addEventListener('mouseenter', () => {
    addBtn.style.boxShadow = '0 0 30px rgba(59, 130, 246, 0.35)';
    addBtn.style.transform = 'translateY(-1px)';
  });
  addBtn.addEventListener('mouseleave', () => {
    addBtn.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.2)';
    addBtn.style.transform = 'translateY(0)';
  });
  addBtn.addEventListener('click', () => {
    showToast({ message: 'Custom rule editor coming soon', variant: 'info' });
  });
  toolbar.appendChild(addBtn);
  container.appendChild(toolbar);

  /* ── Filter chips ── */
  const chipNames = ['All', 'Jira', 'Oracle', 'Carma'];
  let activeChip = 'All';

  const chipRow = document.createElement('div');
  Object.assign(chipRow.style, { display: 'flex', gap: '8px', flexWrap: 'wrap' });

  const chipEls: Record<string, HTMLButtonElement> = {};

  function updateChipStyles() {
    for (const [name, el] of Object.entries(chipEls)) {
      const isActive = name === activeChip;
      Object.assign(el.style, {
        background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'var(--cv-bg-glass)',
        color: isActive ? 'var(--cv-accent)' : 'var(--cv-text-muted)',
        borderColor: isActive ? 'var(--cv-border-active)' : 'var(--cv-border)',
      });
    }
  }

  for (const name of chipNames) {
    const chip = document.createElement('button');
    Object.assign(chip.style, {
      padding: '5px 14px',
      borderRadius: '9999px',
      border: '1px solid var(--cv-border)',
      background: 'var(--cv-bg-glass)',
      color: 'var(--cv-text-muted)',
      fontSize: '11px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all var(--cv-transition)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    });
    chip.textContent = name;
    chip.addEventListener('click', () => {
      activeChip = name;
      updateChipStyles();
      filterRules(currentSearch);
    });
    chipEls[name] = chip;
    chipRow.appendChild(chip);
  }
  updateChipStyles();
  container.appendChild(chipRow);

  /* ── Rule list ── */
  const ruleList = document.createElement('div');
  ruleList.id = 'cv-rule-list';
  Object.assign(ruleList.style, { display: 'flex', flexDirection: 'column', gap: '10px' });
  container.appendChild(ruleList);

  let currentSearch = '';

  function renderRuleCards(rules: typeof BUILTIN_RULES) {
    ruleList.innerHTML = '';
    if (rules.length === 0) {
      ruleList.appendChild(emptyState('🔍', 'No rules match your search'));
      return;
    }
    for (const rule of rules) {
      
      const borderColor = rule.site_accent ?? 'var(--cv-border)';

      const card = document.createElement('div');
      Object.assign(card.style, {
        background: 'var(--cv-bg-secondary)',
        border: '1px solid var(--cv-border)',
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 'var(--cv-radius-md)',
        backdropFilter: 'var(--cv-blur)',
        transition: 'all var(--cv-transition)',
        overflow: 'hidden',
      });
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.borderColor = 'var(--cv-border-active)';
        card.style.borderLeftColor = borderColor;
        card.style.boxShadow = `0 0 20px ${borderColor}22, var(--cv-shadow-glow)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.borderColor = 'var(--cv-border)';
        card.style.borderLeftColor = borderColor;
        card.style.boxShadow = 'none';
      });

      const inner = document.createElement('div');
      Object.assign(inner.style, {
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
      });

      const left = document.createElement('div');
      Object.assign(left.style, { display: 'flex', flexDirection: 'column', gap: '8px', flex: '1', minWidth: '0' });
      const ruleTitle = document.createElement('div');
      Object.assign(ruleTitle.style, { fontSize: '13px', fontWeight: '600', color: 'var(--cv-text-primary)' });
      ruleTitle.textContent = rule.label;
      left.appendChild(ruleTitle);

      const badges = document.createElement('div');
      Object.assign(badges.style, { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' });
      badges.appendChild(createBadge(rule.site_label, (rule.site === 'jira' ? 'info' : rule.site === 'oracle' ? 'warning' : 'success') as BadgeVariant));
      badges.appendChild(createBadge(rule.category, (rule.category_variant ?? 'neutral') as BadgeVariant));
      if (rule.builtin) badges.appendChild(createBadge('Built-in', 'neutral'));
      left.appendChild(badges);
      inner.appendChild(left);

      const controls = document.createElement('div');
      Object.assign(controls.style, { display: 'flex', gap: '10px', alignItems: 'center', flexShrink: '0' });

      const runBtn = createButton('▶ Run', 'primary');
      Object.assign(runBtn.style, {
        background: 'var(--cv-accent-gradient)',
        border: 'none',
        fontSize: '11px',
        padding: '5px 14px',
        boxShadow: '0 0 12px rgba(59, 130, 246, 0.15)',
      });
      const syncRunButtonState = () => {
        runBtn.disabled = !rule.enabled;
        runBtn.style.opacity = rule.enabled ? '1' : '0.55';
        runBtn.style.cursor = rule.enabled ? 'pointer' : 'not-allowed';
      };
      syncRunButtonState();

      controls.appendChild(createToggle({
        checked: rule.enabled,
        onChange: (enabled) => {
          rule.enabled = enabled;
          const idx = BUILTIN_RULES.findIndex((candidate) => candidate.id === rule.id);
          if (idx >= 0) BUILTIN_RULES[idx].enabled = enabled;
          syncRunButtonState();
          void sendRuntimeMessage({
            kind: 'toggle-rule',
            payload: { ruleId: rule.id, enabled },
          }).catch(() => {
            rule.enabled = !enabled;
            if (idx >= 0) BUILTIN_RULES[idx].enabled = !enabled;
            syncRunButtonState();
            showToast({ message: `Failed to update ${rule.label}`, variant: 'error' });
          });
        },
      }));

      runBtn.addEventListener('click', async () => {
        if (!rule.enabled) {
          showToast({ message: `${rule.label} is disabled`, variant: 'warning' });
          return;
        }
        const { isDataCapture, isValidation, isLongRunning } = classifyRule(rule);
        const ctx = initRunFeedback(rule, card);

        try {
          if (ctx.tracker) advanceTrackerToExec(ctx.tracker);

          const result = await sendRuntimeMessage({
            kind: 'run-rule-with-result-mode' as const,
            payload: { ruleId: rule.id, site: rule.site, resultMode: 'return' },
          });

          const runtimeFailure = runtimeFailureMessage(result);
          if (runtimeFailure) {
            throw new Error(runtimeFailure);
          }

          if (ctx.tracker) finalizeTracker(ctx.tracker);
          if (ctx.alert) handleValidationResult(ctx.alert, result, () => runBtn.click());
          if (isDataCapture) handleDataCaptureResult(rule, result, ctx.resultSlot);

          if (!isLongRunning && !isValidation) {
            showToast({ message: '\u2713 ' + rule.label + ' complete', variant: 'success' });
          }
        } catch (err) {
          handleRunError(err, rule, ctx, () => runBtn.click());
        }
      });
      controls.appendChild(runBtn);
      inner.appendChild(controls);

      card.appendChild(inner);
      ruleList.appendChild(card);
    }
  }

  function filterRules(query: string) {
    currentSearch = query;
    const q = query.toLowerCase();
    const siteFilter = activeChip === 'All' ? null : activeChip.toLowerCase();
    const filtered = BUILTIN_RULES.filter((r) => {
      const matchesSearch = r.label.toLowerCase().includes(q) || r.site.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
      const matchesSite = !siteFilter || r.site.toLowerCase() === siteFilter;
      return matchesSearch && matchesSite;
    });
    renderRuleCards(filtered);
  }

  renderRuleCards(BUILTIN_RULES);

  return container;
}

/* ─── Data ──────────────────────────────────────────────────────── */

function renderData(): HTMLElement {
  const container = createContainer();
  Object.assign(container.style, { flex: '1' });

  const captureIndex: DataTableColumn[] = [
    { key: 'rule', label: 'Rule', width: '180px', sortable: true },
    { key: 'site', label: 'Site', width: '100px', sortable: true },
    { key: 'status', label: 'Status', width: '100px' },
    { key: 'rows', label: 'Rows', width: '80px', sortable: true },
    { key: 'timestamp', label: 'Captured', width: '180px', sortable: true },
  ];

  const indexTable = new DataTable({
    columns: captureIndex,
    data: [],
    title: 'Captured Data',
    searchable: true,
    exportable: true,
    popout: true,
    pageSize: 25,
    onRowClick: (_row, _idx) => {
      showCaptureDetail(_row);
    },
  });

  container.appendChild(indexTable.getElement());

  const detailArea = document.createElement('div');
  Object.assign(detailArea.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '12px',
  });
  container.appendChild(detailArea);

  function showCaptureDetail(row: Record<string, string>) {
    detailArea.innerHTML = '';
    const site = row.site ?? '';
    const ruleId = row.rule ?? '';
    void loadCapturedData(site + '_' + ruleId).then((capturedRows) => {
      if (!capturedRows || capturedRows.length === 0) {
        const msg = document.createElement('div');
        Object.assign(msg.style, {
          fontSize: '12px',
          color: 'var(--cv-text-muted)',
          padding: '16px',
          textAlign: 'center',
        });
        msg.textContent = 'No detail data stored for this capture.';
        detailArea.appendChild(msg);
        return;
      }
      const cols = Object.keys(capturedRows[0]).map((k) => ({ key: k, label: k, sortable: true }));
      const artifact: ResultArtifact = {
        type: 'table',
        title: ruleId + ' — ' + site,
        columns: cols,
        rows: capturedRows,
        meta: { Site: site, Rule: ruleId, Rows: String(capturedRows.length) },
      };
      const viewer = createResultViewer({
        artifact,
        onDownload: (filename, mime, data) => {
          void sendRuntimeMessage({ kind: 'download-result', payload: { filename, mime, data } });
        },
        onCopy: (data) => {
          void sendRuntimeMessage({ kind: 'copy-result', payload: { data } });
        },
      });
      detailArea.appendChild(viewer);
    });
  }

  void (async () => {
    try {
      const sites = ['jira', 'oracle', 'carma'];
      const captureRules: Record<string, string[]> = {
        jira: ['jira.issue.capture.table'],
        oracle: ['oracle.invoice.create'],
        carma: ['carma.bulk.search.scrape'],
      };
      const indexRows: Record<string, string>[] = [];
      for (const site of sites) {
        for (const ruleId of (captureRules[site] ?? [])) {
          const stored = await storageGet<Record<string, unknown> | null>('cv_last_run_' + site, null);
          if (stored) {
            const resp = stored as Record<string, unknown>;
            const data = resp.data ?? resp;
            const rowCount = Array.isArray(data) ? String(data.length) : '—';
            indexRows.push({
              rule: ruleId,
              site: site,
              status: resp.ok !== false ? '\u2713 OK' : '\u2715 Error',
              rows: rowCount,
              timestamp: new Date().toLocaleString(),
            });
          }
        }
      }
      if (indexRows.length > 0) {
        indexTable.setData(indexRows);
      }
    } catch {
      // silently continue
    }
  })();

  const emptyWrap = emptyState('\uD83D\uDCCA', 'Run a data capture rule to see results here');
  container.appendChild(emptyWrap);

  const hint = document.createElement('div');
  Object.assign(hint.style, {
    fontSize: '12px',
    color: 'var(--cv-text-muted)',
    textAlign: 'center',
    padding: '0 24px 12px',
    lineHeight: '1.5',
  });
  hint.textContent = 'Click a row to view full captured data with export options. Results persist until cleared.';
  container.appendChild(hint);

  return container;
}


/* ─── Settings ──────────────────────────────────────────────────── */

function renderSettings(): HTMLElement {
  const container = createContainer();
  Object.assign(container.style, { maxWidth: '680px' });

  /* ── General ── */
  container.appendChild(sectionHeading('General'));
  const generalCard = createCard({ title: 'Preferences' });
  const generalBody = getCardBody(generalCard);
  Object.assign(generalBody.style, { display: 'flex', flexDirection: 'column', gap: '16px' });

  generalBody.appendChild(createToggle({
    label: 'Auto-run rules on page load',
    checked: true,
    onChange: (val) => { storageSet({ cv_auto_run: val }).catch(() => {}); },
  }));
  generalBody.appendChild(createToggle({
    label: 'Show notifications',
    checked: true,
    onChange: (val) => { storageSet({ cv_notifications: val }).catch(() => {}); },
  }));
  generalBody.appendChild(createFormField({
    label: 'Log Level',
    type: 'select',
    value: 'info',
    options: [
      { value: 'debug', label: 'Debug' },
      { value: 'info', label: 'Info' },
      { value: 'warn', label: 'Warning' },
      { value: 'error', label: 'Error' },
    ],
    onChange: (val) => { storageSet({ cv_log_level: val }).catch(() => {}); },
  }));
  container.appendChild(generalCard);

  /* ── Theme ── */
  container.appendChild(sectionHeading('Theme'));
  const themeCard = createCard({ title: 'Appearance' });
  const themeBody = getCardBody(themeCard);
  Object.assign(themeBody.style, { display: 'flex', flexDirection: 'column', gap: '16px' });

  const themes = [
    { id: 'midnight', label: 'Midnight', accent: '#3b82f6', bg: '#0f172a' },
    { id: 'obsidian', label: 'Obsidian', accent: '#a78bfa', bg: '#09090b' },
    { id: 'daylight', label: 'Daylight', accent: '#2563eb', bg: '#ffffff' },
    { id: 'carvana-blue', label: 'Carvana Blue', accent: '#00b4d8', bg: '#0c1929' },
  ];

  const themeGrid = document.createElement('div');
  Object.assign(themeGrid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px',
  });

  let activeTheme = 'midnight';
  storageGet('cv_theme', 'midnight').then((val) => {
    activeTheme = val as string;
    updateThemeSelection();
  }).catch(() => {});

  const themeButtons: Record<string, HTMLDivElement> = {};

  for (const theme of themes) {
    const btn = document.createElement('div');
    Object.assign(btn.style, {
      position: 'relative',
      padding: '14px',
      borderRadius: 'var(--cv-radius-md)',
      border: '2px solid var(--cv-border)',
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'all var(--cv-transition)',
      background: 'var(--cv-bg-glass)',
      backdropFilter: 'var(--cv-blur)',
      overflow: 'hidden',
    });

    const swatch = document.createElement('div');
    Object.assign(swatch.style, {
      width: '100%',
      height: '48px',
      borderRadius: 'var(--cv-radius-sm)',
      marginBottom: '10px',
      background: `linear-gradient(135deg, ${theme.bg}, ${theme.accent})`,
      transition: 'transform var(--cv-transition)',
    });
    btn.appendChild(swatch);

    const labelRow = document.createElement('div');
    Object.assign(labelRow.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
    });

    const label = document.createElement('span');
    Object.assign(label.style, { fontSize: '12px', fontWeight: '600', color: 'var(--cv-text-secondary)' });
    label.textContent = theme.label;
    labelRow.appendChild(label);

    const checkmark = document.createElement('span');
    Object.assign(checkmark.style, {
      fontSize: '13px',
      color: 'var(--cv-accent)',
      display: 'none',
      transition: 'opacity var(--cv-transition)',
    });
    checkmark.textContent = '✓';
    checkmark.dataset.check = 'true';
    labelRow.appendChild(checkmark);

    btn.appendChild(labelRow);

    btn.addEventListener('mouseenter', () => {
      if (theme.id !== activeTheme) {
        btn.style.borderColor = 'rgba(148, 163, 184, 0.25)';
        swatch.style.transform = 'scale(1.02)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (theme.id !== activeTheme) {
        btn.style.borderColor = 'var(--cv-border)';
      }
      swatch.style.transform = 'scale(1)';
    });

    btn.addEventListener('click', () => {
      activeTheme = theme.id;
      storageSet({ cv_theme: theme.id }).catch(() => {});
      sendRuntimeMessage({ kind: 'theme-changed', payload: { themeId: theme.id } }).catch(() => {});
      updateThemeSelection();
      showToast({ message: `Theme: ${theme.label}`, variant: 'success' });
    });

    themeButtons[theme.id] = btn;
    themeGrid.appendChild(btn);
  }

  function updateThemeSelection() {
    for (const [id, btn] of Object.entries(themeButtons)) {
      const isActive = id === activeTheme;
      btn.style.borderColor = isActive ? 'var(--cv-accent)' : 'var(--cv-border)';
      btn.style.boxShadow = isActive ? '0 0 20px rgba(59, 130, 246, 0.2)' : 'none';
      const check = btn.querySelector('[data-check]') as HTMLElement | null;
      if (check) check.style.display = isActive ? 'inline' : 'none';
    }
  }

  themeBody.appendChild(themeGrid);
  container.appendChild(themeCard);

  /* ── Sites ── */
  container.appendChild(sectionHeading('Sites'));
  const sitesCard = createCard({ title: 'Connected Sites' });
  const sitesBody = getCardBody(sitesCard);
  Object.assign(sitesBody.style, { display: 'flex', flexDirection: 'column', gap: '14px' });

  for (const site of SITES) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 0',
      borderBottom: '1px solid var(--cv-border)',
    });

    const siteIcon = document.createElement('span');
    Object.assign(siteIcon.style, { fontSize: '20px', lineHeight: '1' });
    siteIcon.textContent = site.icon;
    row.appendChild(siteIcon);

    const siteLabel = document.createElement('span');
    Object.assign(siteLabel.style, { flex: '1', fontSize: '13px', fontWeight: '500', color: 'var(--cv-text-primary)' });
    siteLabel.textContent = site.label;
    row.appendChild(siteLabel);

    row.appendChild(createToggle({ checked: true }));
    sitesBody.appendChild(row);
  }
  container.appendChild(sitesCard);

  /* ── Storage ── */
  container.appendChild(sectionHeading('Storage'));
  const storageCard = createCard({ title: 'Data Management' });
  const storageBody = getCardBody(storageCard);
  Object.assign(storageBody.style, { display: 'flex', flexDirection: 'column', gap: '14px' });

  const storageInfo = document.createElement('div');
  Object.assign(storageInfo.style, { fontSize: '12px', color: 'var(--cv-text-muted)', lineHeight: '1.5' });
  storageInfo.textContent = 'Local storage is used to persist preferences, cached data, and rule configurations.';
  storageBody.appendChild(storageInfo);

  const storageBtnRow = document.createElement('div');
  Object.assign(storageBtnRow.style, { display: 'flex', gap: '10px', flexWrap: 'wrap' });

  const clearBtn = createButton('Clear All Data', 'danger');
  clearBtn.addEventListener('click', () => {
    showToast({ message: 'Data cleared', variant: 'warning' });
  });
  storageBtnRow.appendChild(clearBtn);

  const exportBtn = createButton('Export Config', 'secondary');
  exportBtn.addEventListener('click', () => {
    showToast({ message: 'Config exported', variant: 'success' });
  });
  storageBtnRow.appendChild(exportBtn);

  storageBody.appendChild(storageBtnRow);

  const usageTxt = document.createElement('div');
  Object.assign(usageTxt.style, { fontSize: '11px', color: 'var(--cv-text-muted)' });
  usageTxt.textContent = 'Storage usage: ~12 KB of 5 MB';
  storageBody.appendChild(usageTxt);

  container.appendChild(storageCard);

  return container;
}

/* ─── Logs ──────────────────────────────────────────────────────── */

function renderLogs(): HTMLElement {
  const container = createContainer();
  Object.assign(container.style, { flex: '1' });

  const columns: DataTableColumn[] = [
    { key: 'timestamp', label: 'Time', width: '160px' },
    { key: 'level', label: 'Level', width: '80px' },
    { key: 'source', label: 'Source', width: '180px' },
    { key: 'message', label: 'Message' },
  ];

  const sampleLogs = [
    { timestamp: new Date().toISOString(), level: 'info', source: 'extension', message: 'Extension loaded — all systems nominal' },
  ];

  const table = new DataTable({
    columns,
    data: sampleLogs,
    title: 'Activity Logs',
    searchable: true,
    exportable: true,
    popout: true,
    pageSize: 50,
  });

  container.appendChild(table.getElement());

  return container;
}

/* ─── Init ──────────────────────────────────────────────────────── */

async function init() {
  BUILTIN_RULES = await loadBuiltinRules();

  const { root, main } = createPageShell();

  const tabDefs: TabDef[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', render: renderDashboard },
    { id: 'rules', label: 'Rules', icon: '📋', render: renderRules },
    { id: 'data', label: 'Data', icon: '📊', render: renderData },
    { id: 'settings', label: 'Settings', icon: '⚙️', render: renderSettings },
    { id: 'logs', label: 'Logs', icon: '📝', render: renderLogs },
  ];

  const tabs = createTabs({ tabs: tabDefs, activeId: 'dashboard' });
  main.appendChild(tabs);

  const app = document.getElementById('app');
  if (app) {
    app.appendChild(root);
  } else {
    document.body.appendChild(root);
  }
}

void init();
