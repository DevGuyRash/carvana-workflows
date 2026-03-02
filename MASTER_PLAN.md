# Carvana Extension — Enterprise Redesign Master Plan

> Branch: `feat/enterprise-extension-redesign`
> Date: 2025
> Status: **Active — Implementation In-Progress**

---

## 1. Vision & Guiding Principles

### 1.1 What We're Building

A **production-grade Chrome + Firefox browser extension** that serves as a unified
automation and productivity platform for internal Carvana web applications (Jira,
Oracle Cloud, Carma, and future sites). The extension replaces the legacy
Tampermonkey-era "workflow" mental model with a modern, scalable architecture:

- **Site Rules** instead of workflows — declarative "when on site X, apply behavior Y"
- **Shared component library** — reusable UI primitives (tables, modals, toasts, forms)
  used across every surface (popup, extension page, side panel, content overlays)
- **Dedicated extension page** with tabbed navigation — settings, logs, site rules,
  data viewer, and theme management all live here
- **Lightweight popup** — a quick-launch hub, not a feature-crammed panel
- **Enterprise-grade UX** — non-technical users can configure rules, view logs,
  switch themes, and manage data without touching code

### 1.2 Core Principles

| # | Principle | Meaning |
|---|-----------|--------|
| 1 | **Rust-first** | All business logic, rule evaluation, data extraction, and DOM manipulation live in Rust/WASM. TypeScript is glue only. |
| 2 | **Shared everything** | Every UI component, style token, and utility exists once and is imported everywhere. No per-feature duplication. |
| 3 | **Non-technical friendly** | A user who has never seen code can add site rules, change themes, view logs, and export data through polished GUIs. |
| 4 | **Scalable by design** | Adding a new site or automation = adding a Rust crate + a rule definition. Zero UI scaffolding needed. |
| 5 | **Convention over configuration** | Consistent naming, file layout, and patterns across every crate and module. |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension Shell                   │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌──────────┐ │
│  │  Popup    │  │ Ext. Page  │  │ Side Panel│  │ Content  │ │
│  │ (hub)     │  │ (tabs UI)  │  │ (quick    │  │ Scripts  │ │
│  │           │  │            │  │  actions) │  │ (per-site│ │
│  └─────┬────┘  └─────┬──────┘  └─────┬─────┘  │  rules)  │ │
│        │             │               │         └────┬─────┘ │
│        └──────┬──────┴───────┬───────┘              │       │
│               │              │                      │       │
│        ┌──────▼──────────────▼──────────────────────▼─────┐ │
│        │         Shared UI Component Library              │ │
│        │   (design tokens, table, modal, toast, forms)    │ │
│        └──────────────────────┬───────────────────────────┘ │
│                               │                             │
│        ┌──────────────────────▼───────────────────────────┐ │
│        │              Message Bus (chrome.runtime)        │ │
│        └──────────────────────┬───────────────────────────┘ │
│                               │                             │
│        ┌──────────────────────▼───────────────────────────┐ │
│        │           Background Service Worker              │ │
│        │  ┌────────────────────────────────────────────┐  │ │
│        │  │           WASM Runtime (Rust)              │  │ │
│        │  │  ┌──────────┐ ┌──────────┐ ┌───────────┐  │  │ │
│        │  │  │ Rule     │ │ Site     │ │ Storage   │  │  │ │
│        │  │  │ Engine   │ │ Adapters │ │ Manager   │  │  │ │
│        │  │  └──────────┘ └──────────┘ └───────────┘  │  │ │
│        │  └────────────────────────────────────────────┘  │ │
│        └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure (Target State)

