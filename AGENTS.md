# AGENTS.md — Carvana Userscripts: Authoring & Extensibility Guide

This document is the hands-on guide for building and evolving automations (pages, workflows, steps) on top of the foundation. It complements `README.md` (which stays short).

---

## Core Concepts

- **Page**: A detectable surface (e.g., "Jira - Issue View"). Pages have a `detector` (conditions) and a list of **workflows**.
- **Workflow**: A sequence of **actions** plus metadata (`enabledWhen`, `options`, `triggers`/`autoRun`, `intent`, `riskLevel`, `profiles`, `internal`).
- **Selectors**: Robust, composable definitions (`SelectorSpec`) that locate elements without brittleness.
- **Engine**: Runs workflows, manages auto-run, persists options/profiles, and refreshes detection on SPA navigation.
- **Menu**: Shadow-DOM panel with **Actions**, **Automations**, and **Settings** (Theme/Storage/Logs/Advanced). Search/filter/sort + archive/reorder actions; Automations show auto-run status. Operator vs Developer modes; Developer mode unlocks selector JSON editing and Task JSON tools.
- **Profiles + Options**: Per-workflow saved settings (P1/P2/P3) that feed templates and actions.

---

## Repo Safety Guards

- Do not use the `apply_patch` command/tool in this repository. Use direct file writes or scripted edits instead.
- Before any commit, you MUST scan staged and unstaged diffs for sensitive content (PII/secrets/production identifiers). At minimum review `git diff -- .` and `git diff --cached -- .` and remove/redact anything sensitive before committing.

---
## SelectorSpec (robust selection)

Available fields (you can combine them):

- `selector` (CSS), `id`, `tag`, `type`, `role`
- `text` { `equals` | `includes` | `regex` } with `caseInsensitive`, `trim`
- `attribute`: object of matchers (string literal or `{ equals|includes|regex, flags }`)
- `visible`: require visibility
- `within`: scope to an ancestor that matches another `SelectorSpec`
- Logical: `and`, `or`, `not`
- `nth`: choose an index (0‑based)

**Tip:** Prefer combinations (e.g., `role + text.includes + attribute`) over brittle CSS.

---

## Actions DSL

- `waitFor` — wait for element by selector; supports `timeoutMs`, `pollIntervalMs`, `visibleOnly`, `minStabilityMs`.
- `delay` — sleep for ms.
- `click` — optional `preWait`, `postWaitFor` (e.g., wait for a listbox that opens).
- `type` — `clearFirst`, per‑key delay, optional `postEnter`.
- `selectFromList` — pick an item in a popup/list using list spec + item spec.
- `extract` — harvest `text/html/value/href/attribute/raw` into a JSON object; supports globals (`document.title`, `location.*`, `navigator.userAgent`, `timestamp`).
- `extractList` — harvest rows using a `list` selector and `fields` (each with `key`, `take`, optional `from`); `limit` can be templated.
- `captureData` — prompt for pasted text, parse via regex/selector/split patterns, store in `vars`, and optionally `present`/`copyToClipboard`.
- `branch` — conditional routing (`exists/notExists/textPresent/any/all/not`) to another workflow ID.
- `execute` — run custom code with context (`vars`, `options`, `profile`, `log`, `runWorkflow`, `setVar`, `getVar`, `store`); optional `assign`.
- `error` — display a message (can be used in error workflows).

You can add new actions; see **“Adding a new Action”** below.

### Templating (options + vars)

All string fields inside steps are templated at runtime. Use:

- `{{opt.KEY}}` for workflow options (saved per profile).
- `{{vars.KEY}}` for values captured at runtime (e.g., `captureData` output).
- `{{profile.id}}` / `{{profile.label}}` when needed.

---

## Adding a Page

Create a page file like `packages/jira-userscript/src/pages/my-page.ts` and a workflow file such as `packages/jira-userscript/src/workflows/jira-my-do-something.ts`.

