# Carvana Workflows Extension

Unified Chrome + Firefox WebExtension with Rust + WebAssembly runtime.

## Build

```bash
npm run build
```

Artifacts:

- `dist/chrome-extension`
- `dist/firefox-extension`

## Notes

- Rust runtime is built via `wasm-pack`.
- Keep TS limited to extension API glue and page bootstraps.

## Package

```bash
npm run package:extensions
```

Artifacts:

- `dist/chrome-extension.zip`
- `dist/firefox-extension.zip`
