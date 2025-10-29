# Tasks Document

- [x] 1. Build Oracle invoice status detector helper
  - File: `packages/oracle-userscript/src/shared/invoice/status-detector.ts`
  - Implement `detectInvoiceValidationStatus` with retry/backoff, snippet capture, manual verification mode, and diagnostics payload.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, NFR-Reliability_
  - _Leverage: `packages/oracle-userscript/src/shared/` selector utilities, `@cv/core/workflow` wait helpers, DOM snippet in requirements.md_
  - _Prompt: Implement the task for spec oracle-invoice-validation-alert, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Oracle Selector Specialist and TypeScript Engineer | Task: Create the reusable detection helper with retries, snippet capture, and verification hooks per requirements 1.1–1.4 and 3.1 | Restrictions: Preserve existing Oracle selector conventions, avoid persisting raw invoice data, follow shared helper patterns | _Leverage: `packages/oracle-userscript/src/shared/selector-utils.ts`, `@cv/core/workflow` helpers, requirements DOM snippet | _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1 | Success: Helper returns structured `DetectionResult`, handles unknown state after retries, passes TypeScript checks, and integrates manual verification flag | Instructions: Before starting set this task to [-] in tasks.md, after successful completion update it to [x]_

- [x] 2. Add detector unit tests
  - File: `packages/oracle-userscript/src/shared/invoice/status-detector.test.ts`
  - Cover validated/needs-revalidated/unknown branches, retry timing, and manual verification outputs with jsdom fixtures.
  - _Requirements: 1.2, 1.3, 3.1, NFR-Performance, NFR-Reliability_
  - _Leverage: `vitest`, existing Oracle fixture utilities under `packages/oracle-userscript/test-utils`, DOM snippet documented in requirements_
  - _Prompt: Implement the task for spec oracle-invoice-validation-alert, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Automation Engineer skilled in Vitest and jsdom | Task: Build comprehensive unit tests for the status detector covering success, fallback, and verification scenarios aligned to requirements 1.2, 1.3, and 3.1 | Restrictions: Do not mock unrelated modules, keep fixtures self-contained, assert timing via fake timers rather than real waits | _Leverage: `vitest`, jsdom utilities, requirements DOM snippet | _Requirements: 1.2, 1.3, 3.1 | Success: Tests reproduce all detector outcomes, use fake timers for retry logic, and fail if diagnostics payloads are incomplete | Instructions: Set this task to [-] when you begin and flip to [x] after tests pass_

- [x] 3. Define validation banner theme tokens
  - File: `packages/core/src/ui/hud-theme-validation.ts`
  - Encode colors, easing curves, keyframes, and responsive layout constants for three banner states.
  - _Requirements: 2.1, 2.2, 2.3, NFR-Architecture, NFR-Usability_
  - _Leverage: Existing HUD theme modules in `packages/core/src/ui/theme`, requirements color specs, animation guidelines from design.md_
  - _Prompt: Implement the task for spec oracle-invoice-validation-alert, first run spec-workflow-guide to get the workflow guide then implement the task: Role: UI Systems Engineer focusing on design token architecture | Task: Create validation banner token module matching requirements 2.1–2.3 and design guidance, exporting typed accessors | Restrictions: Keep tokens declarative, avoid inlining business logic, ensure WCAG contrast values are documented in tokens | _Leverage: HUD theme utilities, design.md animation tables | _Requirements: 2.1, 2.2, 2.3 | Success: Token module exports typed theme map, satisfies lint/tests, and is consumable by HUD components | Instructions: Mark this task as [-] before editing and switch to [x] once tokens compile and tests pass_

- [x] 4. Implement HUD validation banner renderer
  - File: `packages/core/src/ui/hud-validation-banner.ts`
  - Render animated banner states inside HUD shadow DOM with ARIA live updates, dismissal, and token-driven styling.
  - _Requirements: 2.1, 2.2, 2.3, NFR-Usability, NFR-Performance_
  - _Leverage: HUD overlay utilities (`packages/core/src/ui/hud.ts`), new theme tokens, existing icon font resources_
  - _Prompt: Implement the task for spec oracle-invoice-validation-alert, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend Engineer specializing in animated HUD experiences | Task: Build the validation banner module that consumes tokens, animates states, manages ARIA live announcements, and supports dismissal per requirements 2.1–2.3 | Restrictions: Do not mutate Oracle DOM directly, keep animations within HUD shadow root, respect performance budget | _Leverage: HUD UI utilities, token module, icon font | _Requirements: 2.1, 2.2, 2.3 | Success: Module exposes `showValidationBanner`, `syncValidationBannerTheme`, `clearValidationBanner`, passes lint/tests, and animations behave per specs | Instructions: Change this task to [-] when work starts and to [x] after banner renders correctly with tests_

- [x] 5. Add HUD banner unit tests
  - File: `packages/core/src/ui/hud-validation-banner.test.ts`
  - Validate animation state transitions, ARIA messaging, dismissal behavior, and token consumption via jsdom.
  - _Requirements: 2.1, 2.2, 2.3, NFR-Usability, NFR-Performance_
  - _Leverage: `vitest`, HUD test harnesses, token module from task 3_
  - _Prompt: Implement the task for spec oracle-invoice-validation-alert, first run spec-workflow-guide to get the workflow guide then implement the task: Role: UI Test Engineer experienced in jsdom animation testing | Task: Write unit tests ensuring the HUD banner renders all states, announces via ARIA, and cleans up per requirements 2.1–2.3 | Restrictions: Use fake timers for animation assertions, avoid coupling tests to implementation details, keep snapshots minimal | _Leverage: HUD testing utilities, token module | _Requirements: 2.1, 2.2, 2.3 | Success: Tests verify each state’s classes/animations, ARIA messages fire, and cleanup removes nodes | Instructions: Set status to [-] before coding and to [x] once tests pass_

