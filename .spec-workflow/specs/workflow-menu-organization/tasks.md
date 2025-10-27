- [x] 1. Implement workflow preferences persistence service
  - File: packages/core/src/menu/workflow-preferences.ts
  - Create a typed service to persist ordering and hidden-state metadata with versioning, reconciliation, and Store-backed serialization
  - Export helper to surface ordered and hidden workflow lists for MenuUI consumers
  - _Leverage: packages/core/src/storage.ts, packages/core/src/autorun.ts_
  - _Requirements: Requirement 1, Requirement 2, Requirement 3_
  - _Prompt: Implement the task for spec workflow-menu-organization, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Platform Engineer focused on state persistence | Task: Build workflow-preferences service providing ordered/hidden retrieval, mutation APIs, and fault-tolerant reconciliation against runtime workflow IDs | Restrictions: Keep serialization format versioned, avoid direct DOM coupling, reuse Store patterns from storage.ts | _Leverage: storage.ts, autorun.ts serialization helpers | _Requirements: Requirement 1, Requirement 2, Requirement 3 | Success: New service persists order/hidden state, gracefully handles missing/corrupt data, and exposes methods consumed by MenuUI_

- [x] 2. Add drag interaction controller utility
  - File: packages/core/src/menu/drag-controller.ts
  - Implement pointer and keyboard handlers to reorder list items via callbacks while respecting accessibility focus management
  - Provide attach/detach lifecycle tied to MenuUI list elements
  - _Leverage: packages/core/src/ui.ts (existing event patterns)_
  - _Requirements: Requirement 1, Usability_
  - _Prompt: Implement the task for spec workflow-menu-organization, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend Interaction Engineer specializing in accessible drag-and-drop | Task: Create reusable drag-controller utility supporting pointer and keyboard reordering callbacks for workflow items | Restrictions: No global event leakage outside Shadow DOM, maintain 60fps-friendly updates, ensure keyboard shortcuts mirror drag semantics | _Leverage: ui.ts event patterns | _Requirements: Requirement 1, Usability | Success: Utility attaches to workflow list, emits stable reorder callbacks, and supports both pointer and keyboard interactions_

- [x] 3. Integrate preferences and drag controller into MenuUI workflows tab
  - File: packages/core/src/ui.ts
  - Use WorkflowPreferencesService and DragController to render ordered lists, reveal drag handles, handle reorder persistence, and debounce writes
  - Show visual drop indicators and announce status updates
  - _Leverage: packages/core/src/menu/workflow-preferences.ts, packages/core/src/menu/drag-controller.ts_
  - _Requirements: Requirement 1, Non-Functional Performance_
  - _Prompt: Implement the task for spec workflow-menu-organization, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Senior TypeScript UI Engineer maintaining MenuUI | Task: Wire new persistence service and drag controller into MenuUI to enable drag handles, reorder persistence, and live indicators | Restrictions: Preserve existing workflow footer behavior, debounce persistence within 250ms, avoid mutating workflow definitions directly | _Leverage: workflow-preferences.ts, drag-controller.ts | _Requirements: Requirement 1, Non-Functional Performance | Success: Workflows tab supports drag handles with smooth reordering, stored order persists across reloads, existing profile/autorun controls remain functional_

- [x] 4. Implement hide/unhide controls and Hidden tab experience
  - File: packages/core/src/ui.ts
  - Add hide toggles, animate removal, and introduce Hidden tab rendering with search/filter, counters, and unhide action handling
  - Ensure auto-run toggles respect hidden status with prompting behavior
  - _Leverage: packages/core/src/menu/workflow-preferences.ts, packages/core/src/autorun.ts_
  - _Requirements: Requirement 2, Requirement 3, Usability_
  - _Prompt: Implement the task for spec workflow-menu-organization, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Product UI Engineer focusing on menu ergonomics | Task: Extend MenuUI to provide hide/unhide controls, Hidden tab with search/filter, and auto-run prompts for hidden workflows | Restrictions: Maintain keyboard access for hide/unhide, reuse tab switching patterns, prevent hidden workflows from auto-run without confirmation | _Leverage: workflow-preferences.ts, autorun.ts | _Requirements: Requirement 2, Requirement 3, Usability | Success: Users can hide workflows, Hidden tab surfaces count/search, unhide restores ordering, and hidden-auto-run conflicts prompt users_

- [x] 5. Style updates for drag handles and hidden surfaces
  - File: packages/core/src/ui.ts (css string)
  - Introduce modern visual treatments for drag handles, drop indicators, hidden badges, and tab badges while meeting contrast guidelines
  - Ensure animations for hide transitions remain performant
  - _Leverage: existing css() in MenuUI_
  - _Requirements: Requirement 1, Requirement 2, Requirement 3, Usability_
  - _Prompt: Implement the task for spec workflow-menu-organization, first run spec-workflow-guide to get the workflow guide then implement the task: Role: UI Engineer with expertise in design systems | Task: Update MenuUI CSS to add drag handle affordances, hidden badges, and animations that feel modern and accessible | Restrictions: Keep CSS scoped to Shadow DOM, avoid heavy box-shadows that hurt performance, ensure focus states remain visible | _Leverage: MenuUI css() | _Requirements: Requirement 1, Requirement 2, Requirement 3, Usability | Success: Visual design clearly communicates drag, hide, and hidden states, animations run smoothly, all new elements meet WCAG AA_

- [ ] 6. Add unit tests for preferences and hiding logic
  - File: packages/core/test/workflow.preferences.test.ts
  - Cover order reconciliation, hide toggles, persistence version fallback, and auto-run prompt interactions at service level
  - _Leverage: packages/core/test/autorun.test.ts patterns_
  - _Requirements: Requirement 1, Requirement 2, Requirement 3, Reliability_
  - _Prompt: Implement the task for spec workflow-menu-organization, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Test Engineer focusing on core utilities | Task: Write unit tests validating workflow-preferences service ordering/hidden behavior and edge cases | Restrictions: Use Vitest patterns from existing core tests, mock Store interactions deterministically, avoid DOM reliance | _Leverage: autorun.test.ts patterns | _Requirements: Requirement 1, Requirement 2, Requirement 3, Reliability | Success: Tests cover reconciliation, hide/unhide, persistence errors, and pass reliably_

- [ ] 7. Add integration tests for MenuUI interactions
  - File: packages/core/test/ui.menu-organization.test.ts
  - Simulate MenuUI drag reorder, hide/unhide flows, hidden tab rendering, and keyboard support using jsdom helpers
  - _Leverage: packages/core/test/ui.theme.test.ts, packages/core/src/ui.ts_
  - _Requirements: Requirement 1, Requirement 2, Requirement 3, Usability_
  - _Prompt: Implement the task for spec workflow-menu-organization, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend QA Automation Engineer for UI components | Task: Create integration tests exercising MenuUI drag, hide, and hidden tab interactions including accessibility affordances | Restrictions: Use existing MenuUI setup helpers, ensure tests run under Vitest/jsdom, keep animations mocked or disabled for determinism | _Leverage: ui.theme.test.ts, ui.ts | _Requirements: Requirement 1, Requirement 2, Requirement 3, Usability | Success: Integration tests demonstrate drag reorder, hide/unhide, hidden tab UX, and keyboard navigation all function as specified_