```
carvana-workflows/
├── apps/
│   └── webextension/
│       ├── manifest.base.json          # Shared manifest template
│       ├── popup.html                  # Minimal popup shell
│       ├── extension.html              # Full-page tabbed UI
│       ├── sidepanel.html              # Side panel shell
│       ├── assets/
│       │   └── icons/                  # Extension icons
│       ├── src/
│       │   ├── background.ts           # Service worker bootstrap
│       │   ├── content.ts              # Content script bootstrap
│       │   ├── popup.ts                # Popup entry point
│       │   ├── extension-page.ts       # Extension page entry point
│       │   ├── sidepanel.ts            # Side panel entry point
│       │   ├── shared/
│       │   │   ├── messages.ts          # Message bus types & helpers
│       │   │   ├── runtime.ts           # WASM loader
│       │   │   ├── webext-async.ts      # Chrome/Firefox API compat
│       │   │   ├── storage-bridge.ts    # TS <> WASM storage bridge
│       │   │   └── theme.ts            # Theme application logic
│       │   └── ui/
│       │       ├── tokens.css           # Design tokens (CSS vars)
│       │       ├── base.css             # Reset + typography
│       │       ├── components/
│       │       │   ├── data-table.ts    # Reusable sortable/filterable table
│       │       │   ├── modal.ts         # Modal / popout system
│       │       │   ├── toast.ts         # Toast notification system
│       │       │   ├── tabs.ts          # Tab navigation component
│       │       │   ├── toggle.ts        # Toggle switch
│       │       │   ├── card.ts          # Card container
│       │       │   ├── badge.ts         # Status badge
│       │       │   ├── search-input.ts  # Search/filter input
│       │       │   └── form-field.ts    # Label+input+error field
│       │       └── layouts/
│       │           ├── page-shell.ts    # Extension page layout
│       │           └── panel-shell.ts   # Side panel layout
│       ├── pkg/                         # WASM build output
│       └── tsconfig.json
├── rust/
│   ├── Cargo.toml                      # Workspace root
│   ├── rust-toolchain.toml
│   └── crates/
│       ├── cv_ext_contract/             # Shared types & traits
│       │   └── src/
│       │       ├── lib.rs
│       │       ├── site.rs              # Site enum + URL matching
│       │       ├── rule.rs              # Rule definition types (NEW)
│       │       ├── action.rs            # Action enum
│       │       ├── result.rs            # Execution result types
│       │       ├── command.rs           # Command envelope
│       │       ├── settings.rs          # Settings schema (NEW)
│       │       └── theme.rs             # Theme definition (NEW)
│       ├── cv_ext_storage/              # Storage abstractions
│       │   └── src/
│       │       ├── lib.rs
│       │       └── keys.rs
│       ├── cv_ext_core/                 # Rule engine + orchestration
│       │   └── src/
│       │       ├── lib.rs
│       │       ├── rule_engine.rs        # Rule matching & evaluation (NEW)
│       │       ├── executor.rs          # Action executor trait
│       │       └── registry.rs          # Site adapter registry
│       ├── cv_ext_sites_jira/           # Jira site adapter (RENAMED)
│       ├── cv_ext_sites_oracle/         # Oracle site adapter (RENAMED)
│       ├── cv_ext_sites_carma/          # Carma site adapter (RENAMED)
│       └── cv_ext_wasm/                 # WASM bridge (thin)
│           └── src/
│               ├── lib.rs
│               ├── bridge_rules.rs      # Rule CRUD bridge (NEW)
│               ├── bridge_settings.rs   # Settings bridge (NEW)
│               ├── bridge_theme.rs      # Theme bridge (NEW)
│               ├── commands.rs          # Legacy command dispatch
│               ├── dom.rs
│               └── errors.rs
├── scripts/
│   ├── build-wasm.mjs
│   ├── build-extension.mjs
│   ├── dev-extension.mjs
│   └── package-extensions.mjs
├── tests/
│   └── e2e/
├── excel/                               # Unchanged - not in extension scope
├── package.json
├── tsconfig.base.json
└── AGENTS.md
```

---

## 4. Rust Crate Redesign (Detailed)

### 4.1 Rename: cv_ext_workflows_* -> cv_ext_sites_*

The "workflow" naming implies sequential scripts. The new "sites" naming reflects
what they actually are: **site-specific adapters** that know how to interact with
a particular web application's DOM, data, and behavior.

| Old Crate | New Crate | Purpose |
|-----------|-----------|--------|
| `cv_ext_workflows_jira` | `cv_ext_sites_jira` | Jira DOM selectors, data capture, JQL builder |
| `cv_ext_workflows_oracle` | `cv_ext_sites_oracle` | Oracle invoice forms, LOV handling, validation |
| `cv_ext_workflows_carma` | `cv_ext_sites_carma` | Carma table scraping, bulk search, popout data |

### 4.2 New Contract Types

#### cv_ext_contract::rule

