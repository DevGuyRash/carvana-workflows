# Requirements Document

**Version 0.2 — 2025-10-29**

## Introduction

Deliver an auto-run Oracle workflow that spot-checks invoice validation status and immediately surfaces a vivid, unobtrusive alert so analysts never miss invoices that must be re-validated. The workflow should run hands-off on eligible invoice pages, confirm the status element, and display a status banner that conveys risk without blocking the core UI. Final deliverable includes a production-ready workflow, HUD banner themes, animation specs, and documentation capturing the target DOM element for long-term reference.

## Alignment with Product Vision

Reinforces the automation suite’s promise of proactive guardrails that keep back-office operators in flow. By detecting risky invoices and flagging them in-context, the feature prevents missed follow-ups while respecting Oracle’s layout constraints and our commitment to calm, legible overlays.

## Requirements

### Requirement 1 — Reliable Invoice Status Detection

**User Story:** As an Oracle AP specialist, I want the workflow to auto-run on invoice forms and capture the current validation status so that I immediately know whether the invoice is safe, needs attention, or has an unknown state.

#### Acceptance Criteria

1. WHEN the page contains “Invoice Header” AND either “Edit Invoice” OR “Create Invoice” within the visible DOM THEN the workflow SHALL auto-run and evaluate the invoice status region.
2. WHEN the workflow searches within anchor elements under the invoice status tables THEN it SHALL classify the first match of the text tokens “Validated” or “Needs Re-Validated” case-insensitively.
3. IF no qualifying status element is present after configurable retries up to 12s THEN the workflow SHALL classify the status as `unknown` and record diagnostics for operator review.
4. WHEN a new invoice header loads (detected via auto-run context tokens combining tab, header, and document title) THEN the workflow SHALL re-run after prior execution completes.

#### Source Status Node Reference

Captured from Oracle Invoice Header (US2 tenant) for invoice `CARV-VALIDATION-DEMO-001` on 2025-10-28:

```
<td class="xrh" headers="ValidationStatus">
  <a id="pt1:_FOr1:1:_FONSr2:0:MAnt2:1:pm1:r1:0:ap1:r131:0:status1" class="x12" role="link">
    <span class="p_AFTextOnly">Needs Re-Validated</span>
  </a>
</td>
```

Selectors MUST anchor on the `ValidationStatus` header text and the `Needs Re-Validated` / `Validated` tokens; avoid brittle id suffixes.

### Requirement 2 — High-Visibility Animated Alert Banner

**User Story:** As an analyst reviewing invoices, I want a dramatic yet unobtrusive banner that conveys the validation state without obscuring Oracle controls so that I can keep working while staying informed.

#### Acceptance Criteria

1. WHEN the status is `validated` THEN the workflow SHALL render a compact, fixed-position banner within the userscript HUD that pulses from deep green (#0f7a1f) to the menu’s standard accent for 1.5 seconds using an `ease-in-out` cubic-bezier timing curve before settling to solid green with subtle 8px drop shadow.
2. WHEN the status is `needs-revalidated` THEN the banner SHALL animate from a warning yellow (#ffbf00) to a saturated red (#c1121f) over 3 seconds with two keyframes (0s, 1.2s, 3s) and remain visibly red until dismissed or the state changes; the banner SHALL include an inline warning icon rendered via existing HUD icon font.
3. WHEN the status is `unknown` THEN the banner SHALL flash a “mystery” gradient (ultraviolet #6a0dad to charcoal #0b0b0d) for 2 seconds, emit a warning message via ARIA live region, and transition to a darker red variant distinct from the standard failure red.
4. The banner SHALL remain clickable only for dismissal, occupy no more than 15% of vertical viewport, scale typography responsively between 18–24px for readability, and respect HUD spacing tokens (16px horizontal padding, 12px vertical).

### Requirement 3 — Operator Confirmation and Diagnostics Loop

**User Story:** As a workflow maintainer, I want built-in confirmation and diagnostics so that selectors stay accurate and we can validate automated tests with human sign-off.

#### Acceptance Criteria

1. WHEN the workflow captures a status THEN it SHALL log the matched element text (verbatim), DOM path summary (header text + trimmed aria lineage), and banner color token into workflow history for later export.
2. WHEN selectors or tests are updated in development THEN the workflow SHALL expose a manual “Verify selectors” action that re-runs detection and reports whether the expected selector matched, surfacing diff output between captured snippet and baseline.
3. IF the verification action fails or returns `unknown` status twice consecutively THEN the workflow SHALL prompt the user to confirm selector updates before enabling auto-run repeat.

## Non-Functional Requirements

### Code Architecture and Modularity
- Encapsulate DOM querying and classification in a dedicated helper so tests and future workflows can reuse Oracle invoice status detection.
- Keep visual banner rendering within the shared menu overlay, avoiding direct Oracle DOM mutations beyond necessary status reads.
- Store animation tokens (durations, easing curves, color assignments) in a shared HUD theme module to keep workflow definitions declarative.

### Performance
- Complete status detection and banner render within 500ms after the status element becomes available, excluding Oracle network delays.
- Avoid re-rendering the banner more than once per auto-run cycle unless the status text changes.

### Security
- Do not persist invoice data beyond the derived status classification and diagnostic metadata needed for testing.
- Ensure banner scripts respect existing CSP allowances and do not inject external assets.

### Reliability
- Retry status detection with exponential backoff up to 12 seconds to handle slow Oracle redraws, logging each attempt.
- Guarantee banner teardown when navigating away from eligible invoice headers to prevent stale alerts.

### Usability
- Ensure banner colors and text meet WCAG 2.1 AA contrast ratios (≥ 4.5:1) against the menu background.
- Provide screen-reader announcements via ARIA live region when the banner state changes.
- Capture annotated motion specs (keyframes, durations, easing) and HUD layout diagrams in the design artifact to guide implementation.
- Before finalizing implementation tasks, coordinate a selector/test walkthrough with requestor to confirm matching strategy and diagnostics expectations.