```ts
// packages/jira-userscript/src/workflows/jira-my-do-something.ts
import type { WorkflowDefinition } from '@cv/core';

export const JiraMyDoSomethingWorkflow: WorkflowDefinition = {
  id: 'jira.my.do.something',
  label: 'Do Something',
  steps: [
    { kind: 'click', target: { text: { includes: 'Open Menu', caseInsensitive: true }, tag: 'button' }, postWaitFor: { role: 'listbox' } },
    { kind: 'selectFromList', list: { role: 'listbox' }, item: { text: { equals: 'Desired Item', caseInsensitive: true } } }
  ]
};
```

```ts
// packages/jira-userscript/src/pages/my-page.ts
import type { PageDefinition } from '@cv/core';
import { JiraMyDoSomethingWorkflow } from '../workflows/jira-my-do-something';

export const MyPage: PageDefinition = {
  id: 'jira.my.page',
  label: 'Jira — My Custom Page',
  detector: {
    all: [
      { exists: { selector: 'body' } },
      { textPresent: { where: { selector: 'h1, [data-test-id="page-title"]' }, matcher: { includes: 'My Page', caseInsensitive: true } } }
    ]
  },
  workflows: [JiraMyDoSomethingWorkflow]
};
```

Register the page in your `src/index.ts` (order matters: first match wins) and rebuild.

---

## Authoring a Workflow

* Start with a rough flow using generic selectors (or just text), then open **Menu → Developer mode → Task detail → Selectors** to refine.
* Use `postWaitFor` on `click` when the click opens a panel/list/etc.
* Use `waitFor` when you need to wait for contents to appear.
* Use `branch` to handle missing elements or alternate paths.
* Use `extract` + `present` for quick UI feedback, and `copyToClipboard` to move data to your clipboard.
* Toggle **Auto** in **Automations** (or the task detail view) to launch a workflow automatically when its page detector matches; enable **Repeat** to allow re-running on subsequent detections (with guardrails that prevent rapid loops).
* Store each workflow definition in its own file (e.g., `src/workflows/<workflow-id>.ts`) and import it into the page module; avoid defining multiple workflows inside a single page file.
* For long-running single clicks that must succeed (e.g., Oracle’s “Expand Search — Invoice”), use the shared `click` action’s `postWaitFor` + optional `postWaitTimeoutMs`/`postWaitPollMs` so the engine keeps retrying until the expected state appears, instead of building ad-hoc loops inside workflows.
* Prefer `options` + templates (`{{opt.*}}`) instead of hard-coded values; use `captureData` when operators paste data.
* Use `enabledWhen` to gate auto-run and relevance (manual runs still work).
* Set `intent: 'automation'` for auto-only tasks or `internal: true` for helper workflows.
* Use `riskLevel: 'caution' | 'danger'` to require confirmation before enabling auto-run.
* Disable profiles per workflow via `profiles: { enabled: false }` when you do not need multiple option sets.

### Triggers and auto-run config

Preferred: use `triggers` (manual/auto/repeat) and `triggers.auto.config` for settings. `autoRun` still works as a legacy alias.

Auto-run config fields:

- `waitForConditionMs` / `waitForReadyMs` (or `waitForMs`) and `pollIntervalMs`
- `waitForSelector`, `waitForHiddenSelector`, `waitForInteractableSelector`
- `respectLoadingIndicator` (default true), `skipReadiness`
- `retryDelayMs` (for repeat-enabled auto retries)
- `watchMutations` (boolean or config with `root`, `debounceMs`, `observeAttributes`, `observeChildList`, `observeCharacterData`, `attributeFilter`, `forceAutoRun`)
- `context` (string/function/object) to decide when repeat runs are allowed even if the URL is unchanged

Trigger knobs:

- `triggers.manual.enabled=false` to disable manual runs (and hide from Actions).
- `triggers.auto.enabled=false` to disable auto-run even if `autoRun` is set.
- `triggers.repeat.enabled=false` to disable repeat for that workflow.

### Oracle auto-run reliability notes

When automating Oracle panels, the DOM swaps the expand/collapse anchor without changing the surrounding markup. The reliable pattern is:

