# Universal Code Review Guidelines & Prompt (Language‑Agnostic)

**Status**: Canonical Baseline

> A practical, paste‑anywhere code review standard for **humans and AI reviewers**.
> The repository's own docs/contracts/policies are authoritative and must be followed.

---

## ⚠️ PROTOCOL INTEGRITY & ENFORCEMENT (MANDATORY — READ FIRST)

**This section establishes non-negotiable constraints. You SHALL read this section before proceeding. Skipping this section constitutes a protocol violation.**

### Binding Obligations

The reviewer (human or AI) **SHALL**:

1. **Execute ALL phases in order** — You SHALL NOT skip any Round (−1 through 5) defined in §4. IF you cannot complete a Round, THEN you SHALL document why in the report and add it to residual risk per §12.2.

2. **Produce a final verdict** — You SHALL conclude every review with an explicit `APPROVE`, `REQUEST CHANGES`, or `BLOCK` verdict per §12. A review without a verdict is incomplete and invalid.

3. **Use the required templates** — You SHALL use the templates in §13 to structure your output (delivered per §12 "Report storage"). You SHALL NOT invent alternative formats. The templates exist to ensure completeness; deviating from them causes omissions.

4. **Cite evidence for every claim** — You SHALL provide evidence anchors per §1.5.1 for every non-trivial claim. IF you cannot provide evidence, THEN you SHALL use the confidence calibration language from §1.5.2 and add the item to residual risk per §12.2.

5. **Complete phase checkpoints** — At the end of each Round in §4, you SHALL verify the phase is complete by checking the cross-referenced requirements before proceeding.

### Protocol Violations (auto-flag as BLOCKER)

The reviewer **SHALL NOT**:

- Skip phases or reorder the workflow (violates §4)
- Omit the verdict (violates §12)
- Use "LGTM" or "looks good" without evidence (violates §1.2)
- Mark high-risk domains as "Lightweight Review" (violates §11)
- Leave the "Not verified / residual risk" section empty without explicit justification (violates §12.2)
- Ignore template requirements (violates §13)
- Paste the full report into chat when file output is possible (violates §12 "Report storage")

### Cross-Reference Mesh (Enforcement Network)

This document uses bidirectional cross-references to create an enforcement mesh. WHEN you read a section that references another section, THEN you SHALL follow that reference to verify compliance. Key enforcement paths:

| Start Section   | References         | Which Requires                             | Which References Back                   |
| --------------- | ------------------ | ------------------------------------------ | --------------------------------------- |
| §0 (How to use) | §3, §4, §12, §13   | Discovery, Workflow, Output, Templates     | All reference §0 as entry point         |
| §4 (Workflow)   | §1, §2, §5, §6, §7 | Evidence, Severity, Principles, Checklists | All reference §4 as execution context   |
| §11 (Depth)     | §4, §10, §14       | Workflow, Security, Quick Card             | All reference §11 for applicability     |
| §12 (Output)    | §1.5, §4, §13      | Confidence, Workflow, Templates            | All reference §12 as output requirement |
| §13 (Templates) | §0, §4, §12        | Usage, Workflow, Output                    | All reference §13 as format requirement |

**Validation gate**: Before finalizing your review, you SHALL verify that:

- [ ] All Rounds (−1 through 5) are documented or explicitly marked N/A with justification (§4)
- [ ] Verdict is stated with severity counts (§12)
- [ ] Template structure is followed (§13.1)
- [ ] Residual risk section is populated or explicitly cleared (§12.2)
- [ ] Evidence anchors exist for all BLOCKER/MAJOR findings (§1.5.1)

IF any validation fails, THEN the review is incomplete. You SHALL NOT proceed to output until all validations pass.

---

## Table of contents

