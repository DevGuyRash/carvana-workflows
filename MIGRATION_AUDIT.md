# Migration Audit and Execution Spec: Legacy Userscripts -> Rust WebExtension

> **As of:** 2026-02-24 09:25:20 UTC
> **Repository commit:** `7ab3e48`
> **Primary target:** `apps/webextension/` + `rust/crates/*`
> **Document mode:** Decision-complete implementation spec (not just audit)

---

## 1. Purpose and Scope

This document is the canonical migration spec for closing parity gaps between the removed
userscript runtime and the current Rust-first WebExtension runtime.

### 1.1 In scope

- Truthful current-state assessment from repository code.
- Parity gap analysis for Jira, Oracle, and Carma features listed below.
- File-level implementation tasks and sequencing.
- Public interface and contract changes required for parity.
- Test matrix and acceptance criteria.
- UI functional requirements and explicit handoff notes for separate design ownership.

### 1.2 Out of scope

- Visual design system redesign or detailed visual styling decisions.
- Introducing userscript/Tampermonkey compatibility.
- Editing code in this document update.

### 1.3 Verification method used for this audit

Current-state claims in this file were validated by reading these files and entry points:

- `rust/crates/cv_ext_wasm/src/dom.rs`
- `rust/crates/cv_ext_wasm/src/commands.rs`
- `rust/crates/cv_ext_wasm/src/lib.rs`
- `rust/crates/cv_ext_core/src/executor.rs`
- `rust/crates/cv_ext_core/src/engine.rs`
- `rust/crates/cv_ext_core/src/registry.rs`
- `rust/crates/cv_ext_core/src/rule_engine.rs`
- `rust/crates/cv_ext_sites_jira/src/capture.rs`
- `rust/crates/cv_ext_sites_jira/src/rules.rs`
- `rust/crates/cv_ext_sites_oracle/src/rules.rs`
- `rust/crates/cv_ext_sites_carma/src/rules.rs`
- `apps/webextension/src/shared/messages.ts`
- `apps/webextension/src/content.ts`
- `apps/webextension/src/background.ts`
- `apps/webextension/src/popup.ts`
- `apps/webextension/src/sidepanel.ts`
- `apps/webextension/src/extension-page.ts`
- `tests/e2e/TEST_PLAN.md`

---

## 2. Current-State Summary Matrix

| Feature | Legacy status | Current runtime status | Confidence | Migration verdict |
|---|---|---|---|---|
| Jira: Capture Filter Table | Fully working, AP post-processing logic and export flow | Captures generic table rows, adds only Stock/VIN/PID/Reference/Invoice | Verified in code | Not ported |
| Jira: JQL Search Builder | Full interactive builder UI + state + persistence | Command only marks installed and clicks Advanced switcher | Verified in code | Not ported |
| Oracle: Invoice Creator | Robust form automation with wait/retry/LOV handling | Partial command chain with direct value assignment and basic selectors | Verified in code | Partially ported |
| Oracle: Validation Alert | Retry detector + floating status banner | Body-text substring detection + data attribute write only | Verified in code | Partially ported |
| Oracle: Expand Invoice Search | Expand/collapse + state verify | Expand and `aria-expanded` verification implemented | Verified in code | Ported (functional minimum) |
| Carma: Bulk Search Scrape | Full scraping app: pagination/filter/dedup/export/UI | Wait for `table`, then generic extract only | Verified in code | Not ported |

---

## 3. Runtime Architecture Reality Check

### 3.1 Current execution path

- UI surfaces dispatch runtime messages (`popup.ts`, `sidepanel.ts`, `extension-page.ts`).
- `background.ts` forwards site-bound execution requests to content script tabs.
- `content.ts` invokes WASM exports (`run_workflow`, `capture_jira_filter_table`, `list_rules`).
- `cv_ext_core::RuntimeEngine` executes action lists synchronously via `ActionExecutor`.
- `cv_ext_wasm` provides concrete DOM execution in `dom.rs` + feature commands in `commands.rs`.

### 3.2 Key confirmed constraints

