import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DetectionResult, InvoiceStatusDetectionDiagnostics, InvoiceValidationStatus } from '../../shared/invoice/status-detector';
import type { WorkflowDefinition, WorkflowExecuteContext, WorkflowLogLevel } from '@cv/core';
import { Store } from '@cv/core';
import { OracleInvoiceValidationAlertWorkflow, OracleInvoiceValidationVerifyWorkflow } from '../oracle-invoice-validation-alert';

const {
  detectMock,
  showBannerMock,
  syncThemeMock,
  clearBannerMock,
  getTokensMock
} = vi.hoisted(() => ({
  detectMock: vi.fn<(options?: any) => Promise<DetectionResult>>(),
  showBannerMock: vi.fn(),
  syncThemeMock: vi.fn(),
  clearBannerMock: vi.fn(),
  getTokensMock: vi.fn()
}));

vi.mock('../../shared/invoice/status-detector', () => ({
  detectInvoiceValidationStatus: detectMock
}));

vi.mock('@cv/core', async () => {
  const actual = await vi.importActual<typeof import('@cv/core')>('@cv/core');
  return {
    ...actual,
    showValidationBanner: showBannerMock,
    syncValidationBannerTheme: syncThemeMock,
    clearValidationBanner: clearBannerMock,
    getValidationBannerTokens: getTokensMock
  };
});

const mockTokens = {
  states: {
    validated: {
      state: 'validated',
      label: 'Invoice validated',
      baseBackground: '#0f7a1f',
      baseTextColor: '#ffffff',
      dropShadow: 'shadow-valid',
      animation: { durationMs: 1, easing: 'linear', iterationCount: 1 as const, keyframes: [] },
      aria: { politeness: 'polite' as const, tone: 'success' as const },
      wcag: { criterion: 'AA' as const, textHex: '#ffffff', backgroundHex: '#0f7a1f', ratio: 4.5 }
    },
    needsRevalidated: {
      state: 'needsRevalidated',
      label: 'Invoice needs re-validation',
      baseBackground: '#c1121f',
      baseTextColor: '#ffffff',
      dropShadow: 'shadow-crit',
      iconId: 'warning',
      animation: { durationMs: 1, easing: 'linear', iterationCount: 1 as const, keyframes: [] },
      aria: { politeness: 'assertive' as const, tone: 'critical' as const },
      wcag: { criterion: 'AA' as const, textHex: '#ffffff', backgroundHex: '#c1121f', ratio: 4.5 }
    },
    unknown: {
      state: 'unknown',
      label: 'Invoice status unknown',
      baseBackground: '#5a0b1a',
      baseTextColor: '#ffffff',
      dropShadow: 'shadow-unknown',
      animation: { durationMs: 1, easing: 'linear', iterationCount: 1 as const, keyframes: [] },
      aria: { politeness: 'assertive' as const, tone: 'warning' as const },
      wcag: { criterion: 'AA' as const, textHex: '#ffffff', backgroundHex: '#5a0b1a', ratio: 4.5 }
    }
  },
  layout: {
    maxViewportHeightPct: 15,
    horizontalPaddingPx: 16,
    verticalPaddingPx: 12,
    fontSizeRangePx: { min: 18, max: 24 },
    borderRadiusPx: 12
  }
} as const;

const gmMemory = new Map<string, string>();

const ALERT_HISTORY_KEY = 'wf:history:oracle.invoice.validation.alert';
const VERIFY_HISTORY_KEY = 'wf:history:oracle.invoice.validation.verify';
const MANUAL_BASELINE_KEY = 'oracle.invoice.validation.alert:manualBaseline';
const MANUAL_UNKNOWN_STREAK_KEY = 'oracle.invoice.validation.alert:manualUnknownStreak';

type DetectionOverrides = Partial<Omit<DetectionResult, 'status' | 'diagnostics'>> & {
  status: InvoiceValidationStatus;
  diagnostics?: Partial<InvoiceStatusDetectionDiagnostics>;
};

