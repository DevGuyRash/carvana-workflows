# Carvana Workflows Extension

Unified Chrome + Firefox WebExtension with Rust + WebAssembly runtime.

## Build

```bash
npm run build
```

Artifacts:

- `dist/chrome-extension`
- `dist/firefox-extension`

## Dev Auto Rebuild

```bash
npm run dev
```

- Rebuilds automatically when Rust or extension source files change.
- Browser extension reload remains manual after each rebuild.

## Package

```bash
npm run package:extensions
```

Artifacts:

- `dist/chrome-extension.zip`
- `dist/firefox-extension.zip`

## Notes

- Rust runtime is built via `wasm-pack`.
- Keep TS limited to extension API glue and page bootstraps.
