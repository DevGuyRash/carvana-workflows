# AGENTS.md — Carvana Userscripts: Authoring & Extensibility Guide

This document is the hands-on guide for building and evolving automations (pages, workflows, steps) on top of the foundation. It complements `README.md` (which stays short).

---

## Core Concepts

- **Page**: A detectable surface (e.g., “Jira – Issue View”). Pages have a `detector` (conditions) and a list of **workflows**.
- **Workflow**: A sequence of **actions** (click/type/wait/extract/branch/error). You can persist and resume.
- **Selectors**: Robust, composable definitions (`SelectorSpec`) that locate elements without brittleness.
- **Engine**: Runs workflows, stores last step/workflow, and integrates with the menu.
- **Menu**: A Shadow‑DOM panel with tabs (Workflows, Selectors, Theme, Storage, Logs). You can edit selectors at runtime.

---

## SelectorSpec (robust selection)

Available fields (you can combine them):

- `selector` (CSS), `id`, `tag`, `type`, `role`
- `text` { `equals` | `includes` | `regex` } with `caseInsensitive`, `trim`
- `attribute`: object of attribute matchers with `equals/includes/regex`
- `visible`: require visibility
- `within`: scope to an ancestor that matches another `SelectorSpec`
- Logical: `and`, `or`, `not`
- `nth`: choose an index (0‑based)

**Tip:** Prefer combinations (e.g., `role + text.includes + attribute`) over brittle CSS.

---

## Actions DSL

- `waitFor` — wait for element by selector; supports `timeoutMs`, `visibleOnly`, `minStabilityMs`.
- `delay` — sleep for ms.
- `click` — optional `preWait`, `postWaitFor` (e.g., wait for a listbox that opens).
- `type` — `clearFirst`, per‑key delay, optional `postEnter`.
- `selectFromList` — pick an item in a popup/list using list spec + item spec.
- `extract` — harvest `text/html/value/href/attribute` into a JSON object; `present` to show; `copyToClipboard` to copy.
- `branch` — conditional routing (`exists/notExists/textPresent/any/all/not`) to another workflow ID.
- `error` — display a message (can be used in error workflows).

You can add new actions; see **“Adding a new Action”** below.

---

## Adding a Page

Create a file like `packages/jira-userscript/src/pages/my-page.ts`:

```ts
import type { PageDefinition, WorkflowDefinition } from '@cv/core';

export const MyPage: PageDefinition = {
  id: 'jira.my.page',
  label: 'Jira — My Custom Page',
  detector: {
    all: [
      { exists: { selector: 'body' } },
      { textPresent: { where: { selector: 'h1, [data-test-id="page-title"]' }, matcher: { includes: 'My Page', caseInsensitive: true } } }
    ]
  },
  workflows: []
};

const MyWorkflow: WorkflowDefinition = {
  id: 'jira.my.do.something',
  label: 'Do Something',
  steps: [
    { kind: 'click', target: { text: { includes: 'Open Menu', caseInsensitive: true }, tag: 'button' }, postWaitFor: { role: 'listbox' } },
    { kind: 'selectFromList', list: { role: 'listbox' }, item: { text: { equals: 'Desired Item', caseInsensitive: true } } }
  ]
};

MyPage.workflows.push(MyWorkflow);
```

Register the page in your `src/index.ts` (order matters: first match wins) and rebuild.

---

## Authoring a Workflow

* Start with a rough flow using generic selectors (or just text), then open **Menu → Selectors** to refine.
* Use `postWaitFor` on `click` when the click opens a panel/list/etc.
* Use `waitFor` when you need to wait for contents to appear.
* Use `branch` to handle missing elements or alternate paths.
* Use `extract` + `present` for quick UI feedback, and `copyToClipboard` to move data to your clipboard.

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
* Config and selectors via `Store` (GM_*), export/import in **Storage** tab.

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

---

## Testing & Debugging

* Use the **Demo** workflows first to verify plumbing (copy title/info).
* Use **Selectors → Test Match** to highlight current selector matches.
* If the menu isn’t visible, ensure your userscript is enabled and the URL matches your `@match`.
* If a page doesn’t show expected workflows, your **detector** likely didn’t match. Temporarily switch to a fallback demo page or relax your detector.
* Use browser devtools + Console for logs.

---

## Style & Principles

* **DRY, SOLID, KISS, YAGNI** across workflows and selectors.
* Prefer semantic attributes, roles, and text over brittle positional CSS.
* Keep workflows small, composable, and data‑driven (selectors and values in settings/storage where possible).