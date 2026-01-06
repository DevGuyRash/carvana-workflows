# Universal Code Review Guidelines & Prompt (Language‑Agnostic)

**Status**: Canonical Baseline

> A practical, paste‑anywhere code review standard for **humans and AI reviewers**.
> The repository’s own docs/contracts/policies are authoritative and must be followed.

---

## Table of contents- [Universal Code Review Guidelines \& Prompt (Language‑Agnostic)](#universal-code-review-guidelines--prompt-languageagnostic)

- [Universal Code Review Guidelines \& Prompt (Language‑Agnostic)](#universal-code-review-guidelines--prompt-languageagnostic)
  - [Table of contents- Universal Code Review Guidelines \& Prompt (Language‑Agnostic)](#table-of-contents--universal-code-review-guidelines--prompt-languageagnostic)
  - [0) How to use this guide (humans and AI reviewers)](#0-how-to-use-this-guide-humans-and-ai-reviewers)
    - [If you use an AI reviewer](#if-you-use-an-ai-reviewer)
      - [Inputs to provide (minimum)](#inputs-to-provide-minimum)
      - [Procedure (what the AI must do)](#procedure-what-the-ai-must-do)
      - [Output requirements](#output-requirements)
      - [GitHub CLI note: unresolved inline threads](#github-cli-note-unresolved-inline-threads)
  - [0.1) What this is for](#01-what-this-is-for)
  - [1) Non‑shallow review rules (quality bar)](#1-nonshallow-review-rules-quality-bar)
    - [1.1 Every finding must be anchored](#11-every-finding-must-be-anchored)
    - [1.2 Evidence beats vibes](#12-evidence-beats-vibes)
    - [1.3 Risk dictates depth](#13-risk-dictates-depth)
    - [1.4 Prefer small, composable patches](#14-prefer-small-composable-patches)
    - [1.5 Audit discipline (anti false completeness)](#15-audit-discipline-anti-false-completeness)
      - [1.5.1 Evidence standard (hard citations)](#151-evidence-standard-hard-citations)
      - [1.5.2 Confidence calibration (required language)](#152-confidence-calibration-required-language)
      - [1.5.3 Signal preservation (anti dilution rules)](#153-signal-preservation-anti-dilution-rules)
      - [1.5.4 Approval discipline (release-readiness mindset)](#154-approval-discipline-release-readiness-mindset)
  - [2) Severity rubric (required)](#2-severity-rubric-required)
  - [3) Repository contract \& workflow discovery (mandatory first step)](#3-repository-contract--workflow-discovery-mandatory-first-step)
    - [3.1 Read the repo’s instruction set (in priority order if present)](#31-read-the-repos-instruction-set-in-priority-order-if-present)
    - [3.2 Repo Snapshot (fill this in during discovery)](#32-repo-snapshot-fill-this-in-during-discovery)
    - [3.3 Discovery enforcement rules (mechanical)](#33-discovery-enforcement-rules-mechanical)
  - [4) Review workflow (multi‑pass, with required coverage)](#4-review-workflow-multipass-with-required-coverage)
    - [Round −1 — Fresh eyes (mandatory)](#round-1--fresh-eyes-mandatory)
    - [Round 0 — Triage \& intent (mandatory)](#round-0--triage--intent-mandatory)
      - [Quick triage checks](#quick-triage-checks)
      - [Change inventory (required for audit-style reviews)](#change-inventory-required-for-audit-style-reviews)
      - [Commit hygiene (required)](#commit-hygiene-required)
    - [Round 1 — Diff review (mandatory)](#round-1--diff-review-mandatory)
      - [“Play computer” checklist](#play-computer-checklist)
    - [Round 2 — Requirements trace (mandatory when possible)](#round-2--requirements-trace-mandatory-when-possible)
      - [Using `git` (works anywhere)](#using-git-works-anywhere)
      - [Using GitHub CLI (`gh`) when available](#using-github-cli-gh-when-available)
      - [If a PR exists, also review](#if-a-pr-exists-also-review)
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
  - [13) Templates (copy/paste)](#13-templates-copypaste)
    - [13.1 Findings template](#131-findings-template)
    - [13.2 AI reviewer usage](#132-ai-reviewer-usage)
  - [14) Quick Review Card (one-page cheat sheet)](#14-quick-review-card-one-page-cheat-sheet)
    - [A) 2-minute triage](#a-2-minute-triage)
      - [Stop conditions (immediate escalation to Full Audit)](#stop-conditions-immediate-escalation-to-full-audit)
    - [B) 10-minute "outside-in" scan](#b-10-minute-outside-in-scan)
    - [C) Discussion closure (PRs)](#c-discussion-closure-prs)
      - [CLI helper for unresolved inline threads (GraphQL)](#cli-helper-for-unresolved-inline-threads-graphql)
    - [D) Findings standard (how to write comments)](#d-findings-standard-how-to-write-comments)
    - [E) Minimal review output template (Quick Review Card)](#e-minimal-review-output-template-quick-review-card)

---

## 0) How to use this guide (humans and AI reviewers)

This document is the review standard. Use it as the operating instructions for
any reviewer (human or AI). Do not treat any single section as a standalone
“paste this prompt” block that replaces the rest of the file.

### If you use an AI reviewer

#### Inputs to provide (minimum)

- The diff/patch (or repo + branch/commit range)
- PR description / acceptance criteria (or issue link)
- Any repo-specific constraints you already know (build/test commands,
  rollout/migration rules, security model)

#### Procedure (what the AI must do)

1. **Fresh eyes pass** — follow §4 Round −1. Read through the entire change and record your unfiltered observations before applying any checklists.
2. **Repo discovery** — follow §3 and identify the repo's authoritative rules (docs, contracts, CI gates).
3. **Round 0 triage** — follow §4 Round 0 and state intent, risk level, and contract surfaces touched.
4. **Round 1 diff review** — follow §4 Round 1; apply §1 (evidence) + §2 (severity rubric); produce BLOCKER/MAJOR/MINOR/NIT findings.
5. **Round 2 requirements trace** — follow §4 Round 2 when PR/issue context is available (or discover it via `git`/`gh`).
6. **Round 3 discussion closure (PRs)** — follow §4 Round 3 and ensure review threads are actually resolved (or explicitly deferred with tracking).
7. **Verification** — use the repo's canonical commands per §12 and clearly call out what was/wasn't run.
8. **Final sanity check** — follow §4 Round 5. Set aside the checklists and evaluate the change holistically, capturing anything the structured passes overlooked.

#### Output requirements

- Use §12 as the required section list and §13.1 as the report skeleton.
- Every BLOCKER/MAJOR finding includes location, concrete failure mode, a fix,
  and a verification step.

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

---

## 0.1) What this is for

A strong review answers four questions:

1. **Correctness**: Does it meet requirements and handle edge cases (including concurrency and retries)?
2. **Safety**: Does it preserve security, privacy, and reliability (and fail safely)?
3. **Maintainability**: Is it readable, testable, and reasonably simple for future contributors?
4. **Compatibility**: Does it respect published contracts (APIs/schemas/DB) and release/rollout constraints?

---

## 1) Non‑shallow review rules (quality bar)

These rules exist to prevent “checkbox reviews” and ensure the output is verifiable.

### 1.1 Every finding must be anchored

For each **BLOCKER/MAJOR/MINOR** finding, include:

- **Label**: BLOCKER / MAJOR / MINOR / NIT
- **Location**: file path(s) + symbol(s) (function/class/module)
- **What**: the specific behavior or risk
- **Why it matters**: concrete failure mode (security, data loss, outages, regressions, compatibility)
- **Fix**: a concrete suggestion (pseudo‑diff, exact API change, refactor outline)
- **Test/verification**: what test to add or how to validate (unit/integration/e2e, lint rule, migration check)

> If you can’t point to code and a failure mode, it’s not a finding—it's a preference (NIT) or speculation (ask for proof).

### 1.2 Evidence beats vibes

→ When review conclusion lacks evidence anchors: flag as incomplete.
→ When "looks good" or equivalent appears without citing what was checked: flag as **MINOR** (request specifics).

For each review, explicitly state what was checked:

- [ ] Contracts verified: [list or "none in scope"]
- [ ] Tests verified: [ran / read / not checked]
- [ ] Rollback considered: [yes with plan / not applicable / not checked]
- [ ] Edge cases checked: [list or "none identified"]

### 1.3 Risk dictates depth

If risk is **high**, a "short review" is not acceptable. High risk includes: auth, permissions, data migrations, payments, concurrency/async, caching, distributed systems, external calls, cryptography, PII/PHI.

→ When high-risk domain is touched and review uses §14 Quick Card only: flag as **MAJOR** (insufficient review depth). Escalate to Full Audit per §11.

### 1.4 Prefer small, composable patches

- When a diff is large and mixes refactoring with behavior changes, flag as **MINOR** (recommend splitting). The goal is reviewability—if the change is hard to follow because of its size or scope, it should be broken up.
- When refactoring is necessary without characterization tests: flag as **MINOR** (request tests or explicit risk acknowledgment).
- When behavior change and refactor are combined in same commit: flag as **NIT** (recommend separation) unless explicitly justified in commit message.

### 1.5 Audit discipline (anti false completeness)

This guide assumes you want **audit-style reviews / release-readiness memos by default**.
That means the review must be:

- **mechanical** (explicit checks, not vibes),
- **evidence-backed** (claims tied to code/tests/commands),
- **signal-preserving** (critical issues cannot get buried in narrative).

#### 1.5.1 Evidence standard (hard citations)

For any non-trivial claim (especially “safe”, “backwards compatible”, “migration is safe”, “no user-visible change”, “idempotent”, “race-free”):

- include an **evidence anchor** directly under the claim:
  - `path/to/file.ext:line` and symbol name(s),
  - test name(s) and where they live,
  - command(s) run and their outcome (or “not run”).

**If you cannot produce evidence anchors, downgrade the statement** to a question or add it to **Not verified / residual risk**.

#### 1.5.2 Confidence calibration (required language)

Use one of these labels for important conclusions:

- **Verified**: you ran the relevant check/test and it passed, or you have an objective artifact (CI run, logs).
- **Supported by code reading**: you did not run it, but the logic is clear and backed by tests/docs.
- **Assumed**: you believe it’s true but did not verify it (must go in _Not verified_).
- **Unknown**: you cannot determine from the diff/context (must become a question or a requested follow-up).

Avoid absolute phrasing without verification:

- ❌ “Production-ready.” “Safe.” “No risk.” “Fully addressed.”
- ✅ “Verified by …” / “Supported by …” / “Not verified: …”

#### 1.5.3 Signal preservation (anti dilution rules)

To prevent “big report, low signal”:

- Put **Verdict + severity counts + Findings Index** near the top.
- Keep **BLOCKER/MAJOR** sections concise and actionable; move narrative to appendices.
- If you add “nice-to-have” notes, keep them in **MINOR/NIT** and do not mix them into blockers.

#### 1.5.4 Approval discipline (release-readiness mindset)

Only use **APPROVE** when _all_ are true:

- No **BLOCKER/MAJOR** items remain.
- Required verification gates are **run and passing**, or a clearly documented exemption exists.
- Contract/compatibility implications are addressed (versioning, migration plan, rollback).
- Docs/specs are updated or an explicit follow-up is filed (and justified).
- PR discussion threads (including inline) are resolved or explicitly deferred with tracking.

Otherwise, use **REQUEST CHANGES** (or **BLOCK** if invariants/contracts are violated).

---

## 2) Severity rubric (required)

|       Label | Meaning                                                                                                                             | Merge impact          |
| ----------: | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **BLOCKER** | Violates an invariant/contract, introduces a security vulnerability, data corruption risk, or makes the system unreliable.          | Must fix before merge |
|   **MAJOR** | Breaks compatibility, introduces nondeterminism, meaningfully degrades security posture, or lacks critical tests for risky changes. | Must fix before merge |
|   **MINOR** | Improves clarity, coverage, maintainability; non‑blocking but recommended.                                                          | Should fix            |
|     **NIT** | Cosmetic or preference‑level suggestions with low impact.                                                                           | Optional              |

**Rule**: For **BLOCKER/MAJOR**, always include a concrete fix + verification step, and name the protected constraint (contract, invariant, trust boundary, migration rule, etc.).

---

## 3) Repository contract & workflow discovery (mandatory first step)

Before reviewing logic, establish the repo’s rules so you don’t accidentally recommend violating them.

### 3.1 Read the repo’s instruction set (in priority order if present)

- `README.md` / “Getting Started”
- `CONTRIBUTING.md`, `CODEOWNERS`, `SECURITY.md`, `CONSTITUTION.md` (or equivalent)
- Any “agent instruction” files: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `QWEN.md`, `CODEX.md`, `.cursorrules`, `.github/copilot-instructions.md`
- Architecture/spec docs: `docs/`, `context/`, `adr/`, `design/`, `spec/`, `prd/`, `rfcs/`
- Contract artifacts: `openapi.*`, `schemas/`, `proto/`, `graphql/`, `contracts/`, `api/`
- Operational/deploy docs: `runbooks/`, `deploy/`, `helm/`, `terraform/`, `.github/workflows/` (or CI equivalents)

### 3.2 Repo Snapshot (fill this in during discovery)

Write this at the top of your review **if it isn’t already obvious** from the PR description.

| Field                                  | Notes                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Primary runtime(s)**                 | service / CLI / UI / library / worker / cron                                                                      |
| **State source of truth**              | DB tables / event log / files / external system (be explicit)                                                     |
| **Write ownership rules**              | who is allowed to write state; where writes are allowed; any “single writer” or “no direct DB writes” constraints |
| **Contract surfaces**                  | APIs / schemas / DB migrations / CLI output / config formats / events / file formats                              |
| **Compatibility promises**             | semver, stability guarantees, deprecation policy, forward/backward compatibility requirements                     |
| **Security model**                     | authn/authz approach; policy gates; audit logging; secret handling; multi-tenant isolation rules                  |
| **Side-effect policy**                 | network rules; allowlists/deny-lists; subprocess rules; filesystem rules; sandbox/trust tiers                     |
| **Determinism requirements**           | stable ordering; replay/rebuild; reproducible builds; “no hidden state” rules                                     |
| **Release/rollout rules**              | feature flags, staged rollout, canary strategy, rollback expectations, migration sequencing                       |
| **Canonical build/lint/test commands** | copy from docs/CI (don’t invent new ones)                                                                         |
| **Required tooling gates**             | format/lint/tests/security scans/benchmarks required to merge                                                     |
| **Report storage convention**          | where code review reports (if any) are saved; naming rules                                                        |

> If the repo's invariant rules are unclear or missing, treat it as a **process risk** and recommend documenting them—especially for state ownership, security boundaries, contract evolution, async/delivery semantics, and rollout/migration rules.

### 3.3 Discovery enforcement rules (mechanical)

The reviewer shall verify discovery was performed and flag gaps:

- [ ] **Discovery evidence**: Cite at least one authoritative doc read (e.g., `README.md`, `CONTRIBUTING.md`, or agent instruction file).
      → If no authoritative doc exists in repo: flag as **MINOR** (recommend creating one).
      → Evidence: doc path read + summary of key constraints found.
- [ ] **Repo Snapshot populated**: When reviewing for the first time (or after major changes), verify the Repo Snapshot table (§3.2) is filled.
      → If critical fields are "unknown" (security model, contract surfaces, state source of truth): flag as **MINOR** and add to residual risk.
      → Evidence: completed Repo Snapshot in report.
- [ ] **High-risk domain docs**: When the change touches auth, payments, migrations, or PII, verify a relevant security/contract doc exists.
      → If high-risk domain touched without documented rules: flag as **MAJOR** (process gap).
      → Evidence: doc path OR "not found" + recommendation.

---

## 4) Review workflow (multi‑pass, with required coverage)

### Round −1 — Fresh eyes (mandatory)

Before applying any checklists or structured analysis, read through the entire change and record your unfiltered observations. This phase captures intuitive signals that mechanical passes often miss.

Do not consult the checklists in this document during this round. Simply read the code and write down whatever you notice—confusion, complexity, things that feel off, questions that arise, patterns that seem unusual, or anything else that catches your attention.

Record these observations in a dedicated section of your report. After completing all subsequent rounds, revisit this list to ensure nothing was lost in the structured analysis.

---

### Round 0 — Triage & intent (mandatory)

- Read the PR description (or commit message/branch name if no PR).
- Identify:
  - **Intent**: what user/system behavior changes?
  - **Risk level**: low / medium / high (justify briefly)
  - **Affected domains**: API, storage, security, concurrency/async, UI, tooling, infra, etc.
  - **Contract surfaces touched**: APIs/schemas/DB/migrations/CLI outputs/event formats/config

#### Quick triage checks

- Does the diff include contract files (schemas, API specs, migrations)?
- Are there new dependencies or permissions/capabilities?
- Are there new side effects (network/file/subprocess)?
- Is there any “silent behavior change” risk (defaults, ordering, parsing)?
- Is there new async/distributed behavior (queues, jobs, retries, event handlers, background tasks)?

#### Change inventory (required for audit-style reviews)

Add an explicit inventory section in the report before deep findings:

- **Diffstat**: number of files + approximate LOC churn (use `git diff --stat` / `--numstat`).
- **Files touched**: list files grouped by _domain_ (contracts, storage, security, UI, infra).
- **Contract surfaces**: call out exactly what is public/stable (schemas/APIs/CLI outputs/DB migrations).
- **Dependency/capability delta**: new deps, new permissions, new network/file/subprocess use.
- **Data/migration delta**: migrations, backfills, irreversible steps, mixed-version considerations.

This prevents missing “small-looking” but high-risk surfaces.

#### Commit hygiene (required)

Even without reformatting the PR, reviewers must check:

- are commits logically separated (refactor vs behavior)?
- does each commit build/test (or at least not obviously break invariants)?
- are there “fixup” commits that hide unfinished work?

If the commit structure increases audit risk, flag it as **MINOR** (or **MAJOR** if it blocks understanding/verification).

---

### Round 1 — Diff review (mandatory)

Review from outside‑in:

1. **Contracts & boundaries**: schemas, API routes, CLI flags, public interfaces
2. **State & persistence**: data model changes, migrations, idempotency, ordering
3. **Core logic**: correctness, edge cases, error handling, determinism
4. **Security**: authz/authn, validation, secrets, logging, external calls
5. **Async/distributed behavior**: retries, ordering, idempotency, cancellation, backpressure
6. **Tests & docs**: coverage, hermeticity, spec/runbook updates

#### “Play computer” checklist

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

---

### Round 2 — Requirements trace (mandatory when possible)

If PR/issue context wasn’t provided, attempt discovery and then re‑review against requirements.

#### Using `git` (works anywhere)

```bash
git status
git diff
git log --oneline --decorate -n 50
git branch --show-current
git show -1
```

#### Using GitHub CLI (`gh`) when available

```bash
gh repo view
gh pr status
gh pr list --limit 20
gh issue list --limit 20
gh pr view <PR_NUMBER> --json title,body,labels,files,comments,reviews
gh issue view <ISSUE_NUMBER> --json title,body,labels,comments
```

#### If a PR exists, also review

- PR template checkboxes (if any)
- linked issues / acceptance criteria
- commit history for “fixup” signs of unresolved work
- labels indicating rollout/security/migration requirements

#### Re‑review questions

- Does the diff fully address acceptance criteria?
- Are there “TODOs” that should be tracked as explicit follow‑ups?
- Is anything solved only partially (happy path only; missing rollback; missing authz)?
- Are there scope creeps that increase risk without payoff?
- Are non-functional requirements met (latency, resource limits, reliability, auditability)?
- For async/distributed systems: are delivery semantics and retries correctly handled?

#### Requirements traceability (audit requirement)

When PR/issue acceptance criteria exist, include a **traceability matrix** in the report:

- each acceptance criterion / requirement,
- status (Met / Partially / Not met / Not in scope),
- evidence anchors (code + tests + docs),
- follow-ups (issue/task) for anything deferred.

---

### Round 3 — Discussion & unresolved thread closure (mandatory for PRs)

A PR is not “done” until the discussion state matches the code.

#### 4.3.1 Review threads: are we done?

- Read all PR **comments and review threads**.
- Confirm:
  - Are any threads **unresolved**?
  - Were requested changes implemented?
  - Were any reviewer questions answered with sufficient evidence?
  - If something wasn’t changed, is the rationale explicit and acceptable?
  - Are follow-ups tracked (issue/task) when work is deferred?

#### 4.3.2 How to find unresolved conversations (especially inline review threads)

**Important**: `gh pr view <number> --comments` does **not** include inline review threads.

- **Option A (recommended)**: check the PR on GitHub’s UI and filter for unresolved threads.
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

  - `first:100` and `comments(first:10)` are limits; if you have more, add pagination.
  - Use the output to confirm every unresolved thread is either addressed in code or explicitly resolved/deferred with rationale.

#### 4.3.3 Responding to PR feedback (thread hygiene)

Applies to both authors and reviewers; it prevents “lost” decisions.

- Reply in the **same thread** as the feedback (avoid new top-level comments unless summarizing).
- **Resolve conversations** only when the feedback is addressed (code changed, question answered, or decision recorded).
- **Do not resolve** a conversation if you still need input—reply and explicitly tag/request follow-up from the reviewer.
- When pushing changes in response to feedback:
  - summarize what changed and where,
  - call out what remains unchanged and why (if applicable),
  - re-request review if required by repo workflow.

#### 4.3.4 Review drift & merge gates

- Check for **review drift**:
  - The diff changed after earlier reviews—did it introduce new risks?
  - Were earlier approvals invalidated by later commits?
  - Did new commits touch unreviewed areas?
- Verify all required checks:
  - CI status (tests/lint/security scans)
  - required reviewers/code owners
  - release notes or migration notes if required
  - compliance requirements (if any) satisfied

---

### Round 4 — Verification (mandatory for high risk; required for standard reviews when commands available)

Use the repo's canonical commands (from docs/CI) and confirm outcomes.

→ When high-risk domain is touched and verification not run: flag as **MAJOR** (add to residual risk with justification).
→ When verification commands are available but not run for any review: add to residual risk section.

Required verification gates (run all that apply):

- format
- lint/static analysis
- unit tests
- integration/e2e tests (when behavior spans components)
- security scans (SAST/SCA/secret scanning)
- build artifacts (packages, containers, bundles)
- migrations (apply on representative data; rollback if supported/required)
- performance/benchmarks (when perf-sensitive)
- async/distributed validation (consumer replay, idempotency tests, retry behavior) when applicable

If you cannot run them, the review should still:

- name what _should_ be run, and
- call out gaps (e.g., “migration not tested”, “no coverage for authz denial path”, “retry behavior not tested”).

#### Verification artifacts (audit requirement)

For each gate/check you claim passed, record at least one of:

- the command used,
- the environment/source (local vs CI),
- the result (pass/fail),
- and (when available) a stable pointer (test name(s), log snippet, CI job name).

---

### Round 5 — Final sanity check (mandatory)

After completing all structured rounds, set aside the checklists and evaluate the change holistically.

This round exists because mechanical analysis can miss the forest for the trees. A change may pass every checklist item yet still be fundamentally flawed in a way no checkbox anticipated.

Revisit your Round −1 observations and confirm each was either addressed by the structured passes or is now captured as a finding. Then ask yourself whether this change, taken as a whole, is something you would be comfortable deploying. If something still feels wrong but you cannot articulate a specific checklist violation, record it anyway—unexplained discomfort is a signal worth preserving.

---

## 5) Core engineering principles (mechanical checks)

For each principle, the reviewer shall apply the associated checklist and produce evidence anchors. If a violation is found, flag it with the indicated severity.

---

### 5.1 KISS — Keep It Simple

When reviewing for simplicity, verify:

- [ ] **Abstraction justification**: For each new abstraction (class, interface, wrapper, factory) introduced in the diff, cite at least two distinct call sites OR a documented extension point.
      → If fewer than two exist: flag as **MINOR** (premature abstraction). Evidence: `file:line` of abstraction + call sites.
- [ ] **Indirection depth**: When a function call chain exceeds 3 hops before reaching business logic, cite the chain and justify why intermediate layers are necessary.
      → If unjustified: flag as **MINOR**. Evidence: call chain `A() → B() → C() → D()` with file:line for each.
- [ ] **Configuration surface**: When new config options are added, verify each option has a documented use case or existing consumer.
      → If undocumented/unused: flag as **NIT**. Evidence: config key + usage location(s).

---

### 5.2 DRY — Don't Repeat Yourself

When reviewing for duplication, verify:

- [ ] **Logic duplication**: When similar logic appears in multiple locations within the diff or across the repo, cite all locations. Use judgment for what constitutes "meaningful" duplication—trivial boilerplate may be acceptable, but business logic should not be repeated.
      → If duplicated without justification: flag as **MINOR** (same-bug-twice risk). Evidence: `file1:line` and `file2:line` with description of duplicated logic.
- [ ] **Rule duplication**: When validation rules, business constraints, or formatting logic are defined in multiple places, cite all locations.
      → If duplicated: flag as **MINOR**. Evidence: locations + which rule is duplicated.
- [ ] **Constant duplication**: When magic numbers or strings appear in multiple locations, cite all occurrences.
      → If >2 occurrences without named constant: flag as **NIT**. Evidence: value + locations.

---

### 5.3 YAGNI — You Aren't Gonna Need It

When reviewing for speculative generality, verify:

- [ ] **Unused parameters/options**: When new function parameters, config options, or feature flags are added, verify each has at least one active use in the diff or existing codebase.
      → If unused: flag as **MINOR**. Evidence: parameter/option name + grep showing zero usages.
- [ ] **Premature interfaces**: When an interface/protocol/trait is introduced with only one implementation, cite the implementation.
      → If single implementation and no documented extension plan: flag as **NIT**. Evidence: interface at `file:line`, sole implementer at `file:line`.
- [ ] **Over-parameterization**: When a function has >5 parameters or a config object has >10 options, verify each is actively used.
      → If >20% unused: flag as **MINOR**. Evidence: parameter list + usage counts.

---

### 5.4 SOLID principles (mechanical checks)

#### Single Responsibility

- [ ] **Responsibility count**: When a class/module has methods spanning >3 distinct concerns (e.g., I/O + parsing + business logic + formatting), cite the method groups.
      → If >3 concerns: flag as **MINOR** (split candidate). Evidence: `file:line` + list of concern groupings.

#### Open/Closed

- [ ] **Modification vs extension**: When existing stable code is modified (not extended) to add new behavior, verify no safer extension point exists.
      → If modification was avoidable via existing extension mechanism: flag as **MINOR**. Evidence: modified code at `file:line` + alternative extension point.

#### Liskov Substitution

- [ ] **Override behavior preservation**: When a method is overridden, verify the override does not violate the base contract (preconditions not strengthened, postconditions not weakened).
      → If contract violated: flag as **MAJOR**. Evidence: base method at `file:line`, override at `file:line`, contract difference.

#### Interface Segregation

- [ ] **Interface size**: When an interface has many methods, verify all implementers use all methods. Large interfaces with partial implementations suggest the interface should be split.
      → If implementers leave methods as no-op/stub: flag as **MINOR** (split candidate). Evidence: interface at `file:line`, stub implementations.

#### Dependency Inversion

- [ ] **Concrete dependencies at boundaries**: When a module directly instantiates external dependencies (DB clients, HTTP clients, file handles) inline rather than accepting them as parameters, cite the instantiation.
      → If inline instantiation blocks testing: flag as **MINOR**. Evidence: instantiation at `file:line`.

---

### 5.5 Law of Demeter (Least Knowledge)

When reviewing for coupling, verify:

- [ ] **Chain length**: When method chains exceed 2 dots (e.g., `a.b().c().d()`), cite the chain and verify intermediate objects are not implementation details.
      → If chain exposes internals: flag as **MINOR**. Evidence: chain at `file:line` + which object is leaked.
- [ ] **Friend access**: When code accesses fields/methods of an object obtained from another object's return value, verify this is part of the public contract.
      → If accessing internal structure: flag as **MINOR**. Evidence: access pattern at `file:line`.

---

### 5.6 Make Illegal States Unrepresentable

When reviewing for type safety, verify:

- [ ] **Stringly-typed data**: When a string is used where an enum, newtype, or validated wrapper would prevent invalid values, cite the usage.
      → If invalid values are possible at runtime: flag as **MINOR**. Evidence: string usage at `file:line` + example invalid value.
- [ ] **Optional misuse**: When null/None/undefined is used to represent a domain state (e.g., "not started" vs "failed"), verify explicit state types would be clearer.
      → If null has multiple meanings: flag as **MINOR**. Evidence: null check at `file:line` + ambiguous interpretations.
- [ ] **Constructor validation**: When a type has invariants, verify the constructor/factory enforces them.
      → If invariants can be violated post-construction: flag as **MAJOR**. Evidence: type at `file:line` + bypass path.

---

### 5.7 Functional Core / Imperative Shell

When reviewing for side-effect isolation, verify:

- [ ] **I/O in business logic**: When business logic functions directly perform I/O (DB calls, network, file access), cite the I/O operation.
      → If I/O is mixed with business logic and blocks unit testing: flag as **MINOR**. Evidence: I/O call at `file:line` within business function.
- [ ] **Pure function testability**: When a function could be pure but isn't (due to hidden I/O or global state), cite the impurity.
      → If impurity is avoidable: flag as **NIT**. Evidence: impure operation at `file:line`.

---

### 5.8 Fail Fast vs Fail Safe

When reviewing error handling, verify:

- [ ] **Invariant violations**: When programmer errors or invariant violations are caught, verify they fail fast (throw/panic/assert) rather than returning error values.
      → If invariant violation is silently handled: flag as **MAJOR**. Evidence: catch/handle at `file:line` + invariant description.
- [ ] **User input handling**: When user input or external data causes errors, verify the error is graceful (clear message, no crash, no data corruption).
      → If user input causes crash or corruption: flag as **BLOCKER**. Evidence: error path at `file:line` + failure behavior.

---

### 5.9 Principle of Least Privilege

When reviewing permissions/capabilities, verify:

- [ ] **Permission scope**: When code requests permissions (file access, network, admin rights), verify it requests the minimum necessary.
      → If broader permissions than needed: flag as **MINOR**. Evidence: permission request at `file:line` + narrower alternative.
- [ ] **Credential scope**: When credentials/tokens are used, verify they have the minimum required scope.
      → If over-scoped credentials: flag as **MAJOR**. Evidence: credential usage at `file:line` + scope.

---

### 5.10 Robustness with Precision

When reviewing input handling, verify:

- [ ] **Unknown field policy**: When parsing external input, verify unknown fields are either explicitly rejected OR explicitly ignored with documentation.
      → If silently accepted without policy: flag as **MINOR**. Evidence: parser at `file:line` + test proving behavior.
- [ ] **Type coercion**: When input types are coerced (string→number, etc.), verify coercion rules are explicit and tested.
      → If implicit coercion can cause data loss: flag as **MAJOR**. Evidence: coercion at `file:line` + example lossy input.

---

### 5.11 Consistency over cleverness

When reviewing for consistency, verify:

- [ ] **Pattern divergence**: When the diff introduces a pattern different from existing repo conventions, cite both the new pattern and the existing convention.
      → If divergence is unjustified: flag as **MINOR**. Evidence: new pattern at `file:line` + existing pattern at `file:line` + justification (or lack thereof).
- [ ] **Naming conventions**: When new names diverge from repo naming conventions, cite the divergence.
      → If unjustified: flag as **NIT**. Evidence: new name + convention + examples of convention usage.

---

## 6) Universal checklist (deep, apply to every change)

For each checklist item, the reviewer shall either cite evidence of compliance OR flag the issue with severity. Items marked "N/A" require brief justification.

### 6.1 Correctness & edge cases

- [ ] **Boundary validation**: When input is accepted, verify validation exists for types, ranges, formats, and length limits.
      → Evidence: validation code at `file:line` + test name proving rejection of invalid input.
      → If missing: flag as **MAJOR**.
- [ ] **Empty/null handling**: When code processes optional or nullable values, verify behavior is intentional (explicit check, not accidental null propagation).
      → Evidence: null check at `file:line` OR type proving non-null.
      → If accidental: flag as **MAJOR**.
- [ ] **Idempotency**: When operation can be retried or duplicated, verify repeated execution produces same result.
      → Evidence: idempotency key usage at `file:line` OR test proving idempotency.
      → If duplicates cause corruption: flag as **BLOCKER**.
- [ ] **Partial failure behavior**: When operation has multiple steps, verify rollback/compensation/retry semantics are defined.
      → Evidence: transaction boundary at `file:line` OR error handler with compensation.
      → If undefined: flag as **MAJOR**.
- [ ] **Concurrency safety**: When code modifies shared state, verify one of: (a) single-threaded access proven, (b) lock/mutex/atomic at `file:line`, (c) immutable data used.
      → Evidence: synchronization mechanism cited.
      → If race condition possible: flag as **BLOCKER** with failure scenario.
- [ ] **Time handling**: When timestamps are used, verify timezone handling, DST transitions, and clock type (monotonic vs wall) are correct.
      → Evidence: timezone-aware type at `file:line` OR explicit UTC normalization.
      → If ambiguous: flag as **MINOR**.
- [ ] **Numeric correctness**: When arithmetic is performed, verify overflow/underflow protection, rounding rules, and precision (especially for currency).
      → Evidence: checked arithmetic OR bounds validation at `file:line`.
      → If overflow possible: flag as **MAJOR**.
- [ ] **Error visibility**: When errors are caught, verify they are logged/returned/handled (not swallowed silently).
      → Evidence: error handling at `file:line` showing propagation or logging.
      → If swallowed: flag as **MAJOR**.
- [ ] **Resource lifecycle**: When resources are acquired (files, connections, locks), verify cleanup occurs in all paths (including error paths).
      → Evidence: cleanup code at `file:line` OR RAII/context manager usage.
      → If leak possible: flag as **MAJOR**.
- [ ] **Branch coverage**: When new conditional paths are added, verify each path has intentional behavior (no accidental fallthrough or default).
      → Evidence: test covering each branch OR explicit documentation of default behavior.
      → If unintentional path exists: flag as **MINOR**.

### 6.2 Contracts & compatibility

- [ ] **Interface stability**: When public interfaces are modified, verify they are versioned OR the change is backward-compatible.
      → Evidence: version bump in contract file OR compatibility test.
      → If breaking without version: flag as **BLOCKER**.
- [ ] **Breaking change strategy**: When a breaking change is intentional, verify deprecation notice, migration path, and timeline are documented.
      → Evidence: deprecation notice at `file:line` OR migration doc.
      → If undocumented breaking change: flag as **MAJOR**.
- [ ] **Unknown field policy**: When parsing external input, verify unknown fields are either rejected (strict) OR ignored with explicit documentation.
      → Evidence: test proving unknown field behavior at test name.
      → If silently accepted without policy: flag as **MINOR**.
- [ ] **Default safety**: When default values are defined, verify they are safe (fail-closed, not fail-open) and documented.
      → Evidence: default value at `file:line` + documentation.
      → If unsafe default: flag as **MAJOR**.
- [ ] **Error contract stability**: When error responses are returned, verify codes/formats are stable and do not leak internal details.
      → Evidence: error format at `file:line` + no stack traces/paths exposed.
      → If leaky: flag as **MINOR** (or **MAJOR** if security-relevant).
- [ ] **Deterministic pagination**: When pagination/sorting is implemented, verify ordering is deterministic (stable sort key).
      → Evidence: ORDER BY clause or sort key at `file:line`.
      → If nondeterministic: flag as **MINOR**.
- [ ] **Mixed-version compatibility**: When rolling deploys occur, verify new code handles old data and old code handles new data.
      → Evidence: compatibility test OR explicit N-1 compatibility statement.
      → If incompatible: flag as **MAJOR**.
- [ ] **Deprecation tracking**: When features are deprecated, verify they are announced with timeline and tracked.
      → Evidence: deprecation notice with date at `file:line`.

### 6.3 Determinism & reproducibility (when outputs persist or are user-visible)

- [ ] **Stable ordering**: When iterating over collections that affect output, verify order is deterministic.
      → Evidence: sorted iteration OR stable key at `file:line`.
      → If nondeterministic iteration affects output: flag as **MINOR**.
- [ ] **Time/randomness injection**: When tests use time or randomness, verify they are injected/controlled (not real clock/random).
      → Evidence: fake clock or seeded random at `file:line` in tests.
      → If flaky test risk: flag as **MINOR**.
- [ ] **State completeness**: When behavior depends on state, verify all required state is explicitly stored or derivable.
      → Evidence: state storage at `file:line`.
      → If hidden state: flag as **MINOR**.
- [ ] **Environment independence**: When outputs are generated, verify they do not depend on locale, filesystem order, or CPU architecture.
      → Evidence: explicit locale setting OR test on multiple environments.
      → If environment-dependent: flag as **MINOR**.
- [ ] **Build determinism**: When artifacts are generated, verify inputs are pinned and sorting is stable.
      → Evidence: lockfile + deterministic build flag OR reproducibility test.
      → If nondeterministic build: flag as **MINOR**.

### 6.4 Security & privacy (deny-by-default mindset)

Note: For high-risk changes, apply §10 in full. This section provides quick checks for all changes.

- [ ] **Authentication enforcement**: When protected endpoints exist, verify auth check is present.
      → Evidence: auth middleware/decorator at `file:line` + test for unauthenticated denial.
      → If missing: flag as **BLOCKER**.
- [ ] **Authorization correctness**: When resources have ownership, verify authz check includes object-level permissions (not just role).
      → Evidence: ownership check at `file:line` + test for wrong-owner denial.
      → If missing object-level check: flag as **BLOCKER**.
- [ ] **Injection prevention**: When user input reaches SQL/shell/template/path, verify parameterization or sanitization.
      → Evidence: parameterized query at `file:line` OR sanitization function.
      → If unsanitized: flag as **BLOCKER**.
- [ ] **SSRF protection**: When URLs are constructed from user input, verify host validation or allowlist.
      → Evidence: URL validation at `file:line`.
      → If unvalidated: flag as **BLOCKER**.
- [ ] **Path safety**: When file paths are constructed, verify normalization and directory restriction.
      → Evidence: path normalization at `file:line` + prefix/chroot check.
      → If traversal possible: flag as **BLOCKER**.
- [ ] **Secret protection**: Verify secrets/tokens/passwords are not logged, traced, or included in error messages.
      → Evidence: grep of log statements showing no secret variables.
      → If found: flag as **BLOCKER**.
- [ ] **External call limits**: When external calls are made, verify timeouts and retry limits are configured.
      → Evidence: timeout config at `file:line` + retry limit.
      → If unbounded: flag as **MAJOR**.
- [ ] **PII minimization**: When PII is collected/stored, verify it is minimized and retention/deletion is handled.
      → Evidence: data model showing minimal fields + deletion mechanism.
      → If excessive PII: flag as **MAJOR**.
- [ ] **Crypto hygiene**: When cryptography is used, verify established libraries, current algorithms, and secure key storage.
      → Evidence: library import at `file:line` + key storage mechanism.
      → If custom crypto or deprecated algorithm: flag as **BLOCKER**.
- [ ] **Tenant isolation**: When multi-tenant data exists, verify queries include tenant filter.
      → Evidence: tenant filter in query at `file:line` + test for cross-tenant denial.
      → If missing: flag as **BLOCKER**.

### 6.5 Reliability & resilience

- [ ] **Bounded retries**: When retries are implemented, verify max attempts, backoff, and jitter are configured.
      → Evidence: retry config at `file:line` showing limit + backoff.
      → If unbounded: flag as **MAJOR**.
- [ ] **Idempotency keys**: When external side effects are retried, verify idempotency keys are used.
      → Evidence: idempotency key at `file:line`.
      → If missing for payment/email/webhook: flag as **MAJOR**.
- [ ] **Circuit breakers**: When calling critical external dependencies, verify circuit breaker or fallback exists.
      → Evidence: circuit breaker config at `file:line` OR fallback logic.
      → If missing for critical path: flag as **MINOR**.
- [ ] **Backpressure handling**: When processing unbounded input (queues, streams), verify bounded buffers or rate limiting.
      → Evidence: buffer size or rate limit at `file:line`.
      → If unbounded: flag as **MAJOR**.
- [ ] **Graceful shutdown**: When long-running processes exist, verify they handle shutdown signals and complete in-flight work.
      → Evidence: signal handler at `file:line`.
      → If abrupt termination loses data: flag as **MAJOR**.
- [ ] **Degraded mode defaults**: When dependencies fail, verify system has safe fallback behavior.
      → Evidence: fallback logic at `file:line` OR timeout with safe default.
      → If no fallback defined: flag as **MINOR**.
- [ ] **Resource limits**: When resources are allocated (memory, connections, threads), verify limits are configured.
      → Evidence: limit config at `file:line`.
      → If unbounded allocation: flag as **MAJOR**.

### 6.6 Observability & operability

- [ ] **Structured logging**: When log statements are added, verify they use structured format with relevant context.
      → Evidence: structured log call at `file:line` with context fields.
      → If unstructured in production code: flag as **NIT**.
- [ ] **Correlation propagation**: When requests cross service boundaries, verify trace/correlation IDs are propagated.
      → Evidence: correlation ID in request context at `file:line`.
      → If missing for distributed system: flag as **MINOR**.
- [ ] **Critical path metrics**: When critical operations are added, verify success/failure/latency metrics exist.
      → Evidence: metric emission at `file:line`.
      → If missing on critical path: flag as **MINOR**.
- [ ] **Runbook updates**: When operational behavior changes, verify runbooks/alerts are updated.
      → Evidence: runbook update in diff OR follow-up issue filed.
      → If missing for operational change: flag as **MINOR**.
- [ ] **Feature flag safety**: When feature flags are used, verify default-off for risky features and kill switch tested.
      → Evidence: flag default at `file:line` + test for disabled behavior.
      → If default-on for risky feature: flag as **MAJOR**.
- [ ] **Error debuggability**: When errors are returned, verify they include enough context for debugging without leaking secrets.
      → Evidence: error message format at `file:line`.
      → If opaque error: flag as **NIT**. If leaky: flag as **MAJOR**.
- [ ] **Audit logging**: When security-sensitive actions occur (auth, admin actions, data access), verify audit log exists.
      → Evidence: audit log call at `file:line`.
      → If missing for security action: flag as **MAJOR**.

### 6.7 Maintainability & readability

- [ ] **Idiomatic code**: Verify code follows language/framework conventions established in the repo. This includes standard library usage, error handling patterns, naming conventions, project structure, and common idioms for the language (e.g., Go's explicit error returns, Rust's ownership patterns, Python's context managers).
      → Evidence: comparison to existing patterns at `file:line`.
      → If non-idiomatic without justification: flag as **MINOR**.
- [ ] **Design pattern appropriateness**: When design patterns are used (factory, strategy, observer, etc.), verify they solve an actual problem rather than adding ceremony. When patterns are conspicuously absent where they would simplify the code, note the opportunity.
      → Evidence: pattern usage at `file:line` + justification or alternative.
      → If pattern adds complexity without benefit: flag as **MINOR**.
      → If missing pattern would significantly improve clarity: flag as **NIT**.
- [ ] **Intention-revealing names**: Verify names describe what, not how (no `temp`, `data`, `handler2`).
      → Evidence: cite unclear name at `file:line` if found.
      → If misleading: flag as **NIT**.
- [ ] **Function focus**: When functions are notably complex (excessive length, deep nesting, many responsibilities), verify the complexity is justified by the problem domain.
      → Evidence: function at `file:line` with description of complexity.
      → If unjustified complexity: flag as **MINOR**.
- [ ] **Dead code removal**: Verify no unused variables, imports, or commented-out code blocks in diff.
      → Evidence: grep for unused symbols.
      → If dead code: flag as **NIT**.
- [ ] **Duplication avoidance**: Verify no meaningful logic is duplicated within diff or across repo.
      → Evidence: duplicate locations if found.
      → If duplicated: flag as **MINOR** (see §5.2).
- [ ] **Why-comments**: Verify comments explain invariants/tradeoffs, not obvious mechanics.
      → Evidence: comment at `file:line` if exemplary or problematic.
      → If commenting obvious code: flag as **NIT**.
- [ ] **Error consistency**: Verify error types and messages follow repo conventions.
      → Evidence: error format at `file:line` vs convention.
      → If inconsistent: flag as **NIT**.
- [ ] **API documentation**: Verify public APIs have documentation (docstrings, OpenAPI, etc.).
      → Evidence: documentation at `file:line` OR doc artifact.
      → If public API undocumented: flag as **MINOR**.
- [ ] **Hermetic boundaries**: Verify code that should be pure (no side effects) remains pure, and side effects are isolated to well-defined boundaries. Business logic should not directly perform I/O; external dependencies should be injectable for testing.
      → Evidence: I/O isolation at `file:line` or dependency injection pattern.
      → If side effects are scattered throughout business logic: flag as **MINOR**.

### 6.8 Dependencies & supply chain

- [ ] **Dependency justification**: When new dependencies are added, verify they provide capability not easily implemented in <100 LOC.
      → Evidence: capability description + "Alternatives: [list or 'none viable']".
      → If dependency adds >1MB or >10 transitive deps for <100 LOC benefit: flag as **MINOR**.
- [ ] **Version pinning**: Verify versions are pinned and lockfiles updated.
      → Evidence: lockfile changes in diff.
      → If unpinned: flag as **MINOR**.
- [ ] **License compliance**: Verify new dependency licenses comply with project policy.
      → Evidence: license field in package metadata.
      → If incompatible license: flag as **BLOCKER**.
- [ ] **Vulnerability check**: Verify new dependencies have no known critical vulnerabilities.
      → Evidence: SCA scan result OR advisory check.
      → If vulnerable: flag as **MAJOR** (or **BLOCKER** if exploitable).
- [ ] **Surface minimization**: Verify heavy dependencies are optional or feature-flagged when possible.
      → Evidence: optional dependency declaration.
      → If monolithic: flag as **NIT**.
- [ ] **Build reproducibility**: Verify no unpinned downloads or non-deterministic fetches in build.
      → Evidence: pinned URLs or checksums in build config.
      → If non-reproducible: flag as **MINOR**.

### 6.9 Async & concurrency correctness (apply whenever async/workers are involved)

- [ ] **Delivery semantics**: Verify delivery semantics are explicitly stated (at-most-once / at-least-once / exactly-once with proof) and code matches.
      → Evidence: comment or doc at `file:line` stating semantics + implementation matching.
      → If unstated: flag as **MAJOR**.
- [ ] **Retry safety**: When retries occur, verify they do not duplicate side effects.
      → Evidence: idempotency key at `file:line` OR dedupe check OR transactional boundary.
      → If duplicates possible: flag as **BLOCKER**.
- [ ] **Bounded fan-out**: When work is spawned/forked, verify concurrency is bounded by semaphore/pool/limit.
      → Evidence: concurrency limit at `file:line`.
      → If unbounded spawn: flag as **MAJOR**.
- [ ] **Explicit backpressure**: When processing streams/queues, verify bounded buffers, batching, or rate limiting exist.
      → Evidence: buffer size or batch config at `file:line`.
      → If unbounded: flag as **MAJOR**.
- [ ] **Cancellation handling**: When tasks can be cancelled, verify: - tasks stop promptly on cancellation/shutdown signal - resources are cleaned up (locks released, files closed, connections returned)
      → Evidence: cancellation check at `file:line` + cleanup in finally/defer.
      → If no cancellation support: flag as **MAJOR**.
- [ ] **I/O timeouts**: Verify all external I/O calls have timeouts configured.
      → Evidence: timeout parameter at `file:line`.
      → If missing timeout: flag as **MAJOR**.
- [ ] **Error propagation**: Verify errors from async tasks are not silently dropped.
      → Evidence: error handler or supervision at `file:line`.
      → If silent failure: flag as **MAJOR**.
- [ ] **Lock safety**: Verify no locks are held across await/yield points.
      → Evidence: lock scope at `file:line` showing release before await.
      → If lock held across await: flag as **BLOCKER**.
- [ ] **Lock ordering**: When multiple locks are acquired, verify consistent ordering to prevent deadlock.
      → Evidence: lock acquisition order documented or verified at `file:line`.
      → If inconsistent ordering: flag as **MAJOR**.
- [ ] **Ordering enforcement**: When ordering matters, verify it is enforced (partition key, sequence number, per-entity serialization).
      → Evidence: ordering mechanism at `file:line`.
      → If ordering assumed but not enforced: flag as **MAJOR**.
- [ ] **Event loop safety**: Verify blocking operations do not run on event loop threads.
      → Evidence: offload to worker pool at `file:line` OR proof of non-blocking.
      → If blocking on event loop: flag as **MAJOR**.
- [ ] **Async context propagation**: Verify trace/correlation IDs are preserved across async boundaries.
      → Evidence: context propagation at `file:line`.
      → If lost: flag as **MINOR**.

### 6.10 Code quality & refactoring (mechanical detection)

The reviewer shall actively search for these patterns and cite evidence when found:

- [ ] **Duplicated logic**: Search for meaningfully similar code blocks within diff and related files.
      → If found: flag as **MINOR** with locations `file1:line` and `file2:line`.
- [ ] **High complexity**: Identify functions with notable complexity—this may manifest as deep nesting, many branches, long length, or high cognitive load. Use judgment rather than rigid thresholds; what matters is whether the complexity is justified.
      → If found: flag as **MINOR** with function at `file:line` + complexity indicator.
- [ ] **Misleading names**: Identify names that don't match behavior (e.g., `getUser` that modifies state, `isValid` that throws).
      → If found: flag as **NIT** with name at `file:line` + actual behavior.
- [ ] **Unrelated changes**: Identify refactors or cleanups bundled with behavior changes.
      → If found: flag as **MINOR** (request split) with locations.
- [ ] **Boolean flag explosion**: Identify functions with >2 boolean parameters controlling behavior.
      → If found: flag as **NIT** with suggestion to use enum/options object at `file:line`.
- [ ] **Deep nesting**: Identify code with >3 levels of nesting.
      → If found: flag as **NIT** with suggestion for early returns at `file:line`.
- [ ] **Inconsistent error handling**: Identify mixed patterns (exceptions vs result types vs error codes) within same module.
      → If found: flag as **NIT** with locations showing inconsistency.
- [ ] **Shotgun surgery**: When a change requires edits across many unrelated files for a single concept, flag the coupling.
      → If found: flag as **MINOR** with file list.
- [ ] **God object/module**: Identify classes/modules that are disproportionately large relative to the codebase, or that accumulate unrelated responsibilities.
      → If found: flag as **MINOR** with location + responsibility groupings.

When recommending refactors:

- Cite the specific smell at `file:line`
- Propose small, incremental steps
- Require characterization tests before refactoring risky code
- Avoid new abstractions unless ≥2 use cases exist

---

## 7) Change-type checklists (pick what applies)

Apply the relevant checklist based on change type. For each item, cite evidence or flag with severity.

---

### A) Public API / schema / wire contracts

- [ ] **Contract artifacts updated**: When API behavior changes, verify OpenAPI/JSON Schema/Proto/GraphQL is updated.
      → Evidence: artifact file + line showing change.
      → If missing: flag as **MAJOR**.
- [ ] **Strict decoding policy**: Verify unknown field handling is explicit (reject or documented ignore) and type coercion rules are defined.
      → Evidence: schema config at `file:line` + test proving behavior.
      → If undefined: flag as **MINOR**.
- [ ] **Compatibility tested**: When contract changes, verify old client/new server and new client/old server compatibility.
      → Evidence: compatibility test name OR explicit N-1/N+1 analysis.
      → If untested and required: flag as **MAJOR**.
- [ ] **Example payloads updated**: When request/response format changes, verify docs and fixtures are updated.
      → Evidence: doc/fixture file change in diff.
      → If missing: flag as **MINOR**.
- [ ] **Error model documented**: Verify error status codes, error codes, and structured fields are documented.
      → Evidence: error documentation at `file:line` OR OpenAPI error schema.
      → If undocumented: flag as **MINOR**.
- [ ] **Versioning respected**: When breaking change, verify version is bumped per strategy (semver, endpoint version, schema version).
      → Evidence: version bump in contract file.
      → If breaking without version bump: flag as **BLOCKER**.

#### Concrete contract hardening (recommended)

- [ ] **additionalProperties: false**: For JSON schemas intended to be strict, verify this is set.
      → Evidence: schema at `file:line` showing setting.
- [ ] **Unknown field rejection test**: For typed decoders, verify test exists proving unknown fields are rejected.
      → Evidence: test name.

---

### B) Storage, migrations, and data model changes

- [ ] **Migration downtime**: Verify migration can be applied without downtime, OR downtime is explicitly planned and communicated.
      → Evidence: migration script analysis OR deployment plan.
      → If unknown: flag as **MAJOR**.
- [ ] **Large table handling**: When migration touches large tables, verify backfill strategy and batching exist.
      → Evidence: batch size config at `file:line` OR backfill script.
      → If no batching for large table: flag as **MAJOR**.
- [ ] **Rollback plan**: Verify rollback migration exists, OR irreversibility is explicitly acknowledged.
      → Evidence: down migration at `file:line` OR "irreversible" comment.
      → If no plan: flag as **MAJOR**.
- [ ] **Index impact**: When indexes are added/modified on large tables, verify write amplification and query plan impact are analyzed. What constitutes "large" depends on the system—use the repo's own thresholds if documented, otherwise apply judgment.
      → Evidence: EXPLAIN output showing index usage OR benchmark comparing before/after write latency.
      → If unanalyzed for large table: flag as **MINOR**.
- [ ] **Data integrity constraints**: Verify uniqueness, foreign keys, and check constraints are enforced.
      → Evidence: constraint definition at `file:line`.
      → If missing for critical data: flag as **MAJOR**.
- [ ] **Transaction boundaries**: Verify atomicity and isolation assumptions are correct.
      → Evidence: transaction block at `file:line`.
      → If incorrect boundary: flag as **MAJOR**.
- [ ] **Old data compatibility**: Verify new code can read existing records (null handling, missing columns, enum additions).
      → Evidence: null-safe code at `file:line` OR migration backfilling data.
      → If incompatible: flag as **BLOCKER**.
- [ ] **Backfill observability**: When backfills exist, verify metrics/logging and pause/resume capability.
      → Evidence: logging at `file:line` + resume mechanism.
      → If unobservable: flag as **MINOR**.

---

### C) Event-driven / distributed / async workflows

Use this section for message queues, job runners, event buses, background workers, distributed sagas, webhooks.

#### Semantics & correctness

- [ ] **Delivery semantics stated**: Verify delivery semantics are documented (at-least-once / at-most-once / exactly-once).
      → Evidence: comment or doc at `file:line` stating semantics.
      → If unstated: flag as **MAJOR**.
- [ ] **Handler idempotency**: Verify handler is safe under retries/duplicates via idempotency key or dedupe storage.
      → Evidence: idempotency mechanism at `file:line` + test.
      → If not idempotent: flag as **BLOCKER**.
- [ ] **Side effect safety**: Verify external calls use idempotency keys where supported.
      → Evidence: idempotency key at `file:line`.
      → If side effects can duplicate: flag as **MAJOR**.
- [ ] **Ordering enforced**: When ordering matters, verify enforcement (partition key, sequence, per-entity serialization).
      → Evidence: ordering mechanism at `file:line`.
      → If assumed but not enforced: flag as **MAJOR**.
- [ ] **Exactly-once skepticism**: When exactly-once is claimed, require proof of coordination mechanism.
      → Evidence: coordination mechanism at `file:line`.
      → If unproven claim: flag as **BLOCKER**.

#### Reliability & backpressure

- [ ] **Bounded retries**: Verify retries have max attempts with backoff/jitter.
      → Evidence: retry config at `file:line`.
      → If unbounded: flag as **MAJOR**.
- [ ] **Poison message handling**: Verify DLQ/quarantine + alerting exists.
      → Evidence: DLQ config at `file:line` + alert.
      → If missing: flag as **MAJOR**.
- [ ] **Backpressure**: Verify bounded queues, batch sizes, or rate limits exist.
      → Evidence: limit config at `file:line`.
      → If unbounded: flag as **MAJOR**.
- [ ] **Concurrency limits**: Verify worker parallelism is bounded.
      → Evidence: concurrency limit at `file:line`.
      → If unbounded: flag as **MAJOR**.
- [ ] **Ack semantics**: Verify ack happens after commit (not before).
      → Evidence: ack call at `file:line` after DB commit.
      → If premature ack: flag as **BLOCKER**.

#### Data consistency

- [ ] **Transactional boundaries**: Verify outbox pattern or equivalent prevents "commit succeeded but publish failed".
      → Evidence: outbox table OR transactional publish at `file:line`.
      → If inconsistent: flag as **MAJOR**.
- [ ] **Consistency model explicit**: Verify eventual vs strong consistency is documented and matches user expectations.
      → Evidence: documentation at `file:line`.
      → If unclear: flag as **MINOR**.

#### Observability

- [ ] **Trace propagation**: Verify correlation IDs propagate through messages.
      → Evidence: correlation ID handling at `file:line`.
      → If missing: flag as **MINOR**.
- [ ] **Metrics**: Verify lag, retry rate, DLQ rate, and latency metrics exist.
      → Evidence: metric emission at `file:line`.
      → If missing for critical worker: flag as **MINOR**.

#### Security

- [ ] **Message authenticity**: When relevant, verify signing or ACL validation.
      → Evidence: validation at `file:line`.
      → If unauthenticated from untrusted source: flag as **MAJOR**.
- [ ] **Payload validation**: Verify schema validation before processing.
      → Evidence: schema check at `file:line`.
      → If missing: flag as **MAJOR**.

---

### D) External calls (network/file/subprocess/third-party APIs)

- [ ] **Centralized interface**: Verify side effects go through adapter/client boundary (not scattered).
      → Evidence: adapter at `file:line` wrapping calls.
      → If scattered: flag as **MINOR**.
- [ ] **Timeouts configured**: Verify all external calls have timeout.
      → Evidence: timeout config at `file:line`.
      → If missing: flag as **MAJOR**.
- [ ] **Bounded retries**: Verify retry limit with backoff/jitter.
      → Evidence: retry config at `file:line`.
      → If unbounded: flag as **MAJOR**.
- [ ] **Credential safety**: Verify credentials are not logged and use secure storage.
      → Evidence: credential loading at `file:line` (no plaintext).
      → If logged or plaintext: flag as **BLOCKER**.
- [ ] **Response validation**: Verify remote response is validated before use.
      → Evidence: validation at `file:line`.
      → If trusted blindly: flag as **MAJOR**.
- [ ] **Rate limit handling**: Verify rate limits and quotas are handled (backoff on 429).
      → Evidence: rate limit handling at `file:line`.
      → If ignored: flag as **MINOR**.
- [ ] **Failure mode defined**: Verify fallback, degrade, or hard-fail behavior is documented.
      → Evidence: failure handling at `file:line` OR doc.
      → If undefined: flag as **MINOR**.
- [ ] **Retry idempotency**: When calls are auto-retried, verify they are idempotent.
      → Evidence: idempotency key at `file:line`.
      → If non-idempotent retry: flag as **MAJOR**.

---

### E) Caching

- [ ] **Not source of truth**: Verify cache is not the primary source of truth (can be rebuilt).
      → Evidence: cache population from authoritative source.
      → If cache is source of truth: flag as **MAJOR**.
- [ ] **Stale safety**: Verify stale values cannot violate invariants.
      → Evidence: analysis of stale value impact.
      → If invariant violation possible: flag as **MAJOR**.
- [ ] **Key determinism**: Verify cache keys are deterministic and collision-resistant.
      → Evidence: key generation at `file:line`.
      → If nondeterministic: flag as **MINOR**.
- [ ] **Key versioning**: When cached data structure changes, verify key version is updated.
      → Evidence: version in key at `file:line`.
      → If unversioned with schema change: flag as **MAJOR**.
- [ ] **Invalidation strategy**: Verify invalidation is documented and implemented (TTL, event-driven, explicit).
      → Evidence: invalidation at `file:line` + doc.
      → If unclear: flag as **MINOR**.
- [ ] **Size bounds**: Verify memory/disk bounds and eviction policy.
      → Evidence: size limit at `file:line`.
      → If unbounded: flag as **MAJOR**.
- [ ] **Thread safety**: Verify cached values are immutable or safely copied.
      → Evidence: immutable type OR copy at `file:line`.
      → If mutable shared: flag as **MAJOR**.
- [ ] **Graceful degradation**: Verify cache outage has fallback to source.
      → Evidence: fallback path at `file:line`.
      → If hard fail on cache miss: flag as **MINOR**.
- [ ] **Sensitive data**: Verify sensitive data is not cached, or cache is encrypted/protected.
      → Evidence: no PII in cache OR encryption at `file:line`.
      → If unprotected sensitive data: flag as **MAJOR**.
- [ ] **Stampede prevention**: Verify singleflight/coalescing or jitter prevents thundering herd.
      → Evidence: singleflight at `file:line`.
      → If no protection on hot cache: flag as **MINOR**.

---

### F) Performance-sensitive changes

- [ ] **Complexity analysis**: Verify time and space complexity is analyzed for expected input sizes.
      → Evidence: complexity comment at `file:line` OR analysis in PR description.
      → If unanalyzed for large inputs: flag as **MINOR**.
- [ ] **O(n²) patterns**: Search for nested loops over unbounded collections.
      → If found: flag as **MAJOR** with `file:line` + alternative.
- [ ] **N+1 patterns**: Search for DB/API calls inside loops.
      → If found: flag as **MAJOR** with `file:line` + batching suggestion.
- [ ] **Allocation in hot path**: Search for unnecessary allocations/copies in performance-critical paths.
      → If found: flag as **MINOR** with `file:line`.
- [ ] **Batching/streaming**: When processing large data, verify batching or streaming is used.
      → Evidence: batch/stream at `file:line`.
      → If loading all into memory: flag as **MAJOR** for large datasets.
- [ ] **Benchmark evidence**: When performance claims are made, require benchmark.
      → Evidence: benchmark result.
      → If claim without evidence: flag as **MINOR** (request benchmark).
- [ ] **Regression prevention**: Verify performance-critical code has benchmark in CI.
      → Evidence: benchmark test name.
      → If missing for critical path: flag as **MINOR**.

---

### G) Concurrency and parallelism

- [ ] **Shared state protection**: Verify shared mutable state uses locks, atomics, or message passing.
      → Evidence: synchronization at `file:line`.
      → If unprotected: flag as **BLOCKER**.
- [ ] **Deadlock prevention**: Verify consistent lock ordering.
      → Evidence: lock order documentation OR analysis.
      → If inconsistent: flag as **MAJOR**.
- [ ] **Lock-await separation**: Verify no locks held across await/yield points.
      → Evidence: lock scope at `file:line`.
      → If violated: flag as **BLOCKER**.
- [ ] **Cancellation respected**: Verify tasks check cancellation and clean up.
      → Evidence: cancellation check at `file:line`.
      → If ignored: flag as **MAJOR**.
- [ ] **Task supervision**: Verify spawned tasks are joined or supervised (not fire-and-forget without rationale).
      → Evidence: join/supervision at `file:line`.
      → If fire-and-forget: flag as **MINOR**.
- [ ] **Bounded parallelism**: Verify thread/task pool has size limit.
      → Evidence: pool size at `file:line`.
      → If unbounded: flag as **MAJOR**.
- [ ] **Race prevention**: Verify races are prevented by design, types, or tested with race detector.
      → Evidence: race detector CI step OR design analysis.
      → If untested concurrent code: flag as **MINOR**.
- [ ] **Event loop isolation**: Verify blocking operations are not on event loop thread.
      → Evidence: offload to worker at `file:line`.
      → If blocking on event loop: flag as **MAJOR**.
- [ ] **Context propagation**: Verify trace IDs and auth context propagate across threads/tasks.
      → Evidence: context passing at `file:line`.
      → If lost: flag as **MINOR**.

---

### H) UI/UX changes (CLI, web, mobile)

- [ ] **Behavior consistency**: Verify user-facing behavior is consistent with existing patterns.
      → Evidence: comparison to existing behavior.
      → If inconsistent: flag as **MINOR**.
- [ ] **Accessibility**: Verify keyboard navigation, focus states, ARIA semantics, and contrast.
      → Evidence: accessibility attributes at `file:line` OR a11y test.
      → If missing: flag as **MINOR**.
- [ ] **i18n readiness**: When user strings are added, verify they use i18n framework.
      → Evidence: i18n call at `file:line`.
      → If hardcoded strings: flag as **MINOR**.
- [ ] **Telemetry privacy**: Verify telemetry respects opt-out and does not collect PII without consent.
      → Evidence: opt-out check at `file:line`.
      → If violates privacy: flag as **MAJOR**.

#### CLI-specific

- [ ] **Exit codes**: Verify exit codes are meaningful (0 success, non-zero error) and documented.
      → Evidence: exit code usage at `file:line`.
      → If always 0: flag as **MINOR**.
- [ ] **Machine-readable output**: When JSON output is promised, verify it is stable and documented.
      → Evidence: JSON output at `file:line` + schema/doc.
      → If unstable: flag as **MAJOR**.
- [ ] **Actionable errors**: Verify error messages include what went wrong and how to fix.
      → Evidence: error message at `file:line`.
      → If opaque: flag as **MINOR**.
- [ ] **Argument validation**: Verify CLI arguments are validated with helpful errors.
      → Evidence: validation at `file:line`.
      → If invalid args silently accepted: flag as **MINOR**.

---

### I) CI/CD, tooling, and developer experience

- [ ] **Check preservation**: Verify CI changes do not weaken required checks.
      → Evidence: CI config comparison.
      → If weakened without replacement: flag as **MAJOR**.
- [ ] **CI secret handling**: Verify secrets use secret storage, not plaintext, with least privilege.
      → Evidence: secret reference in CI config.
      → If plaintext: flag as **BLOCKER**.
- [ ] **Contributor impact**: Verify tooling updates are documented and won't break contributors.
      → Evidence: changelog or doc update.
      → If breaking without notice: flag as **MINOR**.
- [ ] **Local reproducibility**: Verify local build/test workflow matches CI.
      → Evidence: local instructions in README or CONTRIBUTING.
      → If divergent: flag as **MINOR**.
- [ ] **Config change justification**: Verify lint/format config changes are justified.
      → Evidence: rationale in PR or commit message.
      → If unjustified: flag as **NIT**.

---

## 8) Big‑O complexity expectations (mechanical analysis)

**Big‑O** describes how runtime/memory grows with input size _n_:

- **O(1)**: constant time (ideal for hot paths)
- **O(log n)**: grows slowly (balanced trees, binary search)
- **O(n)**: linear (often acceptable)
- **O(n log n)**: sorting, divide-and-conquer (often acceptable)
- **O(n²) or worse**: can explode; acceptable only with strict bounds and justification

---

### 8.1 Complexity analysis checklist (mechanical)

The reviewer shall analyze complexity for code touching hot paths or processing variable-size input:

- [ ] **Identify hot paths**: List functions in diff that are called frequently or process user-controlled input sizes.
      → Evidence: function names at `file:line` + call frequency estimate.
- [ ] **State complexity**: For each hot path function, state time and space complexity.
      → Evidence: complexity in format `O(n)` at `file:line`.
      → If unstated for hot path: flag as **MINOR** (request analysis).
- [ ] **Validate input bounds**: For O(n²) or worse, verify input size is bounded.
      → Evidence: bound enforcement at `file:line` (e.g., max items, pagination).
      → If unbounded O(n²): flag as **MAJOR**.

---

### 8.2 Anti-pattern detection (mechanical)

Search for these patterns and flag:

- [ ] **Nested loops**: When loops are nested over collections, analyze combined complexity.
      → If O(n²) without bounds: flag as **MAJOR** with `file:line`.
- [ ] **Repeated lookups**: When `find`/`contains`/`filter` is called inside a loop, flag potential O(n²).
      → If optimizable with set/map: flag as **MINOR** with `file:line` + suggestion.
- [ ] **N+1 queries**: When DB/API calls are made inside loops, flag N+1 pattern.
      → If found: flag as **MAJOR** with `file:line` + batching suggestion.
- [ ] **Repeated string concatenation**: When strings are concatenated in a loop (in languages where this is O(n²)), flag.
      → If found: flag as **MINOR** with `file:line` + StringBuilder suggestion.
- [ ] **Unbounded recursion**: When recursion depth depends on input size without tail-call optimization, flag stack overflow risk.
      → If found: flag as **MAJOR** with `file:line` + iteration suggestion.

---

### 8.3 Evidence requirements for performance claims

When performance claims are made (e.g., "this is O(n)", "this is fast"), require:

- [ ] **Benchmark**: Benchmark result showing actual performance at expected scale.
      → If claim without benchmark: flag as **MINOR** (request benchmark).
- [ ] **Profile**: For optimization changes, require before/after profile.
      → If optimization without profile: flag as **NIT**.
- [ ] **Production metrics**: For performance-critical paths, require production metrics showing acceptable latency.
      → If no metrics for critical path: add to residual risk.

---

## 9) Test quality standards (language‑agnostic)

### 9.1 Coverage requirements (with thresholds)

The reviewer shall verify test coverage and cite evidence for each requirement.

#### 9.1.1 High-risk domains (auth, payments, migrations, crypto, PII)

When the change is in a high-risk domain, require:

- [ ] **Unit test per branch**: Each new conditional branch has a unit test.
      → Evidence: test name(s) covering each branch.
      → If missing: flag as **MAJOR**.
- [ ] **Integration test for success path**: At least one integration test exercises the primary success flow.
      → Evidence: integration test name.
      → If missing: flag as **MAJOR**.
- [ ] **Rejection path test**: At least one test proves denial/failure on invalid input or unauthorized access.
      → Evidence: test name proving rejection.
      → If missing: flag as **BLOCKER** (for auth/authz) or **MAJOR** (for other high-risk).

#### 9.1.2 Behavioral changes (not pure refactor)

When the change modifies behavior, require:

- [ ] **Behavior-change test**: At least one test that would fail on the old behavior and pass on the new.
      → Evidence: test name + description of what it asserts differently.
      → If missing: flag as **MAJOR**.

#### 9.1.3 Pure mechanical refactors

When the change is a pure refactor with no behavior change, existing tests passing is sufficient provided:

- [ ] **Coverage verification**: Coverage report shows touched lines are exercised, OR reviewer manually identifies at least one existing test exercising each modified path.
      → Evidence: coverage report link OR test names.
      → If unverified: flag as **MINOR** (request coverage evidence).

#### 9.1.4 Test coverage gaps

When tests are missing, the reviewer shall:

1. Identify which failure modes are unprotected
2. Flag as **MAJOR** with specific test request
3. Include the minimum test that would prevent regression

---

### 9.2 Must‑haves (mechanical checks)

- [ ] **New behavior tested**: When new behavior is added, verify at least one test exercises it.
      → Evidence: test name at `test_file:line`.
      → If missing: flag as **MAJOR**.
- [ ] **Regression test for bug fix**: When a bug is fixed, verify a test exists that would have caught the bug.
      → Evidence: test name + description of what it catches.
      → If missing: flag as **MAJOR**.
- [ ] **Determinism**: Verify tests do not use real time, unseeded randomness, or real network.
      → Evidence: grep for `sleep`, `time.Now`, `random()`, `http.Get` without mocking.
      → If found: flag as **MINOR** (flaky risk).
- [ ] **Hermeticity**: Verify tests do not depend on machine state, environment variables without defaults, or external services.
      → Evidence: test setup showing isolation.
      → If dependent: flag as **MINOR**.
- [ ] **Happy path coverage**: Verify at least one test exercises the success path.
      → Evidence: test name.
      → If missing: flag as **MAJOR**.
- [ ] **Rejection path coverage**: Verify at least one test exercises a failure/denial path.
      → Evidence: test name proving error handling.
      → If missing: flag as **MAJOR** for risky code, **MINOR** otherwise.
- [ ] **Behavior assertion**: Verify tests assert on behavior/contracts, not implementation details (e.g., not asserting on mock call counts unless that's the contract).
      → Evidence: assertion type in test.
      → If over-mocked: flag as **NIT**.
- [ ] **Descriptive test names**: Verify test names describe scenario and expected outcome.
      → Evidence: cite unclear test name if found.
      → If unclear: flag as **NIT**.

---

### 9.3 Risk-based test requirements (apply when applicable)

- [ ] **Integration tests**: When behavior spans modules/services, verify integration test exists.
      → Evidence: integration test name.
      → If missing for cross-module behavior: flag as **MINOR**.
- [ ] **Contract tests**: When public API/schema is modified, verify contract test validates backward/forward compatibility.
      → Evidence: contract test name.
      → If missing for API change: flag as **MAJOR**.
- [ ] **Property-based tests**: When code has invariants (e.g., serialization roundtrip, ordering), verify property test exists.
      → Evidence: property test name.
      → If missing for complex invariant: flag as **NIT**.
- [ ] **Fuzzing**: When code parses untrusted input, verify fuzzing exists or is planned.
      → Evidence: fuzz test name OR follow-up issue.
      → If missing for parser: flag as **MINOR**.
- [ ] **Migration tests**: When DB migrations are added, verify apply/rollback are tested.
      → Evidence: migration test name.
      → If missing: flag as **MAJOR**.
- [ ] **Concurrency tests**: When concurrent/async code is added, verify stress or race-detection test exists.
      → Evidence: concurrency test name OR race detector CI step.
      → If missing for concurrent code: flag as **MINOR**.

---

### 9.4 Testing anti-patterns (flag when found)

The reviewer shall search for these patterns and flag:

- [ ] **Over-mocking**: When tests mock internal calls and only verify mock interactions, not behavior.
      → If found: flag as **NIT** with suggestion to test behavior.
- [ ] **Brittle string assertions**: When tests assert on exact error messages that are not part of the contract.
      → If found: flag as **NIT** with suggestion to assert on error type/code.
- [ ] **Non-deterministic waits**: When tests use `sleep()` or real time without fake clock.
      → If found: flag as **MINOR** (flaky risk) with `file:line`.
- [ ] **External dependencies**: When tests require external services without hermetic harness.
      → If found: flag as **MINOR** with suggestion for mock/stub.
- [ ] **Unstable golden tests**: When golden tests encode environment-dependent or nondeterministic output.
      → If found: flag as **MINOR** with suggestion to normalize output.

---

### 9.5 Missing test escalation

When a PR adds/changes behavior without tests, the reviewer shall:

1. Ask: "Which failure modes does this protect against?"
2. Ask: "What is the smallest test that prevents regression?"
3. If no automated test is feasible: require documented manual verification plan
4. Flag as **MAJOR** until resolved (or **BLOCKER** for security-critical code)

---

## 10) Security review mini-framework (mandatory for high-risk)

When a change touches auth, payments, PII, persistence, network, or crypto, the reviewer shall produce the following artifacts with evidence anchors.

### 10.1 Threat summary table (required output)

| Element                    | Value                                                             | Evidence anchor                    |
| -------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| **Assets protected**       | (credentials / money / PII / integrity / availability)            | `file:line` where asset is handled |
| **Entry points**           | (API / CLI / file / webhook / queue / UI)                         | `file:line` of input acceptance    |
| **Trust boundary crossed** | (user→admin / public→internal / tenant isolation)                 | `file:line` of privilege check     |
| **Attack vectors checked** | (injection type / SSRF / authz bypass / replay / deserialization) | Test name proving rejection        |
| **Failure mode defined**   | (timeout / retry / partial failure behavior)                      | `file:line` of error handler       |

**If any cell cannot be filled**: flag as **MAJOR** (unclear security posture) and request clarification from author.

---

### 10.2 Injection checklist (mechanical)

For each user-controlled input that reaches a sensitive sink, verify mitigation and cite evidence:

| Sink type                            | Mitigation required                                                   | Evidence format                          |
| ------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------- |
| SQL/query builder                    | Parameterized query or ORM with bound parameters                      | `file:line` of query + test name         |
| Shell/subprocess                     | Allowlist of commands OR proper escaping/quoting                      | `file:line` of exec + test for rejection |
| Template engine                      | Auto-escaping enabled OR manual escape at render                      | Config file + `file:line` of render      |
| Path/filesystem                      | Path normalization + directory restriction (chroot/jail/prefix check) | `file:line` of path validation           |
| Deserializer (JSON/YAML/pickle/etc.) | Schema validation before processing                                   | `file:line` of schema check + test       |
| URL/redirect                         | Allowlist of hosts OR same-origin check                               | `file:line` of URL validation            |
| Regex with user input                | Bounded complexity OR timeout                                         | `file:line` of regex + complexity proof  |

→ If input reaches sink without verified mitigation: flag as **BLOCKER**.

---

### 10.3 Authorization checklist (mechanical)

For each protected resource or action in the diff:

- [ ] **Authz check location**: Cite the authorization check at `file:line`.
- [ ] **Object-level permissions**: When resource is user-specific or tenant-specific, verify the check includes object ownership, not just role.
      → Evidence: test name proving denial when wrong user/tenant attempts access.
- [ ] **Default deny**: Verify missing/invalid credentials result in denial, not fallback access.
      → Evidence: test name proving denial on missing auth.
- [ ] **Privilege escalation paths**: When admin/elevated actions exist, verify they cannot be reached by non-privileged users.
      → Evidence: test name proving denial for non-admin.

→ If authz check is missing or untested: flag as **BLOCKER**.

---

### 10.4 Secrets and sensitive data checklist (mechanical)

- [ ] **Secrets in logs**: Grep diff for log/print/trace statements. Verify no secrets, tokens, passwords, or API keys are logged.
      → If found: flag as **BLOCKER**. Evidence: `file:line` of log statement + secret type.
- [ ] **Secrets in errors**: Verify error messages returned to users do not include internal paths, stack traces, or credentials.
      → If found: flag as **MAJOR**. Evidence: `file:line` of error return.
- [ ] **PII handling**: When PII is collected/stored/transmitted, verify minimization and encryption requirements are met.
      → If PII is stored in plaintext without justification: flag as **MAJOR**. Evidence: storage location.
- [ ] **Credential storage**: When credentials are stored, verify they use secure storage (keychain, vault, encrypted config), not plaintext files.
      → If plaintext: flag as **BLOCKER**. Evidence: storage mechanism at `file:line`.

---

### 10.5 Cryptography checklist (mechanical)

When the diff includes cryptographic operations:

- [ ] **Library usage**: Verify established crypto libraries are used (not hand-rolled algorithms).
      → If custom crypto: flag as **BLOCKER**. Evidence: `file:line` of implementation.
- [ ] **Algorithm choice**: Verify algorithms are current (not MD5 for security, not SHA1 for signatures, not DES/3DES).
      → If deprecated algorithm: flag as **MAJOR**. Evidence: algorithm at `file:line`.
- [ ] **Key management**: Verify keys are not hardcoded, have rotation mechanism, and are stored securely.
      → If hardcoded key: flag as **BLOCKER**. Evidence: `file:line`.
- [ ] **IV/nonce handling**: When encryption requires IV/nonce, verify it is randomly generated per operation (not reused).
      → If reused: flag as **BLOCKER**. Evidence: `file:line` of IV generation.

---

### 10.6 Network and external calls checklist (mechanical)

When the diff makes outbound network calls:

- [ ] **SSRF protection**: When URLs are constructed from user input, verify host allowlist or URL validation exists.
      → If user can control destination without restriction: flag as **BLOCKER**. Evidence: `file:line`.
- [ ] **TLS enforcement**: Verify connections use HTTPS/TLS (not plain HTTP for sensitive data).
      → If HTTP used for sensitive data: flag as **MAJOR**. Evidence: `file:line` of connection.
- [ ] **Certificate validation**: Verify certificate validation is not disabled.
      → If validation disabled: flag as **BLOCKER**. Evidence: `file:line` of config.

---

## 11) Review depth selection (decision tree)

The reviewer shall determine review depth at the start and state the selection with justification in the report.

### 11.1 Depth selection decision tree

Apply rules in order; use the first matching rule:

1. **If** the change touches auth/authz, payments, crypto, migrations, PII, or multi-tenant boundaries,
   **then** apply **Full Audit** (§4 all rounds + §10 threat model + all applicable §7 checklists).
   → State: "Full Audit selected: [domain] touched."

2. **If** the change modifies a public contract (API schema, CLI output, DB migration, wire format) without touching high-risk domains,
   **then** apply **Contract-Focused Review** (§7.A/B + §4 Rounds 0-2 + §4 Round 4 verification).
   → State: "Contract-Focused Review selected: [contract type] modified."

3. **If** the change introduces new async/distributed behavior (queues, workers, event handlers, background tasks),
   **then** apply **Async Review** (§6.9 + §7.C + §4 Rounds 0-2 + verification of idempotency/retry behavior).
   → State: "Async Review selected: [component type] introduced."

4. **If** the change is a pure mechanical refactor with no behavior change AND existing test coverage for touched code is verified,
   **then** apply **Lightweight Review** (§14 Quick Card only).
   → State: "Lightweight Review selected: refactor-only; coverage verified at [evidence: coverage report or test names]."

5. **Otherwise**, apply **Standard Review** (§4 Rounds 0-2 + relevant §7 checklists + §4 Round 4 if verification commands available).
   → State: "Standard Review selected: [brief justification]."

---

### 11.2 Depth escalation triggers

During review, escalate to Full Audit if any of the following are discovered:

- [ ] Unexpected auth/authz code in the diff
- [ ] Secrets or credentials handled
- [ ] New external network calls to untrusted destinations
- [ ] Database migrations on tables with >1M rows (or unknown size)
- [ ] Caching logic that affects correctness (not just performance)
- [ ] "Exactly-once" or "atomic" claims without proof

→ If escalation occurs: state "Escalated to Full Audit: [trigger discovered at file:line]."

---

### 11.3 Review depth output requirement

The report shall include at the top:

```markdown
**Review depth**: [Full Audit / Contract-Focused / Async / Lightweight / Standard]
**Justification**: [one sentence explaining why this depth was selected]
**Escalations**: [none / list of triggers that caused escalation]
```

---

## 12) Reviewer output expectations (format + completeness)

### Required sections

Audit-style reviews must include all of the following (even for small diffs):

1. **Executive summary + verdict**

   - intent, risk level, and a clear **Verdict**: `APPROVE` / `REQUEST CHANGES` / `BLOCK`
   - severity counts (BLOCKER/MAJOR/MINOR/NIT)
   - top risks and why (1–5 bullets)

2. **Change inventory**

   - diffstat (files + LOC churn)
   - files/domains touched (contracts/storage/security/etc.)
   - dependency/capability delta
   - data/migration delta

3. **Requirements traceability**

   - acceptance criteria / requirements → status → evidence anchors

4. **Findings**

   - grouped by **BLOCKER / MAJOR / MINOR / NIT**
   - each non‑NIT finding includes: location + failure mode + fix + test/verification + evidence anchors

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

The "Not verified / residual risk" section shall be populated when ANY of the following are true:

- [ ] A verification command was not run (cite which command and why)
- [ ] A claim uses "Assumed" or "Unknown" confidence level (per §1.5.2)
- [ ] A checklist item was marked "N/A" without justification
- [ ] Migration or rollback was not tested against representative data
- [ ] Concurrency/async behavior was reviewed by code reading only (no test execution)
- [ ] Security claims were not verified with tests (e.g., "injection safe" without test proving rejection)
- [ ] Performance claims were made without benchmark evidence

For each residual risk item, include:

```markdown
- **Not verified**: [what was not verified]
  - **Why it matters**: [potential failure mode]
  - **How to verify**: [specific command, test, or check]
  - **Owner/tracking**: [issue link or suggested owner]
```

**If the section would be empty**, the reviewer shall explicitly state:

> "All claims verified mechanically; no residual risk identified. See Verification Ledger for evidence."

---

### Report storage

Store review reports in the repo’s preferred location. If none is defined, use a predictable folder such as:

- `reports/` or `.local/reports/`
- `{YYYY-MM-DD}_{HH-MM-SS}_code-review_{branch_or_pr}.md`

---

## 13) Templates (copy/paste)

Use these as scaffolding for review reports and checklists. They’re meant to be
**applied alongside** the rules and workflow in the sections above, not treated
as a standalone “prompt” that replaces them.

### 13.1 Findings template

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

List anything you did not verify mechanically, plus how to verify it.

- Not verified: …
  - Why it matters:
  - How to verify:
  - Suggested owner/tracking (if needed):

---

## Final sanity check (Round 5)

(After completing all structured rounds, revisit this section. Does the change make sense as a whole? Did the checklists miss anything? Any lingering concerns?)

- Fresh eyes observations addressed: [yes / no — list any that were missed]
- Holistic assessment: ...
- Unexplained concerns (if any): ...
```

### 13.2 AI reviewer usage

See §0) “How to use this guide (humans and AI reviewers)”. This section stays
short on purpose so the guidance is treated as part of the overall document,
not as a standalone “paste this prompt” block.

---

## 14) Quick Review Card (one-page cheat sheet)

Use this for day‑to‑day PRs. If risk is high, do not stop here—use the full workflow.

### A) 2-minute triage

- [ ] Read PR description + linked issue(s) (or infer from commits/branch).
- [ ] Identify **risk level** (low/medium/high) and why.
- [ ] Identify **contract surfaces** touched (API/schema/DB/CLI/config/events).
- [ ] Note **side effects**: network / filesystem / subprocess / migrations / permissions.
- [ ] Note **async/distributed**: queues, workers, retries, background tasks, event handlers.

#### Stop conditions (immediate escalation to Full Audit)

When ANY of these are present, stop Quick Review and apply Full Audit (§4 + §10):

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

For each category, if a check fails: escalate to full checklist (§6/§7) and assign severity.

1. **Contracts & boundaries**

   - [ ] Boundary validation exists (types/ranges/length). → If missing: **MAJOR**
   - [ ] Unknown-field policy is explicit and tested (reject or documented ignore). → If missing: **MINOR**
   - [ ] Breaking changes are versioned or explicitly acknowledged. → If unversioned: **BLOCKER**

2. **State & persistence**

   - [ ] Writes happen only in allowed layer (ownership respected). → If violated: **BLOCKER**
   - [ ] Retry/duplicate safety (idempotency) is correct where needed. → If missing: **MAJOR**
   - [ ] Ordering/determinism rules are preserved. → If violated: **MAJOR**

3. **Async/distributed**

   - [ ] Handler is safe under retries/duplicates. → If unsafe: **BLOCKER**
   - [ ] Concurrency is bounded; backpressure exists. → If unbounded: **MAJOR**
   - [ ] Poison/failed work path exists (DLQ/quarantine/alerts). → If missing: **MAJOR**
   - [ ] Cancellation/shutdown won't leak tasks or lose commits. → If leaks: **MAJOR**

4. **Security**

   - [ ] Authn/authz checks are present and correct (object-level permissions if relevant). → If missing: **BLOCKER**
   - [ ] No injection risks (SQL/command/path/template/deserialization). → If found: **BLOCKER**
   - [ ] No secrets/PII in logs/traces/errors. → If found: **BLOCKER**

5. **Reliability**

   - [ ] Timeouts + bounded retries for external calls. → If missing: **MAJOR**
   - [ ] Partial failure behavior is defined (rollback/compensation). → If undefined: **MAJOR**
   - [ ] Feature flags/rollout/rollback plan exists if risky. → If missing for risky change: **MINOR**

6. **Tests & docs**
   - [ ] Tests cover happy path + rejection path.
   - [ ] Changed production code has test exercising each modified branch (or justified exception with issue link).
   - [ ] CI gates still enforce required checks.
   - [ ] Docs/specs updated if behavior/contract changed.

→ When any item fails: cite `file:line` + severity per full checklist (§6, §9).

---

### C) Discussion closure (PRs)

- [ ] Unresolved review threads are resolved or explicitly deferred (with tracking).
- [ ] If using CLI: confirm unresolved inline threads (not just PR comments) are handled.
- [ ] New commits didn’t introduce unreviewed risk.
- [ ] Required reviewers/codeowners satisfied.

#### CLI helper for unresolved inline threads (GraphQL)

```bash
gh api graphql -F owner=<owner> -F repo=<repo> -F number=<pr> -f query='query($owner:String!, $repo:String!, $number:Int!) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:100) { nodes { isResolved comments(first:10) { nodes { author { login } body path line } } } } } } }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
```

---

### D) Findings standard (how to write comments)

For any non-NIT finding, include:

- **Location** + **What** + **Why (failure mode)** + **Fix** + **Test/verification**

---

### E) Minimal review output template (Quick Review Card)

```md
## Summary

- Intent:
- Risk level: low/medium/high (why)
- Areas touched:
- Review depth: [Full Audit / Contract-Focused / Async / Lightweight / Standard] — [justification]

## Findings

For each non-NIT finding, use this format:

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

## Residual risk (if any)

- Not verified: [what] — Why: [failure mode] — How to verify: [action]
```