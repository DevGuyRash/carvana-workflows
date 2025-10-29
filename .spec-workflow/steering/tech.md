# Technology Stack

## Project Type
Composable TypeScript monorepo that builds Tampermonkey userscripts for Jira and Oracle operational workflows.

## Core Technologies

### Primary Language(s)
- **Language**: TypeScript 5.x targeting modern browsers.
- **Runtime/Compiler**: Node 18+ executing esbuild bundling pipeline.
- **Language-specific tools**: npm workspaces, TypeScript compiler for types, Vitest for isolated step validation.

### Key Dependencies/Libraries
- **@cv/core**: Shared workflow engine, selector abstractions, and menu scaffolding.
- **esbuild 0.25**: Bundles userscripts with fast incremental builds.
- **Vitest 2.1**: Executes unit tests for selectors, helpers, and utility logic under jsdom.
- **cross-env / rimraf**: Build scripting utilities for cross-platform workflows.

### Application Architecture
Monorepo with shared core package and domain-specific userscript packages. Each userscript registers pages and workflows consumed by the runtime menu. Declarative JSON-like workflow definitions drive the engine, while selectors and helper utilities live alongside workflows.

### Data Storage
- **Primary storage**: Browser-local Greasemonkey/Tampermonkey storage (GM_* APIs) for workflow settings, auto-run toggles, and persistence.
- **Caching**: In-memory caches within the userscript runtime for selectors and last-run status.
- **Data formats**: JSON-serializable payloads, clipboard text, and minimal HTML fragments.

### External Integrations
- **APIs**: Jira web UI and Oracle Cloud Financials DOM surfaces; no direct REST integration.
- **Protocols**: DOM interaction via standard browser APIs; MutationObserver for change detection.
- **Authentication**: Inherits browser session auth; no credentials stored in code.

### Monitoring & Dashboard Technologies
- **Dashboard Framework**: Shadow DOM menu rendered via vanilla TypeScript and templated HTML.
- **Real-time Communication**: MutationObserver + polling for workflow status updates.
- **Visualization Libraries**: Native DOM APIs; no third-party chart libs.
- **State Management**: Internal store module using GM_* persistence keyed by workflow ID.

## Development Environment

### Build & Development Tools
- **Build System**: Custom Node script (`scripts/build.mjs`) invoking esbuild for each package.
- **Package Management**: npm workspaces for shared dependency management.
- **Development workflow**: `npm run build:dev` for local served bundles, `npm run serve:userscripts` for Tampermonkey auto-update testing.

### Code Quality Tools
- **Static Analysis**: `tsc --noEmit` via `npm run lint`/`typecheck`.
- **Formatting**: Project follows TypeScript style with editorconfig; no auto-formatter enforced.
- **Testing Framework**: Vitest with jsdom environment to verify selectors and workflow utilities.
- **Documentation**: Specs and steering documents under `.spec-workflow/`; AGENTS.md for authoring guidance.

### Version Control & Collaboration
- **VCS**: Git with trunk-based development on `main` plus feature branches.
- **Branching Strategy**: Conventional commits aligned with spec workflow gates.
- **Code Review Process**: Pull requests referencing approved specs and ADRs; approvals tracked via `.spec-workflow/approvals`.

### Dashboard Development
- **Live Reload**: Manual rebuild via `npm run build:dev`; served bundles auto-refresh in Tampermonkey.
- **Port Management**: Local server uses default `4873`; configurable through env.
- **Multi-Instance Support**: Separate userscript bundles (`jira.user.js`, `oracle.user.js`) share core runtime.

## Deployment & Distribution
- **Target Platform(s)**: Chrome/Edge browsers running Tampermonkey in Carvana managed environments.
- **Distribution Method**: Built scripts in `dist/` installed manually or via local update server.
- **Installation Requirements**: Tampermonkey extension, Carvana SSO access to Jira/Oracle.
- **Update Mechanism**: Tampermonkey auto-update via `build:dev` server or manual reinstall from `dist/`.

## Technical Requirements & Constraints

### Performance Requirements
- Initial menu render within 500ms post page detection.
- Workflow step execution latency < 250ms per DOM action when selectors resolve.

### Compatibility Requirements
- **Platform Support**: Chromium-based browsers (Chrome, Edge) on Windows/macOS.
- **Dependency Versions**: TypeScript >= 5.6; esbuild >= 0.25; Vitest >= 2.1.
- **Standards Compliance**: DOM Level 4 selectors; Tampermonkey API compatibility.

### Security & Compliance
- **Security Requirements**: No hard-coded credentials; limit clipboard operations to explicit user consent; log sensitive values redacted.
- **Compliance Standards**: Align with Carvana privacy expectations; avoid storing PII beyond necessary runtime context.
- **Threat Model**: Protect against DOM injection collisions and runaway automation; leverage visibility checks to avoid unintended clicks.

### Scalability & Reliability
- **Expected Load**: Tens of concurrent workflows per analyst per session.
- **Availability Requirements**: Userscript must gracefully degrade when DOM changes; fallback to manual process with informative errors.
- **Growth Projections**: Additional Oracle and Jira surfaces; eventual expansion to other internal tools.

## Technical Decisions & Rationale
1. **TypeScript Monorepo**: Ensures shared types and utilities across workflows, reducing duplication.
2. **Declarative Workflow Engine**: Simplifies authoring and enables runtime resilience features such as auto-run context tokens.
3. **Shadow-DOM Menu**: Prevents host page CSS collisions and centralizes workflow discovery.

## Known Limitations
- **Tampermonkey Sandbox**: Limits advanced build artifacts (e.g., wasm) and requires careful packaging of assets.
- **Selector Drift**: Oracle DOM volatility necessitates ongoing selector audits and auto-run safeguards.
- **Testing Coverage**: jsdom-based tests cannot simulate full Oracle UI, so manual validation remains necessary before rollout.
