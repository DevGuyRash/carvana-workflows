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
