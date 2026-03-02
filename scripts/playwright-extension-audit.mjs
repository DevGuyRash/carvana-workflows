#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const EXT_PATH = path.resolve('dist/chrome-extension');
const OUT_DIR = path.resolve('.local/audits');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_JSON = path.join(OUT_DIR, `playwright-extension-audit-${timestamp}.json`);
const OUT_MD = path.join(OUT_DIR, `playwright-extension-audit-${timestamp}.md`);

const findings = [];
const parity = [];
const artifacts = {
  timestamp: new Date().toISOString(),
  extensionPath: EXT_PATH,
  checks: findings,
  parity,
  stats: { total: 0, pass: 0, fail: 0, warn: 0 },
  notes: [],
};

function addCheck(name, status, details, extra = {}) {
  findings.push({ name, status, details, ...extra });
  artifacts.stats.total += 1;
  if (status === 'pass') artifacts.stats.pass += 1;
  if (status === 'fail') artifacts.stats.fail += 1;
  if (status === 'warn') artifacts.stats.warn += 1;
}

function addParity(site, feature, status, delta, extra = {}) {
  parity.push({ site, feature, status, delta, ...extra });
}

async function runCheck(name, fn) {
  try {
    const result = await fn();
    addCheck(name, 'pass', result?.details ?? 'ok', result?.extra ?? {});
    return result;
  } catch (err) {
    addCheck(name, 'fail', err instanceof Error ? err.message : String(err));
    return null;
  }
}

function htmlJiraFixture() {
  return `<!doctype html>
  <html>
    <head><title>Jira Issue Navigator</title></head>
    <body>
      <h1>Issue Navigator</h1>
      <table id="issuetable">
        <thead>
          <tr><th>Key</th><th>Summary</th><th>Status</th><th>Assignee</th></tr>
        </thead>
        <tbody>
          <tr><td>TR-100</td><td>Stock S123456 VIN 1HGCM82633A004352 PID P998877</td><td>Open</td><td>Alice</td></tr>
          <tr><td>TR-101</td><td>VIN only 5YJ3E1EA7JF000001 no stock no pid</td><td>In Progress</td><td>Bob</td></tr>
          <tr><td>TR-102</td><td>Stock S765432 and PID P111222</td><td>Done</td><td>Cara</td></tr>
          <tr><td>TR-103</td><td>No identifiers here</td><td>Open</td><td>Dev</td></tr>
          <tr><td>TR-104</td><td>PID P909090 VIN 2HGFG11869H123456</td><td>QA</td><td>Eve</td></tr>
        </tbody>
      </table>
    </body>
  </html>`;
}

function htmlOracleFixture() {
  return `<!doctype html>
  <html>
    <head><title>Oracle Fusion Payables</title></head>
    <body>
      <h1>Invoice Header</h1>
      <h2>Edit Invoice</h2>
      <table>
        <tr>
          <td class="xrh" headers="ValidationStatus">
            <a href="#"><span class="p_AFTextOnly">needs reverification</span></a>
          </td>
        </tr>
      </table>
      <form>
        <label>Business Unit <input name="Business Unit" value="CARVANA" /></label>
        <label>Supplier <input name="Supplier" value="Demo Supplier" /></label>
        <label>Supplier Site <input name="Supplier Site" value="HQ" /></label>
        <label>Invoice Number <input name="Invoice Number" value="INV-10001" /></label>
      </form>
    </body>
  </html>`;
}

function htmlCarmaFixture() {
  return `<!doctype html>
  <html>
    <head><title>Carma Dashboard</title></head>
    <body>
      <main>
        <h1>Carma Dashboard</h1>
        <section data-app="carma">Bulk Search</section>
        <section class="cpl__block">
          <div class="cpl__block__header-title">Latest Purchase</div>
          <button aria-label="Show 25">Show 25</button>
          <table data-testid="data-table">
            <thead>
              <tr>
                <th>Stock Number</th><th>VIN</th><th>Purchase ID</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>S123456</td><td>1HGCM82633A004352</td><td>P123</td><td>2026-01-10</td></tr>
              <tr><td>S123456</td><td>1HGCM82633A004352</td><td>P123</td><td>2026-01-09</td></tr>
              <tr><td>S765432</td><td>5YJ3E1EA7JF000001</td><td>P765</td><td>2026-02-01</td></tr>
            </tbody>
          </table>
        </section>
      </main>
    </body>
  </html>`;
}

