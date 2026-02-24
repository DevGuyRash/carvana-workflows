# Carvana Workflows

Unified Chrome + Firefox WebExtension runtime powered by Rust + WebAssembly.

## Runtime Direction

- WebExtension only (no userscript runtime).
- Rust owns workflow contracts, site registries, and execution logic.
- TypeScript is minimal extension glue for browser APIs and bootstrap.

## Supported Sites

- Jira: `https://jira.carvana.com/*`
- Oracle FA: `https://*.fa.us2.oraclecloud.com/*`
- Carma: `https://carma.cvnacorp.com/*`

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

Package zipped artifacts:

```bash
npm run package:extensions
```

Zipped outputs:

- `dist/chrome-extension.zip`
- `dist/firefox-extension.zip`

## Check + Test

```bash
npm run typecheck
npm test
```

## Load Extension Locally

1. Chrome: open `chrome://extensions`, enable Developer Mode, click **Load unpacked**, select `dist/chrome-extension`.
2. Firefox: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, select `dist/firefox-extension/manifest.json`.

## Repository Notes

- `excel/` remains in-repo and is intentionally outside extension runtime scope.
- Legacy userscript/runtime packages were removed as part of the big-bang migration.