```rust
/// A rule defines: "When conditions are met on a site, perform these actions."
pub struct RuleDefinition {
    pub id: String,
    pub label: String,
    pub description: String,
    pub site: Site,
    pub enabled: bool,
    pub url_pattern: Option<String>,      // Optional URL regex filter
    pub trigger: RuleTrigger,             // When to fire
    pub actions: Vec<Action>,             // What to do
    pub priority: u16,                    // Execution order
    pub category: RuleCategory,           // For UI grouping
    pub builtin: bool,                    // true = shipped with extension
}

pub enum RuleTrigger {
    OnPageLoad,                           // Fire on document_idle
    OnDemand,                             // User clicks "Run" in UI
    OnUrlMatch,                           // Fire when URL matches pattern
    OnElementAppear { selector: String }, // Fire when element appears
}

pub enum RuleCategory {
    DataCapture,       // Extract data from pages
    FormAutomation,    // Fill forms, click buttons
    UiEnhancement,     // Inject custom UI elements
    Navigation,        // URL manipulation, redirects
    Validation,        // Check page state, alert on issues
}
```

#### cv_ext_contract::settings

```rust
pub struct ExtensionSettings {
    pub theme: String,
    pub log_level: LogLevel,
    pub log_retention_days: u16,
    pub notifications_enabled: bool,
    pub auto_run_rules: bool,
    pub sites: HashMap<String, SiteSettings>,
}

pub struct SiteSettings {
    pub enabled: bool,
    pub default_rules: Vec<String>,
}
```

#### cv_ext_contract::theme

```rust
pub struct ThemeDefinition {
    pub id: String,
    pub label: String,
    pub tokens: ThemeTokens,
}

pub struct ThemeTokens {
    pub bg_primary: String,
    pub bg_secondary: String,
    pub bg_surface: String,
    pub text_primary: String,
    pub text_secondary: String,
    pub text_muted: String,
    pub accent: String,
    pub accent_hover: String,
    pub border: String,
    pub border_active: String,
    pub success: String,
    pub warning: String,
    pub error: String,
    pub info: String,
    pub radius_sm: String,
    pub radius_md: String,
    pub radius_lg: String,
    pub font_family: String,
    pub font_mono: String,
}
```

### 4.3 Rule Engine (cv_ext_core::rule_engine)

The rule engine replaces the old RuntimeEngine + WorkflowDefinition model.

```rust
pub struct RuleEngine {
    rules: Vec<RuleDefinition>,
}

impl RuleEngine {
    /// Load rules: built-in (from site crates) + user-defined (from storage)
    pub fn load(builtin: Vec<RuleDefinition>, user: Vec<RuleDefinition>) -> Self;

    /// Get all rules for a site, sorted by priority
    pub fn rules_for_site(&self, site: Site) -> Vec<&RuleDefinition>;

    /// Get rules that should auto-fire for current URL
    pub fn auto_rules(&self, site: Site, url: &str) -> Vec<&RuleDefinition>;

    /// Get on-demand rules (shown in UI for user to trigger)
    pub fn on_demand_rules(&self, site: Site) -> Vec<&RuleDefinition>;

    /// Execute a specific rule
    pub fn execute<E: ActionExecutor>(
        &self, rule_id: &str, executor: &mut E
    ) -> RunResult;

    /// CRUD for user-defined rules (persisted to storage)
    pub fn add_rule(&mut self, rule: RuleDefinition);
    pub fn update_rule(&mut self, rule: RuleDefinition);
    pub fn remove_rule(&mut self, rule_id: &str);
    pub fn toggle_rule(&mut self, rule_id: &str, enabled: bool);
}
```

### 4.4 WASM Bridge Extensions

New `#[wasm_bindgen]` exports for the extension page and popup to call:

```rust
// bridge_rules.rs
pub fn list_rules(site: String) -> JsValue;
pub fn get_rule(rule_id: String) -> JsValue;
pub fn toggle_rule(rule_id: String, enabled: bool);
pub fn run_rule(rule_id: String, context: Option<String>) -> JsValue;
pub fn auto_rules_for_url(url: String) -> JsValue;

// bridge_settings.rs
pub fn get_settings() -> JsValue;
pub fn update_settings(json: String);
pub fn get_theme() -> JsValue;
pub fn list_themes() -> JsValue;
pub fn apply_theme(theme_id: String) -> JsValue;

// bridge_theme.rs
pub fn builtin_themes() -> JsValue;
pub fn theme_css_vars(theme_id: String) -> JsValue;
```

---

## 5. Shared UI Component Library (Detailed)

### 5.1 Design Tokens (ui/tokens.css)

All colors, spacing, typography, borders, and shadows are CSS custom properties.
Theme switching works by swapping the values of these vars.

