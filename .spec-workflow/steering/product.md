# Product Overview

## Product Purpose
Carvana Automation Userscripts streamline repetitive back-office tasks across Jira and Oracle by codifying reliable, tamper-proof workflows. The steering artifacts ensure every automation effort begins with shared context so teams deliver consistent, reviewer-ready specs and implementations.

## Target Users
- Automation engineers authoring and maintaining Tampermonkey workflows for Carvana.
- Operations stakeholders who rely on accurate, low-friction automation to reduce manual effort.
- Reviewers who need traceable specs, approvals, and QA hooks before a workflow ships.

## Key Features
1. **Spec-Guided Delivery**: Structured workflow for requirements, design, and task breakdown with approvals at each gate.
2. **Reusable Selector Library**: Cross-workflow selector patterns and helpers that minimize brittle DOM targeting.
3. **Menu-Driven Execution**: Shadow-DOM control surface providing workflow launch, selector editing, auto-run toggles, and logs for validation.

## Business Objectives
- Shorten time-to-approve for new automations while preserving quality.
- Reduce production regression risk by enforcing spec + approval checkpoints.
- Improve observability of automation coverage across Jira and Oracle domains.

## Success Metrics
- **Spec Cycle Time**: < 3 business days from draft requirements to task approval.
- **Automation Regression Rate**: < 2% post-deploy runtime failures attributable to spec gaps.
- **Workflow Adoption**: > 80% of eligible finance/Jira flows executed via userscripts.

## Product Principles
1. **Reliability First**: Automations must default to safe fallbacks and human review when selectors fail.
2. **Traceable Decisions**: Every feature travels with documented rationale, approvals, and task history.
3. **Operator Empathy**: UX and messaging emphasize clarity so analysts can trust automation output and intervene quickly.

## Monitoring & Visibility
- **Dashboard Type**: Shadow-DOM in-browser panel exposed by the userscripts.
- **Real-time Updates**: MutationObserver-driven logs and status badges refreshed per workflow step.
- **Key Metrics Displayed**: Last run, auto-run status, selector test results, and captured extraction outputs.
- **Sharing Capabilities**: Specs and approvals remain source-controlled; workflow logs can be copied via clipboard actions for handoff.

## Future Vision
### Potential Enhancements
- **Remote Access**: Serve sanitized execution logs to a lightweight web dashboard for asynchronous reviews.
- **Analytics**: Aggregate auto-run telemetry to highlight flaky selectors or high-friction steps.
- **Collaboration**: Integrate approval feedback loops directly into the menu for on-page reviewer sign-off.
