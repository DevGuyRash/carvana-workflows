# Jira Advanced Search Builder (JQL) — Progress Log

> Always read this file first in future sessions.

## Goal
Build a toggleable Jira Advanced Search (JQL) builder workflow that injects a friendly GUI, covers all JQL operators/keywords/functions, supports grouping (AND/OR/NOT), and writes the generated JQL into Jira's advanced search box.

## Status
- 2025-12-31: Kickoff. Jira page inspected with Playwright; advanced search textarea is `textarea#advanced-search` (name `jql`, role `combobox`, aria-label `Advanced Query`). Search button is `button.search-button` with text `Search`.
- 2025-12-31: Jira JQL autocomplete endpoint confirmed: `GET /rest/api/2/jql/autocompletedata` returns `visibleFieldNames`, `visibleFunctionNames`, and `jqlReservedWords`.
- 2025-12-31: Atlassian Advanced Search docs opened for JSM 10.3; keywords/operators/functions references reviewed for JQL operator coverage.

## Notes
- Use the JQL autocomplete API to avoid hardcoding field names and to include all custom fields.
- Build modular shared code under `packages/jira-userscript/src/shared/jql/`.
- Workflow should **toggle** the UI: run once to create, run again to destroy.
- UI must be user-friendly (no SQL knowledge needed) and allow grouping + AND/OR/NOT logic, plus ORDER BY.

## Next Steps
- Implement shared JQL builder state + formatting helpers + UI mount.
- Add workflow `jira.jql.builder` that toggles the UI.
- Wire into Jira page registry in `packages/jira-userscript/src/pages/jira.ts`.
- Validate via Playwright injection and ensure selectors are non-brittle.

## Implementation Notes
- Added shared JQL builder modules under `packages/jira-userscript/src/shared/jql/` (data, state/formatting, UI mount).
- New workflow `jira.jql.builder` toggles the builder UI and uses Jira autocomplete API for fields/functions.
- Jira page registry now exposes the JQL builder workflow alongside demos.

## Verification
- Playwright: confirmed `textarea#advanced-search` exists and accepts injected JQL value; search button selector confirmed (`button.search-button`).
- Playwright: verified `/rest/api/2/jql/autocompletedata` returns fields/functions/reserved words.
- Lint: `npm run lint` fails due to existing Oracle workflow typing errors (unrelated to Jira builder).

## 2025-12-31 Follow-up
- Fixed TypeScript lint errors in `packages/oracle-userscript/src/workflows/oracle-invoice-creator.ts` (typed execute context + stricter id assertions).
- Added function detection to JQL builder quoting logic to avoid quoting `currentUser()`-style functions.
- Added tests: `packages/jira-userscript/test/jql-builder.test.ts`.
- Lint passes (`npm run lint`) and targeted vitest run passes.

## 2025-12-31 (Doc-driven fixes)
- Added text-search modes for ~ / !~ operators (phrase, wildcard, prefix, suffix, fuzzy, proximity, boost, raw) aligned with Atlassian text-search syntax.
- Expanded JQL keyword list to match Atlassian keywords reference.
- Added text-search UI controls + hints; included result/bulk-change hints.
- Added state normalization so saved clauses pick up new defaults.
- Added tests covering text-search outputs.

## 2025-12-31 (Field fixes + Playwright)
- Improved field matching (partial, cf[ID] tokens) and friendlier labels; added field type badges and JQL value display.
- Added preference to use custom field IDs (cf[...]) when selected and toggle to apply across clauses.
- Added text-search options UI for ~ / !~ operators.
- Playwright: injected bundled preview of builder UI into Jira issue navigator and verified DOM render.

## 2025-12-31 (Docs alignment)
- Field panel now shows friendly names + cf IDs + type labels; partial matching improved so "Vendor" finds vendor-related fields.
- Added toggle to prefer `cf[ID]` in JQL per Atlassian guidance.
- Reference panel now notes `text` master-field usage and custom field ID preference.
