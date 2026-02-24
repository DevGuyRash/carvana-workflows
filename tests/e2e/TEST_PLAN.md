# Playwright E2E Test Plan — Carvana Workflows

## Overview

This document catalogues every Playwright test that should be created for the
Carvana Workflows browser extension. Tests exercise the four TS entry-points
(popup, sidepanel, content, background), the WASM runtime bridge, and per-site
workflow behaviour using local HTML fixtures that simulate Jira, Oracle, and
Carma DOM surfaces.

All tests load the built extension from `dist/chrome-extension/` and use
fixture HTML served by Playwright's built-in static server.

---

## Directory Layout

```
tests/e2e/
├── playwright.config.ts          # Playwright config (chromium, extension loading)
├── fixtures/
│   ├── jira/
│   │   ├── filter-table.html     # Simulates Jira issue navigator with a filter table
│   │   └── issue-page.html       # Simulates a single Jira issue view
│   ├── oracle/
│   │   ├── invoice-header.html   # Invoice header with ValidationStatus cell
│   │   ├── invoice-create.html   # Create Invoice form
│   │   └── search-results.html   # Invoice search results table
│   ├── carma/
│   │   └── dashboard.html        # Carma dashboard stub
│   └── blank.html                # Blank page for negative/isolation tests
├── popup.spec.ts
├── sidepanel.spec.ts
├── content.spec.ts
├── background.spec.ts
└── workflows/
    ├── jira.spec.ts
    ├── oracle.spec.ts
    └── carma.spec.ts
```

---

## Fixture Requirements

### Jira Fixtures

**`fixtures/jira/filter-table.html`**
- Must include a `<table>` with column headers: Key, Summary, Status, Assignee.
- Rows should contain realistic data with Stock numbers, VINs, and PIDs embedded
  in the Summary column to exercise `derive_identifiers` through the WASM bridge.
- At least 5 rows; one row with no identifiers, one with only a VIN, one with all three.

**`fixtures/jira/issue-page.html`**
- Simulates a single issue view with Summary field containing identifiers.
- Used to test site detection returning `"jira"` on a non-filter page.

### Oracle Fixtures

**`fixtures/oracle/invoice-header.html`**
- Contains the `ValidationStatus` `<td>` cell structure from the requirements spec:
  ```html
  <td class="xrh" headers="ValidationStatus">
    <a ...><span class="p_AFTextOnly">needs reverification</span></a>
  </td>
  ```
- Must also include "Invoice Header" and "Edit Invoice" text tokens to trigger
  auto-run detection logic.
- Three variants embedded in the same file via `data-scenario` attributes or
  separate `<template>` elements for: validated, needs-revalidated, unknown.

**`fixtures/oracle/invoice-create.html`**
- Simulates the Create Invoice form with Business Unit, Supplier, Supplier Site,
  and Invoice Number fields.
- Used to test `oracle.invoice.create` sub-workflow routing.

**`fixtures/oracle/search-results.html`**
- Simulates the invoice search results table with expandable rows.
- Used to test `oracle.search.invoice.expand` workflow routing.

### Carma Fixtures

**`fixtures/carma/dashboard.html`**
- Minimal Carma dashboard DOM that triggers `detect_site` → `"carma"`.

### Blank Fixture

**`fixtures/blank.html`**
- Empty body. Used for negative tests where no site should be detected.

---

## Test Specifications

### 1. `popup.spec.ts` — Popup UI Tests

| # | Test Name | Description |
|---|-----------|-------------|
| 1.1 | renders heading and button | Popup HTML loads; `<h1>` contains "Carvana Workflows"; `#open-panel` button is visible. |
| 1.2 | status element exists and starts empty | `#status` div is present and either empty or contains no error text on load. |
| 1.3 | open-panel button click sends message | Click `#open-panel`; verify `chrome.runtime.sendMessage` was called with `{ kind: 'open-control-center' }`. |
| 1.4 | displays error in status on failure | Mock `sendMessage` to reject; click button; `#status` should contain error text. |
| 1.5 | popup styles render dark theme | Verify `body` background-color is `#0f172a` (dark slate). |

### 2. `sidepanel.spec.ts` — Side Panel UI Tests

| # | Test Name | Description |
|---|-----------|-------------|
| 2.1 | renders control center heading | `<h1>` contains "Carvana Workflow Control Center". |
| 2.2 | site label starts with detecting | `#site` element contains "detecting...". |
| 2.3 | workflow select starts empty | `#workflow-select` has zero `<option>` children on initial load. |
| 2.4 | hydrate populates workflows on supported site | Navigate to a Jira fixture; sidepanel hydrates; `#workflow-select` gets populated with Jira workflow options. |
| 2.5 | hydrate shows unsupported on blank page | Navigate to blank fixture; `#site` shows "unsupported". |
| 2.6 | run-workflow button dispatches command | Select a workflow; click `#run-workflow`; verify content script receives `{ kind: 'run-workflow', site, workflowId }`. |
| 2.7 | capture-table button dispatches command | Click `#capture-table`; verify content script receives `{ kind: 'capture-jira-table' }`. |
| 2.8 | output panel shows workflow result | Mock workflow returning data; `#output` `<pre>` element displays the result. |
| 2.9 | output panel shows error on failure | Mock workflow failure; `#output` displays error message. |
| 2.10 | re-hydrates on tab activation change | Simulate `chrome.tabs.onActivated`; verify `hydrateSite()` re-runs. |
| 2.11 | re-hydrates on tab update | Simulate `chrome.tabs.onUpdated`; verify `hydrateSite()` re-runs. |
| 2.12 | dark theme styling | Verify `body` background is `#020617`. |

