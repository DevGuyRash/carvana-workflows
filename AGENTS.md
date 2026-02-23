# AGENTS.md — Carvana Workflows (WebExtension + Rust)

This repository is extension-first and Rust-first.

## Runtime Scope

- Target browsers: Chrome + Firefox WebExtensions.
- Runtime model: centralized extension UX (popup + side panel) with content-script execution.
- Userscript/Tampermonkey/Violentmonkey runtime is deprecated and must not be reintroduced.
- Keep `excel/` assets in-repo; they are not part of extension runtime execution.

## Architecture

- Rust owns workflow contracts, site registries, selectors, automation logic, and data extraction.
- WebAssembly build tooling uses `wasm-pack`.
- TypeScript is minimal glue for extension APIs and bootstrap only.
- Avoid wrapper-heavy frameworks and avoid unnecessary shims.

## Module Boundaries

- Keep files short, focused, and composable.
- Prefer small Rust modules per concern (contracts, engine, site workflows, wasm bridge).
- Prefer small TS modules per concern (background, content, popup, sidepanel, messaging bridge).
- Do not create monolithic files.

## Build and Validation

- Install deps: `npm install`
- Build wasm + extension: `npm run build`
- Typecheck: `npm run typecheck`
- Test: `npm test`

## Git and Safety

- Do not use `apply_patch` in this repository.
- Before each commit, scan staged and unstaged changes for sensitive information:
  - `git diff -- .`
  - `git diff --cached -- .`
- Use conventional commits and small logical batches.
- Never commit directly to `main`.

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