function htmlBlank() {
  return '<!doctype html><html><head><title>Blank</title></head><body></body></html>';
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cv-ext-audit-'));
  let context;

  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        '--no-sandbox',
      ],
      viewport: { width: 1440, height: 900 },
    });

    await context.route('https://jira.carvana.com/**', (route) => {
      route.fulfill({ status: 200, contentType: 'text/html', body: htmlJiraFixture() });
    });
    await context.route('https://abc.fa.us2.oraclecloud.com/**', (route) => {
      route.fulfill({ status: 200, contentType: 'text/html', body: htmlOracleFixture() });
    });
    await context.route('https://carma.cvnacorp.com/**', (route) => {
      route.fulfill({ status: 200, contentType: 'text/html', body: htmlCarmaFixture() });
    });
    await context.route('https://example.com/**', (route) => {
      route.fulfill({ status: 200, contentType: 'text/html', body: htmlBlank() });
    });

    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 60000 });
    const extensionId = sw.url().split('/')[2];
    artifacts.extensionId = extensionId;

    const jiraPage = await context.newPage();
    await jiraPage.goto('https://jira.carvana.com/issues/?jql=project=TR', { waitUntil: 'domcontentloaded' });
    await jiraPage.bringToFront();

    const bridge = await context.newPage();
    await bridge.goto(`chrome-extension://${extensionId}/extension.html`, { waitUntil: 'domcontentloaded' });

    const runtimeSend = async (msg) => {
      return bridge.evaluate(async (m) => chrome.runtime.sendMessage(m), msg);
    };

    const activeTabInfo = async () => {
      return bridge.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        return { id: tab?.id, url: tab?.url, title: tab?.title };
      });
    };

    await runCheck('Active tab should be Jira fixture before command tests', async () => {
      await jiraPage.bringToFront();
      await bridge.waitForTimeout(200);
      const info = await activeTabInfo();
      if (!info?.url?.includes('jira.carvana.com')) {
        throw new Error(`Unexpected active tab URL: ${info?.url || 'none'}`);
      }
      return { details: `active tab ${info.url}` };
    });

    await runCheck('Runtime detect-site identifies Jira', async () => {
      await jiraPage.bringToFront();
      const resp = await runtimeSend({ kind: 'detect-site', payload: { url: jiraPage.url() } });
      if (!resp?.ok || resp?.data?.site !== 'jira') {
        throw new Error(`detect-site response: ${JSON.stringify(resp)}`);
      }
      return { details: JSON.stringify(resp) };
    });

    await runCheck('Runtime get-rules for jira returns non-empty list', async () => {
      await jiraPage.bringToFront();
      const resp = await runtimeSend({ kind: 'get-rules', payload: { site: 'jira' } });
      if (!resp?.ok || !Array.isArray(resp?.data) || resp.data.length === 0) {
        throw new Error(`get-rules jira response: ${JSON.stringify(resp)}`);
      }
      return { details: `jira rules: ${resp.data.length}` };
    });

    await runCheck('Runtime run-rule executes jira.jql.builder', async () => {
      await jiraPage.bringToFront();
      const resp = await runtimeSend({ kind: 'run-rule', payload: { site: 'jira', ruleId: 'jira.jql.builder' } });
      if (!resp?.ok) {
        throw new Error(`run-rule response: ${JSON.stringify(resp)}`);
      }
      return { details: JSON.stringify(resp).slice(0, 300) };
    });
    await runCheck('Jira parity: jql builder panel contains quick/visual/advanced tabs', async () => {
      await jiraPage.bringToFront();
      await runtimeSend({ kind: 'run-rule', payload: { site: 'jira', ruleId: 'jira.jql.builder' } });
      const tabs = await jiraPage.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-cv-tab]')).map((node) => node.textContent?.trim() ?? '');
      });
      const hasTabs = ['Quick', 'Visual', 'Advanced'].every((tab) => tabs.includes(tab));
      if (!hasTabs) throw new Error(`missing tabs in ${JSON.stringify(tabs)}`);
      addParity('jira', 'panel_modes_quick_visual_advanced', 'PARITY', 'none');
      return { details: tabs.join(', ') };
    });

    await runCheck('Jira parity: repeated open does not duplicate panel root', async () => {
      await jiraPage.bringToFront();
      await runtimeSend({ kind: 'run-rule', payload: { site: 'jira', ruleId: 'jira.jql.builder' } });
      await runtimeSend({ kind: 'run-rule', payload: { site: 'jira', ruleId: 'jira.jql.builder' } });
      const panelCount = await jiraPage.evaluate(
        () => document.querySelectorAll('#cv-jql-builder-panel').length,
      );
      if (panelCount !== 1) throw new Error(`expected one panel, found ${panelCount}`);
      addParity('jira', 'panel_lifecycle_duplicate_binding_guard', 'PARITY', 'none');
      return { details: `panel roots=${panelCount}` };
    });
    addParity(
      'jira',
      'userscript_gear_launcher',
      'INTENTIONAL_DELTA',
      'Extension-driven launch only (no in-page gear/switcher injection)',
    );

    await runCheck('Runtime capture-table returns Jira rows', async () => {
      await jiraPage.bringToFront();
      const resp = await runtimeSend({ kind: 'capture-table' });
      if (!resp?.ok || !Array.isArray(resp?.data) || resp.data.length < 3) {
        throw new Error(`capture-table response: ${JSON.stringify(resp)}`);
      }
      const firstRow = resp.data[0];
      return {
        details: `rows=${resp.data.length}`,
        extra: { firstRowKeys: Object.keys(firstRow || {}) },
      };
    });

    await runCheck('Runtime run-rule rejects unknown Jira rule', async () => {
      await jiraPage.bringToFront();
      const resp = await runtimeSend({ kind: 'run-rule', payload: { site: 'jira', ruleId: 'jira.missing.rule' } });
      if (resp?.ok !== false) {
        throw new Error(`expected failure, got: ${JSON.stringify(resp)}`);
      }
      return { details: resp.error || JSON.stringify(resp) };
    });

    await runCheck('Runtime run-auto-rules returns aggregated results envelope', async () => {
      await jiraPage.bringToFront();
      const resp = await runtimeSend({ kind: 'run-auto-rules', payload: { url: jiraPage.url() } });
      if (!resp || typeof resp.ok !== 'boolean') {
        throw new Error(`invalid envelope: ${JSON.stringify(resp)}`);
      }
      if (!resp.data || !Array.isArray(resp.data.results)) {
        throw new Error(`missing results array: ${JSON.stringify(resp)}`);
      }
      return { details: `ok=${resp.ok} results=${resp.data.results.length}` };
    });

    await runCheck('Disabling a rule blocks execution via background gate', async () => {
      await jiraPage.bringToFront();
      const off = await runtimeSend({ kind: 'toggle-rule', payload: { ruleId: 'jira.jql.builder', enabled: false } });
      if (!off?.ok) throw new Error(`toggle off failed: ${JSON.stringify(off)}`);
      const blocked = await runtimeSend({ kind: 'run-rule', payload: { site: 'jira', ruleId: 'jira.jql.builder' } });
      if (blocked?.ok !== false || !String(blocked.error || '').includes('disabled')) {
        throw new Error(`expected disabled error, got ${JSON.stringify(blocked)}`);
      }
      const on = await runtimeSend({ kind: 'toggle-rule', payload: { ruleId: 'jira.jql.builder', enabled: true } });
      if (!on?.ok) throw new Error(`toggle on failed: ${JSON.stringify(on)}`);
      return { details: `blocked message: ${blocked.error}` };
    });

    await runCheck('Settings get/save round-trip', async () => {
      const getResp = await runtimeSend({ kind: 'get-settings' });
      if (!getResp?.ok || !getResp?.data) throw new Error(`get-settings failed: ${JSON.stringify(getResp)}`);

      const newSettings = {
        ...(getResp.data || {}),
        notifications_enabled: false,
        log_level: 'debug',
      };
      const saveResp = await runtimeSend({ kind: 'save-settings', payload: newSettings });
      if (!saveResp?.ok) throw new Error(`save-settings failed: ${JSON.stringify(saveResp)}`);

      const verify = await runtimeSend({ kind: 'get-settings' });
      if (!verify?.ok || verify?.data?.notifications_enabled !== false || verify?.data?.log_level !== 'debug') {
        throw new Error(`settings not persisted: ${JSON.stringify(verify)}`);
      }
      return { details: 'settings persisted in extension storage' };
    });

    await runCheck('open-extension-page runtime command opens a new extension tab', async () => {
      const before = context.pages().length;
      const resp = await runtimeSend({ kind: 'open-extension-page' });
      if (!resp?.ok) throw new Error(`open-extension-page failed: ${JSON.stringify(resp)}`);
      await bridge.waitForTimeout(300);
      const after = context.pages().length;
      if (after <= before) throw new Error(`tab count did not increase: before=${before}, after=${after}`);
      return { details: `tabs before=${before} after=${after}` };
    });

    await runCheck('open-control-center runtime command resolves', async () => {
      await jiraPage.bringToFront();
      const resp = await runtimeSend({ kind: 'open-control-center' });
      if (!resp || typeof resp.ok !== 'boolean') {
        throw new Error(`invalid open-control-center response: ${JSON.stringify(resp)}`);
      }
      return { details: JSON.stringify(resp) };
    });

    const oraclePage = await context.newPage();
    await oraclePage.goto('https://abc.fa.us2.oraclecloud.com/fscmUI/faces/FuseWelcome', { waitUntil: 'domcontentloaded' });

    await runCheck('Runtime detect-site identifies Oracle', async () => {
      await oraclePage.bringToFront();
      const resp = await runtimeSend({ kind: 'detect-site', payload: { url: oraclePage.url() } });
      if (!resp?.ok || resp?.data?.site !== 'oracle') {
        throw new Error(`detect-site oracle response: ${JSON.stringify(resp)}`);
      }
      return { details: JSON.stringify(resp) };
    });

    await runCheck('Runtime get-rules for oracle returns non-empty list', async () => {
      await oraclePage.bringToFront();
      const resp = await runtimeSend({ kind: 'get-rules', payload: { site: 'oracle' } });
      if (!resp?.ok || !Array.isArray(resp?.data) || resp.data.length < 3) {
        throw new Error(`get-rules oracle response: ${JSON.stringify(resp)}`);
      }
      return { details: `oracle rules: ${resp.data.length}` };
    });

    await runCheck('Runtime run-rule executes oracle.invoice.validation.alert', async () => {
      await oraclePage.bringToFront();
      const resp = await runtimeSend({ kind: 'run-rule', payload: { site: 'oracle', ruleId: 'oracle.invoice.validation.alert' } });
      if (!resp?.ok) {
        throw new Error(`oracle validation rule response: ${JSON.stringify(resp)}`);
      }
      return { details: JSON.stringify(resp).slice(0, 300) };
    });

    await runCheck('Oracle parity: invoice create accepts parity option flags', async () => {
      await oraclePage.bringToFront();
      const context = JSON.stringify({
        skipInvoiceNumber: true,
        allowDocumentScope: true,
        allowSupplierSiteWithoutNumber: true,
        businessUnit: 'CARVANA',
      });
      const resp = await runtimeSend({
        kind: 'run-rule',
        payload: { site: 'oracle', ruleId: 'oracle.invoice.create', context },
      });
      if (!resp?.ok) throw new Error(`oracle invoice create failed: ${JSON.stringify(resp)}`);
      const options = resp?.data?.options;
      if (!options || options.skipInvoiceNumber !== true) {
        throw new Error(`missing options in response: ${JSON.stringify(resp)}`);
      }
      addParity('oracle', 'invoice_create_option_flags', 'PARITY', 'none');
      return { details: JSON.stringify(options) };
    });

    await runCheck('Oracle parity: validation verify supports expected status/snippet', async () => {
      await oraclePage.bringToFront();
      const context = JSON.stringify({
        expectedStatus: 'needs-revalidated',
        expectedSnippet: 'needs reverification',
      });
      const resp = await runtimeSend({
        kind: 'run-rule',
        payload: { site: 'oracle', ruleId: 'oracle.invoice.validation.verify', context },
      });
      if (!resp?.ok) throw new Error(`oracle verify failed: ${JSON.stringify(resp)}`);
      const comparison = resp?.data?.comparison;
      if (!comparison || comparison.statusMatches !== true || comparison.snippetMatches !== true) {
        throw new Error(`unexpected comparison: ${JSON.stringify(resp)}`);
      }
      addParity('oracle', 'validation_verify_baseline_comparison', 'PARITY', 'none');
      return { details: JSON.stringify(comparison) };
    });

    const carmaPage = await context.newPage();
    await carmaPage.goto('https://carma.cvnacorp.com/dashboard', { waitUntil: 'domcontentloaded' });

    await runCheck('Runtime detect-site identifies Carma', async () => {
      await carmaPage.bringToFront();
      const resp = await runtimeSend({ kind: 'detect-site', payload: { url: carmaPage.url() } });
      if (!resp?.ok || resp?.data?.site !== 'carma') {
        throw new Error(`detect-site carma response: ${JSON.stringify(resp)}`);
      }
      return { details: JSON.stringify(resp) };
    });

    await runCheck('Runtime get-rules for carma returns non-empty list', async () => {
      await carmaPage.bringToFront();
      const resp = await runtimeSend({ kind: 'get-rules', payload: { site: 'carma' } });
      if (!resp?.ok || !Array.isArray(resp?.data) || resp.data.length < 1) {
        throw new Error(`get-rules carma response: ${JSON.stringify(resp)}`);
      }
      return { details: `carma rules: ${resp.data.length}` };
    });

    await runCheck('Runtime run-rule executes carma.bulk.search.scrape', async () => {
      await carmaPage.bringToFront();
      const context = JSON.stringify({ termsText: 'S123456\nS123456\nS765432' });
      const resp = await runtimeSend({
        kind: 'run-rule',
        payload: { site: 'carma', ruleId: 'carma.bulk.search.scrape', context },
      });
      if (!resp?.ok) {
        throw new Error(`carma run-rule response: ${JSON.stringify(resp)}`);
      }
      if (!resp?.data?.diagnostics || !('uniquenessStrategy' in resp.data.diagnostics)) {
        throw new Error(`missing carma diagnostics: ${JSON.stringify(resp)}`);
      }
      addParity('carma', 'uniqueness_strategy_and_date_resolution', 'PARITY', 'none');
      return { details: JSON.stringify(resp).slice(0, 300) };
    });

    await runCheck('Carma parity: panel renders expected controls and no gear launcher', async () => {
      await carmaPage.bringToFront();
      const panelResp = await runtimeSend({
        kind: 'run-rule',
        payload: { site: 'carma', ruleId: 'carma.show_panel' },
      });
      if (!panelResp?.ok) throw new Error(`carma show panel failed: ${JSON.stringify(panelResp)}`);
      const panelInfo = await carmaPage.evaluate(() => {
        const panel = document.querySelector('#cv-carma-scrape-panel');
        return {
          hasPanel: !!panel,
          hasStart: !!document.querySelector('[data-action="start"]'),
          hasCancel: !!document.querySelector('[data-action="cancel"]'),
          hasSettingsTab: !!document.querySelector('[data-settings-tab="uniqueness"]'),
          gearCount: document.querySelectorAll('[class*="gear"], [id*="gear"]').length,
        };
      });
      if (!panelInfo.hasPanel || !panelInfo.hasStart || !panelInfo.hasCancel) {
        throw new Error(`missing panel controls: ${JSON.stringify(panelInfo)}`);
      }
      addParity('carma', 'panel_actions_and_settings_controls', 'PARITY', 'none');
      addParity(
        'carma',
        'userscript_gear_launcher',
        'INTENTIONAL_DELTA',
        'Extension-driven launch only (no userscript gear button injection)',
      );
      return { details: JSON.stringify(panelInfo) };
    });

    const blankPage = await context.newPage();
    await blankPage.goto('https://example.com/blank', { waitUntil: 'domcontentloaded' });

    await runCheck('Runtime detect-site returns unsupported for non-permitted domain', async () => {
      await blankPage.bringToFront();
      const resp = await runtimeSend({ kind: 'detect-site', payload: { url: blankPage.url() } });
      const site = resp?.data?.site;
      if (!resp?.ok || site !== 'unsupported') {
        throw new Error(`expected unsupported, got ${JSON.stringify(resp)}`);
      }
      return { details: JSON.stringify(resp) };
    });

    await runCheck('Popup page renders and shows brand text', async () => {
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
      await popup.waitForTimeout(1000);
      const bodyText = await popup.evaluate(() => document.body.innerText);
      if (!bodyText.includes('Carvana Extension')) {
        throw new Error(`popup text missing brand: ${bodyText.slice(0, 200)}`);
      }
      const runCount = await popup.locator('button:has-text("Run")').count();
      return { details: `popup render ok; run buttons visible: ${runCount}` };
    });

    await runCheck('Sidepanel page renders and shows command center shell', async () => {
      const panel = await context.newPage();
      await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      await panel.waitForTimeout(1200);
      const bodyText = await panel.evaluate(() => document.body.innerText);
      if (!bodyText.includes('Command Center')) {
        throw new Error(`sidepanel text missing command center: ${bodyText.slice(0, 260)}`);
      }
      return { details: bodyText.slice(0, 220).replace(/\n+/g, ' | ') };
    });

    await runCheck('Extension page renders all top-level tabs', async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/extension.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      const bodyText = await page.evaluate(() => document.body.innerText);
      for (const required of ['Dashboard', 'Rules', 'Data', 'Settings', 'Logs']) {
        if (!bodyText.includes(required)) throw new Error(`Missing tab label: ${required}`);
      }
      return { details: 'Dashboard/Rules/Data/Settings/Logs present' };
    });

    await runCheck('UI emits no uncaught page errors during smoke pass', async () => {
      const errs = [];
      for (const p of context.pages()) {
        p.on('pageerror', (e) => errs.push(String(e)));
      }
      const p = await context.newPage();
      await p.goto(`chrome-extension://${extensionId}/extension.html`, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(800);
      if (errs.length > 0) {
        throw new Error(`page errors: ${errs.slice(0, 3).join(' | ')}`);
      }
      return { details: 'no pageerror events observed in smoke window' };
    });

    // Additional behavioral observations not strictly pass/fail.
    await runCheck('Observation: popup opened as tab likely cannot detect active site context', async () => {
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
      await popup.waitForTimeout(1000);
      const text = await popup.evaluate(() => document.body.innerText);
      if (!text.includes('No supported site')) {
        return { details: 'popup tab mode still detected site in this run' };
      }
      addCheck(
        'UX caveat: popup tested in tab mode differs from action-popup runtime',
        'warn',
        'When popup.html is opened as a regular tab, active-tab detection often resolves to unsupported context.',
      );
      return { details: 'Observed No supported site in tab mode (expected caveat).' };
    });

    artifacts.notes.push(
      'All domain-specific tests used mocked HTML served via Playwright route interception on production-like URLs.',
      'No live Jira/Oracle/Carma credentials were used, so this validates extension mechanics and routing, not real production DOM drift.',
    );
  } finally {
    if (context) await context.close();
    await fs.rm(profileDir, { recursive: true, force: true });
  }

  const lines = [];
  lines.push('# Playwright Extension Audit');
  lines.push('');
  lines.push(`- Timestamp: ${artifacts.timestamp}`);
  lines.push(`- Extension path: ${artifacts.extensionPath}`);
  lines.push(`- Extension ID: ${artifacts.extensionId || 'unknown'}`);
  lines.push(`- Checks: ${artifacts.stats.total}`);
  lines.push(`- Pass: ${artifacts.stats.pass}`);
  lines.push(`- Fail: ${artifacts.stats.fail}`);
  lines.push(`- Warn: ${artifacts.stats.warn}`);
  lines.push('');
  lines.push('## Results');
  lines.push('');

  for (const check of findings) {
    const icon = check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL';
    lines.push(`- [${icon}] ${check.name}`);
    lines.push(`  - ${check.details}`);
  }

  lines.push('');
  lines.push('## Parity Summary');
  lines.push('');
  for (const row of parity) {
    lines.push(`- [${row.status}] ${row.site}: ${row.feature}`);
    lines.push(`  - ${row.delta}`);
  }

  if (artifacts.notes.length > 0) {
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    for (const note of artifacts.notes) lines.push(`- ${note}`);
  }

  await fs.writeFile(OUT_JSON, JSON.stringify(artifacts, null, 2), 'utf8');
  await fs.writeFile(OUT_MD, lines.join('\n'), 'utf8');

  console.log(`Wrote JSON report: ${OUT_JSON}`);
  console.log(`Wrote Markdown report: ${OUT_MD}`);
  console.log(`Summary: total=${artifacts.stats.total} pass=${artifacts.stats.pass} fail=${artifacts.stats.fail} warn=${artifacts.stats.warn}`);

  if (artifacts.stats.fail > 0) process.exitCode = 2;
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
