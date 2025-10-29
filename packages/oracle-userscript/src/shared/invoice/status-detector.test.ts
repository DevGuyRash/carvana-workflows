import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectInvoiceValidationStatus } from './status-detector';

const VALIDATION_HEADER_ID = 'ValidationStatusHeader';

function mountStatusCell(markup: string): HTMLTableCellElement {
  document.body.innerHTML = `
    <table>
      <tbody>
        <tr>
          <th id="${VALIDATION_HEADER_ID}">Invoice Validation Status</th>
          <td headers="ValidationStatus ${VALIDATION_HEADER_ID}">
            ${markup}
          </td>
        </tr>
      </tbody>
    </table>
  `;

  const cell = document.querySelector<HTMLTableCellElement>('td[headers~="ValidationStatus"]');
  if (!cell) throw new Error('fixture did not render ValidationStatus cell');
  return cell;
}

describe('detectInvoiceValidationStatus', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('detects a validated status with sanitized diagnostics', async () => {
    mountStatusCell('<a role="link" data-secret="hidden">Validation Complete: Validated</a>');

    const result = await detectInvoiceValidationStatus({ root: document.body });

    expect(result.status).toBe('validated');
    expect(result.statusText).toMatch(/validated/i);
    expect(result.bannerToken).toBe('hud.validation-banner.validated');
    expect(result.attempts).toBe(1);
    expect(result.elementPath).toContain('Invoice Validation Status');
    expect(result.snippet).not.toContain('data-secret');
    expect(result.diagnostics.statusText).toBe(result.statusText);
    expect(result.diagnostics.bannerToken).toBe(result.bannerToken);
    expect(result.diagnostics.manualVerification).toEqual({ enabled: false });
    expect(result.diagnostics.attemptLog).toHaveLength(1);
    expect(result.diagnostics.attemptLog[0]).toEqual(
      expect.objectContaining({
        attempt: 1,
        foundCandidate: true,
        classifiedStatus: 'validated',
        statusText: expect.stringMatching(/validated/i)
      })
    );
  });

  it('reports manual verification mismatches for needs-revalidated status', async () => {
    mountStatusCell('<span>Needs Revalidation - Supplier updated invoice</span>');

    const result = await detectInvoiceValidationStatus({
      root: document.body,
      manualVerification: {
        expectedStatus: 'validated',
        expectedSnippet: '<td headers="ValidationStatus">Validated</td>'
      }
    });

    expect(result.status).toBe('needs-revalidated');
    expect(result.bannerToken).toBe('hud.validation-banner.needs-revalidated');

    const manual = result.diagnostics.manualVerification;
    expect(manual.enabled).toBe(true);
    expect(manual.statusMatches).toBe(false);
    expect(manual.snippetMatches).toBe(false);
    expect(manual.mismatchSummary).toMatch(/expected status validated/i);
    expect(manual.baselineSnippetPreview).toBeDefined();
  });

  it('retries until exhausting the budget and records delay backoff for unknown status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());

    mountStatusCell('<div>Validation pending manual review</div>');

    const detection = detectInvoiceValidationStatus({
      root: document.body,
      maxDurationMs: 350,
      initialDelayMs: 100,
      maxDelayMs: 150,
      backoffMultiplier: 2
    });

    await vi.runAllTimersAsync();
    const result = await detection;

    expect(result.status).toBe('unknown');
    expect(result.bannerToken).toBe('hud.validation-banner.unknown');
    expect(result.diagnostics.exhaustedRetries).toBe(true);
    expect(result.attempts).toBeGreaterThan(1);
    expect(result.diagnostics.attemptLog.at(-1)?.elapsedMs).toBeGreaterThanOrEqual(350);

    const delays = result.diagnostics.attemptLog
      .map(entry => entry.delayBeforeNextMs)
      .filter((delay): delay is number => typeof delay === 'number');

    expect(delays.length).toBeGreaterThanOrEqual(3);
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBeLessThanOrEqual(150);
    expect(result.diagnostics.totalDurationMs).toBeGreaterThanOrEqual(350);
  });
});
