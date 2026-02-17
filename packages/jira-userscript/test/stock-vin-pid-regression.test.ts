import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  attribute6PidFixtures,
  extractionFixtures,
  invoiceNumberFixtures,
  projectNumberStockFixtures
} from './stock-vin-pid-regression.fixtures';
import {
  ATTRIBUTE6_PID_DESCRIPTOR_PATTERN_TEXT,
  FORMULA_DESCRIPTOR_PATTERN_TEXT,
  FORMULA_TAG_PATTERN_TEXT,
  JIRA_CAPTURE_DESCRIPTOR_PATTERN_TEXT
} from './tr-upload-sheet-regex.contract';
import {
  computeAttribute6Pid,
  computeInvoiceNumber,
  computeProjectNumberStock,
  extractIdentifiers
} from './tr-upload-sheet-regression.harness';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

describe('stock/vin/pid extraction regression fixtures', () => {
  it.each(extractionFixtures)('$name', (fixture) => {
    const actual = extractIdentifiers(fixture.text, fixture.direct);
    expect(actual).toEqual(fixture.expected);
  });
});

describe('excel project_number_stock formula fixtures', () => {
  it.each(projectNumberStockFixtures)('$name', (fixture) => {
    const actual = computeProjectNumberStock(fixture.description);
    expect(actual).toBe(fixture.expectedProjectNumberStock);
  });
});

describe('excel attribute_6_pid formula fixtures', () => {
  it.each(attribute6PidFixtures)('$name', (fixture) => {
    const actual = computeAttribute6Pid(fixture.description);
    expect(actual).toBe(fixture.expectedPid);
  });
});

describe('invoice number mode regression fixtures', () => {
  it.each(invoiceNumberFixtures)('$name', (fixture) => {
    const actual = computeInvoiceNumber(fixture);
    expect(actual).toBe(fixture.expectedInvoiceNumber);
  });
});

describe('regex contract synchronization', () => {
  it('keeps jira capture regex aligned with descriptor contract', () => {
    const filePath = path.resolve(repoRoot, 'scripts/table_capture/jira-issue-capture.js');
    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain(JIRA_CAPTURE_DESCRIPTOR_PATTERN_TEXT);
    expect(source).toContain('(?:[A-Z0-9&]{2,8}-)?\\\\d{7,12}');
  });

  it('keeps invoice-line stock formula aligned with descriptor contract', () => {
    const filePath = path.resolve(repoRoot, 'excel/tr_upload_sheet/invoice_lines/project_number_stock.fx');
    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain(FORMULA_DESCRIPTOR_PATTERN_TEXT);
  });

  it('keeps invoice-number formula aligned with descriptor + tag contract', () => {
    const filePath = path.resolve(repoRoot, 'excel/tr_upload_sheet/invoices/invoice_number_stock_or_date_increment.fx');
    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain(FORMULA_DESCRIPTOR_PATTERN_TEXT);
    expect(source).toContain(FORMULA_TAG_PATTERN_TEXT);
  });

  it('keeps attribute_6_pid formula aligned with pid descriptor contract', () => {
    const filePath = path.resolve(repoRoot, 'excel/tr_upload_sheet/invoice_lines/attribute_6_pid.fx');
    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain(ATTRIBUTE6_PID_DESCRIPTOR_PATTERN_TEXT);
  });

  it('keeps regex spec examples synthetic-only', () => {
    const filePath = path.resolve(repoRoot, 'scripts/table_capture/jira-issue-capture-stock-vin-pid-regex.md');
    const source = readFileSync(filePath, 'utf8');
    expect(source).not.toContain('T&R-2004445961');
    expect(source).not.toContain('1C4HJXDG6KW511003');
  });
});
