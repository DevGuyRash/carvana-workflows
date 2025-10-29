import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DetectionResult, InvoiceValidationStatus } from '../../shared/invoice/status-detector';
import type { WorkflowExecuteContext } from '@cv/core';
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

type DetectionOverrides = Partial<DetectionResult> & {
  status: InvoiceValidationStatus;
  diagnostics?: Partial<DetectionResult['diagnostics']>;
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
  const diagnostics = overrides.diagnostics ?? {};
  const attemptLog = diagnostics.attemptLog ?? baseAttemptLog;
  const manualVerification = diagnostics.manualVerification ?? { enabled: false };

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
      exhaustedRetries: diagnostics.exhaustedRetries ?? status === 'unknown'
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
  const logSpy = overrides.log ?? vi.fn();
  const runWorkflowSpy = overrides.runWorkflow ?? vi.fn().mockResolvedValue(true);
  const ctx: WorkflowExecuteContext = {
    workflowId: overrides.workflowId ?? 'oracle.invoice.validation.alert',
    vars,
    options: overrides.options ?? {},
    profile: overrides.profile ?? { id: 'default', label: 'Default' },
    log: logSpy,
    runWorkflow: runWorkflowSpy,
    setVar: overrides.setVar ?? ((key, value) => { vars[key] = value; }),
    getVar: overrides.getVar ?? (key => vars[key]),
    store
  };
  return { ctx, store, logSpy, runWorkflowSpy };
};

describe('Oracle invoice validation workflow integration', () => {
  it('renders validated banner and logs history on happy path', async () => {
    const { ctx, store, logSpy } = createContext();

    const detection = buildDetectionResult({ status: 'validated', statusText: 'Validated' });
    detectMock.mockResolvedValueOnce(detection);

    const step = OracleInvoiceValidationAlertWorkflow.steps[0];
    await step.run(ctx);

    expect(detectMock).toHaveBeenCalledTimes(1);
    expect(detectMock).toHaveBeenCalledWith(expect.objectContaining({ manualVerification: false }));

    expect(syncThemeMock).toHaveBeenCalledTimes(1);
    expect(showBannerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'validated',
        message: 'Validated',
        detail: 'Invoice validation completed; no further action required.',
        dismissLabel: 'Dismiss validation banner'
      })
    );

    expect(ctx.getVar('invoiceValidation')).toEqual({ result: detection, manualRun: false });

    const history = store.get(ALERT_HISTORY_KEY, []);
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

    const messages = logSpy.mock.calls.map(([message]) => message);
    expect(messages).toContain('Starting Oracle invoice validation detection.');
    expect(messages).toContain('Invoice validation status: validated (Validated)');
  });

  it('falls back to unknown banner when detector exhausts retries', async () => {
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

    await OracleInvoiceValidationAlertWorkflow.steps[0].run(ctx);

    expect(showBannerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'unknown',
        message: mockTokens.states.unknown.label,
        detail: 'Status not detected. Run "Verify Invoice Validation Selectors" to confirm selectors.',
        dismissLabel: 'Dismiss validation banner'
      })
    );

    const history = store.get(ALERT_HISTORY_KEY, []);
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(
      expect.objectContaining({
        status: 'unknown',
        attempts: detection.attempts,
        manualRun: false,
        manualVerification: expect.objectContaining({ enabled: false })
      })
    );

    expect(history[0].diagnostics).toEqual(
      expect.objectContaining({
        exhaustedRetries: true,
        attemptLog: expect.arrayContaining([
          expect.objectContaining({ attempt: 1 }),
          expect.objectContaining({ attempt: 2 })
        ])
      })
    );

    const messages = logSpy.mock.calls.map(([message]) => message);
    expect(messages).toContain('Invoice validation status: unknown (no text)');
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
      statusText: 'Needs Re-Validated',
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

    const step = OracleInvoiceValidationVerifyWorkflow.steps[0];

    await step.run(ctx);

    expect(detectMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      manualVerification: {
        expectedStatus: 'validated',
        expectedSnippet: '<td class="x12">Validated</td>'
      }
    }));

    const baseline = store.get(MANUAL_BASELINE_KEY, null);
    expect(baseline).toEqual({ expectedStatus: 'validated', expectedSnippet: '<td class="x12">Validated</td>' });

    const firstAlertMessage = (globalThis.alert as any).mock.calls[0]?.[0] ?? '';
    expect(firstAlertMessage).toContain('Manual verification differences detected:');
    expect(firstAlertMessage).toContain('expected status validated, received needs-revalidated');
    expect(store.get(MANUAL_UNKNOWN_STREAK_KEY, 0)).toBe(0);

    await step.run(ctx);
    expect(store.get(MANUAL_UNKNOWN_STREAK_KEY, 0)).toBe(1);

    await step.run(ctx);

    const streak = store.get(MANUAL_UNKNOWN_STREAK_KEY, 0);
    expect(streak).toBe(2);

    const alertCalls = (globalThis.alert as any).mock.calls.map(([message]: [string]) => message);
    expect(alertCalls.some(message => message.includes('Manual verification differences detected'))).toBe(true);
    expect(alertCalls[alertCalls.length - 1]).toBe('Invoice validation verification returned unknown twice. Confirm selectors before enabling auto-run repeat.');

    const history = store.get(VERIFY_HISTORY_KEY, []);
    expect(history).toHaveLength(3);
    const manualEntries = history.filter(entry => entry.manualRun);
    expect(manualEntries).toHaveLength(3);
    expect(manualEntries[manualEntries.length - 1]).toEqual(
      expect.objectContaining({
        workflowId: 'oracle.invoice.validation.verify',
        status: 'unknown',
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
        attemptLog: expect.arrayContaining([
          expect.objectContaining({ attempt: 1 })
        ])
      })
    );

    const logs = logSpy.mock.calls.map(([message, level]) => ({ message, level }));
    expect(logs.some(({ message, level }) => level === 'warn' && message.includes('Manual verification mismatch'))).toBe(true);
    expect(logs.some(({ message, level }) => level === 'warn' && message.includes('Invoice validation verification returned unknown twice'))).toBe(true);
  });
});