1. **Detection**: Branch once you detect any matching “Search: Invoice” button, then check the current `aria-expanded` value inside the helper workflow.
2. **Click helper**: In the helper workflow, call `click` with `postWaitFor` targeting the `aria-expanded='true'` selector. The shared `click` action now retries automatically, so you do not need manual polling.
3. **Fallback helper**: If the button is already expanded, run an `ensure` helper that simply waits for the expanded button and second-row container.

**2025-10 Oracle SPA regression**: Oracle began recycling the search toggle without rebuilding the panel rows, which caused auto-run repeat loops to stall. Mitigation:

- Drive all auto-run conditions off the button’s `aria-expanded` attribute (`exists` for `'false'` when collapsed, `postWaitFor` for `'true'` when expanded). This works for any future toggle-style workflows because the attribute survives DOM swaps.
- When repeat is enabled, derive an auto-run context token that combines a stable page marker (tab/header/title) plus the expanded/collapsed state so reruns fire after navigation.
- Configure `watchMutations` with `root: { selector: 'body' }`, `attributeFilter: ['aria-expanded']`, and `forceAutoRun: false`. This waits for Oracle’s attribute flip before rechecking conditions, but still respects cooldowns.
- Keep a generous `waitForConditionMs` (~12s) and `pollIntervalMs` (~150ms) so the button can transition between states during SPA redraws.

Apply the same recipe for other Oracle workflows (or any app that toggles via `aria-expanded`): identify the stable attribute change, store page context tokens, and scope the mutation watcher to the attribute instead of brittle row containers.

This approach avoids duplicating auto-run logic per workflow and keeps Oracle-specific helpers internal by setting `internal: true` on helper workflows.

---

## Loading States (no guessing)

If Oracle (or any page) has a “loading” element, persist it in Settings:

```json
{
  "theme": { "primary": "#1f7a8c", "background": "#0b0c10e6", "text": "#f5f7fb", "accent": "#ffbd59" },
  "interActionDelayMs": 120,
  "loadingIndicator": { "selector": ".af_busy", "visible": true }
}
```

When set, the engine waits after every step until that element is no longer visible.

---

## Branching & Error Paths

Route to other workflows:

```ts
{ kind: 'branch',
  condition: { notExists: { selector: '[data-field-id="resolution"] [data-testid="single-select-read-view"]' } },
  thenWorkflow: 'jira.set.resolution',
  elseWorkflow: 'jira.already.ok'
}
```

This executes nested workflows safely.

---

## Persistent Memory

Engine stores:

* `lastWorkflow` (id + timestamp)
* `lastStep` (index)
* Config and selectors via `Store` (GM_*), export/import in **Settings → Storage**.
* Auto-run preferences per workflow (`auto`, `repeat`, `lastRun` metadata + optional context).
* Options + profiles per workflow (P1/P2/P3) and per-page menu ordering/archiving.

You can store arbitrary KV per workflow if you need it (extend in your actions).

---

## Adding a New Action (advanced)

1. Extend the `Action` union in `packages/core/src/types.ts`:

```ts
| { kind: 'focus'; target: SelectorSpec; comment?: string }
```

2. Implement in `execStep` in `packages/core/src/workflow.ts`:

```ts
case 'focus': {
  const el = findOne(step.target, { visibleOnly: true }) as HTMLElement | null;
  if (!el) return { ok: false, error: 'focus: target not found' };
  el.focus();
  return { ok: true };
}
```

Rebuild and reinstall.

If the new action introduces new selector fields, update `packages/core/src/ui.ts` (`workflowHasSelectors`) so the selector editor and Dev badges stay accurate.

---

## Testing & Debugging

