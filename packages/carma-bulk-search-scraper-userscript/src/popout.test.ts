import { afterEach, describe, expect, it, vi } from 'vitest';
import { openResultsPopout } from './popout';
import type { PopoutOptions, ScrapedRow } from './types';

describe('popout settings + styles', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('injects popout button active/focus-visible styles', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const options: PopoutOptions = {
      copyIncludeHeaders: false,
      persistSelectedColumns: true,
      selectedColumnsByName: [],
    };

    const handle = openResultsPopout({
      getRows: () => [],
      getRunning: () => false,
      logger: { log: () => {}, logDebug: () => {}, clear: () => {} },
      getPopoutOptions: () => options,
      setPopoutOptions: (next) => { options.copyIncludeHeaders = next.copyIncludeHeaders; },
    });

    expect(openSpy).toHaveBeenCalled();
    expect(handle).not.toBeNull();

    const styleEl = document.getElementById('cbss-popout-style');
    const text = styleEl?.textContent || '';
    expect(text.includes('.cbss-popout-btn:active')).toBe(true);
    expect(text.includes('.cbss-popout-btn:focus-visible')).toBe(true);
    expect(text.includes('.cbss-popout-btn.cbss-clicked')).toBe(true);
    expect(text.includes('@keyframes cbss-popout-click-pulse')).toBe(true);

    const refreshBtn = Array.from(document.querySelectorAll('button')).find((button) => (button.textContent || '').trim() === 'Refresh') as HTMLButtonElement | undefined;
    expect(refreshBtn).toBeTruthy();
    refreshBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(refreshBtn?.classList.contains('cbss-clicked')).toBe(true);

    handle?.close();
  });

  it('persists selected column names when a header is selected', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);

    const rows: ScrapedRow[] = [
      {
        searchTerm: 'TERM-1',
        searchUrl: 'https://example.test/search/TERM-1',
        table: 'Customers',
        page: 1,
        Reference: 'REF-1',
        VIN: 'VIN-AAA',
      },
    ];

    let options: PopoutOptions = {
      copyIncludeHeaders: false,
      persistSelectedColumns: true,
      selectedColumnsByName: [],
    };

    const setPopoutOptions = vi.fn((next: PopoutOptions) => {
      options = next;
    });

    const handle = openResultsPopout({
      getRows: () => rows,
      getRunning: () => false,
      logger: { log: () => {}, logDebug: () => {}, clear: () => {} },
      getPopoutOptions: () => options,
      setPopoutOptions,
    });

    expect(handle).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 10));

    const headers = Array.from(document.querySelectorAll('th[data-col-index]')) as HTMLTableCellElement[];
    const vinHeader = headers.find((th) => (th.textContent || '').trim() === 'VIN');
    expect(vinHeader).toBeTruthy();

    vinHeader?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(setPopoutOptions).toHaveBeenCalled();
    expect(options.selectedColumnsByName.includes('VIN')).toBe(true);

    handle?.close();
  });
});
