# AGENTS.md — Carvana Extension (WebExtension + Rust)

This repository is extension-first and Rust-first.

## Runtime Scope

- Target browsers: Chrome + Firefox WebExtensions.
- Runtime model: centralized extension UX (popup + extension page + side panel) with content-script execution.
- Userscript/Tampermonkey/Violentmonkey runtime is deprecated and must not be reintroduced.
- Keep `excel/` assets in-repo; they are not part of extension runtime execution.

## Rust-First Principle

**Rust is the primary language of this project. All new logic must be written in Rust first.**

- If something can be expressed in Rust, it must be expressed in Rust. TypeScript is a last resort, not a default.
- TypeScript exists only to satisfy browser extension APIs that have no `wasm-bindgen` equivalent (`chrome.*`, `browser.*`, manifest bootstrap, and top-level script registration).
- UI component code (in `apps/webextension/src/ui/`) is the only exception — rendering and event wiring must happen in TypeScript, but any business logic those components display should originate from the WASM bridge.
- Never add TS logic that duplicates, reimplements, or shadows Rust logic. If you catch yourself writing TS business logic, that is a signal to move it into a Rust crate and expose it over the WASM bridge.
- The WASM binary is the unit of deployment for all logic. `cv_ext_wasm` (`crates/cv_ext_wasm`) is the only allowed boundary between Rust and TypeScript — all exports cross there.

### Crate responsibilities

- `cv_ext_contract` — shared types, traits, serialisation contracts, theme definitions, settings schema. No side-effects.
- `cv_ext_storage` — storage access abstractions.
- `cv_ext_core` — rule engine, orchestration, executor, site registry.
- `cv_ext_sites_*` — per-site adapters (jira, oracle, carma, …). Add new sites here.
- `cv_ext_wasm` — `wasm-bindgen` bridge only. Thin wrappers that call into the crates above; no logic lives here.

### WASM build chain

- Target: `wasm32-unknown-unknown` (pinned in `rust/rust-toolchain.toml`).
- Build tool: `wasm-pack` (invoked via `npm run build:wasm` → `scripts/build-wasm.mjs`).
- Output lands in `apps/webextension/pkg/` and is imported by TS as an ES module.
- Toolchain components `rustfmt` + `clippy` are required; run both before committing Rust changes.
- `cargo check` is part of `npm run typecheck`; Rust must compile cleanly before any TS typecheck is considered valid.

## Architecture

- Rust owns rule contracts, site registries, selectors, automation logic, and data extraction.
- TypeScript is minimal glue for extension APIs, UI rendering, and bootstrap only.
- Shared UI component library lives in `apps/webextension/src/ui/` — reused across popup, extension page, side panel.
- Design tokens (CSS custom properties) in `src/ui/tokens.css` are the single source of truth for theming.
- Avoid wrapper-heavy frameworks and avoid unnecessary shims.

## Terminology

- **Rule** (not workflow): the unit of automation. A rule defines "when conditions are met on a site, perform these actions."
- **Site adapter** (not workflow crate): per-site Rust crates that know how to interact with a target app's DOM.
- **Extension page**: the full-tab control center (`extension.html`) with tabbed navigation.
- **Popup**: minimal quick-launch hub for running rules and opening the control center.

## Module Boundaries

- Keep files short, focused, and composable.
- Prefer small Rust modules per concern (contracts, engine, site adapters, wasm bridge).
- Prefer small TS modules per concern (background, content, popup, sidepanel, extension-page, messaging bridge).
- UI components are self-contained vanilla TypeScript — no frameworks.
- Do not create monolithic files.

## Build and Validation

- Install deps: `npm install`
- Build wasm + extension: `npm run build`
- Auto rebuild during development: `npm run dev`
- Typecheck: `npm run typecheck`
- Test: `npm test`
- Package zip artifacts: `npm run package:extensions`

`npm run dev` auto rebuilds on source changes. Browser extension reload remains manual.

## Testing

### Rust Unit Tests

- Run with `npm test` (delegates to `cargo test`).
- When modifying any Rust crate, update or add unit tests in the corresponding `#[cfg(test)]` module.
- All new public functions must have at least one test covering the happy path and one covering an error/edge case.

### Playwright End-to-End Tests

- Location: `tests/e2e/` at the repository root.
- Config: `tests/e2e/playwright.config.ts`.
- Fixtures (mock site HTML): `tests/e2e/fixtures/`.
- Run with: `npx playwright test --config tests/e2e/playwright.config.ts`.
- When modifying **any** code in `apps/webextension/src/` or Rust crates that surface through the WASM bridge, you **must** update the relevant Playwright tests in `tests/e2e/` to cover the changed behavior.
- New user-facing features (popup interactions, sidepanel workflows, content-script behavior) require new Playwright test files.
- Tests are organised by surface: `popup.spec.ts`, `sidepanel.spec.ts`, `content.spec.ts`, `background.spec.ts`, and per-site workflow specs under `tests/e2e/workflows/`.
- Fixture HTML files in `tests/e2e/fixtures/` simulate target-site DOM (Jira, Oracle, Carma) for deterministic testing without live credentials.

## Git and Safety

- Before each commit, scan staged and unstaged changes for sensitive information:
  - `git diff -- .`
  - `git diff --cached -- .`
- Use conventional commits and small logical batches.
- Never commit directly to `main`.
- Never write or modify files using inline shell content injection methods (for example large `Set-Content`/heredoc style command payloads). Use safe, standard patch/edit tooling instead.

## GitOps Workflow

### Branching

- Start from `main` and create a descriptive branch:
  - `feat/<short-description>`
  - `fix/<short-description>`
  - `docs/<short-description>`
  - `refactor/<short-description>`
  - `test/<short-description>`

### Commit conventions

Use Conventional Commits:

```text
<type>(<scope>): <description>
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `style`, `deps`, `security`, `revert`, `hotfix`.

### PR hygiene

Before pushing updates to an existing PR:

- Read top-level comments.
- Read unresolved inline review threads.
- Check failing CI and logs.
- Reply in original threads for each addressed item.

### Merge policy

- Resolve all conversations.
- Ensure CI is green.
- Ensure at least one approval (unless explicitly waived).
- Use squash merge by default.
