# Tasks Document

- [ ] 1. Implement Oracle invoice status detector helper
  - File: `packages/oracle-userscript/src/shared/invoice/status-detector.ts`
  - Create `detectInvoiceValidationStatus` with retry loop, snippet capture, and diagnostics payload per requirements.
  - Reuse `waitFor`, selector builders, and DOM snippet from requirements; emit structured `DetectionResult`.
  - _Requirements: 1.1, 1.2, 1.3, 3.1_

- [ ] 2. Add validation banner theme tokens
  - File: `packages/core/src/ui/hud-theme-validation.ts`
  - Encode color palette, easing, keyframes, spacing, and typography ranges specified in requirements.
  - Export token accessor and associated TypeScript types for reuse.
  - _Requirements: 2.1, 2.2, 2.3, NFR-Architecture_

- [ ] 3. Build HUD validation banner renderer
  - File: `packages/core/src/ui/hud-validation-banner.ts`
  - Render banner inside HUD shadow DOM with animations for validated / needs-revalidated / unknown states.
  - Provide `showValidationBanner`, `syncValidationBannerTheme`, `clearValidationBanner`; ensure ARIA live region updates and dismissal.
  - _Requirements: 2.1, 2.2, 2.3, NFR-Usability_

- [ ] 4. Wire workflow to detector and banner
  - File: `packages/oracle-userscript/src/workflows/oracle-invoice-validation-alert.ts`
  - Define auto-run workflow steps (wait for invoice header, execute detector, branch on status, render banner, log history, schedule rerun).
  - Register manual “Verify selectors” action triggering detector in verification mode and diff logging.
  - _Requirements: 1.1–1.4, 3.1–3.3_

- [ ] 5. Register workflow entry point
  - File: `packages/oracle-userscript/src/index.ts`
  - Import workflow definition, attach to relevant Oracle page registration, and configure auto-run context tokens / mutation watchers.
  - Ensure workflow metadata (id, label, auto-run defaults) follows existing naming conventions.
  - _Requirements: 1.4, NFR-Reliability_

- [ ] 6. Persist diagnostics in workflow history
  - File: `packages/core/src/workflow.ts` (augmentation) & `packages/core/src/data.ts`
  - Store matched text, element path summary, banner state, attempts, and verification flag in history entries.
  - Expose data for export while keeping raw invoice values out of storage (per security requirement).
  - _Requirements: 3.1, NFR-Security_

- [ ] 7. Add Vitest coverage for detector and tokens
  - Files: `packages/oracle-userscript/src/shared/invoice/status-detector.test.ts`, `packages/core/src/ui/hud-theme-validation.test.ts`
  - Create jsdom fixtures mirroring captured DOM snippet; test status classification, retry fallbacks, and token values.
  - _Requirements: 1.2, 1.3, 2.1, NFR-Performance_

- [ ] 8. Add workflow integration test harness
  - File: `packages/oracle-userscript/src/workflows/__tests__/oracle-invoice-validation-alert.test.ts`
  - Stub HUD banner module; assert branching, logging payloads, manual verification flow, and auto-run scheduling.
  - _Requirements: 1.4, 3.2, NFR-Reliability_

- [ ] 9. Prepare manual QA script and HUD demo assets
  - Deliverable: QA checklist under `packages/oracle-userscript/src/notes/oracle-invoice-validation-alert-qa.md`
  - Document steps to simulate each status, trigger manual verification, and confirm banner accessibility/contrast.
  - _Requirements: 2.1–2.3, NFR-Usability_

- [ ] 10. Confirm selectors and tests with requestor before implementation handoff
  - Action: Schedule review of detector snippet, selector strategy, and test fixtures; capture sign-off reference in spec history.
  - Implementation tasks blocked until confirmation recorded.
  - _Requirements: 3.2, NFR-Usability_
