import { describe, expect, it } from 'vitest';
import type { ScrapedRow, UniquenessOptions } from './types';
import { buildUniquenessKey, normalizeUniquenessOptions, parseRowDateMs, shouldReplaceDuplicate } from './uniqueness';

const defaultUniq: UniquenessOptions = {
  enabled: true,
  keyFields: { vin: true, stock: true, pid: true },
  strategy: 'latest_by_date',
  dateColumn: { mode: 'auto', header: '' },
};

describe('uniqueness helpers', () => {
  it('builds key from selected fields', () => {
    const row = {
      latestPurchaseVin: 'VIN-AAA',
      latestPurchaseStockNumber: 'STOCK-100',
      latestPurchasePurchaseId: 'PID-500',
    } as ScrapedRow;

    const key = buildUniquenessKey(row, { vin: true, stock: false, pid: true });
    expect(key).toBe('vin=VIN-AAA|pid=PID-500');
  });

  it('returns null key when selected unique field is missing', () => {
    const row = {
      latestPurchaseVin: 'VIN-AAA',
      latestPurchaseStockNumber: '',
      latestPurchasePurchaseId: 'PID-500',
    } as ScrapedRow;

    const key = buildUniquenessKey(row, { vin: true, stock: true, pid: false });
    expect(key).toBeNull();
  });

  it('parses auto and manual date formats', () => {
    const rowAuto = {
      Date: '1/2/2026 11:30 PM',
    } as ScrapedRow;

    const autoTs = parseRowDateMs(rowAuto, defaultUniq);
    expect(autoTs).not.toBeNull();

    const rowManual = {
      updatedAt: '2026-02-19T15:12:00Z',
    } as ScrapedRow;

    const manualTs = parseRowDateMs(rowManual, {
      ...defaultUniq,
      dateColumn: { mode: 'manual', header: 'updatedAt' },
    });
    expect(manualTs).toBe(Date.parse('2026-02-19T15:12:00Z'));
  });

  it('prefers parseable date header over non-date text in auto mode', () => {
    const row = {
      'Created By': 'jane.doe',
      'Created Date': '2026-02-20T10:30:00Z',
    } as ScrapedRow;

    const ts = parseRowDateMs(row, defaultUniq);
    expect(ts).toBe(Date.parse('2026-02-20T10:30:00Z'));
  });

  it('keeps scanning lower-priority patterns when top pattern is non-date', () => {
    const row = {
      'Created By': 'jane.doe',
      Timestamp: '2026-02-21T09:45:00Z',
    } as ScrapedRow;

    const ts = parseRowDateMs(row, defaultUniq);
    expect(ts).toBe(Date.parse('2026-02-21T09:45:00Z'));
  });

  it('chooses replacement correctly for latest_by_date', () => {
    expect(shouldReplaceDuplicate({ existingTs: 100, candidateTs: 200, strategy: 'latest_by_date' })).toBe(true);
    expect(shouldReplaceDuplicate({ existingTs: 200, candidateTs: 100, strategy: 'latest_by_date' })).toBe(false);
    expect(shouldReplaceDuplicate({ existingTs: null, candidateTs: 100, strategy: 'latest_by_date' })).toBe(true);
    expect(shouldReplaceDuplicate({ existingTs: 100, candidateTs: null, strategy: 'latest_by_date' })).toBe(false);
    expect(shouldReplaceDuplicate({ existingTs: null, candidateTs: null, strategy: 'latest_by_date' })).toBe(true);
  });

  it('normalizes enabled uniqueness with no selected keys', () => {
    const normalized = normalizeUniquenessOptions({
      ...defaultUniq,
      keyFields: { vin: false, stock: false, pid: false },
    });

    expect(normalized.keyFields).toEqual({ vin: true, stock: true, pid: true });
  });
});
