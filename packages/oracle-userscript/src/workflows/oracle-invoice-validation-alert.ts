import type {
  ConditionSpec,
  SelectorSpec,
  WorkflowDefinition,
  WorkflowExecuteContext
} from '@cv/core';
import {
  clearValidationBanner,
  getValidationBannerTokens,
  showValidationBanner,
  syncValidationBannerTheme
} from '@cv/core';
import {
  detectInvoiceValidationStatus,
  type DetectionResult,
  type InvoiceValidationStatus,
  type ManualVerificationDiagnostics
} from '../shared/invoice/status-detector';

type BannerStateKey = 'validated' | 'needsRevalidated' | 'unknown';

interface ManualBaseline {
  expectedStatus?: InvoiceValidationStatus;
  expectedSnippet?: string;
}

interface WorkflowHistoryEntry {
  workflowId: string;
  timestamp: string;
  status: InvoiceValidationStatus;
  statusText: string;
  bannerToken: string;
  elementPath: string;
  attempts: number;
  manualRun: boolean;
  verified: boolean;
  snippet: string;
  manualVerification: Pick<ManualVerificationDiagnostics, 'enabled' | 'statusMatches' | 'snippetMatches' | 'mismatchSummary' | 'baselineSnippetPreview'>;
}

const STATUS_TO_BANNER_STATE: Record<InvoiceValidationStatus, BannerStateKey> = {
  validated: 'validated',
  'needs-revalidated': 'needsRevalidated',
  unknown: 'unknown'
};

const HISTORY_STORE_KEY = 'oracle.invoice.validation.alert:history';
const MANUAL_BASELINE_STORE_KEY = 'oracle.invoice.validation.alert:manualBaseline';
const MANUAL_UNKNOWN_STREAK_KEY = 'oracle.invoice.validation.alert:manualUnknownStreak';
const MAX_HISTORY_ENTRIES = 40;
const OPTION_MANUAL_EXPECTED_STATUS = 'manualExpectedStatus';
const OPTION_MANUAL_EXPECTED_SNIPPET = 'manualExpectedSnippet';

const BODY_VISIBLE: SelectorSpec = { selector: 'body', visible: true };

const INVOICE_HEADER_CONDITION: ConditionSpec = {
  textPresent: {
    where: BODY_VISIBLE,
    matcher: { includes: 'Invoice Header', caseInsensitive: true }
  }
};

const INVOICE_MODE_CONDITION: ConditionSpec = {
  any: [
    {
      textPresent: {
        where: BODY_VISIBLE,
        matcher: { includes: 'Edit Invoice', caseInsensitive: true }
      }
    },
    {
      textPresent: {
        where: BODY_VISIBLE,
        matcher: { includes: 'Create Invoice', caseInsensitive: true }
      }
    }
  ]
};

let lastBannerSignature: string | null = null;

const autoRunContext = (): string => {
  const pieces: string[] = [];
  const activeTab = document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
  const header = document.querySelector<HTMLElement>('h1[data-afr-title], h1.xh2, span.xh2, [data-afr-title]');
  const invoiceNumber = document.querySelector<HTMLElement>('span[data-afr-title*="Invoice"], span[id*="invoiceNumber" i]');
  const tabText = normalizeText(activeTab?.textContent);
  const headerText = normalizeText(header?.textContent);
  const invoiceText = normalizeText(invoiceNumber?.textContent);
  if (tabText) pieces.push(`tab:${tabText}`);
  if (headerText) pieces.push(headerText);
  if (invoiceText) pieces.push(`invoice:${invoiceText}`);
  const title = document.title?.trim();
  if (title) pieces.push(`title:${title}`);
  const unique = Array.from(new Set(pieces.filter(Boolean)));
  return unique.length ? unique.join('|') : 'oracle::invoice';
};

const normalizeText = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();

