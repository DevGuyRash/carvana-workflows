# Project Structure

## Directory Organization

```
carvana-workflows/
├── dist/                         # Compiled Tampermonkey bundles (jira/oracle)
├── packages/
│   ├── core/                     # Shared engine, selector utils, menu runtime
│   ├── jira-userscript/          # Jira-specific pages and workflows
│   └── oracle-userscript/        # Oracle-specific pages and workflows
├── scripts/                      # Build and dev automation scripts
├── .spec-workflow/               # Steering, specs, approvals, templates
├── node_modules/                 # Managed dependencies (npm workspaces)
├── tsconfig*.json                # TypeScript project configuration
└── README.md / AGENTS.md         # High-level documentation & authoring guides
```

Within `packages/*/src`:
- `index.ts` registers pages/workflows with the runtime menu.
- `pages/` house page detectors and workflow registrations.
- `workflows/` contain individual workflow definitions (`WorkflowDefinition`).
- `shared/` stores selectors, helpers, and domain-specific utilities.
- `notes/` captures domain research and manual procedures.

## Naming Conventions

### Files
- **Workflows**: `oracle-<feature>.ts`, `jira-<feature>.ts` (kebab-case with domain prefix).
- **Pages**: `<domain>-<page>.ts` (kebab-case).
- **Utilities**: `<name>.ts` using kebab-case aligned to function.
- **Tests**: `<target>.test.ts` alongside implementation where applicable.

### Code
- **Classes/Types**: `PascalCase` (e.g., `WorkflowDefinition`).
- **Functions/Methods**: `camelCase` (e.g., `registerOracleWorkflows`).
- **Constants**: `UPPER_SNAKE_CASE` for shared tokens, `camelCase` for locals.
- **Variables**: `camelCase`.

## Import Patterns

### Import Order
1. External dependencies (`@cv/core`, third-party libs).
2. Internal shared modules (`../shared/...`).
3. Relative sibling files (`./helpers`).
4. Types-only imports last when separated for clarity.

### Module/Package Organization
- Use workspace package names for cross-package imports (e.g., `@cv/core`).
- Prefer relative paths within a package to avoid circular dependencies.
- Export workflows/pages as named exports for selective registration.

## Code Structure Patterns

### Module Organization
1. Imports and shared constants.
2. Selector specs and helper functions.
3. Workflow/page definitions.
4. Export statements.

### Function Organization
- Validate DOM availability early with `waitFor`/`branch` guards.
- Encapsulate repeated selector targets in shared modules.
- Return declarative step arrays without inline side effects.

### File Organization Principles
- One workflow or page definition per file to simplify approvals.
- Keep helper utilities isolated for reuse and targeted testing.
- Document non-obvious selectors with concise comments referencing Oracle/Jira UI labels.

## Code Organization Principles
1. **Single Responsibility**: Each workflow file represents one automatable flow.
2. **Modularity**: Shared selectors/utilities live under `shared/` directories per domain.
3. **Testability**: Extract complex logic into pure functions for Vitest coverage.
4. **Consistency**: Mirror patterns between Jira and Oracle packages where feasible.

## Module Boundaries
- `@cv/core` exposes engine primitives; domain packages consume but do not modify core internals.
- Jira and Oracle packages avoid cross-dependencies; shared logic belongs in `core` or duplicated intentionally with domain-specific adjustments.
- Specs steer additions by requiring new workflows to register through `index.ts` and maintain selectors in `shared/`.

## Code Size Guidelines
- **File size**: Target < 350 lines per workflow/page file; split helpers when exceeding 200 lines.
- **Function size**: Keep workflow step builder functions < 80 lines; break into helper steps otherwise.
- **Class complexity**: N/A (functional style preferred); limit nested branches to depth of 3.
- **Nesting depth**: Avoid nested waits/branches beyond 3 levels; leverage helper workflows instead.

## Documentation Standards
- Steering and spec docs live under `.spec-workflow/` and drive approvals.
- Workflows requiring non-trivial selectors include inline comments referencing Oracle label text or attributes.
- Major feature directories include `README` or notes where domain procedures are captured for analysts.
