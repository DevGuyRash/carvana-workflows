# Carvana Extension

Enterprise-grade Chrome + Firefox WebExtension for automating Carvana internal web applications, powered by Rust + WebAssembly.

## What It Does

- **Site Rules**: Declarative automations — "when on site X, apply behavior Y"
- **Dedicated Extension Page**: Full-tab control center with Dashboard, Rules, Data, Settings, and Logs tabs
- **Shared UI Components**: Reusable tables, modals, toasts, cards used across all surfaces
- **Theme System**: Multiple built-in themes (Midnight, Obsidian, Daylight, Carvana Blue)
- **Data Capture**: Extract and export table data from Jira, Oracle, Carma

## Supported Sites

- Jira: `https://jira.carvana.com/*`
- Oracle FA: `https://*.fa.us2.oraclecloud.com/*`
- Carma: `https://carma.cvnacorp.com/*`

## Architecture

- **Rust/WASM** owns all business logic, rule evaluation, data extraction, and DOM manipulation
- **TypeScript** is minimal glue for browser APIs, UI rendering, and bootstrap
- **Shared component library** (`src/ui/`) provides design tokens + vanilla TS components
- **Rule engine** replaces the old workflow model — scalable, toggleable, categorized

## Prerequisites

- Node.js 20+
- Rust stable toolchain
- `wasm-pack` (`cargo install wasm-pack`)

## Build

```bash
npm install
npm run build
```

Outputs:
- `dist/chrome-extension`
- `dist/firefox-extension`

## Dev Auto Rebuild

```bash
npm run dev
```

Watches Rust and extension source files. Browser extension reload remains manual.

## Check + Test

```bash
npm run typecheck
npm test
```

## Package

```bash
npm run package:extensions
```

## Load Extension Locally

1. **Chrome**: `chrome://extensions` → Enable Developer Mode → Load unpacked → select `dist/chrome-extension`
2. **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `dist/firefox-extension/manifest.json`

## Repository Notes

- `excel/` remains in-repo and is intentionally outside extension runtime scope.
- Legacy userscript/runtime packages were removed as part of the extension migration.
- See `MASTER_PLAN.md` for the full architectural design document.
