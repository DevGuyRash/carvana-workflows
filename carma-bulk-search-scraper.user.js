// ==UserScript==
// @name         Carma Bulk Search Scraper
// @namespace    https://carma.cvnacorp.com/
// @version      0.6.1
// @description  Bulk scrape result tables from /research/search/<term> (stock number, phone, name, email, etc.) with optional column enabling, page-size, pagination, and CSV/JSON export.
// @match        https://carma.cvnacorp.com/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// ==/UserScript==

(() => {
  'use strict';

  // Prevent double-inject.
  const GLOBAL_KEY = '__carmaBulkSearchScraper__';
  if (window[GLOBAL_KEY]) return;
  window[GLOBAL_KEY] = { loadedAt: Date.now() };

  const APP = {
    state: {
      running: false,
      abort: false,
      rows: [],
      lastCsv: '',
      lastJson: '',
    },
    ui: {},
  };

  const DEFAULTS = {
    paginateAllPages: true,
    setShowTo100: true,
    columnMode: 'all', // 'all' | 'none' | 'key'
    requirePurchaseId: false,
    requireVin: false,
    requireStockNumber: false,
    debug: false,
  };

  const LS_KEY = 'carmaBulkSearchScraper.options.v1';

  // ------------------------------------------------------------
  // Blank / placeholder matching (Row filters)
  // ------------------------------------------------------------
  // These lists control what the *row filters* consider "blank".
  // Add either:
  //   - a string  (case-insensitive exact match after trimming)
  //   - a RegExp  (tested against the trimmed value)
  // If a value is empty OR matches any entry in the respective list,
  // it will be treated as blank.
  const PURCHASE_ID_BLANK_MATCHERS = [
    /no purchase\(s\) found\.?/i,
  ];

  const STOCK_NUMBER_BLANK_MATCHERS = [
    // e.g. /^no stock number$/i,
  ];

  const VIN_BLANK_MATCHERS = [
    // e.g. /^no vin$/i,
  ];

  function safeJsonParse(str, fallback) {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }

  function loadOptions() {
    const saved = safeJsonParse(localStorage.getItem(LS_KEY), {});
    return { ...DEFAULTS, ...saved };
  }

  function saveOptions(opts) {
    localStorage.setItem(LS_KEY, JSON.stringify(opts));
  }

  function cleanText(s) {
    return (s ?? '')
      .toString()
      .replace(/\u00A0/g, ' ') // nbsp
      .replace(/[\t\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitFor(fn, { timeoutMs = 15000, intervalMs = 100, debugLabel = '' } = {}) {
    const start = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const val = fn();
        if (val) return val;
      } catch {
        // ignore
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Timed out waiting${debugLabel ? `: ${debugLabel}` : ''}`);
      }
      await sleep(intervalMs);
    }
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'style') node.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v === false || v === null || typeof v === 'undefined') {
        // skip
      } else node.setAttribute(k, v);
    }
    for (const c of Array.isArray(children) ? children : [children]) {
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    }
    return node;
  }

  function addStyles() {
    if (document.getElementById('carma-bulk-search-scraper-styles')) return;
    const style = el('style', { id: 'carma-bulk-search-scraper-styles' });
    style.textContent = `
      .cbss-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:999999;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:24px;}
      .cbss-modal{background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.25);width:min(1200px,96vw);max-height:90vh;display:flex;flex-direction:column;}
      .cbss-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e6e8ef;}
      .cbss-title{font-size:18px;font-weight:700;color:#183558;}
      .cbss-close{border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#183558;padding:4px 8px;}
      .cbss-body{display:flex;gap:16px;padding:16px;overflow:auto;}
      .cbss-left{flex:1 1 65%;min-width:420px;}
      .cbss-right{flex:0 0 360px;}
      .cbss-label{font-weight:700;color:#183558;margin-bottom:6px;display:block;}
      .cbss-textarea{width:100%;min-height:190px;border:1px solid #cfd6e4;border-radius:8px;padding:10px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:12px;resize:vertical;}
      .cbss-hint{margin-top:8px;color:#5a6b85;font-size:12px;line-height:1.35;}
      .cbss-card{border:1px solid #dbe2ef;border-radius:10px;padding:14px;}
      .cbss-card h4{margin:0 0 10px 0;font-size:14px;color:#183558;}
      .cbss-row{display:flex;align-items:center;gap:8px;margin:6px 0;}
      .cbss-row label{display:flex;align-items:center;gap:8px;color:#183558;font-size:13px;}
      .cbss-row input[type="checkbox"]{transform:translateY(1px);}
      .cbss-select{width:100%;border:1px solid #cfd6e4;border-radius:8px;padding:6px 10px;font-size:13px;background:#fff;}
      .cbss-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
      .cbss-btn{border:1px solid #cfd6e4;border-radius:10px;background:#fff;padding:8px 12px;font-weight:700;cursor:pointer;}
      .cbss-btn:disabled{opacity:.5;cursor:not-allowed;}
      .cbss-btn-primary{background:#16a34a;border-color:#16a34a;color:#fff;}
      .cbss-btn-secondary{background:#f3f4f6;color:#111827;border-color:#d1d5db;}
      .cbss-status-wrap{padding:0 16px 16px 16px;}
      .cbss-status-title{font-weight:700;color:#183558;margin:10px 0 6px 0;}
      .cbss-status{background:#0b1220;color:#e5e7eb;border-radius:10px;padding:12px;min-height:190px;max-height:340px;overflow:auto;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:12px;white-space:pre-wrap;}
      .cbss-fab{position:fixed;right:16px;bottom:16px;z-index:999998;border-radius:999px;background:#183558;color:#fff;border:0;padding:10px 14px;font-weight:800;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);} 
      .cbss-small{font-size:12px;color:#5a6b85;}
    `;
    document.head.appendChild(style);
  }

  function setStatus(line) {
    const pre = APP.ui.status;
    if (!pre) return;
    pre.textContent += (pre.textContent ? '\n' : '') + line;
    // Auto-scroll unless user has scrolled up.
    const nearBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 30;
    if (nearBottom) pre.scrollTop = pre.scrollHeight;
  }

  function log(line) {
    setStatus(line);
  }

  function logDebug(line) {
    if (!APP.ui.debug?.checked) return;
    setStatus(`   🐞 ${line}`);
  }

  function clearStatus() {
    if (APP.ui.status) APP.ui.status.textContent = '';
  }

  function normalizeTermFromLine(rawLine) {
    const line = cleanText(rawLine);
    if (!line) return null;

    // If user pasted full URL, extract the term after /research/search/.
    if (/^https?:\/\//i.test(line)) {
      try {
        const u = new URL(line);
        const idx = u.pathname.indexOf('/research/search/');
        if (idx >= 0) {
          const part = u.pathname.slice(idx + '/research/search/'.length);
          // decode then re-encode so things like %20 are normalized.
          try {
            return decodeURIComponent(part);
          } catch {
            return part;
          }
        }
      } catch {
        // fall through
      }
    }

    return line;
  }

  function parseTerms(text) {
    const lines = (text || '').split(/\r?\n/);
    const terms = [];
    for (const raw of lines) {
      const term = normalizeTermFromLine(raw);
      if (!term) continue;
      const encoded = encodeURIComponent(term);
      terms.push({ term, encoded, url: `https://carma.cvnacorp.com/research/search/${encoded}` });
    }
    return terms;
  }

  function downloadText(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback
      try {
        const ta = el('textarea', { style: 'position:fixed;left:-9999px;top:-9999px;' });
        ta.value = text;
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  function rowsToCsv(rows) {
    if (!rows.length) return '';

    // Build stable column order: meta columns first, then observed columns.
    const preferred = ['searchTerm', 'searchUrl', 'table', 'page'];
    const cols = [];

    const seen = new Set();
    function addCol(c) {
      if (!c) return;
      if (seen.has(c)) return;
      seen.add(c);
      cols.push(c);
    }

    for (const c of preferred) addCol(c);

    for (const row of rows) {
      for (const k of Object.keys(row)) addCol(k);
    }

    const esc = (v) => {
      const s = v === null || typeof v === 'undefined' ? '' : String(v);
      // Quote if it contains special chars.
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    const lines = [];
    lines.push(cols.map(esc).join(','));
    for (const row of rows) {
      lines.push(cols.map((c) => esc(row[c])).join(','));
    }
    return lines.join('\n');
  }

  function getBlocksWithTables(doc) {
    const blocks = Array.from(doc.querySelectorAll('.cpl__block'));
    return blocks
      .map((block) => {
        const table = block.querySelector('table[data-testid="data-table"]');
        if (!table) return null;
        const titleEl = block.querySelector('.cpl__block__header-title');
        const rawTitle = cleanText(titleEl ? titleEl.textContent : '');
        return { block, table, rawTitle };
      })
      .filter(Boolean);
  }

  function parseCountFromTitle(rawTitle) {
    const m = rawTitle.match(/\((\d+)\)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function baseTitle(rawTitle) {
    // Remove trailing "(N)".
    return cleanText(rawTitle.replace(/\s*\(\d+\)\s*$/, '')) || rawTitle;
  }

  function findButtonByText(root, text) {
    const target = text.toLowerCase();
    const btns = Array.from(root.querySelectorAll('button'));
    return btns.find((b) => cleanText(b.textContent).toLowerCase() === target) || null;
  }

  function findDropdownButtonMatching(root, regex) {
    const btns = Array.from(root.querySelectorAll('button'));
    for (const b of btns) {
      const t = cleanText(b.textContent);
      if (regex.test(t)) {
        const dd = b.closest('.dropdown');
        const menu = dd?.querySelector('.dropdown-menu');
        if (dd && menu) return b;
      }
    }
    return null;
  }

  async function openDropdown(button, { timeoutMs = 5000 } = {}) {
    button.click();
    const dd = button.closest('.dropdown');
    if (!dd) throw new Error('Dropdown wrapper not found');
    const menu = await waitFor(() => {
      const m = dd.querySelector('.dropdown-menu');
      if (!m) return null;
      const style = m.getAttribute('style') || '';
      const shown = m.classList.contains('show') || /display:\s*block/i.test(style);
      return shown ? m : null;
    }, { timeoutMs, intervalMs: 50, debugLabel: 'dropdown open' });
    return { dd, menu };
  }

  async function closeDropdown(menu) {
    // Prefer explicit close button.
    const closeBtn = menu.querySelector('#close-edit-columns-dropdown');
    if (closeBtn) {
      closeBtn.click();
      return;
    }
    // Click outside.
    document.body.click();
  }

  function checkboxInfoFromLabel(label) {
    const input = label.querySelector('input[type="checkbox"]');
    if (!input) return null;
    const text = cleanText(label.textContent);
    return {
      label,
      input,
      text,
      checked: !!input.checked,
      disabled: !!input.disabled,
    };
  }

  async function applyColumns(blockRoot, mode) {
    if (mode === 'none') return { applied: false, reason: 'disabled' };

    const editBtn = findButtonByText(blockRoot, 'Edit Columns');
    if (!editBtn) {
      logDebug('Edit Columns button not found; skipping.');
      return { applied: false, reason: 'no_button' };
    }

    const { menu } = await openDropdown(editBtn);

    try {
      const labels = Array.from(menu.querySelectorAll('label'))
        .map(checkboxInfoFromLabel)
        .filter(Boolean);

      const allToggle = labels.find((x) => /^all$/i.test(x.text) || /^all\b/i.test(x.text));
      const actionable = labels.filter((x) => !x.disabled && x !== allToggle);

      if (mode === 'all') {
        const allChecked = actionable.length > 0 && actionable.every((x) => x.input.checked);
        if (allChecked) {
          return { applied: false, reason: 'already_all' };
        }

        if (allToggle) {
          allToggle.label.click();
          await waitFor(() => actionable.every((x) => x.input.checked), {
            timeoutMs: 8000,
            intervalMs: 50,
            debugLabel: 'columns select all',
          });
          return { applied: true, reason: 'clicked_all' };
        }

        // Fallback: click each unchecked.
        let clicked = 0;
        for (const x of actionable) {
          if (!x.input.checked) {
            x.label.click();
            clicked++;
            await sleep(20);
          }
        }
        if (clicked) {
          await sleep(200);
          return { applied: true, reason: `clicked_${clicked}` };
        }
        return { applied: false, reason: 'no_action' };
      }

      if (mode === 'key') {
        const wantMatchers = [
          /latestpurchasepurchaseid/i,
          /latestpurchasevin/i,
          /latestpurchasestocknumber/i,
          /^purchase\s*id$/i,
          /^vin$/i,
          /^stock\s*number$/i,
        ];
        const wanted = actionable.filter((x) => wantMatchers.some((re) => re.test(x.text)));
        let changed = 0;
        for (const x of wanted) {
          if (!x.input.checked) {
            x.label.click();
            changed++;
            await sleep(30);
          }
        }
        if (changed) {
          await sleep(200);
          return { applied: true, reason: `enabled_${changed}_key_cols` };
        }
        return { applied: false, reason: 'already_key' };
      }

      return { applied: false, reason: `unknown_mode_${mode}` };
    } finally {
      await closeDropdown(menu);
    }
  }

  async function setPageSize(blockRoot, size) {
    const showBtn = findDropdownButtonMatching(blockRoot, /^show\s+\d+/i);
    if (!showBtn) {
      logDebug('Show <N> button not found; skipping page-size.');
      return { changed: false, reason: 'no_show_button' };
    }

    const current = cleanText(showBtn.textContent);
    if (new RegExp(`^show\\s+${size}$`, 'i').test(current)) {
      return { changed: false, reason: 'already' };
    }

    const { menu } = await openDropdown(showBtn);

    try {
      const items = Array.from(menu.querySelectorAll('a,button'));
      const target = items.find((x) => new RegExp(`^show\\s+${size}$`, 'i').test(cleanText(x.textContent)));
      if (!target) {
        return { changed: false, reason: 'no_target_item' };
      }
      target.click();

      await waitFor(() => new RegExp(`^show\\s+${size}$`, 'i').test(cleanText(showBtn.textContent)), {
        timeoutMs: 8000,
        intervalMs: 50,
        debugLabel: 'page size apply',
      });
      return { changed: true, reason: 'selected' };
    } finally {
      // menu usually auto-closes, but just in case.
      try {
        document.body.click();
      } catch {
        // ignore
      }
    }
  }

  function getPaginationInfo(blockRoot) {
    const input = blockRoot.querySelector('input[type="number"][min="1"][max]');
    if (input) {
      const max = parseInt(input.getAttribute('max') || '1', 10);
      const val = parseInt(input.value || '1', 10);
      return { input, current: Number.isFinite(val) ? val : 1, total: Number.isFinite(max) ? max : 1 };
    }

    // Fallback parse "1 / 2" text.
    const pagerTextEl = Array.from(blockRoot.querySelectorAll('div'))
      .map((d) => ({ d, t: cleanText(d.textContent) }))
      .find((x) => /^\d+\s*\/\s*\d+$/.test(x.t));

    if (pagerTextEl) {
      const [cur, tot] = pagerTextEl.t.split('/').map((n) => parseInt(n.trim(), 10));
      return {
        input: null,
        current: Number.isFinite(cur) ? cur : 1,
        total: Number.isFinite(tot) ? tot : 1,
        pagerTextEl: pagerTextEl.d,
      };
    }

    return { input: null, current: 1, total: 1 };
  }

  function getPaginationButtons(blockRoot) {
    // Try to find the container that contains the "x / y" text.
    const indicator = Array.from(blockRoot.querySelectorAll('div'))
      .map((d) => ({ d, t: cleanText(d.textContent) }))
      .find((x) => /^\d+\s*\/\s*\d+$/.test(x.t));

    if (!indicator) return null;

    // Walk up to a container with multiple buttons.
    let container = indicator.d.parentElement;
    for (let i = 0; i < 4 && container; i++) {
      const btns = container.querySelectorAll('button');
      if (btns.length >= 4) break;
      container = container.parentElement;
    }

    if (!container) return null;

    const btns = Array.from(container.querySelectorAll('button'));
    if (btns.length < 4) return null;

    return {
      first: btns[0],
      prev: btns[1],
      next: btns[2],
      last: btns[3],
    };
  }

  function scrapeCurrentPageRows(table) {
    const theadRows = Array.from(table.querySelectorAll('thead tr'));
    const headerRow = theadRows[theadRows.length - 1];
    const headers = Array.from(headerRow.querySelectorAll('th')).map((th, idx) => {
      const t = cleanText(th.innerText);
      if (t) return t;
      // Provide a stable name for blank columns.
      if (idx === headerRow.querySelectorAll('th').length - 1) return 'View';
      return `Column ${idx + 1}`;
    });

    const tbody = table.querySelector('tbody');
    const trs = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];

    const rows = trs.map((tr) => {
      const tds = Array.from(tr.querySelectorAll('td'));
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        const key = headers[i];
        const td = tds[i];
        obj[key] = td ? cleanText(td.innerText) : '';
      }
      return obj;
    });

    return { headers, rows };
  }

  function getRowValueByHeaderLike(row, patterns) {
    const keys = Object.keys(row);
    for (const p of patterns) {
      const re = typeof p === 'string' ? new RegExp(`^${p}$`, 'i') : p;
      const k = keys.find((kk) => re.test(cleanText(kk)));
      if (k) return row[k];
    }
    return '';
  }

  function shouldKeepRow(row, filters) {
	  const isNonEmpty = (v, blankMatchers = []) => {
	    const t = cleanText(v);
	    if (!t) return false;
	    if (/^(null|undefined)$/i.test(t)) return false;

	    const tl = t.toLowerCase();
	    for (const m of blankMatchers) {
	      if (!m) continue;
	      if (typeof m === 'string') {
	        const ms = cleanText(m);
	        if (ms && tl === ms.toLowerCase()) return false;
	      } else if (m instanceof RegExp) {
	        if (m.test(t)) return false;
	      }
	    }
	    return true;
	  };

    if (filters.requirePurchaseId) {
      const v = getRowValueByHeaderLike(row, [/purchase\s*id/i, /purchaseid/i]);
	    if (!isNonEmpty(v, PURCHASE_ID_BLANK_MATCHERS)) return false;
    }
    if (filters.requireVin) {
      const v = getRowValueByHeaderLike(row, [/^vin$/i]);
	    if (!isNonEmpty(v, VIN_BLANK_MATCHERS)) return false;
    }
    if (filters.requireStockNumber) {
      const v = getRowValueByHeaderLike(row, [/stock\s*number/i, /stocknumber/i]);
	    if (!isNonEmpty(v, STOCK_NUMBER_BLANK_MATCHERS)) return false;
    }

    return true;
  }

  async function goToFirstPageIfNeeded(blockRoot) {
    const pi = getPaginationInfo(blockRoot);
    if (pi.current === 1) return;

    const btns = getPaginationButtons(blockRoot);
    if (btns && !btns.first.disabled) {
      btns.first.click();
      await waitFor(() => {
        const now = getPaginationInfo(blockRoot);
        return now.current === 1;
      }, { timeoutMs: 8000, intervalMs: 50, debugLabel: 'go to first page' });
    }
  }

  async function clickNextPage(blockRoot, expectedNextPage) {
    const btns = getPaginationButtons(blockRoot);
    if (!btns || btns.next.disabled) return false;

    btns.next.click();

    await waitFor(() => {
      const pi = getPaginationInfo(blockRoot);
      return pi.current === expectedNextPage;
    }, { timeoutMs: 8000, intervalMs: 50, debugLabel: `page -> ${expectedNextPage}` });

    return true;
  }

  async function scrapeBlockPages({ termInfo, blockInfo, opts }) {
    const { block, table, rawTitle } = blockInfo;
    const expectedCount = parseCountFromTitle(rawTitle);
    const name = baseTitle(rawTitle) || 'Table';

    // 1) Columns
    if (opts.columnMode !== 'none') {
      log(`🧱 [${rawTitle || name}] Applying columns: ${opts.columnMode}...`);
      try {
        const r = await applyColumns(block, opts.columnMode);
        if (r.reason === 'already_all' || r.reason === 'already_key') {
          log(`   ℹ️  Columns already satisfied (${opts.columnMode}).`);
        } else if (r.applied) {
          log(`   ✅ Columns updated (${r.reason}).`);
        } else {
          logDebug(`Columns not applied (${r.reason}).`);
        }
      } catch (e) {
        log(`   ⚠️  Failed to apply columns: ${e.message}`);
      }
    }

    // 2) Page size
    if (opts.setShowTo100) {
      log(`🧱 [${rawTitle || name}] Setting page size: Show 100...`);
      try {
        const r = await setPageSize(block, 100);
        if (r.changed) {
          log('   ✅ Set page size to Show 100.');
        } else {
          logDebug(`Page size unchanged (${r.reason}).`);
          // Keep the user-facing message aligned with what people expect.
          if (r.reason === 'already') log('   ℹ️  Already Show 100.');
        }
      } catch (e) {
        log(`   ⚠️  Failed to set page size: ${e.message}`);
      }
    }

    // 3) Pagination info
    const pi0 = getPaginationInfo(block);
    logDebug(`Pagination detected: current=${pi0.current} total=${pi0.total}`);

    let totalSeen = 0;
    let totalKept = 0;

    // Make sure we start on page 1 for deterministic scraping.
    if (opts.paginateAllPages && pi0.total > 1) {
      try {
        await goToFirstPageIfNeeded(block);
      } catch (e) {
        logDebug(`Could not force page 1: ${e.message}`);
      }
    }

    const pi = getPaginationInfo(block);
    const pagesToScrape = opts.paginateAllPages ? pi.total : 1;

    if (!opts.paginateAllPages || pi.total <= 1) {
      log(`🧱 [${rawTitle || name}] Scraping current page only.`);
    } else {
      log(`🧱 [${rawTitle || name}] Scraping all pages (${pi.total}).`);
    }

    for (let page = 1; page <= pagesToScrape; page++) {
      if (APP.state.abort) {
        log('⛔ Aborted by user.');
        break;
      }

      // Wait until table has rendered.
      try {
        await waitFor(() => {
          const t = block.querySelector('table[data-testid="data-table"]');
          if (!t) return null;
          const body = t.querySelector('tbody');
          if (!body) return null;
          // tbody can exist but be empty; still OK.
          return t;
        }, { timeoutMs: 15000, intervalMs: 100, debugLabel: 'table render' });
      } catch (e) {
        log(`   ⚠️  Table not ready on page ${page}: ${e.message}`);
        continue;
      }

      const { rows } = scrapeCurrentPageRows(table);
      totalSeen += rows.length;

      const filters = {
        requirePurchaseId: opts.requirePurchaseId,
        requireVin: opts.requireVin,
        requireStockNumber: opts.requireStockNumber,
      };

      for (const r of rows) {
        const out = {
          searchTerm: termInfo.term,
          searchUrl: termInfo.url,
          table: name,
          page,
          ...r,
        };

        if (shouldKeepRow(out, filters)) {
          APP.state.rows.push(out);
          totalKept++;
        }
      }

      logDebug(`Page ${page}: seen=${rows.length}, kept=${totalKept} (cumulative)`);

      // Go next page if needed.
      if (page < pagesToScrape) {
        try {
          await clickNextPage(block, page + 1);
        } catch (e) {
          log(`   ⚠️  Failed to go to next page (${page + 1}): ${e.message}`);
          break;
        }
      }
    }

    // Mismatch warning (debug only) — count in title vs total seen.
    if (APP.ui.debug?.checked && expectedCount !== null) {
      if (totalSeen !== expectedCount) {
        logDebug(`Count mismatch for "${rawTitle}": title=${expectedCount}, scrapedRows=${totalSeen}. (This can be normal if filters/paging/permissions differ.)`);
      } else {
        logDebug(`Count check OK for "${rawTitle}": ${expectedCount} rows.`);
      }
    }

    return { name, expectedCount, totalSeen, totalKept };
  }

  async function loadIntoIframe(iframe, url) {
    return new Promise((resolve, reject) => {
      let done = false;
      const onLoad = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve(true);
      };
      const onErr = () => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('iframe failed to load'));
      };
      const cleanup = () => {
        iframe.removeEventListener('load', onLoad);
        iframe.removeEventListener('error', onErr);
      };

      iframe.addEventListener('load', onLoad);
      iframe.addEventListener('error', onErr);
      iframe.src = url;

      // Safety timeout.
      setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('iframe load timeout'));
      }, 30000);
    });
  }

  async function runScrape() {
    if (APP.state.running) return;

    const opts = {
      paginateAllPages: !!APP.ui.paginate?.checked,
      setShowTo100: !!APP.ui.show100?.checked,
      columnMode: APP.ui.columns?.value || 'all',
      requirePurchaseId: !!APP.ui.requirePurchaseId?.checked,
      requireVin: !!APP.ui.requireVin?.checked,
      requireStockNumber: !!APP.ui.requireStockNumber?.checked,
      debug: !!APP.ui.debug?.checked,
    };

    saveOptions(opts);

    const terms = parseTerms(APP.ui.terms.value);
    clearStatus();
    APP.state.rows = [];
    APP.state.abort = false;

    if (!terms.length) {
      log('No search terms provided.');
      return;
    }

    APP.state.running = true;
    APP.ui.start.disabled = true;
    APP.ui.cancel.disabled = false;

    log(`Starting. Terms: ${terms.length}`);
    log(`Options: ${JSON.stringify({
      paginateAllPages: opts.paginateAllPages,
      setShowTo100: opts.setShowTo100,
      columnMode: opts.columnMode,
      requirePurchaseId: opts.requirePurchaseId,
      requireVin: opts.requireVin,
      requireStockNumber: opts.requireStockNumber,
      debug: opts.debug,
    })}`);

    const iframe = APP.ui.iframe;

    for (let i = 0; i < terms.length; i++) {
      const termInfo = terms[i];
      if (APP.state.abort) break;

      log(`\n(${i + 1}/${terms.length}) ${termInfo.term}`);

      try {
        await loadIntoIframe(iframe, termInfo.url);
        log(`🧩 Loaded iframe: ${termInfo.url}`);
      } catch (e) {
        log(`⚠️  Failed to load ${termInfo.url}: ${e.message}`);
        continue;
      }

      const doc = iframe.contentDocument;
      if (!doc) {
        log('⚠️  No iframe document; skipping.');
        continue;
      }

      // Wait for at least one table block OR a "no results" screen.
      try {
        await waitFor(() => {
          const hasTable = doc.querySelector('table[data-testid="data-table"]');
          if (hasTable) return true;
          // Some pages may render a message instead of a table.
          const txt = cleanText(doc.body?.innerText || '');
          if (txt && /no\s+results/i.test(txt)) return true;
          return false;
        }, { timeoutMs: 20000, intervalMs: 200, debugLabel: 'results render' });
      } catch (e) {
        log(`⚠️  Results did not render in time: ${e.message}`);
        continue;
      }

      const blocks = getBlocksWithTables(doc);
      if (!blocks.length) {
        log('ℹ️  No tables found on this page.');
        continue;
      }

      // Scrape each block.
      for (const blockInfo of blocks) {
        if (APP.state.abort) break;
        try {
          await scrapeBlockPages({ termInfo, blockInfo, opts });
        } catch (e) {
          log(`⚠️  Error scraping block: ${e.message}`);
        }
      }

      log(`   Total exported rows: ${APP.state.rows.length}`);
    }

    APP.state.running = false;
    APP.ui.start.disabled = false;
    APP.ui.cancel.disabled = true;

    const json = JSON.stringify(APP.state.rows, null, 2);
    const csv = rowsToCsv(APP.state.rows);

    APP.state.lastJson = json;
    APP.state.lastCsv = csv;

    log(`\nDone. Total exported rows: ${APP.state.rows.length}`);
  }

  function buildUI() {
    addStyles();

    const overlay = el('div', { class: 'cbss-overlay', id: 'cbss-overlay' });
    const modal = el('div', { class: 'cbss-modal' });

    const header = el('div', { class: 'cbss-header' }, [
      el('div', { class: 'cbss-title' }, 'Carma Bulk Search Scraper'),
      el('button', { class: 'cbss-close', title: 'Close', onclick: () => closeModal() }, '×'),
    ]);

    const body = el('div', { class: 'cbss-body' });

    // Left
    const left = el('div', { class: 'cbss-left' });
    const termsLabel = el('label', { class: 'cbss-label' }, 'Search terms (one per line)');
    const terms = el('textarea', { class: 'cbss-textarea', placeholder: '2004200036\nJohn Doe\njohn.doe@example.com\n5551234567' });
    const hint = el('div', { class: 'cbss-hint' }, [
      el('div', {}, [
        'Each line becomes: ',
        el('code', {}, 'https://carma.cvnacorp.com/research/search/<encoded term>'),
      ]),
      el('div', {}, [
        'Tip: you can paste full URLs too; the script will extract the term after ',
        el('code', {}, '/research/search/'),
        '.',
      ]),
    ]);

    left.appendChild(termsLabel);
    left.appendChild(terms);
    left.appendChild(hint);

    // Right
    const right = el('div', { class: 'cbss-right' });
    const card = el('div', { class: 'cbss-card' });

    const optionsTitle = el('h4', {}, 'Options');

    const paginate = el('input', { type: 'checkbox', id: 'cbss-paginate' });
    const show100 = el('input', { type: 'checkbox', id: 'cbss-show100' });
    const debug = el('input', { type: 'checkbox', id: 'cbss-debug' });

    const columns = el('select', { class: 'cbss-select', id: 'cbss-columns' }, [
      el('option', { value: 'all' }, 'Enable ALL columns'),
      el('option', { value: 'key' }, 'Enable key columns (Purchase ID / VIN / Stock Number)'),
      el('option', { value: 'none' }, 'Leave columns unchanged'),
    ]);

    const rowFiltersTitle = el('h4', { style: 'margin-top:12px;' }, 'Row filters (if checked, the column must be non-empty)');

    const requirePurchaseId = el('input', { type: 'checkbox', id: 'cbss-requirePurchaseId' });
    const requireVin = el('input', { type: 'checkbox', id: 'cbss-requireVin' });
    const requireStockNumber = el('input', { type: 'checkbox', id: 'cbss-requireStockNumber' });

    const start = el('button', { class: 'cbss-btn cbss-btn-primary', onclick: () => runScrape() }, 'Start');
    const cancel = el('button', {
      class: 'cbss-btn cbss-btn-secondary',
      disabled: true,
      onclick: () => {
        APP.state.abort = true;
        log('⛔ Cancel requested.');
      },
    }, 'Cancel');

    const downloadCsv = el('button', {
      class: 'cbss-btn',
      onclick: () => {
        const csv = APP.state.lastCsv || rowsToCsv(APP.state.rows);
        APP.state.lastCsv = csv;
        downloadText(`carma-search-export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`, csv, 'text/csv');
      },
    }, 'Download CSV');

    const copyCsv = el('button', {
      class: 'cbss-btn',
      onclick: async () => {
        const csv = APP.state.lastCsv || rowsToCsv(APP.state.rows);
        APP.state.lastCsv = csv;
        const ok = await copyToClipboard(csv);
        log(ok ? '✅ Copied CSV to clipboard.' : '⚠️  Failed to copy CSV.');
      },
    }, 'Copy CSV');

    const downloadJson = el('button', {
      class: 'cbss-btn',
      onclick: () => {
        const json = APP.state.lastJson || JSON.stringify(APP.state.rows, null, 2);
        APP.state.lastJson = json;
        downloadText(`carma-search-export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`, json, 'application/json');
      },
    }, 'Download JSON');

    const copyJson = el('button', {
      class: 'cbss-btn',
      onclick: async () => {
        const json = APP.state.lastJson || JSON.stringify(APP.state.rows, null, 2);
        APP.state.lastJson = json;
        const ok = await copyToClipboard(json);
        log(ok ? '✅ Copied JSON to clipboard.' : '⚠️  Failed to copy JSON.');
      },
    }, 'Copy JSON');

    const actions = el('div', { class: 'cbss-actions' }, [start, cancel]);
    const exports = el('div', { class: 'cbss-actions' }, [downloadCsv, copyCsv, downloadJson, copyJson]);

    card.appendChild(optionsTitle);
    card.appendChild(el('div', { class: 'cbss-row' }, [
      el('label', {}, [paginate, ' Paginate through all pages']),
    ]));
    card.appendChild(el('div', { class: 'cbss-row' }, [
      el('label', {}, [show100, ' Set page size to ', el('strong', {}, 'Show 100')]),
    ]));
    card.appendChild(el('div', { class: 'cbss-row' }, [
      el('label', {}, [debug, ' Debug mode (verbose)']),
    ]));

    card.appendChild(el('div', { class: 'cbss-row', style: 'margin-top:8px;align-items:flex-start;' }, [
      el('div', { style: 'flex:0 0 70px;font-weight:700;color:#183558;padding-top:6px;' }, 'Columns:'),
      el('div', { style: 'flex:1;' }, [columns]),
    ]));

    card.appendChild(rowFiltersTitle);
    card.appendChild(el('div', { class: 'cbss-row' }, [
      el('label', {}, [requirePurchaseId, ' Purchase ID']),
      el('label', { style: 'margin-left:10px;' }, [requireVin, ' VIN']),
      el('label', { style: 'margin-left:10px;' }, [requireStockNumber, ' Stock Number']),
    ]));

    card.appendChild(actions);
    card.appendChild(exports);

    right.appendChild(card);

    body.appendChild(left);
    body.appendChild(right);

    // Status
    const statusWrap = el('div', { class: 'cbss-status-wrap' });
    const statusTitle = el('div', { class: 'cbss-status-title' }, 'Status');
    const status = el('pre', { class: 'cbss-status' });
    statusWrap.appendChild(statusTitle);
    statusWrap.appendChild(status);

    // Hidden iframe
    const iframe = el('iframe', { style: 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:0;visibility:hidden;' });

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(statusWrap);
    modal.appendChild(iframe);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Persisted defaults
    const opts = loadOptions();
    paginate.checked = !!opts.paginateAllPages;
    show100.checked = !!opts.setShowTo100;
    columns.value = opts.columnMode || 'all';
    requirePurchaseId.checked = !!opts.requirePurchaseId;
    requireVin.checked = !!opts.requireVin;
    requireStockNumber.checked = !!opts.requireStockNumber;
    debug.checked = !!opts.debug;

    // Keep options saved on change.
    const saveFromUi = () => {
      const o = {
        paginateAllPages: !!paginate.checked,
        setShowTo100: !!show100.checked,
        columnMode: columns.value,
        requirePurchaseId: !!requirePurchaseId.checked,
        requireVin: !!requireVin.checked,
        requireStockNumber: !!requireStockNumber.checked,
        debug: !!debug.checked,
      };
      saveOptions(o);
    };
    [paginate, show100, columns, requirePurchaseId, requireVin, requireStockNumber, debug].forEach((x) => x.addEventListener('change', saveFromUi));

    // Store refs
    APP.ui = {
      overlay,
      terms,
      paginate,
      show100,
      columns,
      requirePurchaseId,
      requireVin,
      requireStockNumber,
      debug,
      start,
      cancel,
      status,
      iframe,
    };
  }

  function openModal() {
    if (!APP.ui.overlay) buildUI();
    APP.ui.overlay.style.display = 'flex';
  }

  function closeModal() {
    if (!APP.ui.overlay) return;
    // Don’t allow closing while actively running (keeps things simple / safe).
    if (APP.state.running) {
      log('⚠️  Close disabled while running. Use Cancel first.');
      return;
    }
    APP.ui.overlay.style.display = 'none';
  }

  function installFab() {
    if (document.getElementById('cbss-fab')) return;
    const btn = el('button', { class: 'cbss-fab', id: 'cbss-fab', title: 'Open Carma Bulk Search Scraper', onclick: () => openModal() }, 'Bulk Search');
    document.body.appendChild(btn);
  }

  // Init
  buildUI();
  installFab();

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Open Carma Bulk Search Scraper', () => openModal());
  }

  // Keyboard shortcut: Ctrl+Shift+Y
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'Y' || e.key === 'y')) {
      e.preventDefault();
      openModal();
    }
  });

})();
