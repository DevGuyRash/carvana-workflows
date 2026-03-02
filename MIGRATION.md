# Rust WebExtension Big-Bang Migration

This repository is being migrated from userscripts to a unified Chrome + Firefox WebExtension architecture.

## Scope

- Replace userscript runtime with extension runtime.
- Move core automation logic into Rust + WebAssembly.
- Keep JS/TS limited to extension bootstrap and API wiring.
- Keep `excel/` assets intact and unchanged.

## Non-goals

- Keeping Tampermonkey/Violentmonkey compatibility.
- Maintaining a dual runtime fallback.

## Migration constraints

- Small, focused modules and small commits.
- Conventional Commits only.
- Sensitive-data scan before each commit.

## Acceptance checkpoints

- No userscript packages in active runtime build graph.
- Unified extension build outputs Chrome and Firefox artifacts.
- Rust crates own workflow contracts and runtime logic.
- `scripts/table_capture/jira-issue-capture.js` behavior represented by Rust extension workflow module.
- Playwright e2e harness is executable via `npm run test:e2e` with a committed `tests/e2e/playwright.config.ts` and baseline specs/fixtures described in `tests/e2e/TEST_PLAN.md`.
