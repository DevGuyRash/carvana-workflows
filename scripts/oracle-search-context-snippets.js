// Run each snippet individually in the browser console while reproducing the Oracle auto-run issue.

// 1. Check that the invoice search container exists
const searchContainer = document.querySelector("div[role='search'][aria-labelledby*='::indReqLab']");
!!searchContainer;

// 2. Confirm the invoice search button is present
searchContainer
  ? !!searchContainer.querySelector("a[role='button'][aria-label*='Search: Invoice']")
  : false;

// 3. Verify the table inside the search panel is present
searchContainer ? !!searchContainer.querySelector('table') : false;

// 4. Inspect panel children visibility state
searchContainer
  ? Array.from(searchContainer.children).map((child, idx) => ({
      idx,
      display: getComputedStyle(child).display,
      ariaHidden: child.getAttribute('aria-hidden'),
      hidden: child.hidden
    }))
  : null;

// 5. Read stored auto-run metadata (requires GM_getValue from userscript env)
typeof GM_getValue === 'function'
  ? GM_getValue('wf:autorun:oracle.search.invoice.expand')
  : 'GM_getValue unavailable';

// 6. Capture the live aria-expanded state of the invoice search button
(() => {
  const btn = document.querySelector("a[role='button'][aria-label*='Search: Invoice']");
  return btn ? btn.getAttribute('aria-expanded') : 'button not found';
})();

// 7. Inspect the second row visibility metrics
(() => {
  const row = document.querySelector("div[role='search'][aria-labelledby*='::indReqLab'] > div:nth-of-type(2)");
  if (!row) return 'second row missing';
  const style = getComputedStyle(row);
  return {
    display: style.display,
    height: style.height,
    ariaHidden: row.getAttribute('aria-hidden'),
    hidden: row.hidden,
    classList: row.className
  };
})();

// 8. Dump child element layout for the search container
console.table(
  Array.from(
    document
      .querySelector("div[role='search'][aria-labelledby*='::indReqLab']")
      ?.children ?? []
  ).map((child, idx) => ({
    idx,
    tag: child.tagName,
    classList: child.className,
    display: getComputedStyle(child).display,
    height: getComputedStyle(child).height,
    ariaHidden: child.getAttribute('aria-hidden'),
    hidden: child.hidden
  }))
);

// 9. Capture the Oracle page title/header element state
(() => {
  const title = document.querySelector("h1[data-afr-title], h1.xh2, span.xh2, [data-afr-title]");
  return title
    ? {
        text: title.textContent?.trim(),
        classList: title.className,
        node: title.tagName
      }
    : 'title not found';
})();

// 10. Search for elements whose text contains "Search"
Array.from(document.querySelectorAll('[class],[id]'))
  .filter(el => (el.textContent || '').trim())
  .map(el => ({
    tag: el.tagName,
    id: el.id,
    classList: el.className,
    text: el.textContent.trim()
  }))
  .filter(entry => /search/i.test(entry.text))
  .slice(0, 10);

// 11. Probe typical Oracle query panel labels
(() => {
  const el = document.querySelector("[id*='qryPanel'] [aria-live='polite'], [id*='qryPanel'] span, [id*='qryPanel'] label");
  return el
    ? { selector: el.id || el.className, tag: el.tagName, text: el.textContent?.trim() }
    : 'panel label not found';
})();

// 12. Dump tab labels and selection state for Oracle tablists
Array.from(document.querySelectorAll("[role='tablist'] [role='tab']")).map(tab => ({
  id: tab.id,
  text: tab.textContent?.trim(),
  selected: tab.getAttribute('aria-selected')
}));

// 13. Capture auto-run context components (button state, labels, header)
(() => {
  const container = document.querySelector("div[role='search'][aria-labelledby*='::indReqLab']");
  const button = container?.querySelector("a[role='button'][aria-label*='Search: Invoice']");
  const expandedAttr = button?.getAttribute('aria-expanded') || null;

  const labelledBy = (container?.getAttribute('aria-labelledby') || '').trim();
  const labels = labelledBy
    ? labelledBy.split(/\s+/).map(id => {
        const el = document.getElementById(id);
        return el ? { id, text: el.textContent?.trim() || '' } : null;
      }).filter(Boolean)
    : [];

  const panel = (() => {
    if (!container) return null;
    const labelId = labels.find(entry => entry && /::indreqLab$/i.test(entry.id));
    if (labelId) {
      const candidate = document.getElementById(labelId.id.replace(/::indreqlab$/i, '::qryPanel'));
      if (candidate instanceof HTMLElement) return candidate;
    }
    return container.querySelector('[id*="::qryPanel"], [id*="qryPanel"], :scope > div:nth-of-type(2)');
  })();

  const bodyVisible = (() => {
    if (!(panel instanceof HTMLElement)) return false;
    if (panel.hidden) return false;
    if ((panel.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false;
    const style = getComputedStyle(panel);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = panel.getBoundingClientRect();
    return rect.height > 1 && rect.width > 1;
  })();

  const activeTab = document.querySelector("[role='tab'][aria-selected='true']");
  const header = document.querySelector('h1[data-afr-title], h1.xh2, span.xh2, [data-afr-title]');

  return {
    expandedAttr,
    bodyVisible,
    labelIds: labels,
    activeTab: activeTab ? activeTab.textContent?.trim() || '' : null,
    headerText: header ? header.textContent?.trim() || '' : null,
    documentTitle: document.title?.trim() || '',
    autoRunContext: `${(labels[0]?.text || '').trim()}|${activeTab ? activeTab.textContent?.trim() : ''}|${header ? header.textContent?.trim() : ''}|${document.title?.trim() || ''}|${bodyVisible ? 'expanded' : 'collapsed'}`
  };
})();