- `ActionExecutor` is synchronous (`rust/crates/cv_ext_core/src/executor.rs`).
- DOM wait logic is busy-loop polling with `Date::now()` (`dom.rs`), not async timer-based.
- `type_selector()` sets input value but does not dispatch `input`/`change`/`blur` events.
- `capture_table_rows()` is generic and does not support table-grid complexity.
- Message contract includes generic `run-rule`/`capture-table`, but no progress stream contract.
- Existing e2e implementation is absent; only planning doc exists in `tests/e2e/TEST_PLAN.md`.

---

## 4. Feature Audit and Decision-Complete Build Specs

## 4.1 Jira: Capture Filter Table

### 4.1.1 Current implementation

- Rule entry: `rust/crates/cv_ext_sites_jira/src/rules.rs`
  - `jira.issue.capture.table` action list uses `Action::ExtractTable { selector: "table" }`.
- Capture export: `rust/crates/cv_ext_wasm/src/lib.rs`
  - `capture_jira_filter_table()` calls `dom::capture_table_rows("table")` and `rows_with_derived_fields()`.
- Derived fields: `rust/crates/cv_ext_sites_jira/src/capture.rs`
  - Adds `StockNumber`, `VIN`, `PID`, `Reference`, `Invoice` using regex/header matching.

### 4.1.2 Confirmed missing behavior

- No AP post-processor output schema (legacy 29-column output not represented).
- No vendor routing rules, request type inference, department routing, or mailing logic.
- No financial fallback logic (check request amount precedence).
- No address parser decomposition.
- No hyperlink formula conversion.
- No invoice-exists formula insertion.
- No output sorting and export formatting modes.
- Table extraction lacks colspan/rowspan/header merge and nested-table isolation.

### 4.1.3 Implementation tasks (ordered)

1. Extend DOM capture primitives in `rust/crates/cv_ext_wasm/src/dom.rs`:
- Add grid-aware cell extraction model with rowspan/colspan normalization.
- Add header de-duplication and merged-header derivation.
- Extract link href metadata and form control values.

2. Add AP transform module in `rust/crates/cv_ext_sites_jira/src/`:
- New file candidates: `ap_transform.rs`, `vendor_rules.rs`, `amounts.rs`, `address.rs`.
- Define normalized row input and canonical AP output struct.

3. Port vendor routing and request-type inference:
- Encode pattern table as Rust static data.
- Support suffix-based inference and department overrides.

4. Port amount/address/reference logic:
- Implement explicit precedence chain and parser fallbacks.
- Preserve placeholder semantics for missing identifiers.

5. Add formula emitters:
- Hyperlink conversion and invoice-exists formula generation as explicit output fields.

6. Integrate in WASM bridge:
- Update `capture_jira_filter_table()` to return transformed output payload with metadata.

7. Add result delivery contract hook:
- Define output mode options for content-side consumption (table/json/clipboard-ready payload).

### 4.1.4 Acceptance criteria

- Output schema contains required AP columns and deterministic ordering.
- Vendor/request type routing parity for representative legacy patterns.
- Amount/address/reference logic matches expected outcomes for edge cases.
- Table capture handles rowspan/colspan and nested table scenarios.
- Returned payload is consumable by popup/sidepanel/extension page.

### 4.1.5 Required tests

- Rust unit tests for vendor rules, amount precedence, address parsing, identifier derivation.
- Rust unit tests for table-grid normalization.
- Integration tests for `capture_jira_filter_table()` response shape and sample rows.
- WebExtension e2e scenario for capture action result delivery visibility.

### 4.1.6 UI handoff note

- UI owner (separate design AI) should design final capture result presentation.
- Engineering here must only define data contract and minimal interaction hooks.

---

## 4.2 Jira: JQL Search Builder

### 4.2.1 Current implementation

- Command exists in `rust/crates/cv_ext_wasm/src/commands.rs`:
  - `install_jql_builder_switcher_hooks()` sets marker attr and clicks Advanced switcher item.
- Rule exposed in `rust/crates/cv_ext_sites_jira/src/rules.rs`:
  - `jira.jql.builder` executes `jira.install_jql_builder` command.

### 4.2.2 Confirmed missing behavior

- No query builder state model (clauses/groups/sorts).
- No builder UI, preset system, or persistence.
- No autocomplete API integration.
- No JQL serialization/formatting boundary contract.

### 4.2.3 Implementation tasks (ordered)

