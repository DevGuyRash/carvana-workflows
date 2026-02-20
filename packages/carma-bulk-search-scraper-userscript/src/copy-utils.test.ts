import { describe, expect, it } from 'vitest';
import { buildRowTsv, buildSelectedCellTsv, extractQuickCopyValues } from './copy-utils';
import type { ScrapedRow } from './types';

describe('copy-utils', () => {
  it('buildRowTsv honors includeHeaders flag', () => {
    const rows = [
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ];

    expect(buildRowTsv(rows, ['a', 'b'], true)).toBe('a\tb\n1\t2\n3\t4');
    expect(buildRowTsv(rows, ['a', 'b'], false)).toBe('1\t2\n3\t4');
  });

  it('buildSelectedCellTsv emits sparse matrix with optional headers', () => {
    const rows = [
      { c1: 'r1c1', c2: 'r1c2' },
      { c1: 'r2c1', c2: 'r2c2' },
    ] as ScrapedRow[];

    const selected = new Set<string>(['0:0', '1:1']);

    expect(buildSelectedCellTsv({
      rows,
      columns: ['c1', 'c2'],
      selectedCells: selected,
      includeHeaders: true,
    })).toBe('c1\tc2\nr1c1\t\n\tr2c2');

    expect(buildSelectedCellTsv({
      rows,
      columns: ['c1', 'c2'],
      selectedCells: selected,
      includeHeaders: false,
    })).toBe('r1c1\t\n\tr2c2');
  });

  it('extractQuickCopyValues preserves order and duplicates while skipping empty values', () => {
    const rows: ScrapedRow[] = [
      {
        latestPurchaseStockNumber: 'STK-1',
        latestPurchaseVin: 'VIN-1',
        latestPurchasePurchaseId: 'PID-1',
        Reference: 'REF-1',
      },
      {
        latestPurchaseStockNumber: 'STK-1',
        latestPurchaseVin: '',
        latestPurchasePurchaseId: 'No Purchase(s) found.',
        Reference: 'REF-2',
      },
      {
        latestPurchaseStockNumber: 'STK-2',
        latestPurchaseVin: 'VIN-2',
        latestPurchasePurchaseId: 'PID-2',
        Reference: '',
      },
    ];

    expect(extractQuickCopyValues(rows, 'stock')).toEqual(['STK-1', 'STK-1', 'STK-2']);
    expect(extractQuickCopyValues(rows, 'vin')).toEqual(['VIN-1', 'VIN-2']);
    expect(extractQuickCopyValues(rows, 'pid')).toEqual(['PID-1', 'PID-2']);
    expect(extractQuickCopyValues(rows, 'reference')).toEqual(['REF-1', 'REF-2']);
  });
});