* Use the **Demo** workflows first to verify plumbing (copy title/info).
* Use **Developer mode → Task detail → Selectors → Test Match** to highlight current selector matches.
* **Settings → Logs** includes a filter + "Show debug logs".
* **Settings → Advanced** (Developer mode only) lets you load/copy/apply Task JSON in-memory.
* If the menu isn’t visible, ensure your userscript is enabled and the URL matches your `@match`.
* If a page doesn’t show expected workflows, your **detector** likely didn’t match. Temporarily switch to a fallback demo page or relax your detector.
* Use browser devtools + Console for logs.
* To test userscripts in Tampermonkey/Violentmonkey with auto-update, run `npm run serve:userscripts` (serves `dist/` on `http://localhost:4873`) and build with `npm run build:dev` so the emitted metadata includes `@downloadURL`/`@updateURL` pointing to that server. Install once from the served URL; subsequent builds auto-update.

---

## Style & Principles

* **DRY, SOLID, KISS, YAGNI** across workflows and selectors.
* Prefer semantic attributes, roles, and text over brittle positional CSS.
* Keep workflows small, composable, and data‑driven (selectors and values in settings/storage where possible).

---

# GitOps Workflow

## Applicability

- WHEN you start work (branching) THEN you SHALL strictly follow all workflows set in this GitOps Workflow section.
- WHEN you open, update, or merge a PR THEN you SHALL strictly follow all workflows set in this GitOps Workflow section.
- WHEN you write commits or a squash-merge message THEN you SHALL strictly follow all workflows set in this GitOps Workflow section.
- WHEN you draft release notes THEN you SHALL strictly follow all workflows set in this GitOps Workflow section.

## 1) Git branching workflow

- WHEN you start any work THEN you SHALL create a new branch:
  1. You SHALL branch from `main` (or the designated base branch for the task).
  2. You SHALL use descriptive branch names following the pattern:
     - `feat/<short-description>` for new features
     - `fix/<short-description>` for bug fixes
     - `docs/<short-description>` for documentation changes
     - `refactor/<short-description>` for refactoring
     - `test/<short-description>` for test additions/changes
  3. You SHALL NOT commit directly to `main`.
  4. WHEN you are about to make changes THEN you SHALL verify you are on the correct branch:

     ```bash
     git checkout main && git pull && git checkout -b <branch-name>
     ```

## 2) Pull request workflow

### 2.1 Link related issues

- WHEN you are about to create a PR THEN you SHALL check for related issues and link them:
  1. You SHALL search for relevant issues:

     ```bash
     gh issue list --search "keyword"
     gh issue list --label "bug"
     ```

  2. WHEN you link issues in the PR body THEN you SHALL use closing keywords (GitHub will auto-close the issue when the PR merges):
     - `Closes #123` — general completion
     - `Fixes #123` — bug fixes
     - `Resolves #123` — alternative syntax
  3. WHEN an issue is related but not fully resolved THEN you SHALL reference it without closing keywords:
     - `Related to #123`
     - `Part of #123`

### 2.2 PR description and reviewers

- IF your repo uses automated reviewers/bots THEN you SHALL list them in the PR body (separate lines; at the end of the PR description) so they reliably trigger.
- WHEN you script PR bodies/comments THEN you SHALL ensure newlines render as real line breaks (not literal `\n`): prefer `gh pr create --body-file ...` or `gh pr view --template '{{.body}}'` (or `--json body --jq '.body'`) when reading.
- WHEN you intend multi-line bodies THEN you SHALL ensure they render as real line breaks (you SHALL avoid literal `\n` in the rendered text).

### 2.3 Updating an existing PR

