import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Store } from '../src/storage';
import { MenuUI } from '../src/ui';
import type { Registry } from '../src/types';

type GmKey = string;

describe('MenuUI theme handling', () => {
  let mem: Map<GmKey, string>;
  let registry: Registry;

  beforeEach(() => {
    mem = new Map();
    registry = { pages: [] };
    const g = globalThis as any;
    g.GM_getValue = (key: string) => mem.get(key);
    g.GM_setValue = (key: string, value: string) => { mem.set(key, value); };
    g.GM_deleteValue = (key: string) => { mem.delete(key); };
    g.GM_listValues = () => Array.from(mem.keys());
    g.GM_registerMenuCommand = vi.fn();
    g.alert = vi.fn();
    if (typeof (globalThis as any).PointerEvent === 'undefined') {
      (globalThis as any).PointerEvent = class PolyfillPointerEvent extends MouseEvent {
        constructor(type: string, init?: MouseEventInit) {
          super(type, init);
        }
      };
    }
  });

  it('applies custom theme to the host element', () => {
    const theme = {
      primary: '#112233',
      background: '#223344',
      text: '#ddeeff',
      accent: '#ffcc00'
    };
    mem.set('spec:settings', JSON.stringify({ theme, interActionDelayMs: 120 }));

    const store = new Store('spec');
    const ui = new MenuUI(registry, store);

    const host = (ui as any).shadow.host as HTMLElement;
    expect(host.style.getPropertyValue('--cv-primary')).toBe(theme.primary);
    expect(host.style.getPropertyValue('--cv-bg')).toBe(theme.background);
    expect(host.style.getPropertyValue('--cv-text')).toBe(theme.text);
    expect(host.style.getPropertyValue('--cv-accent')).toBe(theme.accent);

    const panel = (ui as any).shadow.querySelector('.cv-panel') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.style.getPropertyValue('--cv-primary')).toBe('');
  });

  it('blurs previous color picker when opening a new one', () => {
    const store = new Store('spec');
    const ui = new MenuUI(registry, store);
    const shadow = (ui as any).shadow as ShadowRoot;

    const primary = shadow.getElementById('cv-theme-primary') as HTMLInputElement;
    const accent = shadow.getElementById('cv-theme-accent') as HTMLInputElement;

    expect(primary).toBeTruthy();
    expect(accent).toBeTruthy();

    const blurSpy = vi.spyOn(primary, 'blur');
    primary.focus();
    primary.dispatchEvent(new FocusEvent('focus'));

    accent.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(blurSpy).toHaveBeenCalled();
  });
});
