import { describe, expect, it } from 'vitest';
import { getPresetSelection, isKeyColumnText } from './columns';

describe('columns helpers', () => {
  it('detects default and custom preset selection', () => {
    document.body.innerHTML = `
      <div id="menu">
        <label><input type="radio" name="preset" value="Default" checked /> Default</label>
        <label><input type="radio" name="preset" value="Custom" /> Custom</label>
      </div>
    `;

    const menu = document.getElementById('menu');
    if (!menu) throw new Error('missing menu');
    expect(getPresetSelection(menu)).toBe('default');

    const radios = Array.from(menu.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
    radios[0].checked = false;
    radios[1].checked = true;
    expect(getPresetSelection(menu)).toBe('custom');
  });

  it('returns unknown when no preset is selected', () => {
    document.body.innerHTML = `
      <div id="menu">
        <label><input type="radio" name="preset" value="Default" /> Default</label>
        <label><input type="radio" name="preset" value="Custom" /> Custom</label>
      </div>
    `;

    const menu = document.getElementById('menu');
    if (!menu) throw new Error('missing menu');
    expect(getPresetSelection(menu)).toBe('unknown');
  });

  it('matches key columns and rejects non-key columns', () => {
    expect(isKeyColumnText('latestPurchasePurchaseId')).toBe(true);
    expect(isKeyColumnText('latestPurchaseVin')).toBe(true);
    expect(isKeyColumnText('latestPurchaseStockNumber')).toBe(true);
    expect(isKeyColumnText('Purchase ID')).toBe(true);
    expect(isKeyColumnText('name_first')).toBe(false);
    expect(isKeyColumnText('email')).toBe(false);
  });
});