```css
:root {
  --cv-bg-primary: #0f172a;
  --cv-bg-secondary: #1e293b;
  --cv-bg-surface: #334155;
  --cv-text-primary: #f1f5f9;
  --cv-text-secondary: #cbd5e1;
  --cv-text-muted: #94a3b8;
  --cv-accent: #3b82f6;
  --cv-accent-hover: #2563eb;
  --cv-border: #475569;
  --cv-border-active: #3b82f6;
  --cv-success: #22c55e;
  --cv-warning: #f59e0b;
  --cv-error: #ef4444;
  --cv-info: #06b6d4;
  --cv-radius-sm: 4px;
  --cv-radius-md: 8px;
  --cv-radius-lg: 12px;
  --cv-font: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --cv-font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --cv-shadow-sm: 0 1px 2px rgba(0,0,0,.3);
  --cv-shadow-md: 0 4px 6px rgba(0,0,0,.3);
  --cv-shadow-lg: 0 10px 25px rgba(0,0,0,.4);
  --cv-transition: 150ms ease;
}
```

### 5.2 Component Inventory

Each component is a vanilla TypeScript class that creates DOM elements and
applies token-based styles. No framework dependencies. Components:

| Component | File | Description |
|-----------|------|------------|
| **DataTable** | `data-table.ts` | Sortable, filterable, paginated table. Column resize, row selection, CSV/JSON export. Popout capable. |
| **Modal** | `modal.ts` | Overlay dialog with header, body, footer slots. Supports stacking. |
| **Toast** | `toast.ts` | Non-blocking notification with auto-dismiss. Success/warning/error/info variants. |
| **Tabs** | `tabs.ts` | Horizontal tab bar with content panels. Keyboard navigation. Lazy-loads. |
| **Toggle** | `toggle.ts` | Styled on/off switch with label. |
| **Card** | `card.ts` | Container with optional header, body, actions. |
| **Badge** | `badge.ts` | Small status indicator. success/warning/error/info/neutral. |
| **SearchInput** | `search-input.ts` | Input with search icon, clear button, debounced events. |
| **FormField** | `form-field.ts` | Label + input + error. Types: text, select, textarea, number. |

### 5.3 Popout System

Any DataTable (or other component) can "pop out" into its own browser window.
This makes the Carma popout table, Jira capture results, log viewer, etc. all
use the same mechanism. Zero per-feature popout code.

---

## 6. Extension Page Design (Detailed)

### 6.1 Overview

`extension.html` is a full browser tab (opened via `chrome-extension://<id>/extension.html`)
that serves as the **main control center**. It replaces the cramped side panel as the
primary management interface.

### 6.2 Tab Structure

```
+------------------------------------------------------------------+
|  Dashboard  |  Rules  |  Data  |  Settings  |  Logs              |
+------------------------------------------------------------------+
|                                                                    |
|  [Active tab content rendered here]                                |
|                                                                    |
+------------------------------------------------------------------+
```

#### Tab: Dashboard
- Site status cards (connected/disconnected for each site)
- Quick-run buttons for favorite rules
- Recent activity feed (last 10 rule executions)
- Extension version and update status

#### Tab: Rules
- Searchable, filterable list of all rules (built-in + user-defined)
- Group by site or by category
- Each rule shows: name, site badge, category badge, enabled toggle, "Run" button
- Click a rule -> modal with full details, edit form (for user rules)
- "+ Add Rule" button -> modal with form to create custom rules
- Built-in rules show a lock icon and cannot be deleted (only toggled)

#### Tab: Data
- DataTable showing most recent captured data
- Dropdown to select data source (Jira captures, Carma scrapes, Oracle exports)
- Export buttons: CSV, JSON, copy to clipboard
- "Pop Out" button to open in a new window
- Column visibility toggles

#### Tab: Settings
- **General**: auto-run rules toggle, notification preferences, log level
- **Sites**: per-site enable/disable, default rules, custom URL patterns
- **Theme**: theme selector with live preview, built-in themes:
  - Midnight (dark blue - current)
  - Obsidian (true dark)
  - Daylight (light)
  - Carvana Blue (branded)
- **Storage**: view storage usage, clear data, import/export config

#### Tab: Logs
- DataTable of all extension activity
- Columns: timestamp, level, source, message, details
- Filter by level (debug/info/warn/error)
- Filter by site
- Auto-refresh toggle
- Export and pop-out support

---