- WHEN you are about to push updates to an existing PR THEN you SHALL:
  1. You SHALL read top-level comments using `gh pr view <number> --comments` (or view on GitHub); you SHALL NOT skip these.
  2. You SHALL read inline review threads (these are not included in `gh pr view --comments`); to list unresolved inline threads via CLI, you SHALL use:

     ```bash
     gh api graphql -F owner=<owner> -F repo=<repo> -F number=<pr> -f query='
       query($owner:String!, $repo:String!, $number:Int!) {
         repository(owner:$owner, name:$repo) {
           pullRequest(number:$number) {
             reviewThreads(first:100) {
               nodes { isResolved comments(first:10) { nodes { author { login } body path line } } }
             }
           }
         }
       }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
     ```

  3. You SHALL identify unresolved feedback in BOTH top-level comments AND inline threads.
  4. You SHALL check CI/CD status (review failing checks and logs via `gh pr checks <number> --watch` or GitHub UI) and you SHALL plan fixes before pushing updates.
  5. You SHALL address or respond to each item before you push new commits.
  6. WHEN you address feedback THEN you SHALL reply in the original thread (you SHALL NOT create a new top-level comment):
     - IF permissions/tooling prevent inline replies THEN you SHALL leave a top-level PR comment that references the specific thread(s) and explains why inline reply was not possible.
     - To reply inline via CLI, you SHALL use the review comment reply endpoint:

       ```bash
       gh api -X POST /repos/<owner>/<repo>/pulls/<pr_number>/comments/<comment_id>/replies \
         -f body="reply text"
       ```

     - GraphQL note: `addPullRequestReviewComment` is deprecated; you SHOULD use `addPullRequestReviewThreadReply` with the thread ID if you need GraphQL-based replies.
  7. IF you implemented an automated reviewer/bot suggestion OR you are asking for clarification/further input THEN you SHALL re-tag the bot; IF you rejected the feedback THEN you SHALL NOT re-tag and you SHALL explain why in the thread.

### Treating automated reviewer feedback

- WHEN you receive automated reviewer feedback THEN you SHALL treat it as non-authoritative.
- You SHALL treat automated comments like reviews from a helpful but inexperienced junior developer:
  1. You SHALL verify claims before acting; suggestions may be incorrect, outdated, or miss repo-specific context.
  2. You SHALL NOT blindly apply changes; IF a suggestion conflicts with project invariants or conventions THEN it is wrong regardless of confidence.
  3. IF a claim is inaccurate THEN you SHALL NOT proceed; you SHALL respond directly in the PR thread explaining why.
  4. IF a suggestion is valid and you make changes THEN you SHALL reply in the same thread to keep context together; you SHOULD re-tag the bot so it can verify the fix.
  5. You MAY use automated reviews for catching typos, obvious bugs, missing tests, and style drift; you SHOULD treat them as less reliable for architectural decisions, invariant enforcement, and security boundaries.

### 2.4 Merging PRs

- WHEN you merge a PR THEN you SHALL ensure all of the following are satisfied:
  1. You SHALL ensure all review conversations are resolved (no unaddressed threads, top-level or inline).
  2. You SHALL ensure all CI/CD checks pass (green status).
  3. You SHALL ensure at least one approving review exists (from a qualified reviewer; MAY be bypassed with explicit permission).
  4. You SHALL ensure the author confirms the PR is ready to merge.
  5. You SHALL ensure the PR is rebased on the target branch (no merge conflicts).

**Merge strategy:**

- You SHALL use **squash and merge** as the default and preferred strategy.
- WHEN you squash and merge THEN you SHALL write the squash commit message using the format in section 10.4.
- You MAY use fast-forward or rebase merges for trivial single-commit PRs WHERE the original commit already conforms to section 10.

**Commit receipts:**

- AFTER push or merge operations, you SHALL include a receipt in user-visible output:

  ```markdown
   - **branch `<branch-name>`**
     - `<SHA>` `<type>[(<scope>)]:` _<description>_
     - `<SHA>` `<type>[(<scope>)]:` _<description>_
   ```

- You SHALL list branches in execution order (e.g., `test → fix → feat → refactor`).
- You SHALL include PR URL/ID if pushed.

## 3) Commit conventions

- You SHALL use **Conventional Commits** format for all commits.

### 3.1 Message format

```markdown
<type>(<scope>): <description>

[optional body]

[optional footer]
```

- You SHALL use one of the following commit types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `style`, `deps`, `security`, `revert`, `hotfix`.
- You SHOULD include a scope when it adds clarity (e.g., `feat(cli): add --json flag`, `fix(daemon): handle connection timeout`).
- You SHALL write the description in imperative mood ("Add feature" not "Added feature"); you SHALL use lowercase; you SHALL NOT end with a period.

### 3.2 Atomic commits