1. Define Rust state and serialization contracts in `cv_ext_sites_jira`:
- Add JQL AST-like structures (group, clause, operator, value variants).
- Add deterministic JQL formatter.

2. Add WASM exports in `rust/crates/cv_ext_wasm/src/lib.rs` (or bridge module):
- `jql_init_state`, `jql_apply_action`, `jql_format`, `jql_presets_list`, `jql_presets_save`.

3. Add preset persistence bridge:
- Persist via existing extension storage pipeline (TS bridge to browser storage).

4. Implement TS UI runtime shell in `apps/webextension/src/`:
- Create dedicated module for JQL builder functional UI host.
- Wire UI events to WASM state/actions.
- Keep business rules in Rust, UI rendering in TS per repo policy.

5. Add autocomplete request path:
- Either via TS fetch bridge or WASM fetch export, with explicit response normalization.

### 4.2.4 Acceptance criteria

- User can build nested JQL clauses and groups and generate valid JQL string.
- Built-in presets available and custom presets persist across reloads.
- Autocomplete suggestions integrate into field/value selection.
- Rule execution from extension surfaces launches functional builder workflow.

### 4.2.5 Required tests

- Rust unit tests for JQL formatting and AST transformations.
- TS unit tests for state-to-UI adapter layer.
- e2e scenario: create query, persist preset, reload, rerun query build.

### 4.2.6 UI handoff note

- Provide functional controls and state integration only.
- Final interaction pattern and visual refinement are delegated to design AI.

---

## 4.3 Oracle: Invoice Creator

### 4.3.1 Current implementation

- Main command: `oracle_invoice_create()` in `rust/crates/cv_ext_wasm/src/commands.rs`.
- Executes sub-steps:
  - Business unit ensure.
  - Supplier LOV action.
  - Supplier site fill/ensure.
  - Invoice number fill/generate.
  - Optional invoice group/amount/description fill.
- Field fill relies on `dom::type_selector()`.

### 4.3.2 Confirmed missing behavior

- No event dispatch after value updates (critical for Oracle reactive controls).
- No async waits between interactions.
- No robust LOV popup discovery with `aria-owns`/proximity rules.
- No structured retry/backoff orchestration.
- Partial dropdown filtering only; no resilient selection strategy.

### 4.3.3 Implementation tasks (ordered)

1. Fix input semantics in `rust/crates/cv_ext_wasm/src/dom.rs`:
- Add typed element handling for input/textarea/select.
- Dispatch synthetic `input`, `change`, and `blur` events after mutation.

2. Introduce async wait utilities:
- Add timer-based non-blocking waits and selector polling.
- Remove main-thread busy loops.

3. Extend Oracle DOM helpers in `commands.rs`:
- `find_inline_listbox`, `resolve_aria_owned_popup`, `first_valid_option`, `clear_field`.

4. Add retry orchestration:
- Central reusable retry helper with max attempts and backoff profile.

5. Update invoice create step sequence:
- Include waits between field operations and explicit verification checks.

6. Add structured diagnostics:
- Return step-level attempt details in command result artifacts.

### 4.3.4 Acceptance criteria

- Invoice creation fields register changes in Oracle UI controls.
- LOV selection succeeds across popup/listbox variants.
- Retry path recovers from delayed rendering and transient misses.
- Failure results include actionable diagnostics.

### 4.3.5 Required tests

- DOM unit tests (wasm-bindgen test or integration harness) for event dispatch path.
- Oracle workflow integration tests for delayed dropdown scenarios.
- e2e flow with fixture variants: success, delayed options, no-results.

---

## 4.4 Oracle: Validation Alert

### 4.4.1 Current implementation

- Commands in `rust/crates/cv_ext_wasm/src/commands.rs`:
  - `oracle_invoice_validation_alert()` calls `detect_validation_status()`.
  - `detect_validation_status()` scans full body text for status keywords.
  - Result written to `data-cv-oracle-validation-status` on body.

### 4.4.2 Confirmed missing behavior

- No target-cell selector strategy.
- No retry/backoff detection loop.
- No injected floating banner UI runtime behavior.
- No SPA navigation persistence strategy.
- No manual verification baseline mode.

### 4.4.3 Implementation tasks (ordered)

1. Replace body-wide text scan with targeted selector probe:
- Primary selector for validation cells; controlled fallback chain.