## 7. Popup Redesign

The popup becomes a **minimal quick-launch hub** - not a feature surface.

```
+---------------------------+
|  Carvana Extension   v0.2 |
|--------------------------- |
|  Site: Oracle              |
|  3 rules active            |
|                            |
|  [Run Active Rules]        |
|  [Open Control Center]     |
|  [Quick Actions]           |
|                            |
|  Last: Invoice created OK  |
+---------------------------+
```

- Shows detected site + active rule count
- One-click "Run Active Rules" for auto-rules
- "Open Control Center" opens extension.html in a new tab
- "Quick Actions" dropdown shows on-demand rules for current site
- Last activity indicator

---

## 8. Side Panel

The side panel becomes a **contextual quick-action surface**:

- Shows rules available for current site
- One-click run for each rule
- Compact data preview (last capture)
- Link to full extension page
- Shares all components from the shared library

---

## 9. Content Script Redesign

### 9.1 New Flow

```
Page Load -> content.ts -> WASM detect_site(url)
                        -> WASM auto_rules_for_url(url)
                        -> Execute matching rules
                        -> Report results to background
```

### 9.2 Key Changes

- No more hardcoded JQL logic in content.ts - all site-specific logic is in Rust
- Content script is a thin bridge: detect site -> ask WASM for rules -> execute -> report
- Injected UI overlays use shared components
- All message passing uses typed RuntimeCommand / RuntimeResponse envelope

---

## 10. Theme System

### 10.1 How It Works

1. Theme definitions live in Rust (cv_ext_contract::theme)
2. Built-in themes are compiled into the WASM binary
3. bridge_theme.rs exports functions to list themes and get CSS variable maps
4. TypeScript theme.ts calls WASM, receives a map of CSS variable -> value
5. Theme is applied by setting CSS custom properties on document.documentElement
6. Selected theme ID is persisted to chrome.storage.local
7. On extension load, theme is applied before first paint (flash prevention)

### 10.2 Built-in Themes

| Theme | Background | Accent | Notes |
|-------|-----------|--------|-------|
| Midnight | #0f172a | #3b82f6 | Default. Current dark style. |
| Obsidian | #09090b | #a78bfa | True black for OLED. Purple accent. |
| Daylight | #ffffff | #2563eb | Clean light theme. |
| Carvana Blue | #0c1929 | #00b4d8 | Brand-aligned deep blue. |

---

## 11. Logging System

### 11.1 Architecture

- Rust cv_ext_core produces structured log entries
- Logs are serialized and sent to TypeScript via WASM bridge
- TypeScript stores logs in chrome.storage.local with configurable retention
- Extension page Logs tab shows a DataTable of all logs
- Log level filtering is configurable in settings

### 11.2 Log Entry Schema

```rust
pub struct LogEntry {
    pub timestamp_ms: u64,
    pub level: LogLevel,      // Debug, Info, Warn, Error
    pub source: String,       // e.g., "rule:oracle.invoice.create"
    pub message: String,
    pub data: Option<Value>,  // Arbitrary JSON payload
}
```

---

## 12. Storage Architecture

### 12.1 Storage Keys

| Key | Type | Description |
|-----|------|------------|
| `cv_settings` | `ExtensionSettings` | Global settings object |
| `cv_theme` | `string` | Active theme ID |
| `cv_rules_user` | `RuleDefinition[]` | User-defined custom rules |
| `cv_rules_state` | `Record<string, boolean>` | Per-rule enabled/disabled overrides |
| `cv_logs` | `LogEntry[]` | Rolling log buffer |
| `cv_data_<site>_<type>` | `any[]` | Captured data per site |
| `cv_last_activity` | `object` | Last rule execution summary |

### 12.2 Storage Bridge

TypeScript storage-bridge.ts provides typed wrappers around chrome.storage.local:

```typescript
export async function loadSettings(): Promise<ExtensionSettings>;
export async function saveSettings(s: ExtensionSettings): Promise<void>;
export async function loadRules(): Promise<RuleDefinition[]>;
export async function saveRules(rules: RuleDefinition[]): Promise<void>;
export async function appendLog(entry: LogEntry): Promise<void>;
export async function loadLogs(filter?: LogFilter): Promise<LogEntry[]>;
export async function clearLogs(): Promise<void>;
```

---

## 13. Message Bus

### 13.1 Message Types

