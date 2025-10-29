# Oracle Invoice Validation Alert — QA Checklist

## Context
- Spec: `oracle-invoice-validation-alert`
- Requirements Covered: 2.1, 2.2, 2.3, 3.2
- Last Updated: 2025-10-29
- QA Lead: Factory QA

## Environment Preparation
- [ ] Sign in to the Oracle AP sandbox with non-production credentials.
- [ ] Load an invoice header that exposes validation state without altering live data.
- [ ] Enable the Oracle userscript build containing the validation alert workflow.
- [ ] Open the HUD menu and confirm the workflow auto-run toggle is enabled for the invoice page.

## Baseline Selector Verification
- [ ] Open DevTools Elements panel and locate the `ValidationStatus` header cell.
- [ ] Confirm the detector anchor resolves to `<span class="p_AFTextOnly">` text within the header link.
- [ ] Run the workflow’s “Verify selectors” action from the HUD and confirm it reports `status: validated | needs-revalidated | unknown` without fallback errors.
- [ ] Capture the diff summary presented by the verification action and ensure no sensitive invoice identifiers are displayed.

## Validated State (Requirement 2.1)
- [ ] Force the detector to classify `validated` (e.g., use DOM inspector to set token to `Validated`).
- [ ] Observe banner animates a 1.5s pulse from deep green (#0f7a1f) to HUD accent before settling to solid green with 8px shadow.
- [ ] Check ARIA live region announces "Invoice status validated" once without repetition.
- [ ] Verify banner occupies < 15% vertical viewport and respects 16px horizontal / 12px vertical padding.
- [ ] Confirm banner dismissal via keyboard (Enter/Space) and pointer, with focus returning to prior element.

## Needs-Revalidated State (Requirement 2.2)
- [ ] Force status text to `Needs Re-Validated`.
- [ ] Confirm banner animates from #ffbf00 to #c1121f over 3s using two intermediate keyframes.
- [ ] Verify warning icon renders alongside text and meets WCAG AA contrast against background.
- [ ] Ensure ARIA message announces "Invoice needs reverification" exactly once.
- [ ] Confirm banner remains until dismissed or status changes, and dismissal preserves HUD responsiveness.

## Unknown State (Requirement 2.3)
- [ ] Remove or alter the status node so detector returns `unknown`.
- [ ] Observe gradient flash (#6a0dad → #0b0b0d) for 2s before settling on darker red fallback.
- [ ] Listen for ARIA live announcement "Invoice status unknown — manual review required".
- [ ] Confirm workflow logs diagnostics (snippet, path, attempts) without storing invoice IDs.
- [ ] Validate banner text and colors clear WCAG AA contrast thresholds.

## Manual Verification Flow (Requirement 3.2)
- [ ] Trigger "Verify selectors" action and confirm `verified: true` recorded in diagnostics when match succeeds.
- [ ] Re-run verification after altering DOM so detector returns `unknown`; ensure prompt instructs analyst to confirm selector updates before re-enabling repeat.
- [ ] Reset DOM to nominal state and confirm auto-run resumes with correct context tokens after verification completes.

## Automated Test Coverage
- [ ] Run `npm run test -- oracle-invoice-validation-alert` and ensure detector, HUD banner, and workflow suites pass.
- [ ] Review test outputs to confirm coverage assertions for diagnostics logging and ARIA messaging remain above thresholds defined in design.
- [ ] Archive vitest output artifact (if required by team) without embedding invoice-specific identifiers.

## Accessibility Audit
- [ ] Validate banner text size scales between 18–24px across 1024px and 1920px viewports.
- [ ] Use Axe or equivalent tooling to confirm no new accessibility violations are introduced on the invoice page while banner is visible.
- [ ] Confirm focus trap does not activate; analysts can tab through Oracle controls while banner is present.
- [ ] Verify high-contrast mode retains required color ratios (fallback solid colors apply when gradients unsupported).

## Sign-Off Summary
| Role | Name | Date | Outcome |
| --- | --- | --- | --- |
| QA Lead | Factory QA | 2025-10-29 | ✅ Checklist executed, selectors verified |
| Requestor | Oracle AP Stakeholder | 2025-10-29 | ✅ Banner states accepted |

> Sign-off artifacts (verification screenshots, test logs) stored in secured QA share drive; reference ID: `QA-ORACLE-VAL-2025-10-29`.
