# Userscript Parity Matrix (Jira + Oracle + Carma)

Status keys:
- `PARITY`: implemented and behaviorally matched in extension runtime.
- `INTENTIONAL_DELTA`: intentionally different by design.
- `GAP_FIX_REQUIRED`: known best-effort gap still open.

## Jira JQL Builder

| Feature | Legacy source anchor (`/tmp/scripts/jira.user.js`) | Extension/Rust anchor | Status | Notes |
|---|---|---|---|---|
| Pinned presets state | `5260-5261`, `6611-6630`, `9055-9064` | `rust/crates/cv_ext_wasm/src/menu_state.rs:11-12`, `rust/crates/cv_ext_wasm/src/jql_panel.rs:81-87,142-146,535` | PARITY | Legacy pinned preset keys migrate and persist in panel state. |
| Recent filters/query history | `5261`, `6612`, `6691-6693`, `8528-8549` | `rust/crates/cv_ext_wasm/src/jql_panel.rs:84-85,141-143,221-223,717-724` | PARITY | Recent queries maintained with mirrored `recentFilters` state for parity semantics. |
| Quick search text persistence | `6607`, `8161-8191`, `8424` | `rust/crates/cv_ext_wasm/src/jql_panel.rs:86,160-189,451,672-692` | PARITY | Added quick-search state and natural-language heuristic composition. |
| Advanced editor text persistence | `6614`, `6645`, `9254-9274`, `9567-9568` | `rust/crates/cv_ext_wasm/src/jql_panel.rs:87,154,224-225,452,664,705,755` | PARITY | Advanced editor state now explicitly persisted, not inferred only from query output. |
| Quick/Visual/Advanced tab lifecycle (no duplicate handler recursion) | `8089-8091`, `9545-9549` | `rust/crates/cv_ext_wasm/src/jql_panel.rs:486-493` | PARITY | Added explicit binding guard (`data-cv-bound`) to prevent stacked handlers on rerender. |
| In-page launcher/switcher button injection | `9707` | `rust/crates/cv_ext_wasm/src/jql_panel.rs:778-786` | INTENTIONAL_DELTA | Extension-launch only; no userscript launcher button reinjected. |

## Oracle Workflows

| Feature | Legacy source anchor (`/tmp/scripts/oracle.user.js`) | Extension/Rust anchor | Status | Notes |
|---|---|---|---|---|
| Invoice create option `skipInvoiceNumber` | `6352`, `6484-6494` | `rust/crates/cv_ext_wasm/src/commands.rs:727-734,767` | PARITY | Number subflow now supports explicit skip option behavior. |
| Invoice create options `allowDocumentScope` + `allowSupplierSiteWithoutNumber` | `6162-6168`, `6353-6362`, `6841-6849` | `rust/crates/cv_ext_wasm/src/commands.rs:699-707,768-769` | PARITY | Option schema exposed and honored for supplier site gate behavior. |
| Validation verify expected token/snippet baseline | `7593-7601`, `7416-7439` | `rust/crates/cv_ext_wasm/src/commands.rs:451-483` | PARITY | Verify command now compares observed token/snippet against provided expected baseline. |
| Validation alert status classification | `7102`, `7562-7574` | `rust/crates/cv_ext_wasm/src/commands.rs:268-287,340-370,390-430` | PARITY | Status token classification retained with retries and surfaced artifact metadata. |

## Carma Bulk Scraper

| Feature | Legacy source anchor (`/tmp/scripts/carma-bulk-search-scraper.user.js`) | Extension/Rust anchor | Status | Notes |
|---|---|---|---|---|
| Uniqueness strategy enum (`latest_by_date`, `first_seen`, `last_seen`) | `31`, `2169-2170`, `2249`, `2785` | `rust/crates/cv_ext_wasm/src/carma_ui.rs:82-88,145,233-239,462-466,1009-1010`; `rust/crates/cv_ext_wasm/src/commands.rs:1133-1161,1999` | PARITY | Strategy is now persisted in panel state and applied in dedupe flow. |
| Date column auto/manual resolution for latest strategy | `2251-2252`, `2065`, `2111-2125` | `rust/crates/cv_ext_wasm/src/commands.rs:1051-1082,1084-1131,2000` | PARITY | Auto/manual date header resolution added with normalized date ranking. |
| Deterministic dedupe independent of worker order | `2472-2492` | `rust/crates/cv_ext_wasm/src/commands.rs:1043-1049,1681-1714` | PARITY | Rows are stably ordered before dedupe, then replacement strategy is deterministic. |
| Export/copy/popout behaviors | `1299-1352`, `1578`, `3020-3030`, `3456-3465` | `rust/crates/cv_ext_wasm/src/carma_ui.rs:659-825` | PARITY | Copy CSV/JSON, stock/vin/pid/reference copy, and popout flows wired through shared table runtime helpers. |
| Cancel command behavior | `2722` | `rust/crates/cv_ext_wasm/src/commands.rs:1194-1201`; `rust/crates/cv_ext_wasm/src/carma_ui.rs:642-648` | PARITY | Cancel flag propagates through scrape loop and returns canceled status envelope. |
| Userscript gear/launcher UI | userscript panel bootstrap path | `rust/crates/cv_ext_wasm/src/carma_ui.rs:1041-1049` | INTENTIONAL_DELTA | Extension-driven panel launch only; no legacy in-page gear launcher. |

## Best-Effort Remaining Gaps

| Site | Gap | Status | Rationale |
|---|---|---|---|
| Oracle | Full userscript-level selector fallback matrix (all LOV edge selectors and diagnostics history parity) | GAP_FIX_REQUIRED | Core options and flows are in place, but edge selector permutations remain broader in legacy script surface. |
