# TR Upload Regex Regression Tests

This test package is structured to reduce regex drift and copy/paste debt across Jira capture and Excel formulas.

## Files

- `packages/jira-userscript/test/tr-upload-sheet-regex.contract.ts`
  - Single-source regex contract constants used by tests.
- `packages/jira-userscript/test/tr-upload-sheet-regression.harness.ts`
  - Shared extraction/normalization helpers that mirror runtime behavior.
- `packages/jira-userscript/test/stock-vin-pid-regression.fixtures.ts`
  - Fixture sets (synthetic-only data) for extraction and invoice-number modes.
- `packages/jira-userscript/test/stock-vin-pid-regression.test.ts`
  - Regression suite + file-sync assertions.

## Maintenance Rules

1. Keep fixture data synthetic only (no production identifiers).
2. Update `tr-upload-sheet-regex.contract.ts` first when changing regex behavior.
3. Update runtime files next:
   - `scripts/table_capture/jira-issue-capture.js`
   - `excel/tr_upload_sheet/invoice_lines/project_number_stock.fx`
   - `excel/tr_upload_sheet/invoice_lines/attribute_6_pid.fx`
   - `excel/tr_upload_sheet/invoices/invoice_number_stock_or_date_increment.fx`
4. Add/adjust fixtures for each changed behavior path.
5. Run:

```bash
npm run test -- packages/jira-userscript/test/stock-vin-pid-regression.test.ts
```