```typescript
interface ExtMessage {
  kind: string;
  payload?: unknown;
  tabId?: number;
  requestId?: string;
}

interface ExtResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
  requestId?: string;
}
```

### 13.2 Message Kinds

| Kind | From -> To | Description |
|------|-----------|------------|
| `detect-site` | content -> background | Detect site for current URL |
| `run-rule` | popup/panel/page -> background -> content | Execute a rule |
| `run-auto-rules` | content -> background | Request auto-rules for URL |
| `get-rules` | popup/panel/page -> background | List rules for site |
| `toggle-rule` | page -> background | Enable/disable a rule |
| `get-settings` | page -> background | Load settings |
| `save-settings` | page -> background | Save settings |
| `theme-changed` | background -> all | Broadcast theme change |
| `log-entry` | background -> page | New log entry |
| `data-captured` | content -> background | Data extraction complete |
| `open-extension-page` | popup -> background | Open extension.html tab |

---

## 14. Implementation Phases

### Phase 1: Foundation (This PR)

1. **Create branch** feat/enterprise-extension-redesign
2. **Rename workflow crates** -> site crates
3. **Add new contract types**: rule.rs, settings.rs, theme.rs
4. **Implement rule engine** in cv_ext_core
5. **Create shared UI library**: tokens, base CSS, all components
6. **Build extension.html** with tabbed layout and all tabs
7. **Redesign popup.html** as quick-launch hub
8. **Update sidepanel.html** to use shared components
9. **Rewire content.ts** to use rule engine
10. **Update background.ts** for new message bus
11. **Add WASM bridge functions** for rules, settings, themes
12. **Update build scripts** to include extension.html
13. **Update manifests** for new extension page + permissions
14. **Validate**: npm run build compiles cleanly

### Phase 2: Polish (Follow-up)

- Playwright E2E tests for new UI surfaces
- Performance optimization for large data tables
- Keyboard shortcuts
- Import/export configuration
- User-defined custom rules UI

---

## 15. Migration: What Changes vs. What Stays

### Removed / Replaced

| Old | New |
|-----|-----|
| WorkflowDefinition struct | RuleDefinition struct |
| cv_ext_workflows_* crate names | cv_ext_sites_* crate names |
| RuntimeEngine.run_workflow() | RuleEngine.execute() |
| workflows_for_site() | rules_for_site() |
| list_workflows() WASM export | list_rules() WASM export |
| run_workflow() WASM export | run_rule() WASM export |
| Inline CSS in HTML files | Shared tokens.css + base.css |
| Per-page UI duplication | Shared component library |
| Side panel as primary UI | Extension page as primary UI |
| "Workflow" terminology | "Rule" terminology |

### Preserved

| What | Why |
|------|-----|
| All Rust DOM manipulation logic | Core value - just re-wrapped as rule actions |
| Jira capture + derived fields | Business logic unchanged |
| Oracle invoice form filling | Business logic unchanged |
| Carma table scraping | Business logic unchanged |
| Action enum | Still the unit of execution |
| ActionExecutor trait | Still the abstraction for DOM ops |
| Build toolchain (wasm-pack + esbuild) | Works great, no reason to change |
| Chrome + Firefox dual-manifest system | Still needed |
| excel/ directory | Out of extension scope |

---

## 16. Naming Conventions

| Context | Convention | Example |
|---------|-----------|--------|
| Rust crate names | `cv_ext_<scope>` | `cv_ext_sites_jira` |
| Rust modules | `snake_case` | `rule_engine.rs` |
| Rust types | `PascalCase` | `RuleDefinition` |
| TS files | `kebab-case` | `data-table.ts` |
| CSS variables | `--cv-<category>-<name>` | `--cv-bg-primary` |
| Storage keys | `cv_<scope>` | `cv_settings` |
| Message kinds | `kebab-case` | `run-rule` |
| HTML IDs | `cv-<name>` | `cv-tab-rules` |

---

## 17. Success Criteria

- [ ] `npm run build` produces working Chrome and Firefox extensions
- [ ] Extension page opens with all 5 tabs functional
- [ ] Popup detects site and shows relevant rules
- [ ] Rules can be toggled on/off from the extension page
- [ ] Theme switching works with live preview
- [ ] DataTable component works for Jira data, logs, and Carma scrape results
- [ ] All existing Rust business logic (Jira, Oracle, Carma) works through rules
- [ ] No regression: everything the old extension could do, the new one can do
- [ ] `cargo test` passes
- [ ] `npm run typecheck` passes