const buildDetectionResult = (overrides: DetectionOverrides): DetectionResult => {
  const status = overrides.status;
  const statusText = overrides.statusText ?? (status === 'unknown' ? '' : status.replace('-', ' '));
  const snippet = overrides.snippet ?? '<td class="status">Validated</td>';
  const elementPath = overrides.elementPath ?? 'ValidationStatus > Validated';
  const baseAttemptLog = [
    {
      attempt: 1,
      timestamp: new Date('2025-10-29T00:00:00.000Z').toISOString(),
      elapsedMs: 120,
      foundCandidate: status !== 'unknown',
      classifiedStatus: status,
      statusText
    }
  ];
  const diagnostics: Partial<InvoiceStatusDetectionDiagnostics> = overrides.diagnostics ?? {};
  const attemptLog = diagnostics.attemptLog ?? baseAttemptLog;
  const manualVerification = diagnostics.manualVerification ?? { enabled: false };
  const assumedNeedsRevalidation = diagnostics.assumedNeedsRevalidation ?? false;

  return {
    status,
    statusText,
    snippet,
    elementPath,
    attempts: overrides.attempts ?? attemptLog.length,
    verified: overrides.verified ?? manualVerification.enabled,
    bannerToken: overrides.bannerToken ?? `hud.validation-banner.${status}`,
    diagnostics: {
      attemptLog,
      totalDurationMs: diagnostics.totalDurationMs ?? 1200,
      manualVerification,
      bannerToken: overrides.bannerToken ?? `hud.validation-banner.${status}`,
      statusText,
      snippet,
      elementPath,
      exhaustedRetries: diagnostics.exhaustedRetries ?? status === 'unknown',
      assumedNeedsRevalidation
    }
  };
};

beforeEach(() => {
  detectMock.mockReset();
  showBannerMock.mockReset();
  syncThemeMock.mockReset();
  clearBannerMock.mockReset();
  getTokensMock.mockReset();

  getTokensMock.mockReturnValue(mockTokens);
  showBannerMock.mockReturnValue(true);
  syncThemeMock.mockReturnValue(true);
  clearBannerMock.mockReturnValue(true);

  gmMemory.clear();
  const g = globalThis as any;
  g.GM_getValue = (key: string) => gmMemory.get(key);
  g.GM_setValue = (key: string, value: string) => { gmMemory.set(key, value); };
  g.GM_deleteValue = (key: string) => { gmMemory.delete(key); };
  g.GM_listValues = () => Array.from(gmMemory.keys());
  g.GM_registerMenuCommand = vi.fn();
  g.alert = vi.fn();
  document.title = 'Oracle Invoice Test';
});

const createContext = (overrides: Partial<Omit<WorkflowExecuteContext, 'store'>> = {}) => {
  const namespace = `spec-${Math.random().toString(36).slice(2, 10)}`;
  const store = new Store(namespace);
  const vars: Record<string, any> = {};
  const logSpy: LogMock = overrides.log
    ? (vi.fn(overrides.log) as unknown as LogMock)
    : (vi.fn<WorkflowExecuteContext['log']>() as unknown as LogMock);
  const runWorkflowSpy: RunWorkflowMock = overrides.runWorkflow
    ? (vi.fn(overrides.runWorkflow) as unknown as RunWorkflowMock)
    : (vi.fn<WorkflowExecuteContext['runWorkflow']>().mockResolvedValue(true) as unknown as RunWorkflowMock);
  const ctx: WorkflowExecuteContext = {
    workflowId: overrides.workflowId ?? 'oracle.invoice.validation.alert',
    vars,
    options: overrides.options ?? {},
    profile: overrides.profile ?? { id: 'default', label: 'Default' },
    log: logSpy as unknown as WorkflowExecuteContext['log'],
    runWorkflow: runWorkflowSpy as unknown as WorkflowExecuteContext['runWorkflow'],
    setVar: overrides.setVar ?? ((key, value) => { vars[key] = value; }),
    getVar: overrides.getVar ?? (key => vars[key]),
    store
  };
  return { ctx, store, logSpy, runWorkflowSpy };
};

const runExecuteStep = async (
  workflow: WorkflowDefinition,
  ctx: WorkflowExecuteContext,
  index = 0
): Promise<void> => {
  const step = workflow.steps[index];
  if (!step || step.kind !== 'execute') {
    throw new Error(`Expected execute step at index ${index} for workflow ${workflow.id}`);
  }
  await step.run(ctx);
};

type MockWithCalls<TArgs extends any[] = any[], TReturn = any> = ((...args: TArgs) => TReturn) & {
  mock: { calls: TArgs[] };
};

type LogMock = MockWithCalls<[string, WorkflowLogLevel?], void>;
type RunWorkflowMock = MockWithCalls<
  Parameters<WorkflowExecuteContext['runWorkflow']>,
  ReturnType<WorkflowExecuteContext['runWorkflow']>
>;

const collectMessages = (mock: LogMock): string[] => mock.mock.calls.map(([message]) => message);

