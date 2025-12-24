import type { PaginationButtons, PaginationInfo } from './types';
import { cleanText, waitFor } from './utils';

export function getPaginationInfo(blockRoot: ParentNode): PaginationInfo {
  const input = blockRoot.querySelector('input[type="number"][min="1"][max]') as HTMLInputElement | null;
  if (input) {
    const max = Number.parseInt(input.getAttribute('max') || '1', 10);
    const val = Number.parseInt(input.value || '1', 10);
    return {
      input,
      current: Number.isFinite(val) ? val : 1,
      total: Number.isFinite(max) ? max : 1,
    };
  }

  const pagerTextEl = Array.from(blockRoot.querySelectorAll('div'))
    .map((d) => ({ d: d as HTMLElement, t: cleanText(d.textContent) }))
    .find((x) => /^\d+\s*\/\s*\d+$/.test(x.t));

  if (pagerTextEl) {
    const [cur, tot] = pagerTextEl.t.split('/').map((n) => Number.parseInt(n.trim(), 10));
    return {
      input: null,
      current: Number.isFinite(cur) ? cur : 1,
      total: Number.isFinite(tot) ? tot : 1,
      pagerTextEl: pagerTextEl.d,
    };
  }

  return { input: null, current: 1, total: 1 };
}

export function getPaginationButtons(blockRoot: ParentNode): PaginationButtons | null {
  const indicator = Array.from(blockRoot.querySelectorAll('div'))
    .map((d) => ({ d: d as HTMLElement, t: cleanText(d.textContent) }))
    .find((x) => /^\d+\s*\/\s*\d+$/.test(x.t));

  if (!indicator) return null;

  let container = indicator.d.parentElement;
  for (let i = 0; i < 4 && container; i++) {
    const btns = container.querySelectorAll('button');
    if (btns.length >= 4) break;
    container = container.parentElement;
  }

  if (!container) return null;

  const btns = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
  if (btns.length < 4) return null;

  return {
    first: btns[0],
    prev: btns[1],
    next: btns[2],
    last: btns[3],
  };
}

export async function goToFirstPageIfNeeded(blockRoot: ParentNode): Promise<void> {
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

export async function clickNextPage(blockRoot: ParentNode, expectedNextPage: number): Promise<boolean> {
  const btns = getPaginationButtons(blockRoot);
  if (!btns || btns.next.disabled) return false;

  btns.next.click();

  await waitFor(() => {
    const pi = getPaginationInfo(blockRoot);
    return pi.current === expectedNextPage;
  }, { timeoutMs: 8000, intervalMs: 50, debugLabel: `page -> ${expectedNextPage}` });

  return true;
}