### 3. `content.spec.ts` — Content Script Tests

| # | Test Name | Description |
|---|-----------|-------------|
| 3.1 | installs message listener once | Content script loads; `chrome.runtime.onMessage` listener is registered. |
| 3.2 | does not double-install on re-inject | Inject content script twice; only one listener is active. |
| 3.3 | detect-site returns jira on jira fixture | Load Jira fixture; send `{ kind: 'detect-site' }`; response `data` is `"jira"`. |
| 3.4 | detect-site returns oracle on oracle fixture | Load Oracle fixture; send `{ kind: 'detect-site' }`; response `data` is `"oracle"`. |
| 3.5 | detect-site returns carma on carma fixture | Load Carma fixture; send `{ kind: 'detect-site' }`; response `data` is `"carma"`. |
| 3.6 | detect-site returns unsupported on blank | Load blank fixture; response `data` is `"unsupported"` or similar. |
| 3.7 | list-workflows returns jira workflows | Send `{ kind: 'list-workflows', site: 'jira' }`; response contains workflow objects with `id` and `label`. |
| 3.8 | list-workflows returns oracle workflows | Send `{ kind: 'list-workflows', site: 'oracle' }`; response contains oracle workflow entries. |
| 3.9 | list-workflows returns carma workflows | Send `{ kind: 'list-workflows', site: 'carma' }`; response contains carma workflow entries. |
| 3.10 | run-workflow returns result for known id | Send `{ kind: 'run-workflow', site: 'jira', workflowId: 'jira.jql.builder' }`; response `ok: true`. |
| 3.11 | run-workflow returns missing for unknown id | Send `{ kind: 'run-workflow', site: 'jira', workflowId: 'does.not.exist' }`; response includes `status: 'missing'`. |
| 3.12 | capture-jira-table returns table data | Load Jira filter-table fixture; send `{ kind: 'capture-jira-table' }`; response includes row data with derived fields. |
| 3.13 | capture-jira-table on non-jira page | Load blank fixture; send `{ kind: 'capture-jira-table' }`; response is error or empty. |
| 3.14 | unsupported command returns error | Send `{ kind: 'unknown-thing' }`; response `ok: false`, error contains "unsupported". |

### 4. `background.spec.ts` — Background / Service Worker Tests

| # | Test Name | Description |
|---|-----------|-------------|
| 4.1 | logs on install | Extension installs; console includes `[cv-ext] background installed`. |
| 4.2 | ignores non-matching messages | Send `{ kind: 'something-else' }`; no response, no error. |
| 4.3 | open-control-center resolves via sidePanel API | Mock `chrome.sidePanel.open`; send `{ kind: 'open-control-center', tabId: 1 }`; response `{ ok: true }`. |
| 4.4 | open-control-center falls back to sidebarAction | Remove `sidePanel`; mock `chrome.sidebarAction.open`; send message; response `{ ok: true }`. |
| 4.5 | open-control-center errors without APIs | Remove both APIs; send message; response `{ ok: false, error: 'side panel API unavailable' }`. |
| 4.6 | resolves context from message fields | Send with explicit `tabId` and `windowId`; those values are used (not queried from active tab). |
| 4.7 | resolves context from sender tab | Send without tabId but with sender.tab populated; sender context is used. |
| 4.8 | resolves context from active tab query | Send without tabId, sender has no tab; falls back to `queryActiveTab()`. |
| 4.9 | errors when no context available | Mock `queryActiveTab` returning undefined; response `{ ok: false, error: 'active tab not found' }`. |

### 5. `workflows/jira.spec.ts` — Jira Workflow E2E Tests

| # | Test Name | Description |
|---|-----------|-------------|
| 5.1 | jira.jql.builder routes correctly | Load Jira fixture; run workflow `jira.jql.builder`; result status is `"ready"`, detail mentions rust runtime. |
| 5.2 | jira.issue.capture.table extracts rows | Load Jira filter-table fixture; run `jira.issue.capture.table`; result contains extracted table data. |
| 5.3 | capture derives StockNumber from Summary | Filter-table row has stock number in Summary; captured data includes correct `StockNumber` field. |
| 5.4 | capture derives VIN from Summary | Summary contains a 17-char VIN; captured data includes correct `VIN` field. |
| 5.5 | capture derives PID from Summary | Summary contains a PID; captured data includes correct `PID` field. |
| 5.6 | capture builds Reference from identifiers | Captured row has `Reference` field in `HUB-{stock}-{vin}-{pid}` format. |
| 5.7 | capture builds Invoice from stock | Captured row has `Invoice` field ending in `-TR`. |
| 5.8 | capture handles missing identifiers | Row without identifiers has empty StockNumber/VIN/PID and fallback Reference/Invoice. |
| 5.9 | workflow list includes both jira workflows | `list_workflows("jira")` returns exactly `jira.jql.builder` and `jira.issue.capture.table`. |
| 5.10 | workflow labels are human-readable | Each workflow has a non-empty `label` starting with "Jira:". |

