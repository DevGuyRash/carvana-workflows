import { describe, expect, it } from 'vitest';
import { STYLE_TEXT } from './constants';

describe('main UI button feedback styles', () => {
  it('defines active and focus-visible states for buttons', () => {
    expect(STYLE_TEXT.includes('.cbss-btn:active')).toBe(true);
    expect(STYLE_TEXT.includes('.cbss-btn:focus-visible')).toBe(true);
    expect(STYLE_TEXT.includes('.cbss-fab:active')).toBe(true);
    expect(STYLE_TEXT.includes('.cbss-close:focus-visible')).toBe(true);
    expect(STYLE_TEXT.includes('.cbss-btn.cbss-clicked')).toBe(true);
    expect(STYLE_TEXT.includes('.cbss-tab.cbss-clicked')).toBe(true);
    expect(STYLE_TEXT.includes('@keyframes cbss-click-pulse')).toBe(true);
  });
});