- You SHOULD ensure each commit represents **one logical change**.
- You SHOULD batch related file changes into a single commit (e.g., code + tests + docs for one feature).
- You SHOULD avoid mixing unrelated changes in one commit.

### 3.3 Examples

```markdown
feat(cli): add workspace init command
fix(daemon): prevent duplicate event emission on retry
docs: update kernel contract with error codes
refactor(storage): extract projection rebuild logic
test(protocol): add characterization test for unknown fields
chore: update dependencies
```

### 3.4 Squash commit body and release notes

- WHEN you squash-merge a PR THEN you SHALL write the commit body using this structure.
- WHEN you publish release notes (e.g., GitHub Release notes or a changelog entry) THEN you SHALL write the release body using this structure.

```markdown
<type>[(<scope>)]: <short imperative summary>

## Overview

<2–4 lines on context, intent, impact; reference key issues/PRs>

## New Features

- <new feature> (Refs: #123)

## What's Changed

- <enhancement/refactor/perf/docs/ci/build/style/deps> (Refs: #234)

## Bug Fixes

- <concise bug fix> (Fixes #345)

## Breaking Changes

- <impact one-liner>; migration: <concise steps>

## Commits

- `<SHA>` <original commit message>
- `<SHA>` <original commit message>

## Refs

- #123
- https://example.com/issue/456
```

**Section rules:**

- You SHALL emit sections in the order shown above: Overview, New Features, What's Changed, Bug Fixes, Breaking Changes, Commits, Refs.
- You SHALL omit empty sections EXCEPT `Overview` (always required).
- WHEN you write a squash-merge commit body THEN you SHALL include `Commits` for multi-commit PRs; you MAY omit it if the PR contains exactly one commit.
- WHEN you write release notes THEN you MAY omit `Commits`.
- You SHALL treat `## Refs` as the canonical location for all related issues/PRs/URLs.
- WHEN a bullet relates to a different issue than others THEN you MAY use inline `Fixes #id` or `Refs: #id`; OTHERWISE you SHOULD omit inline refs and rely on `## Refs`.
- IF the header contains `!` (breaking change) THEN you SHALL include a `Breaking Changes` section.

**Type-to-section mapping:**

| Commit type(s)                                                                                    | Section        |
| ------------------------------------------------------------------------------------------------- | -------------- |
| `feat`                                                                                            | New Features   |
| `fix`, `hotfix`                                                                                   | Bug Fixes      |
| `perf`, `refactor`, `docs`, `chore`, `ci`, `build`, `style`, `deps`, `revert`, `test`, `security` | What's Changed |

**Formatting rules:**

- You SHALL write the header in imperative mood with no trailing period; subject (after colon) SHOULD be ≤72 chars.
- You SHALL write bullets with `- ` prefix and they SHOULD be single-line (≤72 chars recommended).
- You SHALL write `Overview` as 2–4 lines of prose explaining why and impact; you SHALL NOT include refs in `Overview`.
- You SHALL NOT duplicate refs across bullets and `## Refs`.
- You SHALL ensure each ref item is a valid issue ref (`#123`), cross-repo ref (`owner/repo#123`), or URL.

Note that AI reviewers will often comment on or create review threads on your PRs. When responding to them, they will not respond to you if you don't tag them in your response:

- @gemini-code-assist
- @codex
  - May appear as `chatgpt-codex-connector`, but only responds to `@codex`


---

## Rust WebExtension Direction (2026-02-23 onward)

- Browser runtime target is now **WebExtensions only** for **Chrome + Firefox**. Userscript/Tampermonkey/Violentmonkey runtime is deprecated and must not be reintroduced.
- Prefer **Rust-first implementation** for workflow engine, selector logic, automation actions, extraction, state models, and site modules.
- JS/TS is allowed only as minimal browser integration glue (manifest wiring, message bridge, wasm bootstrap, extension page bootstraps).
- Avoid wrapper-heavy frameworks/shims. Use direct browser APIs and focused glue modules.
- Keep files short and focused. Favor small modules over large multi-concern files.
- Keep `excel/` artifacts in-repo; they are out-of-scope for extension runtime execution for now.