const truncate = (value: string, max = 280): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3))}...`;
};

const sanitizeBaselineSnippet = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  const raw = Array.isArray(value) ? value.join('\n') : String(value);
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return truncate(cleaned, 600);
};

const normalizeManualStatus = (value: unknown): InvoiceValidationStatus | undefined => {
  if (!value) return undefined;
  const normalized = String(value).toLowerCase().trim();
  if (normalized === 'validated') return 'validated';
  if (normalized === 'needs-revalidated' || normalized === 'needs_revalidated' || normalized === 'needs re-validated') {
    return 'needs-revalidated';
  }
  if (normalized === 'unknown') return 'unknown';
  return undefined;
};

const appendHistoryEntry = (
  ctx: WorkflowExecuteContext,
  result: DetectionResult,
  manualRun: boolean
): void => {
  const entry: WorkflowHistoryEntry = {
    workflowId: ctx.workflowId,
    timestamp: new Date().toISOString(),
    status: result.status,
    statusText: result.statusText,
    bannerToken: result.bannerToken,
    elementPath: result.elementPath,
    attempts: result.attempts,
    manualRun,
    verified: result.verified,
    snippet: truncate(result.snippet, 600),
    manualVerification: {
      enabled: result.diagnostics.manualVerification.enabled,
      statusMatches: result.diagnostics.manualVerification.statusMatches,
      snippetMatches: result.diagnostics.manualVerification.snippetMatches,
      mismatchSummary: result.diagnostics.manualVerification.mismatchSummary,
      baselineSnippetPreview: result.diagnostics.manualVerification.baselineSnippetPreview
    }
  };

  const history = ctx.store.get<WorkflowHistoryEntry[]>(HISTORY_STORE_KEY, []);
  history.push(entry);
  if (history.length > MAX_HISTORY_ENTRIES) {
    history.splice(0, history.length - MAX_HISTORY_ENTRIES);
  }
  ctx.store.set(HISTORY_STORE_KEY, history);
};

const updateManualUnknownStreak = (ctx: WorkflowExecuteContext, status: InvoiceValidationStatus): void => {
  let streak = ctx.store.get<number>(MANUAL_UNKNOWN_STREAK_KEY, 0);
  if (status === 'unknown') {
    streak += 1;
  } else {
    streak = 0;
  }
  ctx.store.set(MANUAL_UNKNOWN_STREAK_KEY, streak);
  if (streak >= 2) {
    const message = 'Invoice validation verification returned unknown twice. Confirm selectors before enabling auto-run repeat.';
    ctx.log(message, 'warn');
    alert(message);
  }
};

const resolveManualBaseline = (ctx: WorkflowExecuteContext, refreshFromOptions: boolean): ManualBaseline | null => {
  let baseline = ctx.store.get<ManualBaseline | null>(MANUAL_BASELINE_STORE_KEY, null);
  if (refreshFromOptions) {
    const expectedStatus = normalizeManualStatus(ctx.options[OPTION_MANUAL_EXPECTED_STATUS]);
    const expectedSnippet = sanitizeBaselineSnippet(ctx.options[OPTION_MANUAL_EXPECTED_SNIPPET]);
    if (expectedStatus || expectedSnippet) {
      baseline = { expectedStatus, expectedSnippet };
      ctx.store.set(MANUAL_BASELINE_STORE_KEY, baseline);
    }
  }
  return baseline;
};

const buildBannerDetail = (status: InvoiceValidationStatus): string | undefined => {
  switch (status) {
    case 'validated':
      return 'Invoice validation completed; no further action required.';
    case 'needs-revalidated':
      return 'Re-run invoice validation before posting to ensure compliance.';
    case 'unknown':
      return 'Status not detected. Run "Verify Invoice Validation Selectors" to confirm selectors.';
    default:
      return undefined;
  }
};

const renderBanner = (ctx: WorkflowExecuteContext, result: DetectionResult, manualRun: boolean): void => {
  const signature = `${result.status}|${result.statusText}`;
  if (!manualRun && signature === lastBannerSignature) {
    ctx.log('Skipping banner re-render; status unchanged from previous run.', 'debug');
    return;
  }
  lastBannerSignature = signature;

  const tokens = getValidationBannerTokens();
  if (!syncValidationBannerTheme()) {
    ctx.log('HUD host not ready; validation banner theme sync deferred.', 'debug');
  }

  const state = STATUS_TO_BANNER_STATE[result.status];
  const stateTokens = tokens.states[state];
  const message = result.statusText || stateTokens.label;
  const detail = buildBannerDetail(result.status);
  const success = showValidationBanner({
    state,
    message,
    detail,
    dismissLabel: 'Dismiss validation banner'
  });

  if (!success) {
    ctx.log('Failed to render validation banner; HUD host unavailable.', 'warn');
  }
};

const runInvoiceValidationDetection = async (
  ctx: WorkflowExecuteContext,
  options: { manual: boolean; baseline?: ManualBaseline | null }
): Promise<DetectionResult> => {
  ctx.log('Starting Oracle invoice validation detection.');

  const manualVerification = options.manual
    ? options.baseline
      ? {
          expectedStatus: options.baseline.expectedStatus,
          expectedSnippet: options.baseline.expectedSnippet
        }
      : true
    : false;

  const result = await detectInvoiceValidationStatus({
    manualVerification,
    onAttempt: attempt => {
      if (attempt.attempt > 1) {
        ctx.log(
          `Retry ${attempt.attempt}: ${attempt.classifiedStatus ?? 'unknown'} (${attempt.statusText ?? 'no text'}) after ${attempt.elapsedMs}ms`,
          'debug'
        );
      }
    }
  });

  ctx.setVar('invoiceValidation', { result, manualRun: options.manual });
  ctx.log(`Invoice validation status: ${result.status} (${result.statusText || 'no text'})`);
  ctx.log(`Detected element path: ${result.elementPath}`, 'debug');

  renderBanner(ctx, result, options.manual);
  appendHistoryEntry(ctx, result, options.manual);

  if (options.manual) {
    updateManualUnknownStreak(ctx, result.status);
  }

  return result;
};

const autoRunStep = async (ctx: WorkflowExecuteContext): Promise<void> => {
  try {
    await runInvoiceValidationDetection(ctx, { manual: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    ctx.log(`Invoice validation detection failed: ${message}`, 'error');
    clearValidationBanner();
    throw error;
  }
};

const manualVerificationStep = async (ctx: WorkflowExecuteContext): Promise<void> => {
  const baseline = resolveManualBaseline(ctx, true);
  if (!baseline) {
    ctx.log('Manual verification baseline not configured; proceeding without comparisons.', 'warn');
  }

  try {
    const result = await runInvoiceValidationDetection(ctx, { manual: true, baseline });
    if (result.diagnostics.manualVerification.enabled) {
      const manual = result.diagnostics.manualVerification;
      if (manual.mismatchSummary) {
        ctx.log(`Manual verification mismatch: ${manual.mismatchSummary}`, 'warn');
        alert(`Manual verification differences detected:\n${manual.mismatchSummary}`);
      } else {
        ctx.log('Manual verification baseline matches detected snippet.');
      }
    } else {
      ctx.log('Manual verification baseline missing; no diff generated.', 'warn');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    ctx.log(`Manual verification failed: ${message}`, 'error');
    clearValidationBanner();
    throw error;
  }
};

export const OracleInvoiceValidationAlertWorkflow: WorkflowDefinition = {
  id: 'oracle.invoice.validation.alert',
  label: 'Oracle: Invoice Validation Alert',
  description: 'Auto-detects Oracle invoice validation status, renders HUD banner, and logs diagnostics.',
  enabledWhen: {
    all: [INVOICE_HEADER_CONDITION, INVOICE_MODE_CONDITION]
  },
  autoRun: {
    waitForConditionMs: 12000,
    pollIntervalMs: 150,
    retryDelayMs: 4000,
    respectLoadingIndicator: false,
    skipReadiness: true,
    watchMutations: {
      root: { selector: 'body' },
      debounceMs: 300,
      observeAttributes: true,
      observeCharacterData: true,
      attributeFilter: ['aria-busy', 'aria-hidden', 'aria-expanded'],
      forceAutoRun: false
    },
    context: { resolve: autoRunContext }
  },
  steps: [
    {
      kind: 'execute',
      run: autoRunStep
    }
  ]
};

export const OracleInvoiceValidationVerifyWorkflow: WorkflowDefinition = {
  id: 'oracle.invoice.validation.verify',
  label: 'Oracle: Verify Invoice Validation Selectors',
  description: 'Manual verification workflow to compare invoice validation selector output against baseline.',
  options: [
    {
      key: OPTION_MANUAL_EXPECTED_STATUS,
      label: 'Expected validation status token',
      type: 'select',
      default: 'validated',
      choices: [
        { value: 'validated', label: 'Validated' },
        { value: 'needs-revalidated', label: 'Needs Re-Validated' },
        { value: 'unknown', label: 'Unknown' }
      ]
    },
    {
      key: OPTION_MANUAL_EXPECTED_SNIPPET,
      label: 'Baseline snippet (sanitized HTML)',
      type: 'multi',
      hint: 'Paste sanitized ValidationStatus cell HTML used for manual verification.'
    }
  ],
  steps: [
    {
      kind: 'execute',
      run: manualVerificationStep
    }
  ]
};