2. Add retry detection engine:
- Poll with increasing interval until timeout.
- Capture attempt log and sampled DOM context.

3. Add alert state model:
- Status enum + metadata suitable for TS UI consumption.

4. Implement banner injection hook:
- Engineering-level mount/update/unmount interface only.
- Styling should remain minimal and theme-token driven.

5. Add SPA persistence strategy:
- Re-evaluate status on URL/nav mutations and keep banner synchronized.

### 4.4.4 Acceptance criteria

- Status detection robust against delayed render.
- Banner reflects validated/needs-revalidated/unknown states consistently.
- Banner survives SPA transitions and can be rehydrated.

### 4.4.5 Required tests

- Detector unit tests with DOM variants and retry timing cases.
- Integration tests for SPA-like DOM replacement.
- e2e run from Oracle fixture with status transitions.

### 4.4.6 UI handoff note

- Provide a functional banner container contract and status tokens.
- Final banner design, spacing, and motion are design-AI owned.

---

## 4.5 Oracle: Expand Invoice Search

### 4.5.1 Current implementation

- `oracle_expand_invoice*` command family in `rust/crates/cv_ext_wasm/src/commands.rs`.
- Uses `aria-expanded` checks and button click behavior.

### 4.5.2 Residual gaps

- Visibility verification is simple and may fail on complex hidden states.
- No diagnostics around unresolved panel state path.

### 4.5.3 Implementation tasks

1. Keep current behavior as baseline.
2. Add optional secondary verification path (panel content visibility lookup).
3. Add richer error messages with selector context.

### 4.5.4 Acceptance criteria

- Idempotent expand command remains stable.
- Failure output includes enough context to debug selector drift.

### 4.5.5 Required tests

- Unit-level command tests for already-expanded and collapsed cases.
- Integration fixture with mismatched aria state fallback.

---

## 4.6 Carma: Bulk Search Scrape

### 4.6.1 Current implementation

- Rule in `rust/crates/cv_ext_sites_carma/src/rules.rs`:
  - Wait for `table` then extract generic table rows.
- No Carma-specific command logic exists in `commands.rs`.

### 4.6.2 Confirmed missing behavior

- No search-term parsing loop.
- No pagination traversal.
- No required-field filtering.
- No dedup/uniqueness strategy.
- No column selection/mapping pipeline.
- No export serialization contract.
- No dedicated scraper UI workflow integration.

### 4.6.3 Implementation tasks (ordered)

1. Add Carma scraper core module under `rust/crates/cv_ext_sites_carma/src/`:
- `parser.rs`, `pagination.rs`, `filters.rs`, `uniqueness.rs`, `columns.rs`, `export.rs`.

2. Define scraper session contract:
- Input options, progress snapshots, and final result payload.

3. Add command handlers in `rust/crates/cv_ext_wasm/src/commands.rs`:
- Start run, continue page, finalize/export.

4. Extend rule definition to call command-driven scrape rather than generic extract.

5. Add TS UI host in extension surface for options/progress/results.
- Functional controls only; no deep visual design in this migration step.

### 4.6.4 Acceptance criteria

- Multi-term scrape supports pagination and deterministic dedup strategy.
- User-selectable columns and required-field filtering apply correctly.
- Export payload supports CSV/JSON output generation.
- Progress feedback available to UI surfaces.

### 4.6.5 Required tests

- Rust unit tests for parser, pagination, dedup, and column projection.
- Integration tests for end-to-end scrape session lifecycle.
- e2e scenario for run, progress, and export action from extension UI.

### 4.6.6 UI handoff note

- Provide options/progress/results interaction contract and events.
- Final modal/popout composition and visual treatment are design-AI owned.

---

## 5. Cross-Cutting Platform Gaps

## 5.1 DOM and Web API support gaps (`cv_ext_wasm`)

### Current gap

`web-sys` feature set in `rust/Cargo.toml` is minimal and does not include several interfaces needed
for realistic extension automation.

### Required additions

- `Event`, `EventTarget`, `InputEvent`, `InputEventInit`
- `HtmlTextAreaElement`, `HtmlSelectElement`
- `CssStyleDeclaration`
- `HtmlIFrameElement` (if iframe access needed)
- Additional request/response APIs if WASM-side fetch is chosen

### Acceptance

