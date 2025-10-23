# Carvana Automation Userscripts — Foundation

Production-ready skeleton for DRY, SOLID, KISS, YAGNI Tampermonkey automation targeting:

- **Jira** — `https://jira.carvana.com/*`
- **Oracle (Carvana)** — `https://edsk.fa.us2.oraclecloud.com/*`

Shared TypeScript core:
- Non‑brittle selectors (`css/id/role/tag/type/attributes/text`, `and/or/not/within/nth`, `visible`)
- Wait utilities with MutationObserver + polling + stability time
- Declarative workflows (click/type/wait/extract/branch/error) with persistence/resume
- Dynamic menu (Shadow DOM): **Workflows**, **Selectors** (JSON editor + Test), **Theme**, **Storage**, **Logs**

> Looking to build your own pages/workflows? See **[AGENTS.md](./AGENTS.md)**.

---

## Quick Start

Requirements: Node 18+, npm.

```bash
npm i
npm run build
```

This outputs two files in `dist/`:

* `jira.user.js`
* `oracle.user.js`

Install each in Tampermonkey (drag into the browser or paste into a new script).

---

## First Run / Demo Workflows

The default registry is **demo‑only**. On a matching site, click the **gear**:

* Run **Demo: Title → Clipboard** to copy the page title and show a preview.
* Try **Demo: Page Info** and **Demo: List Links** to validate extraction & presentation.

Then jump to **AGENTS.md** to add your own pages and real workflows.
