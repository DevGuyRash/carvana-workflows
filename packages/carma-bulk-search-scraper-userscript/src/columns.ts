import type { ColumnMode } from './types';
import { cleanText, sleep, waitFor } from './utils';

export interface CheckboxInfo {
  input: HTMLInputElement;
  text: string;
  checked: boolean;
  disabled: boolean;
  isAllToggle: boolean;
  clickable: HTMLElement;
}

function normalizedToken(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function clickElement(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function closestClickable(element: HTMLElement): HTMLElement {
  const clickable = element.closest('label,button,[role="menuitemcheckbox"],[role="radio"],.form-check,.radio,[data-testid]') as HTMLElement | null;
  return clickable || element;
}

export function isKeyColumnText(text: string): boolean {
  const normalized = normalizedToken(text);
  if (!normalized) return false;
  return [
    'latestpurchasepurchaseid',
    'latestpurchasevin',
    'latestpurchasestocknumber',
    'purchaseid',
    'vin',
    'stocknumber',
  ].includes(normalized);
}

export function getPresetSelection(menu: ParentNode): 'default' | 'custom' | 'unknown' {
  const radios = Array.from(menu.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
  const checked = radios.find((radio) => radio.checked);
  if (!checked) return 'unknown';

  const text = cleanText(`${checked.value || ''} ${checked.closest('label,div')?.textContent || ''}`);
  if (/default/i.test(text)) return 'default';
  if (/custom/i.test(text)) return 'custom';
  return 'unknown';
}

function findPresetRadio(menu: ParentNode, preset: 'default' | 'custom'): HTMLInputElement | null {
  const radios = Array.from(menu.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
  for (const radio of radios) {
    const text = cleanText(`${radio.value || ''} ${radio.closest('label,div')?.textContent || ''}`);
    if (preset === 'default' && /default/i.test(text)) return radio;
    if (preset === 'custom' && /custom/i.test(text)) return radio;
  }
  return null;
}

async function ensureCustomPreset(menu: ParentNode): Promise<boolean> {
  const customRadio = findPresetRadio(menu, 'custom');
  if (!customRadio) return false;
  if (customRadio.checked) return false;

  clickElement(closestClickable(customRadio));
  await waitFor(() => customRadio.checked, {
    timeoutMs: 5000,
    intervalMs: 50,
    debugLabel: 'custom preset select',
  });

  await waitFor(() => {
    const checkbox = menu.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    return checkbox && checkbox.offsetParent !== null ? checkbox : checkbox;
  }, {
    timeoutMs: 5000,
    intervalMs: 50,
    debugLabel: 'custom preset checkbox render',
  });

  return true;
}

function checkboxInfoFromInput(input: HTMLInputElement): CheckboxInfo {
  const clickable = closestClickable(input);
  const text = cleanText(clickable.textContent || input.closest('label,div')?.textContent || '');
  const token = normalizedToken(text);
  return {
    input,
    text,
    checked: !!input.checked,
    disabled: !!input.disabled,
    isAllToggle: token === 'all',
    clickable,
  };
}

function getCheckboxInfos(menu: ParentNode): CheckboxInfo[] {
  const checkboxes = Array.from(menu.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
  return checkboxes.map((input) => checkboxInfoFromInput(input));
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
  const closeBtn = menu.querySelector('#close-edit-columns-dropdown, button[aria-label="Close"]') as HTMLButtonElement | null;
  if (closeBtn) {
    closeBtn.click();
    return;
  }
  document.body.click();
}

async function ensureAllColumns(actionable: CheckboxInfo[], allToggle: CheckboxInfo | null): Promise<{ changed: boolean; reason: string }> {
  const allChecked = actionable.length > 0 && actionable.every((x) => x.input.checked);
  if (allChecked) {
    return { changed: false, reason: 'already_all' };
  }

  if (allToggle && !allToggle.input.disabled && !allToggle.input.checked) {
    clickElement(allToggle.clickable);
    try {
      await waitFor(() => actionable.every((x) => x.input.checked), {
        timeoutMs: 8000,
        intervalMs: 50,
        debugLabel: 'columns select all toggle',
      });
      return { changed: true, reason: 'checked_all_toggle' };
    } catch {
      // fallback below when toggle does not settle all actionable columns
    }
  }

  let clicked = 0;
  for (const info of actionable) {
    if (!info.input.checked) {
      clickElement(info.clickable);
      clicked++;
      await sleep(20);
    }
  }

  if (!clicked) {
    return { changed: false, reason: 'no_action' };
  }

  await waitFor(() => actionable.every((x) => x.input.checked), {
    timeoutMs: 8000,
    intervalMs: 50,
    debugLabel: 'columns select all fallback',
  });
  return { changed: true, reason: `clicked_${clicked}` };
}

export async function applyColumns(blockRoot: ParentNode, mode: ColumnMode): Promise<{ applied: boolean; reason: string }> {
  if (mode === 'none') return { applied: false, reason: 'disabled' };

  const editBtn = findButtonByText(blockRoot, 'Edit Columns');
  if (!editBtn) {
    return { applied: false, reason: 'no_button' };
  }

  const { menu } = await openDropdown(editBtn);

  try {
    await ensureCustomPreset(menu);

    const infos = getCheckboxInfos(menu).filter((info) => !info.disabled);
    if (!infos.length) {
      return { applied: false, reason: 'no_checkboxes' };
    }

    const allToggle = infos.find((info) => info.isAllToggle) || null;
    const actionable = infos.filter((info) => !info.isAllToggle);

    if (mode === 'all') {
      const result = await ensureAllColumns(actionable, allToggle);
      return {
        applied: result.changed,
        reason: result.reason,
      };
    }

    if (mode === 'key') {
      const wanted = actionable.filter((info) => isKeyColumnText(info.text));
      if (!wanted.length) {
        return { applied: false, reason: 'no_key_columns_found' };
      }

      let changed = 0;
      for (const info of wanted) {
        if (!info.input.checked) {
          clickElement(info.clickable);
          changed++;
          await sleep(30);
        }
      }

      if (!changed) {
        return { applied: false, reason: 'already_key' };
      }

      await waitFor(() => wanted.every((info) => info.input.checked), {
        timeoutMs: 8000,
        intervalMs: 50,
        debugLabel: 'key column enable',
      });

      return { applied: true, reason: `enabled_${changed}_key_cols` };
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