- Cargo builds cleanly with expanded feature set.
- DOM helpers compile and cover event-driven form interactions.

---

## 5.2 Async execution model

### Current gap

- `RuntimeEngine` and `ActionExecutor` are synchronous.
- `wait_for_selector()` busy-loops and can block rendering.

### Required migration decision

- Move to async action execution contract for wait/fetch/sleep-dependent flows.

### Implementation approach

- Update `ActionExecutor` trait to async methods.
- Update `RuntimeEngine` execution loop to await action results.
- Update WASM executor implementation accordingly.

### Acceptance

- Waits no longer block UI thread progression.
- Oracle delayed render flows work reliably.

---

## 5.3 Result delivery and UX plumbing

### Current gap

- Runtime returns artifacts, but user surfaces mostly provide success/fail toasts/messages.
- No standardized result viewer or download/clipboard orchestration contract.

### Required additions

- Add result payload schema with `kind`, `columns`, `rows`, `meta`.
- Add UI-consumable response handling in popup/sidepanel/extension-page runtimes.
- Add minimal action hooks for copy/download/open-view.

### Acceptance

- Capture and scrape results are visible and actionable to user.
- Artifact handling is consistent across surfaces.

---

## 6. Public API and Interface Changes Required

This section defines interface-level changes implementers must make to reach parity.

## 6.1 Rust interfaces

1. `ActionExecutor` (`rust/crates/cv_ext_core/src/executor.rs`)
- Change from sync methods to async-compatible methods.
- Preserve action method granularity (`wait_for`, `click`, `type_text`, etc.).

2. `RuntimeEngine` (`rust/crates/cv_ext_core/src/engine.rs`)
- Update execution loop to async action handling.
- Preserve `RunReport` behavior and step artifact extraction semantics.

3. Site modules
- Add feature-specific structs/enums for Jira AP transform, JQL state, Oracle detector, Carma session.

## 6.2 WASM bridge interfaces

1. Existing exports to keep:
- `detect_site`, `list_workflows`, `run_workflow`, `capture_jira_filter_table`.

2. New/expanded exports required:
- JQL state/action APIs.
- Carma scrape session APIs.
- Optional: status/progress subscription pull APIs (if not done via run artifacts).

3. Command output contract normalization:
- All execute commands should return typed JSON payloads with stable keys:
  - `command`
  - `status`
  - `artifacts`
  - `diagnostics`

## 6.3 TS runtime message contracts

`apps/webextension/src/shared/messages.ts` currently uses broad unions and generic payloads.

Required updates:

- Add explicit message kinds for:
  - `run-rule-with-result-mode`
  - `scrape-progress`
  - `result-ready`
  - `download-result`
  - `copy-result`
- Add strict payload interfaces for rule execution context and result envelopes.

## 6.4 Result artifact schema

Standardize artifacts in `RunReport.artifacts` as:

```json
{
  "kind": "table" | "records" | "diagnostic" | "alert",
  "name": "string",
  "columns": ["string"],
  "rows": [],
  "meta": {
    "site": "jira|oracle|carma",
    "workflowId": "string",
    "generatedAtMs": 0
  }
}
```

This schema is required for consistent presentation and export behavior.

---

## 7. Execution Plan (Phase-Gated)

## Phase P0: Runtime foundations (blocking)

### Goal
Unblock parity work by fixing DOM semantics and async execution fundamentals.

### Entry criteria
- Current baseline builds and tests pass (`npm run typecheck`, `npm test`).

### Tasks
1. Expand `web-sys` features in `rust/Cargo.toml`.
2. Implement event-dispatching input helpers in `cv_ext_wasm/src/dom.rs`.
3. Replace busy-loop waits with non-blocking async waits.
4. Migrate executor/engine trait and call sites to async action flow.

### Exit criteria
- Oracle form interactions register reliably in fixtures.
- No busy-loop main-thread blocking in wait paths.

### Risks
- Async trait migration touches multiple crates.
- Run-report timing/ordering regressions.

---

## Phase P1: Jira Capture parity

### Goal
Port AP post-processing and structured output delivery.

### Tasks
1. Implement AP transform modules and routing tables.
2. Upgrade table capture fidelity (grid-aware extraction).
3. Integrate formula output and sort ordering.
4. Emit standardized artifact payload and surface minimal viewer hooks.