- [Universal Code Review Guidelines \& Prompt (Language‑Agnostic)](#universal-code-review-guidelines--prompt-languageagnostic)
  - [⚠️ PROTOCOL INTEGRITY \& ENFORCEMENT (MANDATORY — READ FIRST)](#️-protocol-integrity--enforcement-mandatory--read-first)
    - [Binding Obligations](#binding-obligations)
    - [Protocol Violations (auto-flag as BLOCKER)](#protocol-violations-auto-flag-as-blocker)
    - [Cross-Reference Mesh (Enforcement Network)](#cross-reference-mesh-enforcement-network)
  - [Table of contents](#table-of-contents)
  - [0) How to use this guide (humans and AI reviewers)](#0-how-to-use-this-guide-humans-and-ai-reviewers)
    - [If you use an AI reviewer](#if-you-use-an-ai-reviewer)
      - [Inputs to provide (minimum)](#inputs-to-provide-minimum)
      - [Procedure (what the AI SHALL do)](#procedure-what-the-ai-shall-do)
      - [Output requirements](#output-requirements)
      - [GitHub CLI note: unresolved inline threads](#github-cli-note-unresolved-inline-threads)
  - [0.1) What this is for](#01-what-this-is-for)
  - [1) Non‑shallow review rules (quality bar)](#1-nonshallow-review-rules-quality-bar)
    - [1.1 Every finding SHALL be anchored](#11-every-finding-shall-be-anchored)
    - [1.2 Evidence SHALL beat vibes](#12-evidence-shall-beat-vibes)
    - [1.3 Risk SHALL dictate depth](#13-risk-shall-dictate-depth)
    - [1.4 You SHALL prefer small, composable patches](#14-you-shall-prefer-small-composable-patches)
    - [1.5 Audit discipline (anti false completeness)](#15-audit-discipline-anti-false-completeness)
      - [1.5.1 Evidence standard (hard citations)](#151-evidence-standard-hard-citations)
      - [1.5.2 Confidence calibration (required language)](#152-confidence-calibration-required-language)
      - [1.5.3 Signal preservation (anti dilution rules)](#153-signal-preservation-anti-dilution-rules)
      - [1.5.4 Approval discipline (release-readiness mindset)](#154-approval-discipline-release-readiness-mindset)
  - [2) Severity rubric (required)](#2-severity-rubric-required)
  - [3) Repository contract \& workflow discovery (mandatory first step)](#3-repository-contract--workflow-discovery-mandatory-first-step)
    - [3.1 You SHALL read the repo's instruction set (in priority order if present)](#31-you-shall-read-the-repos-instruction-set-in-priority-order-if-present)
    - [3.2 You SHALL populate the Repo Snapshot during discovery](#32-you-shall-populate-the-repo-snapshot-during-discovery)
    - [3.3 Discovery enforcement rules (mechanical)](#33-discovery-enforcement-rules-mechanical)
  - [4) Review workflow (multi‑pass, with required coverage)](#4-review-workflow-multipass-with-required-coverage)
    - [Round −1 — Fresh eyes (mandatory)](#round-1--fresh-eyes-mandatory)
    - [Round 0 — Triage \& intent (mandatory)](#round-0--triage--intent-mandatory)
      - [Quick triage checks](#quick-triage-checks)
      - [Change inventory (required for audit-style reviews)](#change-inventory-required-for-audit-style-reviews)
      - [Commit hygiene (required)](#commit-hygiene-required)
    - [Round 1 — Diff review (mandatory)](#round-1--diff-review-mandatory)
      - ["Play computer" checklist](#play-computer-checklist)
    - [Round 2 — Requirements trace (mandatory when possible)](#round-2--requirements-trace-mandatory-when-possible)
      - [Using `git` (works anywhere)](#using-git-works-anywhere)
      - [Using GitHub CLI (`gh`) when available](#using-github-cli-gh-when-available)
      - [If a PR exists, you SHALL also review](#if-a-pr-exists-you-shall-also-review)
      - [Re‑review questions](#rereview-questions)
      - [Requirements traceability (audit requirement)](#requirements-traceability-audit-requirement)
    - [Round 3 — Discussion \& unresolved thread closure (mandatory for PRs)](#round-3--discussion--unresolved-thread-closure-mandatory-for-prs)
      - [4.3.1 Review threads: are we done?](#431-review-threads-are-we-done)
      - [4.3.2 How to find unresolved conversations (especially inline review threads)](#432-how-to-find-unresolved-conversations-especially-inline-review-threads)
      - [4.3.3 Responding to PR feedback (thread hygiene)](#433-responding-to-pr-feedback-thread-hygiene)
      - [4.3.4 Review drift \& merge gates](#434-review-drift--merge-gates)
    - [Round 4 — Verification (mandatory for high risk; required for standard reviews when commands available)](#round-4--verification-mandatory-for-high-risk-required-for-standard-reviews-when-commands-available)
      - [Verification artifacts (audit requirement)](#verification-artifacts-audit-requirement)
    - [Round 5 — Final sanity check (mandatory)](#round-5--final-sanity-check-mandatory)
  - [5) Core engineering principles (mechanical checks)](#5-core-engineering-principles-mechanical-checks)
    - [5.1 KISS — Keep It Simple](#51-kiss--keep-it-simple)
    - [5.2 DRY — Don't Repeat Yourself](#52-dry--dont-repeat-yourself)
    - [5.3 YAGNI — You Aren't Gonna Need It](#53-yagni--you-arent-gonna-need-it)
    - [5.4 SOLID principles (mechanical checks)](#54-solid-principles-mechanical-checks)
      - [Single Responsibility](#single-responsibility)
      - [Open/Closed](#openclosed)
      - [Liskov Substitution](#liskov-substitution)
      - [Interface Segregation](#interface-segregation)
      - [Dependency Inversion](#dependency-inversion)
    - [5.5 Law of Demeter (Least Knowledge)](#55-law-of-demeter-least-knowledge)
    - [5.6 Make Illegal States Unrepresentable](#56-make-illegal-states-unrepresentable)
    - [5.7 Functional Core / Imperative Shell](#57-functional-core--imperative-shell)
    - [5.8 Fail Fast vs Fail Safe](#58-fail-fast-vs-fail-safe)
    - [5.9 Principle of Least Privilege](#59-principle-of-least-privilege)
    - [5.10 Robustness with Precision](#510-robustness-with-precision)
    - [5.11 Consistency over cleverness](#511-consistency-over-cleverness)
  - [6) Universal checklist (deep, apply to every change)](#6-universal-checklist-deep-apply-to-every-change)
    - [6.1 Correctness \& edge cases](#61-correctness--edge-cases)
    - [6.2 Contracts \& compatibility](#62-contracts--compatibility)
    - [6.3 Determinism \& reproducibility (when outputs persist or are user-visible)](#63-determinism--reproducibility-when-outputs-persist-or-are-user-visible)
    - [6.4 Security \& privacy (deny-by-default mindset)](#64-security--privacy-deny-by-default-mindset)
    - [6.5 Reliability \& resilience](#65-reliability--resilience)
    - [6.6 Observability \& operability](#66-observability--operability)
    - [6.7 Maintainability \& readability](#67-maintainability--readability)
    - [6.8 Dependencies \& supply chain](#68-dependencies--supply-chain)
    - [6.9 Async \& concurrency correctness (apply whenever async/workers are involved)](#69-async--concurrency-correctness-apply-whenever-asyncworkers-are-involved)
    - [6.10 Code quality \& refactoring (mechanical detection)](#610-code-quality--refactoring-mechanical-detection)
  - [7) Change-type checklists (pick what applies)](#7-change-type-checklists-pick-what-applies)
    - [A) Public API / schema / wire contracts](#a-public-api--schema--wire-contracts)
      - [Concrete contract hardening (recommended)](#concrete-contract-hardening-recommended)
    - [B) Storage, migrations, and data model changes](#b-storage-migrations-and-data-model-changes)
    - [C) Event-driven / distributed / async workflows](#c-event-driven--distributed--async-workflows)
      - [Semantics \& correctness](#semantics--correctness)
      - [Reliability \& backpressure](#reliability--backpressure)
      - [Data consistency](#data-consistency)
      - [Observability](#observability)
      - [Security](#security)
    - [D) External calls (network/file/subprocess/third-party APIs)](#d-external-calls-networkfilesubprocessthird-party-apis)
    - [E) Caching](#e-caching)
    - [F) Performance-sensitive changes](#f-performance-sensitive-changes)
    - [G) Concurrency and parallelism](#g-concurrency-and-parallelism)
    - [H) UI/UX changes (CLI, web, mobile)](#h-uiux-changes-cli-web-mobile)
      - [CLI-specific](#cli-specific)
    - [I) CI/CD, tooling, and developer experience](#i-cicd-tooling-and-developer-experience)
  - [8) Big‑O complexity expectations (mechanical analysis)](#8-bigo-complexity-expectations-mechanical-analysis)
    - [8.1 Complexity analysis checklist (mechanical)](#81-complexity-analysis-checklist-mechanical)
    - [8.2 Anti-pattern detection (mechanical)](#82-anti-pattern-detection-mechanical)
    - [8.3 Evidence requirements for performance claims](#83-evidence-requirements-for-performance-claims)
  - [9) Test quality standards (language‑agnostic)](#9-test-quality-standards-languageagnostic)
    - [9.1 Coverage requirements (with thresholds)](#91-coverage-requirements-with-thresholds)
      - [9.1.1 High-risk domains (auth, payments, migrations, crypto, PII)](#911-high-risk-domains-auth-payments-migrations-crypto-pii)
      - [9.1.2 Behavioral changes (not pure refactor)](#912-behavioral-changes-not-pure-refactor)
      - [9.1.3 Pure mechanical refactors](#913-pure-mechanical-refactors)
      - [9.1.4 Test coverage gaps](#914-test-coverage-gaps)
    - [9.2 Must‑haves (mechanical checks)](#92-musthaves-mechanical-checks)
    - [9.3 Risk-based test requirements (apply when applicable)](#93-risk-based-test-requirements-apply-when-applicable)
    - [9.4 Testing anti-patterns (flag when found)](#94-testing-anti-patterns-flag-when-found)
    - [9.5 Missing test escalation](#95-missing-test-escalation)
  - [10) Security review mini-framework (mandatory for high-risk)](#10-security-review-mini-framework-mandatory-for-high-risk)
    - [10.1 Threat summary table (required output)](#101-threat-summary-table-required-output)
    - [10.2 Injection checklist (mechanical)](#102-injection-checklist-mechanical)
    - [10.3 Authorization checklist (mechanical)](#103-authorization-checklist-mechanical)
    - [10.4 Secrets and sensitive data checklist (mechanical)](#104-secrets-and-sensitive-data-checklist-mechanical)
    - [10.5 Cryptography checklist (mechanical)](#105-cryptography-checklist-mechanical)
    - [10.6 Network and external calls checklist (mechanical)](#106-network-and-external-calls-checklist-mechanical)
  - [11) Review depth selection (decision tree)](#11-review-depth-selection-decision-tree)
    - [11.1 Depth selection decision tree](#111-depth-selection-decision-tree)
    - [11.2 Depth escalation triggers](#112-depth-escalation-triggers)
    - [11.3 Review depth output requirement](#113-review-depth-output-requirement)
  - [12) Reviewer output expectations (format + completeness)](#12-reviewer-output-expectations-format--completeness)
    - [Required sections](#required-sections)
    - [12.2 Residual risk population rules (mandatory)](#122-residual-risk-population-rules-mandatory)
    - [Report storage](#report-storage)
      - [Directory structure](#directory-structure)
      - [Path components](#path-components)
      - [Scope labels](#scope-labels)
      - [One-file-per-agent rule](#one-file-per-agent-rule)
      - [Session manifest (mandatory)](#session-manifest-mandatory)
      - [Manifest update protocol](#manifest-update-protocol)
      - [Example: multi-level agent tree](#example-multi-level-agent-tree)
      - [Chat output](#chat-output)
  - [13) Templates (copy/paste)](#13-templates-copypaste)
    - [13.1 Findings template](#131-findings-template)
    - [13.2 AI reviewer usage](#132-ai-reviewer-usage)
  - [14) Quick Review Card (one-page cheat sheet)](#14-quick-review-card-one-page-cheat-sheet)
    - [A) 2-minute triage](#a-2-minute-triage)
      - [Stop conditions (immediate escalation to Full Audit)](#stop-conditions-immediate-escalation-to-full-audit)
    - [B) 10-minute "outside-in" scan](#b-10-minute-outside-in-scan)
    - [C) Discussion closure (PRs)](#c-discussion-closure-prs)
      - [CLI helper for unresolved inline threads (GraphQL)](#cli-helper-for-unresolved-inline-threads-graphql)
      - [CLI helper to reply inline (REST)](#cli-helper-to-reply-inline-rest)
    - [D) Findings standard (how to write comments)](#d-findings-standard-how-to-write-comments)
    - [E) Minimal review output template (Quick Review Card)](#e-minimal-review-output-template-quick-review-card)
  - [⚠️ END OF DOCUMENT — FINAL PROTOCOL REMINDER](#️-end-of-document--final-protocol-reminder)

---

## 0) How to use this guide (humans and AI reviewers)

**Cross-references**: This section is referenced by §Protocol Integrity. It references §3 (Discovery), §4 (Workflow), §12 (Output), §13 (Templates). You SHALL verify compliance with all referenced sections.

This document is the review standard. You SHALL use it as the operating instructions for any reviewer (human or AI). You SHALL NOT treat any single section as a standalone "paste this prompt" block that replaces the rest of the file.

### If you use an AI reviewer

#### Inputs to provide (minimum)

The invoker **SHALL** provide:

- The diff/patch (or repo + branch/commit range)
- PR description / acceptance criteria (or issue link)
- Any repo-specific constraints already known (build/test commands, rollout/migration rules, security model)

#### Procedure (what the AI SHALL do)

**You SHALL execute the following steps in order. You SHALL NOT skip steps. You SHALL NOT reorder steps. IF you cannot complete a step, THEN you SHALL document why and add it to residual risk per §12.2.**

1. **Fresh eyes pass** — You SHALL follow §4 Round −1. You SHALL read through the entire change and record your unfiltered observations before applying any checklists. (Cross-ref: §4 Round −1 checkpoint)

2. **Repo discovery** — You SHALL follow §3 and identify the repo's authoritative rules (docs, contracts, CI gates). (Cross-ref: §3.3 enforcement rules)

3. **Round 0 triage** — You SHALL follow §4 Round 0 and state intent, risk level, and contract surfaces touched. (Cross-ref: §11 depth selection)

4. **Round 1 diff review** — You SHALL follow §4 Round 1; You SHALL apply §1 (evidence) + §2 (severity rubric); You SHALL produce BLOCKER/MAJOR/MINOR/NIT findings using the template from §13.1. (Cross-ref: §5, §6, §7 checklists)

5. **Round 2 requirements trace** — WHEN PR/issue context is available (or discoverable via `git`/`gh`), THEN you SHALL follow §4 Round 2. (Cross-ref: §4 requirements traceability)

6. **Round 3 discussion closure (PRs)** — WHEN reviewing a PR, THEN you SHALL follow §4 Round 3 and ensure review threads are actually resolved (or explicitly deferred with tracking). (Cross-ref: §4.3.1-4.3.4)

7. **Verification** — You SHALL use the repo's canonical commands per §4 Round 4 and §12 verification ledger. You SHALL clearly call out what was/wasn't run. (Cross-ref: §12 verification ledger template)

8. **Final sanity check** — You SHALL follow §4 Round 5. You SHALL set aside the checklists and evaluate the change holistically, capturing anything the structured passes overlooked. (Cross-ref: Fresh eyes observations from Round −1)

9. **Output generation** — You SHALL use the template from §13.1 to structure your final report. You SHALL include the verdict per §12. You SHALL populate residual risk per §12.2.

#### Output requirements

**You SHALL produce output that conforms to the following requirements. Non-conforming output is invalid.**

- You SHALL use §12 as the required section list.
- You SHALL use §13.1 as the report skeleton template — copy the template structure exactly.
- For every BLOCKER/MAJOR finding, you SHALL include: location, concrete failure mode, a fix, and a verification step per §1.1.
- You SHALL include a verdict (APPROVE / REQUEST CHANGES / BLOCK) per §12 Required sections.
- You SHALL populate the "Not verified / residual risk" section per §12.2, or explicitly state why it is empty.
- You SHALL deliver the final report per §12 "Report storage".

**Checkpoint (§0 complete)**: Before proceeding to §1, verify:

- [ ] You understand the procedure (steps 1-9 above)
- [ ] You understand the output requirements
- [ ] You know which template to use (§13.1)

#### GitHub CLI note: unresolved inline threads

`gh pr view --comments` does not include inline review threads. To list
unresolved threads via CLI:

```bash
query=$(cat <<'GRAPHQL'
query($owner:String!, $repo:String!, $number:Int!) {
  repository(owner:$owner, name:$repo) {
    pullRequest(number:$number) {
      reviewThreads(first:100) {
        nodes {
          isResolved
          comments(first:10) {
            nodes { author { login } body path line }
          }
        }
      }
    }
  }
}
GRAPHQL
)

gh api graphql \
  -F owner=<owner> \
  -F repo=<repo> \
  -F number=<pr> \
  -f query="$query" \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
```

If you need to **reply inline** from CLI, use the review comment reply endpoint (note the required PR number in the path):

```bash
gh api -X POST /repos/<owner>/<repo>/pulls/<pr_number>/comments/<comment_id>/replies \
  -f body="reply text"
```

GraphQL note: `addPullRequestReviewComment` is deprecated; use `addPullRequestReviewThreadReply` with the thread ID if you need GraphQL-based replies.

---

## 0.1) What this is for

A strong review answers four questions:

1. **Correctness**: Does it meet requirements and handle edge cases (including concurrency and retries)?
2. **Safety**: Does it preserve security, privacy, and reliability (and fail safely)?
3. **Maintainability**: Is it readable, testable, and reasonably simple for future contributors?
4. **Compatibility**: Does it respect published contracts (APIs/schemas/DB) and release/rollout constraints?

---

## 1) Non‑shallow review rules (quality bar)

**Cross-references**: This section is referenced by §0 (Procedure step 4), §4 (all Rounds), §12 (Output). It references §2 (Severity), §12.2 (Residual risk). You SHALL apply these rules throughout the review process.

These rules exist to prevent "checkbox reviews" and ensure the output is verifiable. **You SHALL apply these rules to every finding. You SHALL NOT produce findings that violate these rules.**

### 1.1 Every finding SHALL be anchored

For each **BLOCKER/MAJOR/MINOR** finding, you **SHALL** include:

- **Label**: BLOCKER / MAJOR / MINOR / NIT (per §2 severity rubric)
- **Location**: file path(s) + symbol(s) (function/class/module)
- **What**: the specific behavior or risk
- **Why it matters**: concrete failure mode (security, data loss, outages, regressions, compatibility)
- **Fix**: a concrete suggestion (pseudo‑diff, exact API change, refactor outline)
- **Test/verification**: what test to add or how to validate (unit/integration/e2e, lint rule, migration check)

> IF you cannot point to code and a failure mode, THEN it is not a finding—it is a preference (NIT) or speculation (ask for proof).

### 1.2 Evidence SHALL beat vibes

**You SHALL NOT use vague approval language without evidence.**

→ WHEN review conclusion lacks evidence anchors: you SHALL flag as incomplete.
→ WHEN "looks good" or equivalent appears without citing what was checked: you SHALL flag as **MINOR** (request specifics).

For each review, you **SHALL** explicitly state what was checked:

- [ ] Contracts verified: [list or "none in scope"]
- [ ] Tests verified: [ran / read / not checked]
- [ ] Rollback considered: [yes with plan / not applicable / not checked]
- [ ] Edge cases checked: [list or "none identified"]

### 1.3 Risk SHALL dictate depth

**You SHALL NOT perform a shallow review on high-risk changes.**

IF risk is **high**, THEN a "short review" is not acceptable. High risk includes: auth, permissions, data migrations, payments, concurrency/async, caching, distributed systems, external calls, cryptography, PII/PHI.

→ WHEN high-risk domain is touched AND review uses §14 Quick Card only: you SHALL flag as **MAJOR** (insufficient review depth) and you SHALL escalate to Full Audit per §11.

(Cross-ref: §11 depth selection decision tree)

### 1.4 You SHALL prefer small, composable patches

- WHEN a diff is large AND mixes refactoring with behavior changes: you SHALL flag as **MINOR** (recommend splitting). The goal is reviewability—IF the change is hard to follow because of its size or scope, THEN it should be broken up.
- WHEN refactoring is necessary without characterization tests: you SHALL flag as **MINOR** (request tests or explicit risk acknowledgment).
- WHEN behavior change and refactor are combined in same commit: you SHALL flag as **NIT** (recommend separation) unless explicitly justified in commit message.

### 1.5 Audit discipline (anti false completeness)

**Cross-references**: This section is referenced by §12 (Output), §Protocol Integrity. It references §12.2 (Residual risk population).

This guide assumes you want **audit-style reviews / release-readiness memos by default**.
That means the review **SHALL** be:

- **mechanical** (explicit checks, not vibes),
- **evidence-backed** (claims tied to code/tests/commands),
- **signal-preserving** (critical issues SHALL NOT get buried in narrative).

#### 1.5.1 Evidence standard (hard citations)

**You SHALL provide evidence anchors for all non-trivial claims.**

For any non-trivial claim (especially "safe", "backwards compatible", "migration is safe", "no user-visible change", "idempotent", "race-free"), you **SHALL** include an **evidence anchor** directly under the claim:

- `path/to/file.ext:line` and symbol name(s),
- test name(s) and where they live,
- command(s) run and their outcome (or "not run").

**IF you cannot produce evidence anchors, THEN you SHALL downgrade the statement** to a question or add it to **Not verified / residual risk** per §12.2.

#### 1.5.2 Confidence calibration (required language)

**You SHALL use one of these labels for important conclusions:**

- **Verified**: you ran the relevant check/test and it passed, or you have an objective artifact (CI run, logs).
- **Supported by code reading**: you did not run it, but the logic is clear and backed by tests/docs.
- **Assumed**: you believe it's true but did not verify it (SHALL go in _Not verified_ per §12.2).
- **Unknown**: you cannot determine from the diff/context (SHALL become a question or a requested follow-up).

**You SHALL NOT use absolute phrasing without verification:**

- ❌ "Production-ready." "Safe." "No risk." "Fully addressed."
- ✅ "Verified by …" / "Supported by …" / "Not verified: …"

#### 1.5.3 Signal preservation (anti dilution rules)

**You SHALL structure reports to preserve signal. Critical issues SHALL NOT be buried.**

To prevent "big report, low signal":

- You SHALL put **Verdict + severity counts + Findings Index** near the top.
- You SHALL keep **BLOCKER/MAJOR** sections concise and actionable; move narrative to appendices.
- IF you add "nice-to-have" notes, THEN you SHALL keep them in **MINOR/NIT** and you SHALL NOT mix them into blockers.

#### 1.5.4 Approval discipline (release-readiness mindset)

**You SHALL only use APPROVE when ALL of the following are true:**

- No **BLOCKER/MAJOR** items remain.
- Required verification gates are **run and passing**, or a clearly documented exemption exists.
- Contract/compatibility implications are addressed (versioning, migration plan, rollback).
- Docs/specs are updated or an explicit follow-up is filed (and justified).
- PR discussion threads (including inline) are resolved or explicitly deferred with tracking per §4 Round 3.

**OTHERWISE**, you SHALL use **REQUEST CHANGES** (or **BLOCK** if invariants/contracts are violated).

**Checkpoint (§1 complete)**: Before proceeding to §2, verify:

- [ ] You understand evidence anchoring requirements (§1.1, §1.5.1)
- [ ] You understand confidence calibration language (§1.5.2)
- [ ] You understand approval criteria (§1.5.4)

---

## 2) Severity rubric (required)

**Cross-references**: This section is referenced by §0 (Procedure step 4), §1 (all findings), §4 (Rounds), §12 (Output), §13 (Templates). You SHALL use these severity labels for all findings.

**You SHALL classify every finding using exactly one of these labels:**

|       Label | Meaning                                                                                                                             | Merge impact           |
| ----------: | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **BLOCKER** | Violates an invariant/contract, introduces a security vulnerability, data corruption risk, or makes the system unreliable.          | SHALL fix before merge |
|   **MAJOR** | Breaks compatibility, introduces nondeterminism, meaningfully degrades security posture, or lacks critical tests for risky changes. | SHALL fix before merge |
|   **MINOR** | Improves clarity, coverage, maintainability; non‑blocking but recommended.                                                          | SHOULD fix             |
|     **NIT** | Cosmetic or preference‑level suggestions with low impact.                                                                           | MAY fix (optional)     |

**Rule**: For **BLOCKER/MAJOR**, you SHALL always include a concrete fix + verification step per §1.1, and you SHALL name the protected constraint (contract, invariant, trust boundary, migration rule, etc.).

**Checkpoint (§2 complete)**: Before proceeding to §3, verify:

- [ ] You know the four severity levels and their meanings
- [ ] You know that BLOCKER/MAJOR require fix + verification + constraint name

---

## 3) Repository contract & workflow discovery (mandatory first step)

**Cross-references**: This section is referenced by §0 (Procedure step 2), §4 (Round 0), §11 (Depth selection). It references §12.2 (Residual risk). You SHALL complete this section before beginning the review workflow in §4.

**You SHALL establish the repo's rules before reviewing logic. You SHALL NOT recommend changes that violate repo rules you failed to discover.**

### 3.1 You SHALL read the repo's instruction set (in priority order if present)

You **SHALL** check for and read the following (in priority order if present):

- `README.md` / "Getting Started"
- `CONTRIBUTING.md`, `CODEOWNERS`, `SECURITY.md`, `CONSTITUTION.md` (or equivalent)
- Any "agent instruction" files: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `QWEN.md`, `CODEX.md`, `.cursorrules`, `.github/copilot-instructions.md`
- Architecture/spec docs: `docs/`, `context/`, `adr/`, `design/`, `spec/`, `prd/`, `rfcs/`
- Contract artifacts: `openapi.*`, `schemas/`, `proto/`, `graphql/`, `contracts/`, `api/`
- Operational/deploy docs: `runbooks/`, `deploy/`, `helm/`, `terraform/`, `.github/workflows/` (or CI equivalents)

### 3.2 You SHALL populate the Repo Snapshot during discovery

**You SHALL fill in this table at the top of your review IF it isn't already obvious from the PR description.**

| Field                                  | Notes                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Primary runtime(s)**                 | service / CLI / UI / library / worker / cron                                                                      |
| **State source of truth**              | DB tables / event log / files / external system (be explicit)                                                     |
| **Write ownership rules**              | who is allowed to write state; where writes are allowed; any "single writer" or "no direct DB writes" constraints |
| **Contract surfaces**                  | APIs / schemas / DB migrations / CLI output / config formats / events / file formats                              |
| **Compatibility promises**             | semver, stability guarantees, deprecation policy, forward/backward compatibility requirements                     |
| **Security model**                     | authn/authz approach; policy gates; audit logging; secret handling; multi-tenant isolation rules                  |
| **Side-effect policy**                 | network rules; allowlists/deny-lists; subprocess rules; filesystem rules; sandbox/trust tiers                     |
| **Determinism requirements**           | stable ordering; replay/rebuild; reproducible builds; "no hidden state" rules                                     |
| **Release/rollout rules**              | feature flags, staged rollout, canary strategy, rollback expectations, migration sequencing                       |
| **Canonical build/lint/test commands** | copy from docs/CI (you SHALL NOT invent new ones)                                                                 |
| **Required tooling gates**             | format/lint/tests/security scans/benchmarks required to merge                                                     |
| **Report storage convention**          | where code review reports (if any) are saved; naming rules                                                        |

> IF the repo's invariant rules are unclear or missing, THEN you SHALL treat it as a **process risk** and you SHALL recommend documenting them—especially for state ownership, security boundaries, contract evolution, async/delivery semantics, and rollout/migration rules.

### 3.3 Discovery enforcement rules (mechanical)

**You SHALL verify discovery was performed and you SHALL flag gaps using these rules:**

- [ ] **Discovery evidence**: You SHALL cite at least one authoritative doc read (e.g., `README.md`, `CONTRIBUTING.md`, or agent instruction file).
      → IF no authoritative doc exists in repo: you SHALL flag as **MINOR** (recommend creating one).
      → Evidence: doc path read + summary of key constraints found.
- [ ] **Repo Snapshot populated**: WHEN reviewing for the first time (or after major changes), you SHALL verify the Repo Snapshot table (§3.2) is filled.
      → IF critical fields are "unknown" (security model, contract surfaces, state source of truth): you SHALL flag as **MINOR** and add to residual risk per §12.2.
      → Evidence: completed Repo Snapshot in report.
- [ ] **High-risk domain docs**: WHEN the change touches auth, payments, migrations, or PII, you SHALL verify a relevant security/contract doc exists.
      → IF high-risk domain touched without documented rules: you SHALL flag as **MAJOR** (process gap).
      → Evidence: doc path OR "not found" + recommendation.

**Checkpoint (§3 complete)**: Before proceeding to §4, verify:

- [ ] You have read at least one authoritative doc (or documented its absence)
- [ ] You have populated the Repo Snapshot (or know why it's N/A)
- [ ] IF high-risk domain, THEN you have verified relevant docs exist

---

## 4) Review workflow (multi‑pass, with required coverage)

**Cross-references**: This section is referenced by §0 (Procedure), §Protocol Integrity, §11 (Depth selection), §12 (Output). It references §1 (Evidence), §2 (Severity), §3 (Discovery), §5-§10 (Checklists), §13 (Templates). You SHALL execute ALL Rounds in order.

**You SHALL execute Rounds −1 through 5 in order. You SHALL NOT skip Rounds. You SHALL NOT reorder Rounds. IF you cannot complete a Round, THEN you SHALL document why in your report and add it to residual risk per §12.2.**

### Round −1 — Fresh eyes (mandatory)

**Cross-references**: This Round is referenced by Round 5 (Final sanity check). Output goes to §13.1 template "Fresh eyes observations" section.

**You SHALL complete this round before applying any checklists.**

Before applying any checklists or structured analysis, you SHALL read through the entire change and record your unfiltered observations. This phase captures intuitive signals that mechanical passes often miss.

**You SHALL NOT consult the checklists in this document during this round.** Simply read the code and write down whatever you notice—confusion, complexity, things that feel off, questions that arise, patterns that seem unusual, or anything else that catches your attention.

You SHALL record these observations in the "Fresh eyes observations" section of your report per §13.1. After completing all subsequent rounds, you SHALL revisit this list per Round 5 to ensure nothing was lost in the structured analysis.

**Checkpoint (Round −1 complete)**: Before proceeding to Round 0, verify:

- [ ] You have read the entire change without consulting checklists
- [ ] You have recorded observations in the "Fresh eyes observations" section per §13.1
- [ ] You have noted any intuitive concerns (these will be revisited in Round 5)

---

### Round 0 — Triage & intent (mandatory)

**Cross-references**: This Round references §3 (Discovery), §11 (Depth selection). Output goes to §13.1 template "Executive summary" section.

You **SHALL** read the PR description (or commit message/branch name if no PR).

You **SHALL** identify and document:

- **Intent**: what user/system behavior changes?
- **Risk level**: low / medium / high (you SHALL justify briefly)
- **Affected domains**: API, storage, security, concurrency/async, UI, tooling, infra, etc.
- **Contract surfaces touched**: APIs/schemas/DB/migrations/CLI outputs/event formats/config

#### Quick triage checks

You **SHALL** answer these questions:

- Does the diff include contract files (schemas, API specs, migrations)?
- Are there new dependencies or permissions/capabilities?
- Are there new side effects (network/file/subprocess)?
- Is there any "silent behavior change" risk (defaults, ordering, parsing)?
- Is there new async/distributed behavior (queues, jobs, retries, event handlers, background tasks)?

#### Change inventory (required for audit-style reviews)

**You SHALL add an explicit inventory section in the report before deep findings, using the Change inventory template from §13.1:**

- **Diffstat**: number of files + approximate LOC churn (use `git diff --stat` / `--numstat`).
- **Files touched**: list files grouped by _domain_ (contracts, storage, security, UI, infra).
- **Contract surfaces**: call out exactly what is public/stable (schemas/APIs/CLI outputs/DB migrations).
- **Dependency/capability delta**: new deps, new permissions, new network/file/subprocess use.
- **Data/migration delta**: migrations, backfills, irreversible steps, mixed-version considerations.

This prevents missing "small-looking" but high-risk surfaces.

#### Commit hygiene (required)

Even without reformatting the PR, you **SHALL** check:

- Are commits logically separated (refactor vs behavior)?
- Does each commit build/test (or at least not obviously break invariants)?
- Are there "fixup" commits that hide unfinished work?

IF the commit structure increases audit risk, THEN you SHALL flag it as **MINOR** (or **MAJOR** if it blocks understanding/verification).

**Checkpoint (Round 0 complete)**: Before proceeding to Round 1, verify:

- [ ] Intent, risk level, and affected domains are documented per §13.1 template
- [ ] Change inventory is populated (or marked N/A with justification)
- [ ] Review depth is selected per §11 and stated in report

---

### Round 1 — Diff review (mandatory)

**Cross-references**: This Round references §1 (Evidence), §2 (Severity), §5-§7 (Checklists). Output goes to §13.1 template "Findings" sections.

**You SHALL review from outside‑in, in this order:**

1. **Contracts & boundaries**: schemas, API routes, CLI flags, public interfaces (see §7.A)
2. **State & persistence**: data model changes, migrations, idempotency, ordering (see §7.B)
3. **Core logic**: correctness, edge cases, error handling, determinism (see §5, §6.1-§6.3)
4. **Security**: authz/authn, validation, secrets, logging, external calls (see §6.4, §10)
5. **Async/distributed behavior**: retries, ordering, idempotency, cancellation, backpressure (see §6.9, §7.C)
6. **Tests & docs**: coverage, hermeticity, spec/runbook updates (see §9)

#### "Play computer" checklist

**You SHALL trace through these scenarios:**

- How does data enter?
- What validation is performed at the boundary?
- What is the state read/write path?
- What happens on:
  - invalid input
  - partial failure
  - retry / duplicate message / retry storms
  - concurrency (two requests at once; two workers at once)
  - timeouts / cancellations
  - mixed-version deployments (old/new processes running together)

**For each issue found, you SHALL classify per §2 and document per §1.1.**

**Checkpoint (Round 1 complete)**: Before proceeding to Round 2, verify:

- [ ] All six review areas have been examined (or marked N/A with justification)
- [ ] Findings are classified with severity per §2
- [ ] Findings include evidence anchors per §1.1

---

### Round 2 — Requirements trace (mandatory when possible)

**Cross-references**: This Round references §0 (Procedure step 5). Output goes to §13.1 template "Requirements traceability" section.

WHEN PR/issue context wasn't provided, THEN you SHALL attempt discovery and then re‑review against requirements.

#### Using `git` (works anywhere)

You **SHALL** use these commands to gather context:

```bash
git status
git diff
git log --oneline --decorate -n 50
git branch --show-current
git show -1
```

#### Using GitHub CLI (`gh`) when available

WHEN `gh` is available, THEN you **SHALL** also use:

```bash
gh repo view
gh pr status
gh pr list --limit 20
gh issue list --limit 20
gh pr view <PR_NUMBER> --json title,body,labels,files,comments,reviews
gh issue view <ISSUE_NUMBER> --json title,body,labels,comments
```

#### If a PR exists, you SHALL also review

- PR template checkboxes (if any)
- linked issues / acceptance criteria
- commit history for "fixup" signs of unresolved work
- labels indicating rollout/security/migration requirements

#### Re‑review questions

You **SHALL** verify:

- Does the diff fully address acceptance criteria?
- Are there "TODOs" that should be tracked as explicit follow‑ups?
- Is anything solved only partially (happy path only; missing rollback; missing authz)?
- Are there scope creeps that increase risk without payoff?
- Are non-functional requirements met (latency, resource limits, reliability, auditability)?
- For async/distributed systems: are delivery semantics and retries correctly handled?

#### Requirements traceability (audit requirement)

WHEN PR/issue acceptance criteria exist, THEN you **SHALL** include a **traceability matrix** in the report using the template from §13.1:

- each acceptance criterion / requirement,
- status (Met / Partially / Not met / Not in scope),
- evidence anchors (code + tests + docs),
- follow-ups (issue/task) for anything deferred.

**Checkpoint (Round 2 complete)**: Before proceeding to Round 3, verify:

- [ ] Requirements/acceptance criteria have been identified (or documented as not available)
- [ ] Traceability matrix is populated per §13.1 template (or marked N/A with justification)
- [ ] Gaps between requirements and implementation are flagged

---

### Round 3 — Discussion & unresolved thread closure (mandatory for PRs)

**Cross-references**: This Round is referenced by §1.5.4 (Approval discipline). Output goes to §13.1 template "PR discussion / unresolved threads" section.

**WHEN reviewing a PR, THEN you SHALL complete this Round. A PR is not "done" until the discussion state matches the code.**

#### 4.3.1 Review threads: are we done?

You **SHALL** read all PR **comments and review threads**.

You **SHALL** confirm:

- Are any threads **unresolved**?
- Were requested changes implemented?
- Were any reviewer questions answered with sufficient evidence?
- IF something wasn't changed, THEN is the rationale explicit and acceptable?
- Are follow-ups tracked (issue/task) WHEN work is deferred?

#### 4.3.2 How to find unresolved conversations (especially inline review threads)

**Important**: `gh pr view <number> --comments` does **not** include inline review threads.

- **Option A (recommended)**: check the PR on GitHub's UI and filter for unresolved threads.
- **Option B (CLI, PR comments only)**:

  ```bash
  gh pr view <number> --comments
  ```

- **Option C (CLI, unresolved inline review threads via GraphQL)**:

  ```bash
  gh api graphql \
    -F owner=<owner> \
    -F repo=<repo> \
    -F number=<pr> \
    -f query='query($owner:String!, $repo:String!, $number:Int!) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:100) { nodes { isResolved comments(first:10) { nodes { author { login } body path line } } } } } } }' \
    --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
  ```

  Notes:

  - `first:100` and `comments(first:10)` are limits; IF you have more, THEN add pagination.
  - You SHALL use the output to confirm every unresolved thread is either addressed in code or explicitly resolved/deferred with rationale.

#### 4.3.3 Responding to PR feedback (thread hygiene)

**These rules apply to both authors and reviewers; they prevent "lost" decisions.**

- You SHALL reply in the **same thread** as the feedback (avoid new top-level comments unless summarizing).
- You SHALL **resolve conversations** only WHEN the feedback is addressed (code changed, question answered, or decision recorded).
- You SHALL NOT resolve a conversation IF you still need input—reply and explicitly tag/request follow-up from the reviewer.
- WHEN you must reply inline via CLI, THEN you SHALL use:

  ```bash
  gh api -X POST /repos/<owner>/<repo>/pulls/<pr_number>/comments/<comment_id>/replies \
    -f body="reply text"
  ```

  (GraphQL `addPullRequestReviewComment` is deprecated; prefer `addPullRequestReviewThreadReply`.)

- WHEN pushing changes in response to feedback, THEN you SHALL:
  - summarize what changed and where,
  - call out what remains unchanged and why (if applicable),
  - re-request review IF required by repo workflow.

#### 4.3.4 Review drift & merge gates

You **SHALL** check for **review drift**:

- Did the diff change after earlier reviews—did it introduce new risks?
- Were earlier approvals invalidated by later commits?
- Did new commits touch unreviewed areas?

You **SHALL** verify all required checks:

- CI status (tests/lint/security scans)
- required reviewers/code owners
- release notes or migration notes IF required
- compliance requirements (if any) satisfied

**Checkpoint (Round 3 complete)**: Before proceeding to Round 4, verify:

- [ ] All unresolved threads are documented in the "PR discussion / unresolved threads" section per §13.1
- [ ] Each unresolved thread has a disposition (addressed / deferred with tracking / unresolved)
- [ ] Review drift has been checked

---

### Round 4 — Verification (mandatory for high risk; required for standard reviews when commands available)

**Cross-references**: This Round is referenced by §0 (Procedure step 7), §11 (Depth selection). Output goes to §13.1 template "Verification ledger" section.

**You SHALL use the repo's canonical commands (from docs/CI) and confirm outcomes.**

→ WHEN high-risk domain is touched AND verification not run: you SHALL flag as **MAJOR** (add to residual risk per §12.2 with justification).
→ WHEN verification commands are available but not run for any review: you SHALL add to residual risk section per §12.2.

**You SHALL run all applicable verification gates:**

- format
- lint/static analysis
- unit tests
- integration/e2e tests (WHEN behavior spans components)
- security scans (SAST/SCA/secret scanning)
- build artifacts (packages, containers, bundles)
- migrations (apply on representative data; rollback IF supported/required)
- performance/benchmarks (WHEN perf-sensitive)
- async/distributed validation (consumer replay, idempotency tests, retry behavior) WHEN applicable

IF you cannot run them, THEN your review **SHALL** still:

- name what _should_ be run, and
- call out gaps (e.g., "migration not tested", "no coverage for authz denial path", "retry behavior not tested") in residual risk per §12.2.

#### Verification artifacts (audit requirement)

**For each gate/check you claim passed, you SHALL record at least one of:**

- the command used,
- the environment/source (local vs CI),
- the result (pass/fail),
- and (WHEN available) a stable pointer (test name(s), log snippet, CI job name).

**You SHALL use the Verification ledger template from §13.1 to record this information.**

**Checkpoint (Round 4 complete)**: Before proceeding to Round 5, verify:

- [ ] Verification ledger is populated per §13.1 template
- [ ] Each gate has command, result, and evidence documented
- [ ] What was NOT run is documented with justification in residual risk per §12.2

---

### Round 5 — Final sanity check (mandatory)

**Cross-references**: This Round references Round −1 (Fresh eyes). Output goes to §13.1 template "Final sanity check" section. This Round is referenced by §Protocol Integrity and §0 (Procedure step 8).

**You SHALL complete this Round before finalizing your review.**

After completing all structured rounds, you SHALL set aside the checklists and evaluate the change holistically.

This round exists because mechanical analysis can miss the forest for the trees. A change may pass every checklist item yet still be fundamentally flawed in a way no checkbox anticipated.

**You SHALL:**

1. Revisit your Round −1 observations and confirm each was either addressed by the structured passes or is now captured as a finding.
2. Ask yourself whether this change, taken as a whole, is something you would be comfortable deploying.
3. IF something still feels wrong but you cannot articulate a specific checklist violation, THEN you SHALL record it anyway—unexplained discomfort is a signal worth preserving.

**Checkpoint (Round 5 complete / All Rounds complete)**: Before finalizing output, verify:

- [ ] All Round −1 observations have been addressed or captured as findings
- [ ] Holistic assessment is recorded in "Final sanity check" section per §13.1
- [ ] Any unexplained concerns are documented
- [ ] **ALL prior Round checkpoints have been completed**

**FINAL VALIDATION GATE (per §Protocol Integrity)**: Before producing output, you SHALL verify:

- [ ] All Rounds (−1 through 5) are documented or explicitly marked N/A with justification
- [ ] Verdict is stated (APPROVE / REQUEST CHANGES / BLOCK) per §12
- [ ] Severity counts are included (BLOCKER/MAJOR/MINOR/NIT)
- [ ] Template structure from §13.1 is followed
- [ ] Residual risk section is populated per §12.2 or explicitly cleared with justification

IF any validation fails, THEN you SHALL NOT proceed to output. You SHALL return to the incomplete section and complete it.

---

## 5) Core engineering principles (mechanical checks)

**Cross-references**: This section is referenced by §4 Round 1. It references §1 (Evidence), §2 (Severity). You SHALL apply these checks during Round 1 diff review.

For each principle, you **SHALL** apply the associated checklist and produce evidence anchors per §1.5.1. IF a violation is found, THEN you **SHALL** flag it with the indicated severity per §2.

---

### 5.1 KISS — Keep It Simple

WHEN reviewing for simplicity, you **SHALL** verify:

- [ ] **Abstraction justification**: WHEN a new abstraction (class, interface, wrapper, factory) is introduced in the diff, you SHALL cite at least two distinct call sites OR a documented extension point.
      → IF fewer than two exist: you SHALL flag as **MINOR** (premature abstraction). Evidence: `file:line` of abstraction + call sites.
- [ ] **Indirection depth**: WHEN a function call chain exceeds 3 hops before reaching business logic, you SHALL cite the chain and justify why intermediate layers are necessary.
      → IF unjustified: you SHALL flag as **MINOR**. Evidence: call chain `A() → B() → C() → D()` with file:line for each.
- [ ] **Configuration surface**: WHEN new config options are added, you SHALL verify each option has a documented use case or existing consumer.
      → IF undocumented/unused: you SHALL flag as **NIT**. Evidence: config key + usage location(s).

---

### 5.2 DRY — Don't Repeat Yourself

WHEN reviewing for duplication, you **SHALL** verify:

- [ ] **Logic duplication**: WHEN similar logic appears in multiple locations within the diff or across the repo, you SHALL cite all locations. Use judgment for what constitutes "meaningful" duplication—trivial boilerplate may be acceptable, but business logic SHALL NOT be repeated.
      → IF duplicated without justification: you SHALL flag as **MINOR** (same-bug-twice risk). Evidence: `file1:line` and `file2:line` with description of duplicated logic.
- [ ] **Rule duplication**: WHEN validation rules, business constraints, or formatting logic are defined in multiple places, you SHALL cite all locations.
      → IF duplicated: you SHALL flag as **MINOR**. Evidence: locations + which rule is duplicated.
- [ ] **Constant duplication**: WHEN magic numbers or strings appear in multiple locations, you SHALL cite all occurrences.
      → IF >2 occurrences without named constant: you SHALL flag as **NIT**. Evidence: value + locations.

---

### 5.3 YAGNI — You Aren't Gonna Need It

WHEN reviewing for speculative generality, you **SHALL** verify:

- [ ] **Unused parameters/options**: WHEN new function parameters, config options, or feature flags are added, you SHALL verify each has at least one active use in the diff or existing codebase.
      → IF unused: you SHALL flag as **MINOR**. Evidence: parameter/option name + grep showing zero usages.
- [ ] **Premature interfaces**: WHEN an interface/protocol/trait is introduced with only one implementation, you SHALL cite the implementation.
      → IF single implementation and no documented extension plan: you SHALL flag as **NIT**. Evidence: interface at `file:line`, sole implementer at `file:line`.
- [ ] **Over-parameterization**: WHEN a function has >5 parameters or a config object has >10 options, you SHALL verify each is actively used.
      → IF >20% unused: you SHALL flag as **MINOR**. Evidence: parameter list + usage counts.

---

### 5.4 SOLID principles (mechanical checks)

#### Single Responsibility

- [ ] **Responsibility count**: WHEN a class/module has methods spanning >3 distinct concerns (e.g., I/O + parsing + business logic + formatting), you SHALL cite the method groups.
      → IF >3 concerns: you SHALL flag as **MINOR** (split candidate). Evidence: `file:line` + list of concern groupings.

#### Open/Closed

- [ ] **Modification vs extension**: WHEN existing stable code is modified (not extended) to add new behavior, you SHALL verify no safer extension point exists.
      → IF modification was avoidable via existing extension mechanism: you SHALL flag as **MINOR**. Evidence: modified code at `file:line` + alternative extension point.

#### Liskov Substitution

- [ ] **Override behavior preservation**: WHEN a method is overridden, you SHALL verify the override does not violate the base contract (preconditions not strengthened, postconditions not weakened).
      → IF contract violated: you SHALL flag as **MAJOR**. Evidence: base method at `file:line`, override at `file:line`, contract difference.

#### Interface Segregation

- [ ] **Interface size**: WHEN an interface has many methods, you SHALL verify all implementers use all methods. Large interfaces with partial implementations suggest the interface should be split.
      → IF implementers leave methods as no-op/stub: you SHALL flag as **MINOR** (split candidate). Evidence: interface at `file:line`, stub implementations.

#### Dependency Inversion

- [ ] **Concrete dependencies at boundaries**: WHEN a module directly instantiates external dependencies (DB clients, HTTP clients, file handles) inline rather than accepting them as parameters, you SHALL cite the instantiation.
      → IF inline instantiation blocks testing: you SHALL flag as **MINOR**. Evidence: instantiation at `file:line`.

---

### 5.5 Law of Demeter (Least Knowledge)

WHEN reviewing for coupling, you **SHALL** verify:

- [ ] **Chain length**: WHEN method chains exceed 2 dots (e.g., `a.b().c().d()`), you SHALL cite the chain and verify intermediate objects are not implementation details.
      → IF chain exposes internals: you SHALL flag as **MINOR**. Evidence: chain at `file:line` + which object is leaked.
- [ ] **Friend access**: WHEN code accesses fields/methods of an object obtained from another object's return value, you SHALL verify this is part of the public contract.
      → IF accessing internal structure: you SHALL flag as **MINOR**. Evidence: access pattern at `file:line`.

---

### 5.6 Make Illegal States Unrepresentable

WHEN reviewing for type safety, you **SHALL** verify:

- [ ] **Stringly-typed data**: WHEN a string is used where an enum, newtype, or validated wrapper would prevent invalid values, you SHALL cite the usage.
      → IF invalid values are possible at runtime: you SHALL flag as **MINOR**. Evidence: string usage at `file:line` + example invalid value.
- [ ] **Optional misuse**: WHEN null/None/undefined is used to represent a domain state (e.g., "not started" vs "failed"), you SHALL verify explicit state types would be clearer.
      → IF null has multiple meanings: you SHALL flag as **MINOR**. Evidence: null check at `file:line` + ambiguous interpretations.
- [ ] **Constructor validation**: WHEN a type has invariants, you SHALL verify the constructor/factory enforces them.
      → IF invariants can be violated post-construction: you SHALL flag as **MAJOR**. Evidence: type at `file:line` + bypass path.

---

### 5.7 Functional Core / Imperative Shell

WHEN reviewing for side-effect isolation, you **SHALL** verify:

- [ ] **I/O in business logic**: WHEN business logic functions directly perform I/O (DB calls, network, file access), you SHALL cite the I/O operation.
      → IF I/O is mixed with business logic and blocks unit testing: you SHALL flag as **MINOR**. Evidence: I/O call at `file:line` within business function.
- [ ] **Pure function testability**: WHEN a function could be pure but isn't (due to hidden I/O or global state), you SHALL cite the impurity.
      → IF impurity is avoidable: you SHALL flag as **NIT**. Evidence: impure operation at `file:line`.

---

### 5.8 Fail Fast vs Fail Safe

WHEN reviewing error handling, you **SHALL** verify:

- [ ] **Invariant violations**: WHEN programmer errors or invariant violations are caught, you SHALL verify they fail fast (throw/panic/assert) rather than returning error values.
      → IF invariant violation is silently handled: you SHALL flag as **MAJOR**. Evidence: catch/handle at `file:line` + invariant description.
- [ ] **User input handling**: WHEN user input or external data causes errors, you SHALL verify the error is graceful (clear message, no crash, no data corruption).
      → IF user input causes crash or corruption: you SHALL flag as **BLOCKER**. Evidence: error path at `file:line` + failure behavior.

---

### 5.9 Principle of Least Privilege

WHEN reviewing permissions/capabilities, you **SHALL** verify:

- [ ] **Permission scope**: WHEN code requests permissions (file access, network, admin rights), you SHALL verify it requests the minimum necessary.
      → IF broader permissions than needed: you SHALL flag as **MINOR**. Evidence: permission request at `file:line` + narrower alternative.
- [ ] **Credential scope**: WHEN credentials/tokens are used, you SHALL verify they have the minimum required scope.
      → IF over-scoped credentials: you SHALL flag as **MAJOR**. Evidence: credential usage at `file:line` + scope.

---

### 5.10 Robustness with Precision

WHEN reviewing input handling, you **SHALL** verify:

- [ ] **Unknown field policy**: WHEN parsing external input, you SHALL verify unknown fields are either explicitly rejected OR explicitly ignored with documentation.
      → IF silently accepted without policy: you SHALL flag as **MINOR**. Evidence: parser at `file:line` + test proving behavior.
- [ ] **Type coercion**: WHEN input types are coerced (string→number, etc.), you SHALL verify coercion rules are explicit and tested.
      → IF implicit coercion can cause data loss: you SHALL flag as **MAJOR**. Evidence: coercion at `file:line` + example lossy input.

---

### 5.11 Consistency over cleverness

WHEN reviewing for consistency, you **SHALL** verify:

- [ ] **Pattern divergence**: WHEN the diff introduces a pattern different from existing repo conventions, you SHALL cite both the new pattern and the existing convention.
      → IF divergence is unjustified: you SHALL flag as **MINOR**. Evidence: new pattern at `file:line` + existing pattern at `file:line` + justification (or lack thereof).
- [ ] **Naming conventions**: WHEN new names diverge from repo naming conventions, you SHALL cite the divergence.
      → IF unjustified: you SHALL flag as **NIT**. Evidence: new name + convention + examples of convention usage.

---

## 6) Universal checklist (deep, apply to every change)

**Cross-references**: This section is referenced by §4 Round 1, §14 (Quick Card). It references §1 (Evidence), §2 (Severity), §10 (Security). You SHALL apply these checks during Round 1 diff review.

For each checklist item, you **SHALL** either cite evidence of compliance OR flag the issue with severity per §2. Items marked "N/A" require brief justification.

### 6.1 Correctness & edge cases

- [ ] **Boundary validation**: WHEN input is accepted, you SHALL verify validation exists for types, ranges, formats, and length limits.
      → Evidence: validation code at `file:line` + test name proving rejection of invalid input.
      → IF missing: you SHALL flag as **MAJOR**.
- [ ] **Empty/null handling**: WHEN code processes optional or nullable values, you SHALL verify behavior is intentional (explicit check, not accidental null propagation).
      → Evidence: null check at `file:line` OR type proving non-null.
      → IF accidental: you SHALL flag as **MAJOR**.
- [ ] **Idempotency**: WHEN operation can be retried or duplicated, you SHALL verify repeated execution produces same result.
      → Evidence: idempotency key usage at `file:line` OR test proving idempotency.
      → IF duplicates cause corruption: you SHALL flag as **BLOCKER**.
- [ ] **Partial failure behavior**: WHEN operation has multiple steps, you SHALL verify rollback/compensation/retry semantics are defined.
      → Evidence: transaction boundary at `file:line` OR error handler with compensation.
      → IF undefined: you SHALL flag as **MAJOR**.
- [ ] **Concurrency safety**: WHEN code modifies shared state, you SHALL verify one of: (a) single-threaded access proven, (b) lock/mutex/atomic at `file:line`, (c) immutable data used.
      → Evidence: synchronization mechanism cited.
      → IF race condition possible: you SHALL flag as **BLOCKER** with failure scenario.
- [ ] **Time handling**: WHEN timestamps are used, you SHALL verify timezone handling, DST transitions, and clock type (monotonic vs wall) are correct.
      → Evidence: timezone-aware type at `file:line` OR explicit UTC normalization.
      → IF ambiguous: you SHALL flag as **MINOR**.
- [ ] **Numeric correctness**: WHEN arithmetic is performed, you SHALL verify overflow/underflow protection, rounding rules, and precision (especially for currency).
      → Evidence: checked arithmetic OR bounds validation at `file:line`.
      → IF overflow possible: you SHALL flag as **MAJOR**.
- [ ] **Error visibility**: WHEN errors are caught, you SHALL verify they are logged/returned/handled (not swallowed silently).
      → Evidence: error handling at `file:line` showing propagation or logging.
      → IF swallowed: you SHALL flag as **MAJOR**.
- [ ] **Resource lifecycle**: WHEN resources are acquired (files, connections, locks), you SHALL verify cleanup occurs in all paths (including error paths).
      → Evidence: cleanup code at `file:line` OR RAII/context manager usage.
      → IF leak possible: you SHALL flag as **MAJOR**.
- [ ] **Branch coverage**: WHEN new conditional paths are added, you SHALL verify each path has intentional behavior (no accidental fallthrough or default).
      → Evidence: test covering each branch OR explicit documentation of default behavior.
      → IF unintentional path exists: you SHALL flag as **MINOR**.

### 6.2 Contracts & compatibility

- [ ] **Interface stability**: WHEN public interfaces are modified, you SHALL verify they are versioned OR the change is backward-compatible.
      → Evidence: version bump in contract file OR compatibility test.
      → IF breaking without version: you SHALL flag as **BLOCKER**.
- [ ] **Breaking change strategy**: WHEN a breaking change is intentional, you SHALL verify deprecation notice, migration path, and timeline are documented.
      → Evidence: deprecation notice at `file:line` OR migration doc.
      → IF undocumented breaking change: you SHALL flag as **MAJOR**.
- [ ] **Unknown field policy**: WHEN parsing external input, you SHALL verify unknown fields are either rejected (strict) OR ignored with explicit documentation.
      → Evidence: test proving unknown field behavior at test name.
      → IF silently accepted without policy: you SHALL flag as **MINOR**.
- [ ] **Default safety**: WHEN default values are defined, you SHALL verify they are safe (fail-closed, not fail-open) and documented.
      → Evidence: default value at `file:line` + documentation.
      → IF unsafe default: you SHALL flag as **MAJOR**.
- [ ] **Error contract stability**: WHEN error responses are returned, you SHALL verify codes/formats are stable and do not leak internal details.
      → Evidence: error format at `file:line` + no stack traces/paths exposed.
      → IF leaky: you SHALL flag as **MINOR** (or **MAJOR** if security-relevant).
- [ ] **Deterministic pagination**: WHEN pagination/sorting is implemented, you SHALL verify ordering is deterministic (stable sort key).
      → Evidence: ORDER BY clause or sort key at `file:line`.
      → IF nondeterministic: you SHALL flag as **MINOR**.
- [ ] **Mixed-version compatibility**: WHEN rolling deploys occur, you SHALL verify new code handles old data and old code handles new data.
      → Evidence: compatibility test OR explicit N-1 compatibility statement.
      → IF incompatible: you SHALL flag as **MAJOR**.
- [ ] **Deprecation tracking**: WHEN features are deprecated, you SHALL verify they are announced with timeline and tracked.
      → Evidence: deprecation notice with date at `file:line`.

### 6.3 Determinism & reproducibility (when outputs persist or are user-visible)

- [ ] **Stable ordering**: WHEN iterating over collections that affect output, you SHALL verify order is deterministic.
      → Evidence: sorted iteration OR stable key at `file:line`.
      → IF nondeterministic iteration affects output: you SHALL flag as **MINOR**.
- [ ] **Time/randomness injection**: WHEN tests use time or randomness, you SHALL verify they are injected/controlled (not real clock/random).
      → Evidence: fake clock or seeded random at `file:line` in tests.
      → IF flaky test risk: you SHALL flag as **MINOR**.
- [ ] **State completeness**: WHEN behavior depends on state, you SHALL verify all required state is explicitly stored or derivable.
      → Evidence: state storage at `file:line`.
      → IF hidden state: you SHALL flag as **MINOR**.
- [ ] **Environment independence**: WHEN outputs are generated, you SHALL verify they do not depend on locale, filesystem order, or CPU architecture.
      → Evidence: explicit locale setting OR test on multiple environments.
      → IF environment-dependent: you SHALL flag as **MINOR**.
- [ ] **Build determinism**: WHEN artifacts are generated, you SHALL verify inputs are pinned and sorting is stable.
      → Evidence: lockfile + deterministic build flag OR reproducibility test.
      → IF nondeterministic build: you SHALL flag as **MINOR**.

### 6.4 Security & privacy (deny-by-default mindset)

**Cross-references**: For high-risk changes, you SHALL apply §10 in full. This section provides quick checks for all changes.

- [ ] **Authentication enforcement**: WHEN protected endpoints exist, you SHALL verify auth check is present.
      → Evidence: auth middleware/decorator at `file:line` + test for unauthenticated denial.
      → IF missing: you SHALL flag as **BLOCKER**.
- [ ] **Authorization correctness**: WHEN resources have ownership, you SHALL verify authz check includes object-level permissions (not just role).
      → Evidence: ownership check at `file:line` + test for wrong-owner denial.
      → IF missing object-level check: you SHALL flag as **BLOCKER**.
- [ ] **Injection prevention**: WHEN user input reaches SQL/shell/template/path, you SHALL verify parameterization or sanitization.
      → Evidence: parameterized query at `file:line` OR sanitization function.
      → IF unsanitized: you SHALL flag as **BLOCKER**.
- [ ] **SSRF protection**: WHEN URLs are constructed from user input, you SHALL verify host validation or allowlist.
      → Evidence: URL validation at `file:line`.
      → IF unvalidated: you SHALL flag as **BLOCKER**.
- [ ] **Path safety**: WHEN file paths are constructed, you SHALL verify normalization and directory restriction.
      → Evidence: path normalization at `file:line` + prefix/chroot check.
      → IF traversal possible: you SHALL flag as **BLOCKER**.
- [ ] **Secret protection**: You SHALL verify secrets/tokens/passwords are not logged, traced, or included in error messages.
      → Evidence: grep of log statements showing no secret variables.
      → IF found: you SHALL flag as **BLOCKER**.
- [ ] **External call limits**: WHEN external calls are made, you SHALL verify timeouts and retry limits are configured.
      → Evidence: timeout config at `file:line` + retry limit.
      → IF unbounded: you SHALL flag as **MAJOR**.
- [ ] **PII minimization**: WHEN PII is collected/stored, you SHALL verify it is minimized and retention/deletion is handled.
      → Evidence: data model showing minimal fields + deletion mechanism.
      → IF excessive PII: you SHALL flag as **MAJOR**.
- [ ] **Crypto hygiene**: WHEN cryptography is used, you SHALL verify established libraries, current algorithms, and secure key storage.
      → Evidence: library import at `file:line` + key storage mechanism.
      → IF custom crypto or deprecated algorithm: you SHALL flag as **BLOCKER**.
- [ ] **Tenant isolation**: WHEN multi-tenant data exists, you SHALL verify queries include tenant filter.
      → Evidence: tenant filter in query at `file:line` + test for cross-tenant denial.
      → IF missing: you SHALL flag as **BLOCKER**.

### 6.5 Reliability & resilience

- [ ] **Bounded retries**: WHEN retries are implemented, you SHALL verify max attempts, backoff, and jitter are configured.
      → Evidence: retry config at `file:line` showing limit + backoff.
      → IF unbounded: you SHALL flag as **MAJOR**.
- [ ] **Idempotency keys**: WHEN external side effects are retried, you SHALL verify idempotency keys are used.
      → Evidence: idempotency key at `file:line`.
      → IF missing for payment/email/webhook: you SHALL flag as **MAJOR**.
- [ ] **Circuit breakers**: WHEN calling critical external dependencies, you SHALL verify circuit breaker or fallback exists.
      → Evidence: circuit breaker config at `file:line` OR fallback logic.
      → IF missing for critical path: you SHALL flag as **MINOR**.
- [ ] **Backpressure handling**: WHEN processing unbounded input (queues, streams), you SHALL verify bounded buffers or rate limiting.
      → Evidence: buffer size or rate limit at `file:line`.
      → IF unbounded: you SHALL flag as **MAJOR**.
- [ ] **Graceful shutdown**: WHEN long-running processes exist, you SHALL verify they handle shutdown signals and complete in-flight work.
      → Evidence: signal handler at `file:line`.
      → IF abrupt termination loses data: you SHALL flag as **MAJOR**.
- [ ] **Degraded mode defaults**: WHEN dependencies fail, you SHALL verify system has safe fallback behavior.
      → Evidence: fallback logic at `file:line` OR timeout with safe default.
      → IF no fallback defined: you SHALL flag as **MINOR**.
- [ ] **Resource limits**: WHEN resources are allocated (memory, connections, threads), you SHALL verify limits are configured.
      → Evidence: limit config at `file:line`.
      → IF unbounded allocation: you SHALL flag as **MAJOR**.

### 6.6 Observability & operability

- [ ] **Structured logging**: WHEN log statements are added, you SHALL verify they use structured format with relevant context.
      → Evidence: structured log call at `file:line` with context fields.
      → IF unstructured in production code: you SHALL flag as **NIT**.
- [ ] **Correlation propagation**: WHEN requests cross service boundaries, you SHALL verify trace/correlation IDs are propagated.
      → Evidence: correlation ID in request context at `file:line`.
      → IF missing for distributed system: you SHALL flag as **MINOR**.
- [ ] **Critical path metrics**: WHEN critical operations are added, you SHALL verify success/failure/latency metrics exist.
      → Evidence: metric emission at `file:line`.
      → IF missing on critical path: you SHALL flag as **MINOR**.
- [ ] **Runbook updates**: WHEN operational behavior changes, you SHALL verify runbooks/alerts are updated.
      → Evidence: runbook update in diff OR follow-up issue filed.
      → IF missing for operational change: you SHALL flag as **MINOR**.
- [ ] **Feature flag safety**: WHEN feature flags are used, you SHALL verify default-off for risky features and kill switch tested.
      → Evidence: flag default at `file:line` + test for disabled behavior.
      → IF default-on for risky feature: you SHALL flag as **MAJOR**.
- [ ] **Error debuggability**: WHEN errors are returned, you SHALL verify they include enough context for debugging without leaking secrets.
      → Evidence: error message format at `file:line`.
      → IF opaque error: you SHALL flag as **NIT**. IF leaky: you SHALL flag as **MAJOR**.
- [ ] **Audit logging**: WHEN security-sensitive actions occur (auth, admin actions, data access), you SHALL verify audit log exists.
      → Evidence: audit log call at `file:line`.
      → IF missing for security action: you SHALL flag as **MAJOR**.

### 6.7 Maintainability & readability

- [ ] **Idiomatic code**: You SHALL verify code follows language/framework conventions established in the repo. This includes standard library usage, error handling patterns, naming conventions, project structure, and common idioms for the language (e.g., Go's explicit error returns, Rust's ownership patterns, Python's context managers).
      → Evidence: comparison to existing patterns at `file:line`.
      → IF non-idiomatic without justification: you SHALL flag as **MINOR**.
- [ ] **Design pattern appropriateness**: WHEN design patterns are used (factory, strategy, observer, etc.), you SHALL verify they solve an actual problem rather than adding ceremony. WHEN patterns are conspicuously absent where they would simplify the code, you SHALL note the opportunity.
      → Evidence: pattern usage at `file:line` + justification or alternative.
      → IF pattern adds complexity without benefit: you SHALL flag as **MINOR**.
      → IF missing pattern would significantly improve clarity: you SHALL flag as **NIT**.
- [ ] **Intention-revealing names**: You SHALL verify names describe what, not how (no `temp`, `data`, `handler2`).
      → Evidence: cite unclear name at `file:line` if found.
      → IF misleading: you SHALL flag as **NIT**.
- [ ] **Function focus**: WHEN functions are notably complex (excessive length, deep nesting, many responsibilities), you SHALL verify the complexity is justified by the problem domain.
      → Evidence: function at `file:line` with description of complexity.
      → IF unjustified complexity: you SHALL flag as **MINOR**.
- [ ] **Dead code removal**: You SHALL verify no unused variables, imports, or commented-out code blocks in diff.
      → Evidence: grep for unused symbols.
      → IF dead code: you SHALL flag as **NIT**.
- [ ] **Duplication avoidance**: You SHALL verify no meaningful logic is duplicated within diff or across repo.
      → Evidence: duplicate locations if found.
      → IF duplicated: you SHALL flag as **MINOR** (see §5.2).
- [ ] **Why-comments**: You SHALL verify comments explain invariants/tradeoffs, not obvious mechanics.
      → Evidence: comment at `file:line` if exemplary or problematic.
      → IF commenting obvious code: you SHALL flag as **NIT**.
- [ ] **Error consistency**: You SHALL verify error types and messages follow repo conventions.
      → Evidence: error format at `file:line` vs convention.
      → IF inconsistent: you SHALL flag as **NIT**.
- [ ] **API documentation**: You SHALL verify public APIs have documentation (docstrings, OpenAPI, etc.).
      → Evidence: documentation at `file:line` OR doc artifact.
      → IF public API undocumented: you SHALL flag as **MINOR**.
- [ ] **Hermetic boundaries**: You SHALL verify code that should be pure (no side effects) remains pure, and side effects are isolated to well-defined boundaries. Business logic should not directly perform I/O; external dependencies should be injectable for testing.
      → Evidence: I/O isolation at `file:line` or dependency injection pattern.
      → IF side effects are scattered throughout business logic: you SHALL flag as **MINOR**.

### 6.8 Dependencies & supply chain

- [ ] **Dependency justification**: WHEN new dependencies are added, you SHALL verify they provide capability not easily implemented in <100 LOC.
      → Evidence: capability description + "Alternatives: [list or 'none viable']".
      → IF dependency adds >1MB or >10 transitive deps for <100 LOC benefit: you SHALL flag as **MINOR**.
- [ ] **Version pinning**: You SHALL verify versions are pinned and lockfiles updated.
      → Evidence: lockfile changes in diff.
      → IF unpinned: you SHALL flag as **MINOR**.
- [ ] **License compliance**: You SHALL verify new dependency licenses comply with project policy.
      → Evidence: license field in package metadata.
      → IF incompatible license: you SHALL flag as **BLOCKER**.
- [ ] **Vulnerability check**: You SHALL verify new dependencies have no known critical vulnerabilities.
      → Evidence: SCA scan result OR advisory check.
      → IF vulnerable: you SHALL flag as **MAJOR** (or **BLOCKER** if exploitable).
- [ ] **Surface minimization**: You SHALL verify heavy dependencies are optional or feature-flagged when possible.
      → Evidence: optional dependency declaration.
      → IF monolithic: you SHALL flag as **NIT**.
- [ ] **Build reproducibility**: You SHALL verify no unpinned downloads or non-deterministic fetches in build.
      → Evidence: pinned URLs or checksums in build config.
      → IF non-reproducible: you SHALL flag as **MINOR**.

### 6.9 Async & concurrency correctness (apply whenever async/workers are involved)

**Cross-references**: This section is referenced by §4 Round 1, §7.C. You SHALL apply these checks WHEN async/workers are involved.

- [ ] **Delivery semantics**: You SHALL verify delivery semantics are explicitly stated (at-most-once / at-least-once / exactly-once with proof) and code matches.
      → Evidence: comment or doc at `file:line` stating semantics + implementation matching.
      → IF unstated: you SHALL flag as **MAJOR**.
- [ ] **Retry safety**: WHEN retries occur, you SHALL verify they do not duplicate side effects.
      → Evidence: idempotency key at `file:line` OR dedupe check OR transactional boundary.
      → IF duplicates possible: you SHALL flag as **BLOCKER**.
- [ ] **Bounded fan-out**: WHEN work is spawned/forked, you SHALL verify concurrency is bounded by semaphore/pool/limit.
      → Evidence: concurrency limit at `file:line`.
      → IF unbounded spawn: you SHALL flag as **MAJOR**.
- [ ] **Explicit backpressure**: WHEN processing streams/queues, you SHALL verify bounded buffers, batching, or rate limiting exist.
      → Evidence: buffer size or batch config at `file:line`.
      → IF unbounded: you SHALL flag as **MAJOR**.
- [ ] **Cancellation handling**: WHEN tasks can be cancelled, you SHALL verify: - tasks stop promptly on cancellation/shutdown signal - resources are cleaned up (locks released, files closed, connections returned)
      → Evidence: cancellation check at `file:line` + cleanup in finally/defer.
      → IF no cancellation support: you SHALL flag as **MAJOR**.
- [ ] **I/O timeouts**: You SHALL verify all external I/O calls have timeouts configured.
      → Evidence: timeout parameter at `file:line`.
      → IF missing timeout: you SHALL flag as **MAJOR**.
- [ ] **Error propagation**: You SHALL verify errors from async tasks are not silently dropped.
      → Evidence: error handler or supervision at `file:line`.
      → IF silent failure: you SHALL flag as **MAJOR**.
- [ ] **Lock safety**: You SHALL verify no locks are held across await/yield points.
      → Evidence: lock scope at `file:line` showing release before await.
      → IF lock held across await: you SHALL flag as **BLOCKER**.
- [ ] **Lock ordering**: WHEN multiple locks are acquired, you SHALL verify consistent ordering to prevent deadlock.
      → Evidence: lock acquisition order documented or verified at `file:line`.
      → IF inconsistent ordering: you SHALL flag as **MAJOR**.
- [ ] **Ordering enforcement**: WHEN ordering matters, you SHALL verify it is enforced (partition key, sequence number, per-entity serialization).
      → Evidence: ordering mechanism at `file:line`.
      → IF ordering assumed but not enforced: you SHALL flag as **MAJOR**.
- [ ] **Event loop safety**: You SHALL verify blocking operations do not run on event loop threads.
      → Evidence: offload to worker pool at `file:line` OR proof of non-blocking.
      → IF blocking on event loop: you SHALL flag as **MAJOR**.
- [ ] **Async context propagation**: You SHALL verify trace/correlation IDs are preserved across async boundaries.
      → Evidence: context propagation at `file:line`.
      → IF lost: you SHALL flag as **MINOR**.

### 6.10 Code quality & refactoring (mechanical detection)

You **SHALL** actively search for these patterns and cite evidence when found:

- [ ] **Duplicated logic**: You SHALL search for meaningfully similar code blocks within diff and related files.
      → IF found: you SHALL flag as **MINOR** with locations `file1:line` and `file2:line`.
- [ ] **High complexity**: You SHALL identify functions with notable complexity—this may manifest as deep nesting, many branches, long length, or high cognitive load. Use judgment rather than rigid thresholds; what matters is whether the complexity is justified.
      → IF found: you SHALL flag as **MINOR** with function at `file:line` + complexity indicator.
- [ ] **Misleading names**: You SHALL identify names that don't match behavior (e.g., `getUser` that modifies state, `isValid` that throws).
      → IF found: you SHALL flag as **NIT** with name at `file:line` + actual behavior.
- [ ] **Unrelated changes**: You SHALL identify refactors or cleanups bundled with behavior changes.
      → IF found: you SHALL flag as **MINOR** (request split) with locations.
- [ ] **Boolean flag explosion**: You SHALL identify functions with >2 boolean parameters controlling behavior.
      → IF found: you SHALL flag as **NIT** with suggestion to use enum/options object at `file:line`.
- [ ] **Deep nesting**: You SHALL identify code with >3 levels of nesting.
      → IF found: you SHALL flag as **NIT** with suggestion for early returns at `file:line`.
- [ ] **Inconsistent error handling**: You SHALL identify mixed patterns (exceptions vs result types vs error codes) within same module.
      → IF found: you SHALL flag as **NIT** with locations showing inconsistency.
- [ ] **Shotgun surgery**: WHEN a change requires edits across many unrelated files for a single concept, you SHALL flag the coupling.
      → IF found: you SHALL flag as **MINOR** with file list.
- [ ] **God object/module**: You SHALL identify classes/modules that are disproportionately large relative to the codebase, or that accumulate unrelated responsibilities.
      → IF found: you SHALL flag as **MINOR** with location + responsibility groupings.

WHEN recommending refactors, you **SHALL**:

- Cite the specific smell at `file:line`
- Propose small, incremental steps
- Require characterization tests before refactoring risky code
- Avoid new abstractions unless ≥2 use cases exist

---

## 7) Change-type checklists (pick what applies)

**Cross-references**: This section is referenced by §4 Round 1, §11 (Depth selection). It references §1 (Evidence), §2 (Severity). You SHALL apply the relevant checklist based on change type.

You SHALL apply the relevant checklist based on change type. For each item, you SHALL cite evidence or flag with severity per §2.

---

### A) Public API / schema / wire contracts

- [ ] **Contract artifacts updated**: WHEN API behavior changes, you SHALL verify OpenAPI/JSON Schema/Proto/GraphQL is updated.
      → Evidence: artifact file + line showing change.
      → IF missing: you SHALL flag as **MAJOR**.
- [ ] **Strict decoding policy**: You SHALL verify unknown field handling is explicit (reject or documented ignore) and type coercion rules are defined.
      → Evidence: schema config at `file:line` + test proving behavior.
      → IF undefined: you SHALL flag as **MINOR**.
- [ ] **Compatibility tested**: WHEN contract changes, you SHALL verify old client/new server and new client/old server compatibility.
      → Evidence: compatibility test name OR explicit N-1/N+1 analysis.
      → IF untested and required: you SHALL flag as **MAJOR**.
- [ ] **Example payloads updated**: WHEN request/response format changes, you SHALL verify docs and fixtures are updated.
      → Evidence: doc/fixture file change in diff.
      → IF missing: you SHALL flag as **MINOR**.
- [ ] **Error model documented**: You SHALL verify error status codes, error codes, and structured fields are documented.
      → Evidence: error documentation at `file:line` OR OpenAPI error schema.
      → IF undocumented: you SHALL flag as **MINOR**.
- [ ] **Versioning respected**: WHEN breaking change, you SHALL verify version is bumped per strategy (semver, endpoint version, schema version).
      → Evidence: version bump in contract file.
      → IF breaking without version bump: you SHALL flag as **BLOCKER**.

#### Concrete contract hardening (recommended)

- [ ] **additionalProperties: false**: For JSON schemas intended to be strict, you SHALL verify this is set.
      → Evidence: schema at `file:line` showing setting.
- [ ] **Unknown field rejection test**: For typed decoders, you SHALL verify test exists proving unknown fields are rejected.
      → Evidence: test name.

---

### B) Storage, migrations, and data model changes

- [ ] **Migration downtime**: You SHALL verify migration can be applied without downtime, OR downtime is explicitly planned and communicated.
      → Evidence: migration script analysis OR deployment plan.
      → IF unknown: you SHALL flag as **MAJOR**.
- [ ] **Large table handling**: WHEN migration touches large tables, you SHALL verify backfill strategy and batching exist.
      → Evidence: batch size config at `file:line` OR backfill script.
      → IF no batching for large table: you SHALL flag as **MAJOR**.
- [ ] **Rollback plan**: You SHALL verify rollback migration exists, OR irreversibility is explicitly acknowledged.
      → Evidence: down migration at `file:line` OR "irreversible" comment.
      → IF no plan: you SHALL flag as **MAJOR**.
- [ ] **Index impact**: WHEN indexes are added/modified on large tables, you SHALL verify write amplification and query plan impact are analyzed. What constitutes "large" depends on the system—use the repo's own thresholds if documented, otherwise apply judgment.
      → Evidence: EXPLAIN output showing index usage OR benchmark comparing before/after write latency.
      → IF unanalyzed for large table: you SHALL flag as **MINOR**.
- [ ] **Data integrity constraints**: You SHALL verify uniqueness, foreign keys, and check constraints are enforced.
      → Evidence: constraint definition at `file:line`.
      → IF missing for critical data: you SHALL flag as **MAJOR**.
- [ ] **Transaction boundaries**: You SHALL verify atomicity and isolation assumptions are correct.
      → Evidence: transaction block at `file:line`.
      → IF incorrect boundary: you SHALL flag as **MAJOR**.
- [ ] **Old data compatibility**: You SHALL verify new code can read existing records (null handling, missing columns, enum additions).
      → Evidence: null-safe code at `file:line` OR migration backfilling data.
      → IF incompatible: you SHALL flag as **BLOCKER**.
- [ ] **Backfill observability**: WHEN backfills exist, you SHALL verify metrics/logging and pause/resume capability.
      → Evidence: logging at `file:line` + resume mechanism.
      → IF unobservable: you SHALL flag as **MINOR**.

---

### C) Event-driven / distributed / async workflows

You SHALL use this section for message queues, job runners, event buses, background workers, distributed sagas, webhooks.

#### Semantics & correctness

- [ ] **Delivery semantics stated**: You SHALL verify delivery semantics are documented (at-least-once / at-most-once / exactly-once).
      → Evidence: comment or doc at `file:line` stating semantics.
      → IF unstated: you SHALL flag as **MAJOR**.
- [ ] **Handler idempotency**: You SHALL verify handler is safe under retries/duplicates via idempotency key or dedupe storage.
      → Evidence: idempotency mechanism at `file:line` + test.
      → IF not idempotent: you SHALL flag as **BLOCKER**.
- [ ] **Side effect safety**: You SHALL verify external calls use idempotency keys where supported.
      → Evidence: idempotency key at `file:line`.
      → IF side effects can duplicate: you SHALL flag as **MAJOR**.
- [ ] **Ordering enforced**: WHEN ordering matters, you SHALL verify enforcement (partition key, sequence, per-entity serialization).
      → Evidence: ordering mechanism at `file:line`.
      → IF assumed but not enforced: you SHALL flag as **MAJOR**.
- [ ] **Exactly-once skepticism**: WHEN exactly-once is claimed, you SHALL require proof of coordination mechanism.
      → Evidence: coordination mechanism at `file:line`.
      → IF unproven claim: you SHALL flag as **BLOCKER**.

#### Reliability & backpressure

- [ ] **Bounded retries**: You SHALL verify retries have max attempts with backoff/jitter.
      → Evidence: retry config at `file:line`.
      → IF unbounded: you SHALL flag as **MAJOR**.
- [ ] **Poison message handling**: You SHALL verify DLQ/quarantine + alerting exists.
      → Evidence: DLQ config at `file:line` + alert.
      → IF missing: you SHALL flag as **MAJOR**.
- [ ] **Backpressure**: You SHALL verify bounded queues, batch sizes, or rate limits exist.
      → Evidence: limit config at `file:line`.
      → IF unbounded: you SHALL flag as **MAJOR**.
- [ ] **Concurrency limits**: You SHALL verify worker parallelism is bounded.
      → Evidence: concurrency limit at `file:line`.
      → IF unbounded: you SHALL flag as **MAJOR**.
- [ ] **Ack semantics**: You SHALL verify ack happens after commit (not before).
      → Evidence: ack call at `file:line` after DB commit.
      → IF premature ack: you SHALL flag as **BLOCKER**.

#### Data consistency

- [ ] **Transactional boundaries**: You SHALL verify outbox pattern or equivalent prevents "commit succeeded but publish failed".
      → Evidence: outbox table OR transactional publish at `file:line`.
      → IF inconsistent: you SHALL flag as **MAJOR**.
- [ ] **Consistency model explicit**: You SHALL verify eventual vs strong consistency is documented and matches user expectations.
      → Evidence: documentation at `file:line`.
      → IF unclear: you SHALL flag as **MINOR**.

#### Observability

- [ ] **Trace propagation**: You SHALL verify correlation IDs propagate through messages.
      → Evidence: correlation ID handling at `file:line`.
      → IF missing: you SHALL flag as **MINOR**.
- [ ] **Metrics**: You SHALL verify lag, retry rate, DLQ rate, and latency metrics exist.
      → Evidence: metric emission at `file:line`.
      → IF missing for critical worker: you SHALL flag as **MINOR**.

#### Security

- [ ] **Message authenticity**: WHEN relevant, you SHALL verify signing or ACL validation.
      → Evidence: validation at `file:line`.
      → IF unauthenticated from untrusted source: you SHALL flag as **MAJOR**.
- [ ] **Payload validation**: You SHALL verify schema validation before processing.
      → Evidence: schema check at `file:line`.
      → IF missing: you SHALL flag as **MAJOR**.

---

### D) External calls (network/file/subprocess/third-party APIs)

- [ ] **Centralized interface**: You SHALL verify side effects go through adapter/client boundary (not scattered).
      → Evidence: adapter at `file:line` wrapping calls.
      → IF scattered: you SHALL flag as **MINOR**.
- [ ] **Timeouts configured**: You SHALL verify all external calls have timeout.
      → Evidence: timeout config at `file:line`.
      → IF missing: you SHALL flag as **MAJOR**.
- [ ] **Bounded retries**: You SHALL verify retry limit with backoff/jitter.
      → Evidence: retry config at `file:line`.
      → IF unbounded: you SHALL flag as **MAJOR**.
- [ ] **Credential safety**: You SHALL verify credentials are not logged and use secure storage.
      → Evidence: credential loading at `file:line` (no plaintext).
      → IF logged or plaintext: you SHALL flag as **BLOCKER**.
- [ ] **Response validation**: You SHALL verify remote response is validated before use.
      → Evidence: validation at `file:line`.
      → IF trusted blindly: you SHALL flag as **MAJOR**.
- [ ] **Rate limit handling**: You SHALL verify rate limits and quotas are handled (backoff on 429).
      → Evidence: rate limit handling at `file:line`.
      → IF ignored: you SHALL flag as **MINOR**.
- [ ] **Failure mode defined**: You SHALL verify fallback, degrade, or hard-fail behavior is documented.
      → Evidence: failure handling at `file:line` OR doc.
      → IF undefined: you SHALL flag as **MINOR**.
- [ ] **Retry idempotency**: WHEN calls are auto-retried, you SHALL verify they are idempotent.
      → Evidence: idempotency key at `file:line`.
      → IF non-idempotent retry: you SHALL flag as **MAJOR**.

---

### E) Caching

- [ ] **Not source of truth**: You SHALL verify cache is not the primary source of truth (can be rebuilt).
      → Evidence: cache population from authoritative source.
      → IF cache is source of truth: you SHALL flag as **MAJOR**.
- [ ] **Stale safety**: You SHALL verify stale values cannot violate invariants.
      → Evidence: analysis of stale value impact.
      → IF invariant violation possible: you SHALL flag as **MAJOR**.
- [ ] **Key determinism**: You SHALL verify cache keys are deterministic and collision-resistant.
      → Evidence: key generation at `file:line`.
      → IF nondeterministic: you SHALL flag as **MINOR**.
- [ ] **Key versioning**: WHEN cached data structure changes, you SHALL verify key version is updated.
      → Evidence: version in key at `file:line`.
      → IF unversioned with schema change: you SHALL flag as **MAJOR**.
- [ ] **Invalidation strategy**: You SHALL verify invalidation is documented and implemented (TTL, event-driven, explicit).
      → Evidence: invalidation at `file:line` + doc.
      → IF unclear: you SHALL flag as **MINOR**.
- [ ] **Size bounds**: You SHALL verify memory/disk bounds and eviction policy.
      → Evidence: size limit at `file:line`.
      → IF unbounded: you SHALL flag as **MAJOR**.
- [ ] **Thread safety**: You SHALL verify cached values are immutable or safely copied.
      → Evidence: immutable type OR copy at `file:line`.
      → IF mutable shared: you SHALL flag as **MAJOR**.
- [ ] **Graceful degradation**: You SHALL verify cache outage has fallback to source.
      → Evidence: fallback path at `file:line`.
      → IF hard fail on cache miss: you SHALL flag as **MINOR**.
- [ ] **Sensitive data**: You SHALL verify sensitive data is not cached, or cache is encrypted/protected.
      → Evidence: no PII in cache OR encryption at `file:line`.
      → IF unprotected sensitive data: you SHALL flag as **MAJOR**.
- [ ] **Stampede prevention**: You SHALL verify singleflight/coalescing or jitter prevents thundering herd.
      → Evidence: singleflight at `file:line`.
      → IF no protection on hot cache: you SHALL flag as **MINOR**.

---

### F) Performance-sensitive changes

- [ ] **Complexity analysis**: You SHALL verify time and space complexity is analyzed for expected input sizes.
      → Evidence: complexity comment at `file:line` OR analysis in PR description.
      → IF unanalyzed for large inputs: you SHALL flag as **MINOR**.
- [ ] **O(n²) patterns**: You SHALL search for nested loops over unbounded collections.
      → IF found: you SHALL flag as **MAJOR** with `file:line` + alternative.
- [ ] **N+1 patterns**: You SHALL search for DB/API calls inside loops.
      → IF found: you SHALL flag as **MAJOR** with `file:line` + batching suggestion.
- [ ] **Allocation in hot path**: You SHALL search for unnecessary allocations/copies in performance-critical paths.
      → IF found: you SHALL flag as **MINOR** with `file:line`.
- [ ] **Batching/streaming**: WHEN processing large data, you SHALL verify batching or streaming is used.
      → Evidence: batch/stream at `file:line`.
      → IF loading all into memory: you SHALL flag as **MAJOR** for large datasets.
- [ ] **Benchmark evidence**: WHEN performance claims are made, you SHALL require benchmark.
      → Evidence: benchmark result.
      → IF claim without evidence: you SHALL flag as **MINOR** (request benchmark).
- [ ] **Regression prevention**: You SHALL verify performance-critical code has benchmark in CI.
      → Evidence: benchmark test name.
      → IF missing for critical path: you SHALL flag as **MINOR**.

---

### G) Concurrency and parallelism

- [ ] **Shared state protection**: You SHALL verify shared mutable state uses locks, atomics, or message passing.
      → Evidence: synchronization at `file:line`.
      → IF unprotected: you SHALL flag as **BLOCKER**.
- [ ] **Deadlock prevention**: You SHALL verify consistent lock ordering.
      → Evidence: lock order documentation OR analysis.
      → IF inconsistent: you SHALL flag as **MAJOR**.
- [ ] **Lock-await separation**: You SHALL verify no locks held across await/yield points.
      → Evidence: lock scope at `file:line`.
      → IF violated: you SHALL flag as **BLOCKER**.
- [ ] **Cancellation respected**: You SHALL verify tasks check cancellation and clean up.
      → Evidence: cancellation check at `file:line`.
      → IF ignored: you SHALL flag as **MAJOR**.
- [ ] **Task supervision**: You SHALL verify spawned tasks are joined or supervised (not fire-and-forget without rationale).
      → Evidence: join/supervision at `file:line`.
      → IF fire-and-forget: you SHALL flag as **MINOR**.
- [ ] **Bounded parallelism**: You SHALL verify thread/task pool has size limit.
      → Evidence: pool size at `file:line`.
      → IF unbounded: you SHALL flag as **MAJOR**.
- [ ] **Race prevention**: You SHALL verify races are prevented by design, types, or tested with race detector.
      → Evidence: race detector CI step OR design analysis.
      → IF untested concurrent code: you SHALL flag as **MINOR**.
- [ ] **Event loop isolation**: You SHALL verify blocking operations are not on event loop thread.
      → Evidence: offload to worker at `file:line`.
      → IF blocking on event loop: you SHALL flag as **MAJOR**.
- [ ] **Context propagation**: You SHALL verify trace IDs and auth context propagate across threads/tasks.
      → Evidence: context passing at `file:line`.
      → IF lost: you SHALL flag as **MINOR**.

---

### H) UI/UX changes (CLI, web, mobile)

- [ ] **Behavior consistency**: You SHALL verify user-facing behavior is consistent with existing patterns.
      → Evidence: comparison to existing behavior.
      → IF inconsistent: you SHALL flag as **MINOR**.
- [ ] **Accessibility**: You SHALL verify keyboard navigation, focus states, ARIA semantics, and contrast.
      → Evidence: accessibility attributes at `file:line` OR a11y test.
      → IF missing: you SHALL flag as **MINOR**.
- [ ] **i18n readiness**: WHEN user strings are added, you SHALL verify they use i18n framework.
      → Evidence: i18n call at `file:line`.
      → IF hardcoded strings: you SHALL flag as **MINOR**.
- [ ] **Telemetry privacy**: You SHALL verify telemetry respects opt-out and does not collect PII without consent.
      → Evidence: opt-out check at `file:line`.
      → IF violates privacy: you SHALL flag as **MAJOR**.

#### CLI-specific

- [ ] **Exit codes**: You SHALL verify exit codes are meaningful (0 success, non-zero error) and documented.
      → Evidence: exit code usage at `file:line`.
      → IF always 0: you SHALL flag as **MINOR**.
- [ ] **Machine-readable output**: WHEN JSON output is promised, you SHALL verify it is stable and documented.
      → Evidence: JSON output at `file:line` + schema/doc.
      → IF unstable: you SHALL flag as **MAJOR**.
- [ ] **Actionable errors**: You SHALL verify error messages include what went wrong and how to fix.
      → Evidence: error message at `file:line`.
      → IF opaque: you SHALL flag as **MINOR**.
- [ ] **Argument validation**: You SHALL verify CLI arguments are validated with helpful errors.
      → Evidence: validation at `file:line`.
      → IF invalid args silently accepted: you SHALL flag as **MINOR**.

---

### I) CI/CD, tooling, and developer experience

- [ ] **Check preservation**: You SHALL verify CI changes do not weaken required checks.
      → Evidence: CI config comparison.
      → IF weakened without replacement: you SHALL flag as **MAJOR**.
- [ ] **CI secret handling**: You SHALL verify secrets use secret storage, not plaintext, with least privilege.
      → Evidence: secret reference in CI config.
      → IF plaintext: you SHALL flag as **BLOCKER**.
- [ ] **Contributor impact**: You SHALL verify tooling updates are documented and won't break contributors.
      → Evidence: changelog or doc update.
      → IF breaking without notice: you SHALL flag as **MINOR**.
- [ ] **Local reproducibility**: You SHALL verify local build/test workflow matches CI.
      → Evidence: local instructions in README or CONTRIBUTING.
      → IF divergent: you SHALL flag as **MINOR**.
- [ ] **Config change justification**: You SHALL verify lint/format config changes are justified.
      → Evidence: rationale in PR or commit message.
      → IF unjustified: you SHALL flag as **NIT**.

---

## 8) Big‑O complexity expectations (mechanical analysis)

**Cross-references**: This section is referenced by §4 Round 1, §7.F (Performance). It references §1 (Evidence), §2 (Severity).

**Big‑O** describes how runtime/memory grows with input size _n_:

- **O(1)**: constant time (ideal for hot paths)
- **O(log n)**: grows slowly (balanced trees, binary search)
- **O(n)**: linear (often acceptable)
- **O(n log n)**: sorting, divide-and-conquer (often acceptable)
- **O(n²) or worse**: can explode; acceptable only with strict bounds and justification

---

### 8.1 Complexity analysis checklist (mechanical)

You **SHALL** analyze complexity for code touching hot paths or processing variable-size input:

- [ ] **Identify hot paths**: You SHALL list functions in diff that are called frequently or process user-controlled input sizes.
      → Evidence: function names at `file:line` + call frequency estimate.
- [ ] **State complexity**: For each hot path function, you SHALL state time and space complexity.
      → Evidence: complexity in format `O(n)` at `file:line`.
      → IF unstated for hot path: you SHALL flag as **MINOR** (request analysis).
- [ ] **Validate input bounds**: For O(n²) or worse, you SHALL verify input size is bounded.
      → Evidence: bound enforcement at `file:line` (e.g., max items, pagination).
      → IF unbounded O(n²): you SHALL flag as **MAJOR**.

---

### 8.2 Anti-pattern detection (mechanical)

You **SHALL** search for these patterns and flag:

- [ ] **Nested loops**: WHEN loops are nested over collections, you SHALL analyze combined complexity.
      → IF O(n²) without bounds: you SHALL flag as **MAJOR** with `file:line`.
- [ ] **Repeated lookups**: WHEN `find`/`contains`/`filter` is called inside a loop, you SHALL flag potential O(n²).
      → IF optimizable with set/map: you SHALL flag as **MINOR** with `file:line` + suggestion.
- [ ] **N+1 queries**: WHEN DB/API calls are made inside loops, you SHALL flag N+1 pattern.
      → IF found: you SHALL flag as **MAJOR** with `file:line` + batching suggestion.
- [ ] **Repeated string concatenation**: WHEN strings are concatenated in a loop (in languages where this is O(n²)), you SHALL flag.
      → IF found: you SHALL flag as **MINOR** with `file:line` + StringBuilder suggestion.
- [ ] **Unbounded recursion**: WHEN recursion depth depends on input size without tail-call optimization, you SHALL flag stack overflow risk.
      → IF found: you SHALL flag as **MAJOR** with `file:line` + iteration suggestion.

---

### 8.3 Evidence requirements for performance claims

WHEN performance claims are made (e.g., "this is O(n)", "this is fast"), you **SHALL** require:

- [ ] **Benchmark**: You SHALL require benchmark result showing actual performance at expected scale.
      → IF claim without benchmark: you SHALL flag as **MINOR** (request benchmark).
- [ ] **Profile**: For optimization changes, you SHALL require before/after profile.
      → IF optimization without profile: you SHALL flag as **NIT**.
- [ ] **Production metrics**: For performance-critical paths, you SHALL require production metrics showing acceptable latency.
      → IF no metrics for critical path: you SHALL add to residual risk per §12.2.

---

## 9) Test quality standards (language‑agnostic)

**Cross-references**: This section is referenced by §4 Round 1, §14 (Quick Card). It references §1 (Evidence), §2 (Severity), §12.2 (Residual risk).

### 9.1 Coverage requirements (with thresholds)

You **SHALL** verify test coverage and cite evidence for each requirement.

#### 9.1.1 High-risk domains (auth, payments, migrations, crypto, PII)

WHEN the change is in a high-risk domain, you **SHALL** require:

- [ ] **Unit test per branch**: Each new conditional branch has a unit test.
      → Evidence: test name(s) covering each branch.
      → IF missing: you SHALL flag as **MAJOR**.
- [ ] **Integration test for success path**: At least one integration test exercises the primary success flow.
      → Evidence: integration test name.
      → IF missing: you SHALL flag as **MAJOR**.
- [ ] **Rejection path test**: At least one test proves denial/failure on invalid input or unauthorized access.
      → Evidence: test name proving rejection.
      → IF missing: you SHALL flag as **BLOCKER** (for auth/authz) or **MAJOR** (for other high-risk).

#### 9.1.2 Behavioral changes (not pure refactor)

WHEN the change modifies behavior, you **SHALL** require:

- [ ] **Behavior-change test**: At least one test that would fail on the old behavior and pass on the new.
      → Evidence: test name + description of what it asserts differently.
      → IF missing: you SHALL flag as **MAJOR**.

#### 9.1.3 Pure mechanical refactors

WHEN the change is a pure refactor with no behavior change, existing tests passing is sufficient provided:

- [ ] **Coverage verification**: Coverage report shows touched lines are exercised, OR reviewer manually identifies at least one existing test exercising each modified path.
      → Evidence: coverage report link OR test names.
      → IF unverified: you SHALL flag as **MINOR** (request coverage evidence).

#### 9.1.4 Test coverage gaps

WHEN tests are missing, you **SHALL**:

1. Identify which failure modes are unprotected
2. Flag as **MAJOR** with specific test request
3. Include the minimum test that would prevent regression

---

### 9.2 Must‑haves (mechanical checks)

- [ ] **New behavior tested**: WHEN new behavior is added, you SHALL verify at least one test exercises it.
      → Evidence: test name at `test_file:line`.
      → IF missing: you SHALL flag as **MAJOR**.
- [ ] **Regression test for bug fix**: WHEN a bug is fixed, you SHALL verify a test exists that would have caught the bug.
      → Evidence: test name + description of what it catches.
      → IF missing: you SHALL flag as **MAJOR**.
- [ ] **Determinism**: You SHALL verify tests do not use real time, unseeded randomness, or real network.
      → Evidence: grep for `sleep`, `time.Now`, `random()`, `http.Get` without mocking.
      → IF found: you SHALL flag as **MINOR** (flaky risk).
- [ ] **Hermeticity**: You SHALL verify tests do not depend on machine state, environment variables without defaults, or external services.
      → Evidence: test setup showing isolation.
      → IF dependent: you SHALL flag as **MINOR**.
- [ ] **Happy path coverage**: You SHALL verify at least one test exercises the success path.
      → Evidence: test name.
      → IF missing: you SHALL flag as **MAJOR**.
- [ ] **Rejection path coverage**: You SHALL verify at least one test exercises a failure/denial path.
      → Evidence: test name proving error handling.
      → IF missing: you SHALL flag as **MAJOR** for risky code, **MINOR** otherwise.
- [ ] **Behavior assertion**: You SHALL verify tests assert on behavior/contracts, not implementation details (e.g., not asserting on mock call counts unless that's the contract).
      → Evidence: assertion type in test.
      → IF over-mocked: you SHALL flag as **NIT**.
- [ ] **Descriptive test names**: You SHALL verify test names describe scenario and expected outcome.
      → Evidence: cite unclear test name if found.
      → IF unclear: you SHALL flag as **NIT**.

---

### 9.3 Risk-based test requirements (apply when applicable)

- [ ] **Integration tests**: WHEN behavior spans modules/services, you SHALL verify integration test exists.
      → Evidence: integration test name.
      → IF missing for cross-module behavior: you SHALL flag as **MINOR**.
- [ ] **Contract tests**: WHEN public API/schema is modified, you SHALL verify contract test validates backward/forward compatibility.
      → Evidence: contract test name.
      → IF missing for API change: you SHALL flag as **MAJOR**.
- [ ] **Property-based tests**: WHEN code has invariants (e.g., serialization roundtrip, ordering), you SHALL verify property test exists.
      → Evidence: property test name.
      → IF missing for complex invariant: you SHALL flag as **NIT**.
- [ ] **Fuzzing**: WHEN code parses untrusted input, you SHALL verify fuzzing exists or is planned.
      → Evidence: fuzz test name OR follow-up issue.
      → IF missing for parser: you SHALL flag as **MINOR**.
- [ ] **Migration tests**: WHEN DB migrations are added, you SHALL verify apply/rollback are tested.
      → Evidence: migration test name.
      → IF missing: you SHALL flag as **MAJOR**.
- [ ] **Concurrency tests**: WHEN concurrent/async code is added, you SHALL verify stress or race-detection test exists.
      → Evidence: concurrency test name OR race detector CI step.
      → IF missing for concurrent code: you SHALL flag as **MINOR**.

---

### 9.4 Testing anti-patterns (flag when found)

You **SHALL** search for these patterns and flag:

- [ ] **Over-mocking**: WHEN tests mock internal calls and only verify mock interactions, not behavior.
      → IF found: you SHALL flag as **NIT** with suggestion to test behavior.
- [ ] **Brittle string assertions**: WHEN tests assert on exact error messages that are not part of the contract.
      → IF found: you SHALL flag as **NIT** with suggestion to assert on error type/code.
- [ ] **Non-deterministic waits**: WHEN tests use `sleep()` or real time without fake clock.
      → IF found: you SHALL flag as **MINOR** (flaky risk) with `file:line`.
- [ ] **External dependencies**: WHEN tests require external services without hermetic harness.
      → IF found: you SHALL flag as **MINOR** with suggestion for mock/stub.
- [ ] **Unstable golden tests**: WHEN golden tests encode environment-dependent or nondeterministic output.
      → IF found: you SHALL flag as **MINOR** with suggestion to normalize output.

---

### 9.5 Missing test escalation

WHEN a PR adds/changes behavior without tests, you **SHALL**:

1. Ask: "Which failure modes does this protect against?"
2. Ask: "What is the smallest test that prevents regression?"
3. IF no automated test is feasible: you SHALL require documented manual verification plan
4. You SHALL flag as **MAJOR** until resolved (or **BLOCKER** for security-critical code)

---

## 10) Security review mini-framework (mandatory for high-risk)

**Cross-references**: This section is referenced by §4 Round 1, §11 (Depth selection - Full Audit). It references §1 (Evidence), §2 (Severity), §6.4 (Security quick checks).

WHEN a change touches auth, payments, PII, persistence, network, or crypto, you **SHALL** produce the following artifacts with evidence anchors.

### 10.1 Threat summary table (required output)

**You SHALL produce this table for high-risk changes:**

| Element                    | Value                                                             | Evidence anchor                    |
| -------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| **Assets protected**       | (credentials / money / PII / integrity / availability)            | `file:line` where asset is handled |
| **Entry points**           | (API / CLI / file / webhook / queue / UI)                         | `file:line` of input acceptance    |
| **Trust boundary crossed** | (user→admin / public→internal / tenant isolation)                 | `file:line` of privilege check     |
| **Attack vectors checked** | (injection type / SSRF / authz bypass / replay / deserialization) | Test name proving rejection        |
| **Failure mode defined**   | (timeout / retry / partial failure behavior)                      | `file:line` of error handler       |

**IF any cell cannot be filled**: you SHALL flag as **MAJOR** (unclear security posture) and request clarification from author.

---

### 10.2 Injection checklist (mechanical)

For each user-controlled input that reaches a sensitive sink, you **SHALL** verify mitigation and cite evidence:

| Sink type                            | Mitigation required                                                   | Evidence format                          |
| ------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------- |
| SQL/query builder                    | Parameterized query or ORM with bound parameters                      | `file:line` of query + test name         |
| Shell/subprocess                     | Allowlist of commands OR proper escaping/quoting                      | `file:line` of exec + test for rejection |
| Template engine                      | Auto-escaping enabled OR manual escape at render                      | Config file + `file:line` of render      |
| Path/filesystem                      | Path normalization + directory restriction (chroot/jail/prefix check) | `file:line` of path validation           |
| Deserializer (JSON/YAML/pickle/etc.) | Schema validation before processing                                   | `file:line` of schema check + test       |
| URL/redirect                         | Allowlist of hosts OR same-origin check                               | `file:line` of URL validation            |
| Regex with user input                | Bounded complexity OR timeout                                         | `file:line` of regex + complexity proof  |

→ IF input reaches sink without verified mitigation: you SHALL flag as **BLOCKER**.

---

### 10.3 Authorization checklist (mechanical)

For each protected resource or action in the diff, you **SHALL** verify:

- [ ] **Authz check location**: You SHALL cite the authorization check at `file:line`.
- [ ] **Object-level permissions**: WHEN resource is user-specific or tenant-specific, you SHALL verify the check includes object ownership, not just role.
      → Evidence: test name proving denial when wrong user/tenant attempts access.
- [ ] **Default deny**: You SHALL verify missing/invalid credentials result in denial, not fallback access.
      → Evidence: test name proving denial on missing auth.
- [ ] **Privilege escalation paths**: WHEN admin/elevated actions exist, you SHALL verify they cannot be reached by non-privileged users.
      → Evidence: test name proving denial for non-admin.

→ IF authz check is missing or untested: you SHALL flag as **BLOCKER**.

---

### 10.4 Secrets and sensitive data checklist (mechanical)

- [ ] **Secrets in logs**: You SHALL grep diff for log/print/trace statements. You SHALL verify no secrets, tokens, passwords, or API keys are logged.
      → IF found: you SHALL flag as **BLOCKER**. Evidence: `file:line` of log statement + secret type.
- [ ] **Secrets in errors**: You SHALL verify error messages returned to users do not include internal paths, stack traces, or credentials.
      → IF found: you SHALL flag as **MAJOR**. Evidence: `file:line` of error return.
- [ ] **PII handling**: WHEN PII is collected/stored/transmitted, you SHALL verify minimization and encryption requirements are met.
      → IF PII is stored in plaintext without justification: you SHALL flag as **MAJOR**. Evidence: storage location.
- [ ] **Credential storage**: WHEN credentials are stored, you SHALL verify they use secure storage (keychain, vault, encrypted config), not plaintext files.
      → IF plaintext: you SHALL flag as **BLOCKER**. Evidence: storage mechanism at `file:line`.

---

### 10.5 Cryptography checklist (mechanical)

WHEN the diff includes cryptographic operations, you **SHALL** verify:

- [ ] **Library usage**: You SHALL verify established crypto libraries are used (not hand-rolled algorithms).
      → IF custom crypto: you SHALL flag as **BLOCKER**. Evidence: `file:line` of implementation.
- [ ] **Algorithm choice**: You SHALL verify algorithms are current (not MD5 for security, not SHA1 for signatures, not DES/3DES).
      → IF deprecated algorithm: you SHALL flag as **MAJOR**. Evidence: algorithm at `file:line`.
- [ ] **Key management**: You SHALL verify keys are not hardcoded, have rotation mechanism, and are stored securely.
      → IF hardcoded key: you SHALL flag as **BLOCKER**. Evidence: `file:line`.
- [ ] **IV/nonce handling**: WHEN encryption requires IV/nonce, you SHALL verify it is randomly generated per operation (not reused).
      → IF reused: you SHALL flag as **BLOCKER**. Evidence: `file:line` of IV generation.

---

### 10.6 Network and external calls checklist (mechanical)

WHEN the diff makes outbound network calls, you **SHALL** verify:

- [ ] **SSRF protection**: WHEN URLs are constructed from user input, you SHALL verify host allowlist or URL validation exists.
      → IF user can control destination without restriction: you SHALL flag as **BLOCKER**. Evidence: `file:line`.
- [ ] **TLS enforcement**: You SHALL verify connections use HTTPS/TLS (not plain HTTP for sensitive data).
      → IF HTTP used for sensitive data: you SHALL flag as **MAJOR**. Evidence: `file:line` of connection.
- [ ] **Certificate validation**: You SHALL verify certificate validation is not disabled.
      → IF validation disabled: you SHALL flag as **BLOCKER**. Evidence: `file:line` of config.

---

## 11) Review depth selection (decision tree)

**Cross-references**: This section is referenced by §0 (Procedure step 3), §1.3 (Risk dictates depth), §4 Round 0, §14 (Quick Card). It references §4 (Workflow), §7 (Change-type checklists), §10 (Security). You SHALL select depth during Round 0 and state it in your report.

**You SHALL determine review depth at the start and you SHALL state the selection with justification in the report per §13.1 template.**

### 11.1 Depth selection decision tree

**You SHALL apply rules in order; you SHALL use the first matching rule:**

1. **IF** the change touches auth/authz, payments, crypto, migrations, PII, or multi-tenant boundaries,
   **THEN** you SHALL apply **Full Audit** (§4 all rounds + §10 threat model + all applicable §7 checklists).
   → State: "Full Audit selected: [domain] touched."

2. **IF** the change modifies a public contract (API schema, CLI output, DB migration, wire format) without touching high-risk domains,
   **THEN** you SHALL apply **Contract-Focused Review** (§7.A/B + §4 Rounds 0-2 + §4 Round 4 verification).
   → State: "Contract-Focused Review selected: [contract type] modified."

3. **IF** the change introduces new async/distributed behavior (queues, workers, event handlers, background tasks),
   **THEN** you SHALL apply **Async Review** (§6.9 + §7.C + §4 Rounds 0-2 + verification of idempotency/retry behavior).
   → State: "Async Review selected: [component type] introduced."

4. **IF** the change is a pure mechanical refactor with no behavior change AND existing test coverage for touched code is verified,
   **THEN** you MAY apply **Lightweight Review** (§14 Quick Card only).
   → State: "Lightweight Review selected: refactor-only; coverage verified at [evidence: coverage report or test names]."
   → **You SHALL NOT use Lightweight Review for high-risk domains per §1.3.**

5. **OTHERWISE**, you SHALL apply **Standard Review** (§4 Rounds 0-2 + relevant §7 checklists + §4 Round 4 if verification commands available).
   → State: "Standard Review selected: [brief justification]."

---

### 11.2 Depth escalation triggers

**During review, you SHALL escalate to Full Audit IF any of the following are discovered:**

- [ ] Unexpected auth/authz code in the diff
- [ ] Secrets or credentials handled
- [ ] New external network calls to untrusted destinations
- [ ] Database migrations on tables with >1M rows (or unknown size)
- [ ] Caching logic that affects correctness (not just performance)
- [ ] "Exactly-once" or "atomic" claims without proof

→ IF escalation occurs: you SHALL state "Escalated to Full Audit: [trigger discovered at file:line]."

---

### 11.3 Review depth output requirement

**You SHALL include the following at the top of your report (use the §13.1 template Executive summary section):**

```markdown
**Review depth**: [Full Audit / Contract-Focused / Async / Lightweight / Standard]
**Justification**: [one sentence explaining why this depth was selected]
**Escalations**: [none / list of triggers that caused escalation]
```

---

## 12) Reviewer output expectations (format + completeness)

**Cross-references**: This section is referenced by §0 (Output requirements), §Protocol Integrity, §4 (all Rounds). It references §1.5 (Confidence), §4 (Workflow), §13 (Templates). You SHALL structure your output according to this section.

**You SHALL produce a report that includes ALL of the following sections. You SHALL use the template from §13.1 to structure your output.**

### Required sections

**Audit-style reviews SHALL include all of the following (even for small diffs):**

1. **Executive summary + verdict**

   - intent, risk level, and a clear **Verdict**: `APPROVE` / `REQUEST CHANGES` / `BLOCK` (required per §Protocol Integrity)
   - severity counts (BLOCKER/MAJOR/MINOR/NIT)
   - top risks and why (1–5 bullets)
   - review depth per §11.3

2. **Change inventory**

   - diffstat (files + LOC churn)
   - files/domains touched (contracts/storage/security/etc.)
   - dependency/capability delta
   - data/migration delta

3. **Requirements traceability**

   - acceptance criteria / requirements → status → evidence anchors

4. **Findings**

   - grouped by **BLOCKER / MAJOR / MINOR / NIT**
   - each non‑NIT finding SHALL include: location + failure mode + fix + test/verification + evidence anchors per §1.1

5. **Verification ledger**

   - what was run (format/lint/tests/build/scans/migrations/bench)
   - what was **not** run and why
   - where results came from (local/CI)

6. **Compatibility / rollout**

   - migrations/backfills, mixed-version compatibility, feature flags, rollback plan

7. **Repo docs/spec compliance**

   - which authoritative docs/specs were checked (`docs/`, `context/`, `adr/`, etc.)
   - whether any must be updated due to behavior/contract changes

8. **PR discussion resolution** (PRs)

   - unresolved threads (including inline) and disposition

9. **Not verified / residual risk** (required — see §12.2 for population rules)
   - explicit list of assumptions, unknowns, and what would verify them

---

### 12.2 Residual risk population rules (mandatory)

**Cross-references**: This section is referenced by §1.5.1, §1.5.2, §3.3, §4 (all Rounds), §Protocol Integrity. It references §1.5.2 (Confidence calibration).

**You SHALL populate the "Not verified / residual risk" section WHEN ANY of the following are true:**

- [ ] A verification command was not run (you SHALL cite which command and why)
- [ ] A claim uses "Assumed" or "Unknown" confidence level (per §1.5.2)
- [ ] A checklist item was marked "N/A" without justification
- [ ] Migration or rollback was not tested against representative data
- [ ] Concurrency/async behavior was reviewed by code reading only (no test execution)
- [ ] Security claims were not verified with tests (e.g., "injection safe" without test proving rejection)
- [ ] Performance claims were made without benchmark evidence

**For each residual risk item, you SHALL use this format:**

```markdown
- **Not verified**: [what was not verified]
  - **Why it matters**: [potential failure mode]
  - **How to verify**: [specific command, test, or check]
  - **Owner/tracking**: [issue link or suggested owner]
```

**IF the section would be empty**, THEN you **SHALL** explicitly state:

> "All claims verified mechanically; no residual risk identified. See Verification Ledger for evidence."

**You SHALL NOT leave this section blank or omit it. Per §Protocol Integrity, an empty residual risk section without explicit justification is a protocol violation.**

---

### Report storage

You SHALL store review reports using the session-based structure defined below. This structure supports arbitrary agent tree depth (recursive spawning) while maintaining a flat file layout within each session.

#### Directory structure

```markdown
.local/reports/code*reviews/{ref}/{session_id}/
├── {HH-MM-SS-mmm}*{uuid8}\_{scope}.md
├── ...
└── \_session.json
```

IF `.local/reports/` is unavailable, you SHALL use `reports/code_reviews/` as fallback.

#### Path components

| Component      | Format                                 | Example                            | Notes                                                                  |
| -------------- | -------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `ref`          | Branch with `/`→`-`, or `pr-{N}`       | `feature-auth-flow`, `pr-456`      | Filesystem-safe identifier                                             |
| `session_id`   | `YYYY-MM-DD_HH-MM-SS-mmm_{root_uuid8}` | `2025-01-15_14-30-22-456_a3f8b2c1` | Identifies one review run; uses root agent's start time and ID         |
| `HH-MM-SS-mmm` | Time with milliseconds                 | `14-32-00-789`                     | Agent's completion time; provides natural ordering                     |
| `uuid8`        | First 8 chars of UUIDv4                | `a3f8b2c1`                         | Agent's unique identifier for collision resistance and cross-reference |
| `scope`        | Review focus label                     | `security`, `final`                | What this file covers (see scope labels below)                         |

#### Scope labels

| Label       | When to use                                                                     |
| ----------- | ------------------------------------------------------------------------------- |
| `full`      | Standard full review (all applicable checklists from §6–§7)                     |
| `security`  | Security-focused review (§10 + §6.4)                                            |
| `contracts` | API/schema/wire format focus (§7.A)                                             |
| `storage`   | Data model/migration focus (§7.B)                                               |
| `async`     | Async/distributed systems focus (§7.C + §6.9)                                   |
| `perf`      | Performance focus (§7.F + §8)                                                   |
| _{custom}_  | Any domain-specific scope justified by the change                               |
| `final`     | **Authoritative session output**—only one file per session SHALL use this scope |

#### One-file-per-agent rule

Each agent SHALL produce exactly one file upon completion. That file SHALL contain:

1. **The agent's own analysis** (if it performed direct review work)
2. **Synthesis of children** (if it spawned child agents—merged and deduplicated per the template in §13.1)
3. **A verdict** for its scope/subtree

The file is written when the agent completes. This means:

- Grandchildren finish first → their files appear first
- Children wait for grandchildren, then write their synthesis
- Root writes last → its `_final` file is naturally the authoritative output

WHEN an agent both performs its own review work AND coordinates children, it SHALL include both in its single file using the Synthesized Findings section from the template (§13.1).

#### Session manifest (mandatory)

You SHALL create and maintain `_session.json` in the session directory. The root agent SHALL create this file at session start; all agents SHALL update it upon completion.

**Schema:**

```json
{
  "session_id": "2025-01-15_14-30-22-456_a3f8b2c1",
  "ref": "feature-auth",
  "ref_type": "branch",
  "pr_number": null,
  "status": "in_progress",
  "root_agent": "a3f8b2c1",
  "started_at": "2025-01-15T14:30:22.456Z",
  "completed_at": null,

  "agents": {
    "a3f8b2c1": {
      "file": null,
      "scope": "final",
      "parent": null,
      "children": ["b7d4e9f2", "c1a2b3d4"],
      "status": "in_progress",
      "verdict": null,
      "severity_counts": null
    },
    "b7d4e9f2": {
      "file": "14-31-10-234_b7d4_security.md",
      "scope": "security",
      "parent": "a3f8b2c1",
      "children": ["d5e6f7a8"],
      "status": "complete",
      "verdict": "REQUEST_CHANGES",
      "severity_counts": { "blocker": 1, "major": 2, "minor": 0, "nit": 1 }
    }
  },

  "authoritative": {
    "agent": "a3f8b2c1",
    "file": null
  }
}
```

**Required fields:**

| Field                 | Type                            | Description                                                  |
| --------------------- | ------------------------------- | ------------------------------------------------------------ |
| `session_id`          | string                          | Matches directory name                                       |
| `ref`                 | string                          | Sanitized branch or PR reference                             |
| `ref_type`            | `"branch"` \| `"pr"`            | Reference type                                               |
| `pr_number`           | number \| null                  | PR number if `ref_type` is `"pr"`                            |
| `status`              | `"in_progress"` \| `"complete"` | Session status; set to `"complete"` when root agent finishes |
| `root_agent`          | string                          | UUID8 of the root agent                                      |
| `started_at`          | ISO8601                         | Session start timestamp                                      |
| `completed_at`        | ISO8601 \| null                 | Session completion timestamp                                 |
| `agents`              | object                          | Map of agent UUID8 → agent record                            |
| `authoritative.agent` | string                          | UUID8 of agent producing final output                        |
| `authoritative.file`  | string \| null                  | Filename of authoritative output                             |

**Agent record fields:**

| Field             | Type                            | Description                           |
| ----------------- | ------------------------------- | ------------------------------------- |
| `file`            | string \| null                  | Filename (null until agent completes) |
| `scope`           | string                          | Scope label for this agent's review   |
| `parent`          | string \| null                  | Parent agent's UUID8 (null for root)  |
| `children`        | string[]                        | Child agent UUID8s (empty if none)    |
| `status`          | `"in_progress"` \| `"complete"` | Agent status                          |
| `verdict`         | string \| null                  | Verdict once complete                 |
| `severity_counts` | object \| null                  | `{blocker, major, minor, nit}` counts |

#### Manifest update protocol

1. **Root agent at session start**: Creates `_session.json` with own entry, `status: "in_progress"`
2. **Agent spawning child**: Adds child entry to `agents`, updates own `children` array
3. **Agent completing**: Updates own entry with `file`, `status: "complete"`, `verdict`, `severity_counts`
4. **Root agent completing**: Additionally sets `completed_at`, `status: "complete"`, and `authoritative.file`

WHEN multiple agents update the manifest concurrently, you SHALL use atomic write operations (write to temp file, rename) to prevent corruption.

#### Example: multi-level agent tree

Agent tree:

```markdown
Root (a3f8) - full review + coordination
├── Child1 (b7d4) - security
│ ├── Grandchild1 (d5e6) - auth deep-dive
│ └── Grandchild2 (f7a8) - injection
├── Child2 (c1a2) - contracts
└── Child3 (e9f0) - storage
```

Resulting filesystem (files ordered by completion time):

```markdown
.local/reports/code_reviews/feature-auth/2025-01-15_14-30-22-456_a3f8b2c1/
├── 14-30-45-123_d5e6_auth.md # grandchild
├── 14-30-47-456_f7a8_injection.md # grandchild
├── 14-30-50-789_c1a2_contracts.md # child (no grandchildren)
├── 14-30-52-012_e9f0_storage.md # child
├── 14-31-10-234_b7d4_security.md # child (synthesizes grandchildren)
├── 14-32-00-567_a3f8_final.md # root (authoritative)
└── \_session.json
```

#### Chat output

WHEN filesystem write access is available, you SHALL write the complete report to file and output only a short pointer to chat:

```markdown
Review complete: .local/reports/code_reviews/feature-auth/2025-01-15_14-30-22-456_a3f8b2c1/14-32-00-567_a3f8_final.md
Verdict: REQUEST CHANGES (2 BLOCKER, 3 MAJOR, 1 MINOR, 0 NIT)
```

---

## 13) Templates (copy/paste)

**Cross-references**: This section is referenced by §0 (Procedure step 9, Output requirements), §Protocol Integrity, §4 (all Rounds), §12 (Output). You SHALL use these templates for your review output.

**⚠️ MANDATORY USAGE INSTRUCTIONS:**

1. **You SHALL copy the template structure from §13.1** — Do not invent your own format.
2. **You SHALL fill in ALL sections** — Empty sections are protocol violations per §Protocol Integrity.
3. **You SHALL preserve the section headings** — The template headings are required for completeness verification.
4. **WHEN a section is not applicable, THEN you SHALL mark it "N/A" with a brief justification** — Do not delete sections.

These templates are scaffolding for review reports and checklists. They're meant to be **applied alongside** the rules and workflow in the sections above, not treated as a standalone "prompt" that replaces them.

### 13.1 Findings template

**You SHALL use this template structure for your review report. Copy this template and fill in each section per the workflow in §4 and requirements in §12.**

```md
## Fresh eyes observations (Round −1)

(Record your initial, unfiltered observations here before applying any checklists. What stands out? What feels off? What questions arise?)

- ...

---

## Executive summary

| Field                      | Value                                                          |
| -------------------------- | -------------------------------------------------------------- |
| Verdict                    | APPROVE / REQUEST CHANGES / BLOCK                              |
| Review depth               | Full Audit / Contract-Focused / Async / Lightweight / Standard |
| Depth justification        | (one sentence per §11.3)                                       |
| Intent                     |                                                                |
| Risk level                 | low / medium / high — (why)                                    |
| Areas touched              | (packages/modules/services)                                    |
| Contract surfaces affected | (API / schema / DB / CLI / events / config)                    |
| User-visible changes       |                                                                |
| Rollout / flags            | (feature flag? staged rollout? rollback plan?)                 |
| Escalations                | (none / list triggers that caused escalation)                  |

| Severity | Count |
| -------- | ----- |
| BLOCKER  |       |
| MAJOR    |       |
| MINOR    |       |
| NIT      |       |

### Top risks (1–5 bullets)

- ...

---

## Change inventory (audit)

### Diffstat

- Files changed:
- Approx LOC churn:
- Evidence: (paste `git diff --stat` summary or equivalent)

### Domain map

| Domain                     | Files / components | Notes |
| -------------------------- | ------------------ | ----- |
| Contracts (API/schema/CLI) |                    |       |
| Storage / migrations       |                    |       |
| Security / authz           |                    |       |
| Async / workers            |                    |       |
| UI / UX                    |                    |       |
| Infra / CI                 |                    |       |

### Dependency / capability delta

| Change                            | Evidence | Notes |
| --------------------------------- | -------- | ----- |
| New deps                          |          |       |
| New network/filesystem/subprocess |          |       |
| New permissions/capabilities      |          |       |

### Data / migration delta

| Item            | Evidence | Notes |
| --------------- | -------- | ----- |
| Migration(s)    |          |       |
| Backfill(s)     |          |       |
| Rollback impact |          |       |

---

## Requirements traceability

| Requirement / acceptance criteria | Status (Met / Partial / Not met / N/A) | Evidence anchors | Notes / follow-ups |
| --------------------------------- | -------------------------------------- | ---------------- | ------------------ |
|                                   |                                        |                  |                    |

---

## Repo docs/spec compliance

| Doc/spec checked                               | Status (checked / not found / not checked) | Needs update? | Notes |
| ---------------------------------------------- | ------------------------------------------ | ------------- | ----- |
| README / CONTRIBUTING / SECURITY               |                                            |               |       |
| Agent instructions (AGENTS/CLAUDE/etc.)        |                                            |               |       |
| Architecture/spec docs (docs/context/adr/...)  |                                            |               |       |
| Contract artifacts (schemas/openapi/proto/...) |                                            |               |       |
| Ops/CI docs (.github/workflows/runbooks/...)   |                                            |               |       |

---

## Findings index (scan first)

| ID  | Severity | Location                          | Title |
| --- | -------- | --------------------------------- | ----- |
| B1  | BLOCKER  | path/to/file.ext:123 (SymbolName) |       |
| M1  | MAJOR    | path/to/file.ext:456 (SymbolName) |       |
| m1  | MINOR    | path/to/file.ext:789              |       |
| n1  | NIT      | path/to/file.ext:101              |       |

---

## BLOCKERS

### B1 — <Title>

- **Location:** `path/to/file.ext:123` (`SymbolName`)
- **What:** (what the code does today / what’s wrong)
- **Why it matters:** (specific failure mode: exploit, data loss, outage, contract break)
- **Suggested fix:** (concrete fix; pseudo-diff encouraged)
- **Suggested test/verification:** (exact test to add + how to run / how to prove fixed)
- **Evidence anchors:** (code/test/docs pointers that support the claim)

---

## MAJORS

### M1 — <Title>

- **Location**: `path/to/file.ext:456` (`SymbolName`)
- **What**:
- **Why it matters**:
- **Suggested fix**:
- **Suggested test/verification**:
- **Evidence anchors**:

---

## MINORS

### m1 — <Title>

- **Location**: `path/to/file.ext:789`
- **What**:
- **Why it matters**:
- **Suggested fix (optional)**:
- **Suggested test/verification (optional)**:
- **Evidence anchors (optional)**:

---

## NITS

- n1 — `path/to/file.ext:101`: <small suggestion>

---

## Verification ledger (mechanical)

| Check                                       | Command / source | Result (pass/fail/not run) | Evidence (test name, CI job, log snippet) |
| ------------------------------------------- | ---------------- | -------------------------- | ----------------------------------------- |
| Formatting                                  |                  |                            |                                           |
| Lint / static analysis                      |                  |                            |                                           |
| Unit tests                                  |                  |                            |                                           |
| Integration / e2e                           |                  |                            |                                           |
| Build/package                               |                  |                            |                                           |
| Security scans (SAST/SCA/secrets)           |                  |                            |                                           |
| Migrations/backfills                        |                  |                            |                                           |
| Performance checks                          |                  |                            |                                           |
| Async/distributed checks (replay/retry/DLQ) |                  |                            |                                           |

### Commands used / recommended

- `...`
- `...`

---

## Compatibility / rollout

| Topic                | Notes                                                   |
| -------------------- | ------------------------------------------------------- |
| Compatibility impact | (breaking? additive? behavior change?)                  |
| Versioning           | (semver, schema version, endpoint version)              |
| Migrations           | (forward-only? reversible? backfill? large table plan?) |
| Feature flags        | (default state, targeting, kill switch)                 |
| Rollback             | (how to rollback safely; data compatibility)            |

---

## PR discussion / unresolved threads

| Thread / Topic              | Status                | Resolution                     |
| --------------------------- | --------------------- | ------------------------------ |
| (link or short description) | unresolved / resolved | (what changed or why deferred) |
|                             |                       |                                |

---

## Docs / follow-ups

| Item                | Owner / Tracking  | Notes |
| ------------------- | ----------------- | ----- |
| Spec/doc update     | (PR / issue link) |       |
| Follow-up hardening | (issue link)      |       |
| Deferred refactor   | (issue link)      |       |

---

## Not verified / residual risk (required)

**⚠️ YOU SHALL NOT SKIP THIS SECTION — SEE §12.2 FOR POPULATION RULES**

List anything you did not verify mechanically, plus how to verify it.

- Not verified: …
  - Why it matters:
  - How to verify:
  - Suggested owner/tracking (if needed):

IF this section would be empty, THEN you SHALL state: "All claims verified mechanically; no residual risk identified. See Verification Ledger for evidence."

---

## Final sanity check (Round 5)

**⚠️ YOU SHALL COMPLETE THIS SECTION PER §4 ROUND 5 — DO NOT SKIP**

(After completing all structured rounds, revisit this section. Does the change make sense as a whole? Did the checklists miss anything? Any lingering concerns?)

- Fresh eyes observations addressed: [yes / no — list any that were missed]
- Holistic assessment: ...
- Unexplained concerns (if any): ...

---

## PROTOCOL COMPLIANCE VERIFICATION

**You SHALL complete this checklist before submitting your review:**

- [ ] Verdict stated (APPROVE / REQUEST CHANGES / BLOCK) — per §Protocol Integrity
- [ ] All Rounds (−1 through 5) documented or marked N/A — per §4
- [ ] Severity counts included — per §12
- [ ] Template structure followed — per §13.1
- [ ] Residual risk section populated or explicitly cleared — per §12.2
- [ ] Evidence anchors provided for all BLOCKER/MAJOR findings — per §1.5.1

**IF ANY CHECK FAILS, THEN YOUR REVIEW IS INCOMPLETE. YOU SHALL RETURN TO THE INCOMPLETE SECTION.**
```

### 13.2 AI reviewer usage

**Cross-references**: This section references §0 (How to use), §Protocol Integrity.

**You SHALL follow the guidance in §0 "How to use this guide (humans and AI reviewers)".**

This section stays short on purpose so the guidance is treated as part of the overall document, not as a standalone "paste this prompt" block.

**Reminder of binding obligations from §Protocol Integrity:**

- You SHALL execute ALL phases in order (Rounds −1 through 5)
- You SHALL produce a final verdict (APPROVE / REQUEST CHANGES / BLOCK)
- You SHALL use the template from §13.1
- You SHALL cite evidence for every claim per §1.5.1
- You SHALL populate residual risk per §12.2

---

## 14) Quick Review Card (one-page cheat sheet)

**Cross-references**: This section is referenced by §11 (Depth selection). It references §4 (Workflow), §6, §7 (Checklists), §10 (Security). You MAY use this ONLY for Lightweight Review depth per §11.

**⚠️ USAGE RESTRICTIONS:**

- You SHALL use this card ONLY for Lightweight Review (pure mechanical refactors with verified coverage) per §11.
- You SHALL NOT use this card for high-risk domains per §1.3.
- IF risk is high, THEN you SHALL NOT stop here—you SHALL use the full workflow in §4.
- WHEN any stop condition (below) triggers, THEN you SHALL escalate to Full Audit per §11.

### A) 2-minute triage

You **SHALL**:

- [ ] Read PR description + linked issue(s) (or infer from commits/branch).
- [ ] Identify **risk level** (low/medium/high) and why.
- [ ] Identify **contract surfaces** touched (API/schema/DB/CLI/config/events).
- [ ] Note **side effects**: network / filesystem / subprocess / migrations / permissions.
- [ ] Note **async/distributed**: queues, workers, retries, background tasks, event handlers.

#### Stop conditions (immediate escalation to Full Audit)

**WHEN ANY of these are present, THEN you SHALL stop Quick Review and you SHALL apply Full Audit (§4 + §10):**

- [ ] auth/authz changes → **BLOCKER** candidate
- [ ] migrations on large tables without batching/rollback plan → **MAJOR** candidate
- [ ] new outbound network paths to untrusted destinations → **BLOCKER** candidate
- [ ] changes to public schema/API/CLI output without versioning/tests → **MAJOR** candidate
- [ ] caching added/changed without invalidation/bounds → **MAJOR** candidate
- [ ] concurrency/async changes without ordering/idempotency proof → **MAJOR** candidate
- [ ] secrets/PII in logs or errors → **BLOCKER**
- [ ] "exactly-once" or "atomic" claims without test proof → **MAJOR** candidate

---

### B) 10-minute "outside-in" scan

For each category, IF a check fails, THEN you SHALL escalate to full checklist (§6/§7) and assign severity per §2.

1. **Contracts & boundaries**

   - [ ] Boundary validation exists (types/ranges/length). → IF missing: you SHALL flag as **MAJOR**
   - [ ] Unknown-field policy is explicit and tested (reject or documented ignore). → IF missing: you SHALL flag as **MINOR**
   - [ ] Breaking changes are versioned or explicitly acknowledged. → IF unversioned: you SHALL flag as **BLOCKER**

2. **State & persistence**

   - [ ] Writes happen only in allowed layer (ownership respected). → IF violated: you SHALL flag as **BLOCKER**
   - [ ] Retry/duplicate safety (idempotency) is correct where needed. → IF missing: you SHALL flag as **MAJOR**
   - [ ] Ordering/determinism rules are preserved. → IF violated: you SHALL flag as **MAJOR**

3. **Async/distributed**

   - [ ] Handler is safe under retries/duplicates. → IF unsafe: you SHALL flag as **BLOCKER**
   - [ ] Concurrency is bounded; backpressure exists. → IF unbounded: you SHALL flag as **MAJOR**
   - [ ] Poison/failed work path exists (DLQ/quarantine/alerts). → IF missing: you SHALL flag as **MAJOR**
   - [ ] Cancellation/shutdown won't leak tasks or lose commits. → IF leaks: you SHALL flag as **MAJOR**

4. **Security**

   - [ ] Authn/authz checks are present and correct (object-level permissions if relevant). → IF missing: you SHALL flag as **BLOCKER**
   - [ ] No injection risks (SQL/command/path/template/deserialization). → IF found: you SHALL flag as **BLOCKER**
   - [ ] No secrets/PII in logs/traces/errors. → IF found: you SHALL flag as **BLOCKER**

5. **Reliability**

   - [ ] Timeouts + bounded retries for external calls. → IF missing: you SHALL flag as **MAJOR**
   - [ ] Partial failure behavior is defined (rollback/compensation). → IF undefined: you SHALL flag as **MAJOR**
   - [ ] Feature flags/rollout/rollback plan exists if risky. → IF missing for risky change: you SHALL flag as **MINOR**

6. **Tests & docs**
   - [ ] Tests cover happy path + rejection path.
   - [ ] Changed production code has test exercising each modified branch (or justified exception with issue link).
   - [ ] CI gates still enforce required checks.
   - [ ] Docs/specs updated if behavior/contract changed.

→ WHEN any item fails: you SHALL cite `file:line` + severity per full checklist (§6, §9).

---

### C) Discussion closure (PRs)

WHEN reviewing a PR, you **SHALL**:

- [ ] Verify unresolved review threads are resolved or explicitly deferred (with tracking).
- [ ] IF using CLI: confirm unresolved inline threads (not just PR comments) are handled per §4 Round 3.
- [ ] Verify new commits didn't introduce unreviewed risk.
- [ ] Verify required reviewers/codeowners are satisfied.

#### CLI helper for unresolved inline threads (GraphQL)

```bash
gh api graphql -F owner=<owner> -F repo=<repo> -F number=<pr> -f query='query($owner:String!, $repo:String!, $number:Int!) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:100) { nodes { isResolved comments(first:10) { nodes { author { login } body path line } } } } } } }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
```

#### CLI helper to reply inline (REST)

```bash
gh api -X POST /repos/<owner>/<repo>/pulls/<pr_number>/comments/<comment_id>/replies \
  -f body="reply text"
```

---

### D) Findings standard (how to write comments)

For any non-NIT finding, you **SHALL** include per §1.1:

- **Location** + **What** + **Why (failure mode)** + **Fix** + **Test/verification**

---

### E) Minimal review output template (Quick Review Card)

**⚠️ You SHALL use this template ONLY for Lightweight Review per §11. For all other review depths, you SHALL use the full template from §13.1.**

**You SHALL still include a verdict even in Quick Review Card format.**

```md
## Summary

- Intent:
- Risk level: low/medium/high (why)
- Areas touched:
- Review depth: [Full Audit / Contract-Focused / Async / Lightweight / Standard] — [justification]
- **Verdict: APPROVE / REQUEST CHANGES / BLOCK** ← YOU SHALL INCLUDE THIS

## Findings

For each non-NIT finding, you SHALL use this format:

- [SEVERITY] `file:line` — [issue] → [fix]. Evidence: [anchor].

| ID  | Severity | Location | Issue | Evidence |
| --- | -------- | -------- | ----- | -------- |
|     |          |          |       |          |

## Verification

| Check | Command | Result | Evidence |
| ----- | ------- | ------ | -------- |
|       |         |        |          |

- Test gaps / follow-ups:
- Rollout / migration notes:
- Unresolved threads:

## Residual risk (required per §12.2)

- Not verified: [what] — Why: [failure mode] — How to verify: [action]

IF empty, you SHALL state: "All claims verified mechanically; no residual risk identified."
```

---

## ⚠️ END OF DOCUMENT — FINAL PROTOCOL REMINDER

**You have now read the complete Universal Code Review Guidelines.**

**Before you begin your review, you SHALL confirm:**

1. You understand the Protocol Integrity section at the top of this document
2. You will execute ALL Rounds (−1 through 5) in order per §4
3. You will produce a verdict (APPROVE / REQUEST CHANGES / BLOCK) per §12
4. You will use the template from §13.1 (or §14.E for Lightweight Review only)
5. You will populate residual risk per §12.2

**IF you skip phases, omit the verdict, ignore templates, or leave residual risk empty without justification, your review violates this protocol and is invalid.**

**Cross-reference summary for enforcement mesh:**

- §Protocol Integrity → §0, §4, §12, §13
- §0 → §3, §4, §11, §12, §13
- §4 → §1, §2, §3, §5-§10, §12, §13
- §11 → §1.3, §4, §10, §14
- §12 → §1.5, §4, §13
- §13 → §0, §4, §12

**Now begin your review following the procedure in §0.**