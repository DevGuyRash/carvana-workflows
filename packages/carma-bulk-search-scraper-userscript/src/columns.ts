import type { ColumnMode } from './types';
import { cleanText, sleep, waitFor } from './utils';

interface CheckboxInfo {
  label: HTMLLabelElement;
  input: HTMLInputElement;
  text: string;
  checked: boolean;
  disabled: boolean;
}

export function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | null {
  const target = text.toLowerCase();
  const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find((btn) => cleanText(btn.textContent).toLowerCase() === target) || null;
}

export function findDropdownButtonMatching(root: ParentNode, regex: RegExp): HTMLButtonElement | null {
  const candidates = Array.from(
    root.querySelectorAll('button, [role="button"], .dropdown-toggle, [data-bs-toggle="dropdown"]'),
  ) as HTMLElement[];

  for (const candidate of candidates) {
    const text = cleanText(candidate.textContent);
    if (!regex.test(text)) continue;

    const dd = candidate.closest('.dropdown');
    if (!dd) continue;

    return candidate as HTMLButtonElement;
  }

  return null;
}

export async function openDropdown(button: HTMLButtonElement, options: { timeoutMs?: number } = {}): Promise<{ dd: Element; menu: Element }> {
  const { timeoutMs = 5000 } = options;
  button.click();
  const dd = button.closest('.dropdown');
  if (!dd) throw new Error('Dropdown wrapper not found');
  const menu = await waitFor(() => {
    const current = dd.querySelector('.dropdown-menu');
    if (!current) return null;
    const style = current.getAttribute('style') || '';
    const shown = current.classList.contains('show') || /display:\s*block/i.test(style);
    return shown ? current : null;
  }, { timeoutMs, intervalMs: 50, debugLabel: 'dropdown open' });
  return { dd, menu };
}

export async function closeDropdown(menu: Element): Promise<void> {
  const closeBtn = menu.querySelector('#close-edit-columns-dropdown') as HTMLButtonElement | null;
  if (closeBtn) {
    closeBtn.click();
    return;
  }
  document.body.click();
}

function checkboxInfoFromLabel(label: HTMLLabelElement): CheckboxInfo | null {
  const input = label.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
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

export async function applyColumns(blockRoot: ParentNode, mode: ColumnMode): Promise<{ applied: boolean; reason: string }> {
  if (mode === 'none') return { applied: false, reason: 'disabled' };

  const editBtn = findButtonByText(blockRoot, 'Edit Columns');
  if (!editBtn) {
    return { applied: false, reason: 'no_button' };
  }

  const { menu } = await openDropdown(editBtn);

  try {
    const labels = Array.from(menu.querySelectorAll('label'))
      .map((label) => checkboxInfoFromLabel(label as HTMLLabelElement))
      .filter(Boolean) as CheckboxInfo[];

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

export async function setPageSize(blockRoot: ParentNode, size: number): Promise<{ changed: boolean; reason: string }> {
  const matcher = /^show\b.*\d+/i;
  const findShowButton = (root: ParentNode): HTMLButtonElement | null => findDropdownButtonMatching(root, matcher);
  let showBtn = findShowButton(blockRoot);
  if (!showBtn) {
    const table = (blockRoot as Element).querySelector?.('table[data-testid="data-table"]') as HTMLTableElement | null;
    let cursor = table?.parentElement || (blockRoot as Element).parentElement;
    for (let i = 0; i < 6 && cursor && !showBtn; i++) {
      showBtn = findShowButton(cursor);
      cursor = cursor.parentElement;
    }
  }
  if (!showBtn) {
    const doc = (blockRoot as Element).ownerDocument;
    if (doc) showBtn = findShowButton(doc);
  }
  if (!showBtn) {
    try {
      showBtn = await waitFor(() => findShowButton(blockRoot), {
        timeoutMs: 5000,
        intervalMs: 100,
        debugLabel: 'page size button',
      });
    } catch {
      return { changed: false, reason: 'no_show_button' };
    }
  }

  const current = cleanText(showBtn.textContent);
  const currentNum = Number.parseInt((current.match(/\b(\d+)\b/) || [])[1] || '', 10);
  if (Number.isFinite(currentNum) && currentNum === size) return { changed: false, reason: 'already' };

  const { menu } = await openDropdown(showBtn);

  try {
    const items = Array.from(menu.querySelectorAll('a,button')) as HTMLElement[];
    const target = items.find((item) => {
      const text = cleanText(item.textContent);
      if (new RegExp(`^show\\b.*\\b${size}\\b`, 'i').test(text)) return true;
      if (new RegExp(`^${size}$`).test(text)) return true;
      return false;
    });
    if (!target) {
      return { changed: false, reason: 'no_target_item' };
    }
    target.click();

    await waitFor(() => {
      const updated = cleanText(showBtn.textContent);
      const updatedNum = Number.parseInt((updated.match(/\b(\d+)\b/) || [])[1] || '', 10);
      return Number.isFinite(updatedNum) && updatedNum === size;
    }, {
      timeoutMs: 8000,
      intervalMs: 50,
      debugLabel: 'page size apply',
    });
    return { changed: true, reason: 'selected' };
  } finally {
    try {
      document.body.click();
    } catch {
      // ignore
    }
  }
}