### Exit criteria
- Jira capture output matches expected AP schema for defined fixtures.

---

## Phase P2: Oracle Invoice Creator parity

### Goal
Make invoice creation robust in real Oracle UI timing conditions.

### Tasks
1. Implement LOV detection/select helpers and retry loops.
2. Add field clear/type/verify cycle with diagnostics.
3. Update command chain with sleeps/waits and structured failure reasons.

### Exit criteria
- End-to-end invoice creation flow stable against delayed list rendering.

---

## Phase P3: Oracle Validation Alert parity

### Goal
Replace heuristic body scan with resilient targeted detector and alert behavior.

### Tasks
1. Add targeted status detector with backoff.
2. Add alert state output + mount/update hooks.
3. Add SPA navigation resilience.

### Exit criteria
- Accurate status classification and persistent alert behavior.

---

## Phase P4: Jira JQL Builder functional parity

### Goal
Restore core query-builder functionality with Rust-owned logic and TS-rendered UI.

### Tasks
1. Implement JQL state engine and formatter in Rust.
2. Add WASM APIs for state transitions and preset CRUD.
3. Build TS functional UI shell and wire state/actions.

### Exit criteria
- Users can construct, persist, and reuse complex JQL queries.

---

## Phase P5: Carma Bulk Scrape parity

### Goal
Restore production scraper workflow with filtering/dedup/export and progress updates.

### Tasks
1. Build Rust scraper modules and session contract.
2. Add command orchestration and artifact outputs.
3. Add TS functional UI controls for run/options/progress/results.

### Exit criteria
- Scrape workflow supports multi-term pagination and export output.

---

## 8. Test Strategy and Acceptance Matrix

## 8.1 Current test state (verified)

- Rust unit tests exist in crate modules.
- `tests/e2e/TEST_PLAN.md` exists.
- Playwright config/spec/fixtures are not present in repository at this revision.

## 8.2 Required test implementation tracks

1. Rust unit tests
- `cv_ext_sites_jira`: AP routing, amounts, addresses, formatter outputs.
- `cv_ext_wasm`: DOM helper behavior and command result schemas.
- `cv_ext_sites_oracle`: detector and invoice command helper logic.
- `cv_ext_sites_carma`: parser, pagination, dedup, export shaping.

2. Runtime integration tests
- Engine/executor async flow and report artifacts.
- Command chain behavior for Oracle flows and failure retries.

3. E2E implementation (Playwright)
- Build fixtures and specs described in `tests/e2e/TEST_PLAN.md`.
- Add extension loading harness and message helper utilities.

## 8.3 Feature acceptance checklist

### Jira Capture
- [ ] Extracts complex table structures.
- [ ] Produces AP output schema.
- [ ] Applies vendor/amount/address/request logic.
- [ ] Surfaces results in extension UI flow.

### Jira JQL Builder
- [ ] Supports nested query construction and serialization.
- [ ] Presets persist and restore.
- [ ] Autocomplete integration works.

### Oracle Invoice Creator
- [ ] Event-driven fills register in Oracle controls.
- [ ] LOV and retries work under delayed rendering.
- [ ] Diagnostics returned for failed steps.

### Oracle Validation Alert
- [ ] Targeted selector-based status detection with retries.
- [ ] Banner state updates and SPA persistence.

### Carma Bulk Scrape
- [ ] Multi-term + pagination scrape works.
- [ ] Filter and dedup strategies applied deterministically.
- [ ] CSV/JSON export payload produced and actionable.

---

## 9. UI Functional Requirements and Handoff Notes

This migration doc intentionally avoids final visual design decisions.

### 9.1 Functional UI requirements to implement

1. Result surfaces
- Must display tabular artifacts and expose copy/download actions.

2. Long-running workflows (JQL builder, Carma scrape)
- Must expose run state, progress, and error diagnostics.

3. Oracle validation alert
- Must have mount/update lifecycle with status-driven variants.

### 9.2 Explicit non-design boundaries

- Do not lock final layout, color system, typography, or motion system in this migration phase.
- Keep UI additions minimal and token-based so design AI can refine without reworking logic.

### 9.3 UI-affecting assumptions recorded in this audit