### 6. `workflows/oracle.spec.ts` — Oracle Workflow E2E Tests

| # | Test Name | Description |
|---|-----------|-------------|
| 6.1 | detect_site returns oracle on oracle fixture | Oracle invoice-header fixture URL triggers `"oracle"` detection. |
| 6.2 | list-workflows returns all oracle workflows | At least 11 oracle workflows returned (matching current registry). |
| 6.3 | public workflows are user-facing | Non-internal workflows: `oracle.search.invoice.expand`, `oracle.invoice.validation.alert`, `oracle.invoice.create`. |
| 6.4 | internal workflows are hidden from user lists | Internal workflows (`.perform`, `.ensure`, `.lov`, `.fill`, `.number`) have `internal: true`. |
| 6.5 | run oracle.search.invoice.expand routes | Run workflow; result status `"ready"`. |
| 6.6 | run oracle.invoice.validation.alert routes | Run workflow; result status `"ready"`. |
| 6.7 | run oracle.invoice.create routes | Run workflow; result status `"ready"`. |
| 6.8 | run unknown oracle workflow returns missing | Run `oracle.does.not.exist`; result status `"missing"`. |
| 6.9 | invoice-header fixture has ValidationStatus cell | Fixture DOM contains `td[headers="ValidationStatus"]` element. |
| 6.10 | invoice-create fixture has form fields | Fixture DOM contains Business Unit, Supplier, Invoice Number inputs. |

### 7. `workflows/carma.spec.ts` — Carma Workflow E2E Tests

| # | Test Name | Description |
|---|-----------|-------------|
| 7.1 | detect_site returns carma on carma fixture | Carma dashboard fixture triggers `"carma"` detection. |
| 7.2 | list-workflows returns carma workflows | Workflow list returns entries for carma (currently `carma.bulk.search.scrape`). |
| 7.3 | run carma workflow routes correctly | Run the carma workflow; result status `"ready"`. |
| 7.4 | run unknown carma workflow returns missing | Run non-existent id; result status `"missing"`. |

---

## Shared Test Utilities Needed

### `tests/e2e/helpers/extension.ts`
- Helper to load the extension in Chromium via `--load-extension` and
  `--disable-extensions-except` launch args.
- Helper to get the extension ID at runtime.
- Helper to open `chrome-extension://<id>/popup.html` and `sidepanel.html`.

### `tests/e2e/helpers/messaging.ts`
- Helper to send messages to the content script via `chrome.tabs.sendMessage`
  evaluated in the extension's background context.
- Helper to send messages to the background script via `chrome.runtime.sendMessage`.

### `tests/e2e/helpers/fixtures.ts`
- Helper to serve fixture HTML via Playwright's `webServer` or static route config.
- URL builder: `fixtureUrl('jira/filter-table.html')` → `http://localhost:<port>/fixtures/jira/filter-table.html`.

---

## Playwright Config Notes (`playwright.config.ts`)

```
- Browser: Chromium only (extension APIs require Chromium).
- Launch args: --load-extension=<path-to-dist/chrome-extension>,
               --disable-extensions-except=<same>,
               --no-sandbox (CI).
- Static server: serve tests/e2e/fixtures/ on a local port.
- Timeout: 30s per test (WASM init can be slow first load).
- Retries: 1 on CI, 0 locally.
- Reporter: html + list.
```

---

## Test Count Summary

| Spec File | Tests |
|-----------|-------|
| popup.spec.ts | 5 |
| sidepanel.spec.ts | 12 |
| content.spec.ts | 14 |
| background.spec.ts | 9 |
| workflows/jira.spec.ts | 10 |
| workflows/oracle.spec.ts | 10 |
| workflows/carma.spec.ts | 4 |
| **Total** | **64** |

---

## Implementation Priority

1. **Fixtures first** — Build all HTML fixtures so every spec has a surface to test against.
2. **Helpers** — `extension.ts`, `messaging.ts`, `fixtures.ts` shared utilities.
3. **content.spec.ts** — Core bridge; validates WASM loads and commands work.
4. **background.spec.ts** — Service worker message routing.
5. **popup.spec.ts** — Simple UI assertions.
6. **sidepanel.spec.ts** — Richest UI surface; depends on content script working.
7. **workflows/** — Per-site workflow verification; depends on content + fixtures.