const collectLogEntries = (
  mock: LogMock
): Array<{ message: string; level: WorkflowLogLevel | undefined }> =>
  mock.mock.calls.map(([message, level]) => ({ message, level }));

describe('Oracle invoice validation workflow integration', () => {
  it('renders validated banner and logs history on happy path', async () => {
    const { ctx, store, logSpy } = createContext();

    const detection = buildDetectionResult({ status: 'validated', statusText: 'Validated' });
    detectMock.mockResolvedValueOnce(detection);

    await runExecuteStep(OracleInvoiceValidationAlertWorkflow, ctx);

    expect(detectMock).toHaveBeenCalledTimes(1);
    expect(detectMock).toHaveBeenCalledWith(expect.objectContaining({ manualVerification: false }));

    expect(syncThemeMock).toHaveBeenCalledTimes(1);
    expect(showBannerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'validated',
        message: 'Validated',
        detail: 'Invoice validation completed; no further action required.',
        dismissLabel: 'Dismiss validation banner',
        anchor: 'right'
      })
    );

    const invoiceValidation = ctx.getVar('invoiceValidation') as { result: DetectionResult; manualRun: boolean; assumedFallback: boolean };
    expect(invoiceValidation).toEqual({ result: detection, manualRun: false, assumedFallback: false });

    const history = store.get(ALERT_HISTORY_KEY, [] as any[]);
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(
      expect.objectContaining({
        status: 'validated',
        statusText: 'Validated',
        manualRun: false,
        verified: false,
        bannerToken: detection.bannerToken,
        manualVerification: expect.objectContaining({ enabled: false })
      })
    );

    expect(history[0].diagnostics).toEqual(
      expect.objectContaining({
        totalDurationMs: 1200,
        exhaustedRetries: false,
        attemptLog: [
          expect.objectContaining({
            attempt: 1,
            elapsedMs: 120,
            foundCandidate: true,
            statusText: 'Validated'
          })
        ]
      })
    );

    const messages = collectMessages(logSpy);
    expect(messages).toContain('Starting Oracle invoice validation detection.');
    expect(messages).toContain('Invoice validation status: validated (Validated)');
  });

  it('treats unknown detection as needs revalidation fallback', async () => {
    const { ctx, store, logSpy } = createContext();

    const detection = buildDetectionResult({
      status: 'unknown',
      statusText: '',
      diagnostics: {
        attemptLog: [
          {
            attempt: 1,
            timestamp: new Date('2025-10-29T00:00:00.000Z').toISOString(),
            elapsedMs: 4000,
            foundCandidate: false,
            classifiedStatus: undefined,
            statusText: undefined,
            delayBeforeNextMs: 400
          },
          {
            attempt: 2,
            timestamp: new Date('2025-10-29T00:00:01.000Z').toISOString(),
            elapsedMs: 8000,
            foundCandidate: false,
            classifiedStatus: undefined,
            statusText: undefined
          }
        ],
        exhaustedRetries: true,
        manualVerification: { enabled: false }
      }
    });
    detectMock.mockResolvedValueOnce(detection);

    await runExecuteStep(OracleInvoiceValidationAlertWorkflow, ctx);

    const invoiceValidation = ctx.getVar('invoiceValidation') as { result: DetectionResult; manualRun: boolean; assumedFallback: boolean };
    expect(invoiceValidation.assumedFallback).toBe(true);
    expect(invoiceValidation.result.status).toBe('needs-revalidated');

    expect(showBannerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'needsRevalidated',
        message: mockTokens.states.needsRevalidated.label,
        detail: 'Re-run invoice validation before posting to ensure compliance.',
        dismissLabel: 'Dismiss validation banner',
        anchor: 'right'
      })
    );

    const history = store.get(ALERT_HISTORY_KEY, [] as any[]);
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(
      expect.objectContaining({
        status: 'needs-revalidated',
        attempts: detection.attempts,
        manualRun: false,
        manualVerification: expect.objectContaining({ enabled: false })
      })
    );

    expect(history[0].diagnostics).toEqual(
      expect.objectContaining({
        exhaustedRetries: true,
        assumedNeedsRevalidation: true,
        attemptLog: expect.arrayContaining([
          expect.objectContaining({ attempt: 1 }),
          expect.objectContaining({ attempt: 2 })
        ])
      })
    );

    const messages = collectMessages(logSpy);
    expect(messages).toContain('Invoice validation text missing; defaulting status to needs revalidation.');
    expect(messages).toContain('Invoice validation status: needs-revalidated (no text)');
    expect(clearBannerMock).not.toHaveBeenCalled();
  });

  it('runs manual verification with baseline options and warns after consecutive unknown results', async () => {
    const baselineSnippet = '   <td class="x12">Validated</td>  ';
    const { ctx, store, logSpy } = createContext({
      workflowId: 'oracle.invoice.validation.verify',
      options: {
        manualExpectedStatus: 'Validated',
        manualExpectedSnippet: baselineSnippet
      }
    });

    const mismatchResult = buildDetectionResult({
      status: 'needs-revalidated',
      statusText: 'Needs reverification',
      verified: true,
      diagnostics: {
        manualVerification: {
          enabled: true,
          expectedStatus: 'validated',
          statusMatches: false,
          snippetMatches: false,
          mismatchSummary: 'expected status validated, received needs-revalidated',
          baselineSnippetPreview: '<td class="x12">Validated</td>'
        }
      }
    });

    const unknownResult = buildDetectionResult({
      status: 'unknown',
      statusText: '',
      verified: true,
      diagnostics: {
        manualVerification: {
          enabled: true,
          expectedStatus: 'validated',
          statusMatches: false,
          baselineSnippetPreview: '<td class="x12">Validated</td>'
        }
      }
    });

    detectMock
      .mockResolvedValueOnce(mismatchResult)
      .mockResolvedValueOnce(unknownResult)
      .mockResolvedValueOnce(unknownResult);

    await runExecuteStep(OracleInvoiceValidationVerifyWorkflow, ctx);

    expect(detectMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      manualVerification: {
        expectedStatus: 'validated',
        expectedSnippet: '<td class="x12">Validated</td>'
      }
    }));

    const baseline = store.get(MANUAL_BASELINE_KEY, null);
    expect(baseline).toEqual({ expectedStatus: 'validated', expectedSnippet: '<td class="x12">Validated</td>' });

    const alertMock = globalThis.alert as unknown as { mock: { calls: unknown[][] } };
    const firstAlertMessage = (alertMock.mock.calls[0]?.[0] as string | undefined) ?? '';
    expect(firstAlertMessage).toContain('Manual verification differences detected:');
    expect(firstAlertMessage).toContain('expected status validated, received needs-revalidated');
    expect(store.get(MANUAL_UNKNOWN_STREAK_KEY, 0)).toBe(0);

    await runExecuteStep(OracleInvoiceValidationVerifyWorkflow, ctx);
    expect(store.get(MANUAL_UNKNOWN_STREAK_KEY, 0)).toBe(1);

    await runExecuteStep(OracleInvoiceValidationVerifyWorkflow, ctx);

    const streak = store.get(MANUAL_UNKNOWN_STREAK_KEY, 0);
    expect(streak).toBe(2);

    const alertCalls = alertMock.mock.calls.map(call => call[0] as string);
    expect(alertCalls.some((message: string) => message.includes('Manual verification differences detected'))).toBe(true);
    expect(alertCalls[alertCalls.length - 1]).toBe('Invoice validation verification returned inconclusive results twice. Confirm selectors before enabling auto-run repeat.');

    const history = store.get(VERIFY_HISTORY_KEY, [] as any[]);
    expect(history).toHaveLength(3);
    const manualEntries = history.filter(entry => entry.manualRun);
    expect(manualEntries).toHaveLength(3);
    expect(manualEntries[manualEntries.length - 1]).toEqual(
      expect.objectContaining({
        workflowId: 'oracle.invoice.validation.verify',
        status: 'needs-revalidated',
        manualRun: true,
        verified: true,
        manualVerification: expect.objectContaining({ enabled: true })
      })
    );

    const latest = manualEntries[manualEntries.length - 1];
    expect(latest.manualVerification?.baselineSnippetPreview).toBe('<td class="x##">Validated</td>');
    expect(latest.diagnostics).toEqual(
      expect.objectContaining({
        exhaustedRetries: true,
        assumedNeedsRevalidation: true,
        attemptLog: expect.arrayContaining([
          expect.objectContaining({ attempt: 1 })
        ])
      })
    );

    const logs = collectLogEntries(logSpy);
    expect(logs.some(({ message, level }) => level === 'warn' && message.includes('Manual verification mismatch'))).toBe(true);
    expect(logs.some(({ message, level }) => level === 'warn' && message.includes('Invoice validation verification returned inconclusive results twice'))).toBe(true);
  });
});