- Use existing extension surfaces (`popup`, `sidepanel`, `extension-page`) rather than adding new top-level surfaces.
- Prefer reusable UI components under `apps/webextension/src/ui/` for new functional controls.
- Use structured artifact schema to decouple presentation from runtime behavior.

---

## 10. Risks, Dependencies, and Sequencing Constraints

## 10.1 Critical dependencies

- P1/P2/P3/P4/P5 depend on P0 async and input-event correctness.
- JQL and Carma UI functional layers depend on stable message/result contracts.
- E2E rollout depends on fixture and harness implementation.

## 10.2 Primary migration risks

1. Async engine refactor can introduce subtle ordering/timing regressions.
2. Selector drift against live Oracle/Jira/Carma UIs can break rules.
3. Legacy behavior parity may be incomplete without curated fixture corpus.
4. Artifact schema churn can break UI consumers unless versioned/guarded.

## 10.3 Mitigations

- Phase-gate with strict exit criteria.
- Add fixture-driven regression cases before each parity port.
- Introduce contract tests for message/result envelope stability.

---

## 11. Decision Log and Defaults Used

1. Document depth: execution-spec level (selected).
2. UI handling: functional placeholders and explicit design handoff (selected).
3. Runtime model default: async-capable executor migration is required for parity.
4. Result delivery default: structured artifact envelope is required across all surfaces.

---

## 12. Definition of Done for Migration Completion

Migration is complete only when all conditions are true:

1. Feature parity status:
- Jira Capture: ported.
- Jira JQL Builder: ported.
- Oracle Invoice Creator: ported.
- Oracle Validation Alert: ported.
- Oracle Expand Invoice Search: retained ported status.
- Carma Bulk Search Scrape: ported.

2. Contracts:
- Async execution contract implemented and stable.
- Result artifact schema standardized and consumed by UI surfaces.

3. Testing:
- Rust unit/integration suites cover new behavior.
- Playwright e2e suite from `tests/e2e/TEST_PLAN.md` implemented and passing.

4. UX plumbing:
- User can view/export captured or scraped data through extension flows.
- Failures provide actionable diagnostics in UI-visible responses.

---

## Appendix A: Current Source-of-Truth File Map

- Runtime engine: `rust/crates/cv_ext_core/src/engine.rs`
- Executor contract: `rust/crates/cv_ext_core/src/executor.rs`
- Site registry: `rust/crates/cv_ext_core/src/registry.rs`
- Rule engine: `rust/crates/cv_ext_core/src/rule_engine.rs`
- WASM bridge exports: `rust/crates/cv_ext_wasm/src/lib.rs`
- WASM commands: `rust/crates/cv_ext_wasm/src/commands.rs`
- WASM DOM utils: `rust/crates/cv_ext_wasm/src/dom.rs`
- Jira derived capture logic: `rust/crates/cv_ext_sites_jira/src/capture.rs`
- Site rule definitions:
  - `rust/crates/cv_ext_sites_jira/src/rules.rs`
  - `rust/crates/cv_ext_sites_oracle/src/rules.rs`
  - `rust/crates/cv_ext_sites_carma/src/rules.rs`
- Message types: `apps/webextension/src/shared/messages.ts`
- Extension message handlers:
  - `apps/webextension/src/background.ts`
  - `apps/webextension/src/content.ts`

## Appendix B: Legacy Reference Recovery Commands

```bash
# Jira issue capture (final userscript recipe)
git show 35a530f:scripts/table_capture/jira-issue-capture.js

# Jira JQL builder state + UI
git show 9322a47:packages/jira-userscript/src/shared/jql/jql-builder.ts
git show 9322a47:packages/jira-userscript/src/shared/jql/jql-builder-ui-v2.ts

# Oracle invoice creator + validation logic
git show 170891f~1:packages/oracle-userscript/src/workflows/oracle-invoice-creator.ts
git show 170891f~1:packages/oracle-userscript/src/workflows/oracle-invoice-validation-alert.ts
git show 170891f~1:packages/oracle-userscript/src/shared/invoice/status-detector.ts

# Oracle expand invoice search
git show 170891f~1:packages/oracle-userscript/src/workflows/oracle-expand-invoice-search.ts

# Carma bulk scraper
git show 170891f~1:packages/carma-bulk-search-scraper-userscript/src/scraper.ts
```