- [ ] 6. Author Oracle invoice validation alert workflow
  - File: `packages/oracle-userscript/src/workflows/oracle-invoice-validation-alert.ts`
  - Compose workflow steps for detection, banner rendering, diagnostics logging, auto-run repeat, and manual verification action.
  - _Requirements: 1.1, 1.4, 2.1, 3.1, 3.2, 3.3, NFR-Reliability_
  - _Leverage: `@cv/core` workflow DSL, detector helper, HUD banner module, design auto-run patterns_
  - _Prompt: Implement the task for spec oracle-invoice-validation-alert, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Workflow Automation Engineer with Oracle expertise | Task: Implement the workflow definition orchestrating detection, banner updates, history logging, and manual verification per requirements 1.1–1.4 and 3.1–3.3 | Restrictions: Follow existing workflow naming/id conventions, avoid duplicating helper logic, ensure retries respect mutation watchers | _Leverage: workflow DSL, detector helper, HUD banner module | _Requirements: 1.1, 1.4, 3.1, 3.2, 3.3 | Success: Workflow auto-runs correctly, handles branching, registers manual verification, and logs diagnostics | Instructions: Mark this task as [-] to begin and [x] once workflow passes integration tests_

- [ ] 7. Create workflow integration tests
  - File: `packages/oracle-userscript/src/workflows/__tests__/oracle-invoice-validation-alert.test.ts`
  - Stub HUD banner module, simulate detector outputs, and assert branching, logging payloads, and auto-run scheduling.
  - _Requirements: 1.4, 3.1, 3.2, 3.3, NFR-Reliability_
  - _Leverage: `vitest`, workflow test harnesses, detector mock utilities_
  - _Prompt: Implement the task for spec oracle-invoice-validation-alert, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Workflow QA Specialist proficient in integration testing | Task: Implement integration tests covering workflow happy paths, unknown fallback, and manual verification per requirements 1.4 and 3.x | Restrictions: Use dependency injection/mocks for detector and HUD modules, avoid hitting real timers, keep logs assertion-focused | _Leverage: workflow test harness, detector mocks | _Requirements: 1.4, 3.1, 3.2, 3.3 | Success: Tests fail if workflow skips logging, misroutes banner states, or misses manual verification | Instructions: Toggle task to [-] when writing tests and to [x] after they pass_

- [ ] 8. Persist diagnostics in workflow history store
  - Files: `packages/core/src/workflow.ts`, `packages/core/src/data.ts`
  - Extend history payloads to record snippet text, element path summary, banner state, attempts, and verification flag without storing raw invoice IDs.
  - _Requirements: 3.1, NFR-Security, NFR-Reliability_
  - _Leverage: Existing history schema, data serialization utilities, security guidelines from requirements_
  - _Prompt: Implement the task for spec oracle-invoice-validation-alert, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Core Platform Engineer overseeing workflow persistence | Task: Update history storage to include validation diagnostics while honoring security constraints per requirement 3.1 | Restrictions: Do not store sensitive invoice identifiers, maintain backward compatibility with history schema, add tests for new fields | _Leverage: workflow data utilities, security requirements | _Requirements: 3.1 | Success: History entries include diagnostics fields, schemas/tests updated, and no sensitive data leaked | Instructions: Mark this task as [-] at start and [x] once persistence changes are tested_

- [ ] 9. Register workflow and autorun configuration
  - File: `packages/oracle-userscript/src/index.ts`
  - Register workflow with Oracle invoice page, configure auto-run context tokens, mutation watchers, and default auto-run settings.
  - _Requirements: 1.4, NFR-Reliability_
  - _Leverage: Existing Oracle workflow registrations, auto-run context utilities_
  - _Prompt: Implement the task for spec oracle-invoice-validation-alert, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Oracle Workflow Integrator | Task: Wire the workflow into the Oracle userscript registry with correct auto-run tokens and mutation watchers per requirement 1.4 | Restrictions: Maintain registration order priority, reuse shared mutation observer config, avoid duplicating auto-run logic | _Leverage: Oracle userscript index, auto-run utilities | _Requirements: 1.4 | Success: Workflow registers without collisions, auto-run triggers correctly, lint/tests pass | Instructions: Switch this task to [-] before modifying index.ts and to [x] after verifying registration_

- [ ] 10. Produce QA checklist and selector sign-off
  - Deliverables: `packages/oracle-userscript/src/notes/oracle-invoice-validation-alert-qa.md`, spec history entry noting selector/test confirmation.
  - Document manual validation steps for each status, accessibility checks, manual verification flow, and capture requestor approval.
  - _Requirements: 2.1, 2.2, 2.3, 3.2, NFR-Usability_
  - _Leverage: Design motion specs, requirements acceptance criteria, existing QA checklist templates if any_
  - _Prompt: Implement the task for spec oracle-invoice-validation-alert, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Lead coordinating Oracle workflow validation | Task: Create comprehensive QA checklist and record selector/test sign-off per requirements 2.1–2.3 and 3.2 | Restrictions: Align with accessibility standards, do not expose sensitive invoice data, ensure sign-off is captured in spec history | _Leverage: design.md, requirements.md, QA templates | _Requirements: 2.1, 2.2, 2.3, 3.2 | Success: Checklist file committed with actionable steps, sign-off noted in spec history, stakeholders confirm readiness | Instructions: Set this task to [-] when drafting and change to [x] after approval is documented_
