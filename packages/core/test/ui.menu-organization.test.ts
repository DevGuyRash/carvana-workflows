import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuUI } from '../src/ui';
import { Store } from '../src/storage';
import type { PageDefinition, Registry, WorkflowDefinition } from '../src/types';

type PointerEventConfig = PointerEventInit & { clientY?: number };

let mem: Map<string, string>;

function installPointerEventPolyfill(){
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    isPrimary: boolean;
    clientX!: number;
    clientY!: number;

    constructor(type: string, init: PointerEventConfig = {}){
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.isPrimary = init.isPrimary ?? true;
      Object.defineProperty(this, 'clientX', { value: init.clientX ?? 0, configurable: true });
      Object.defineProperty(this, 'clientY', { value: init.clientY ?? 0, configurable: true });
    }
  }
  vi.stubGlobal('PointerEvent', PointerEventPolyfill as unknown as typeof PointerEvent);
}

function createPointerEvent(type: string, init: PointerEventConfig): PointerEvent {
  const BasePointerEvent = globalThis.PointerEvent as typeof PointerEvent;
  return new BasePointerEvent(type, init);
}

function buildWorkflows(): WorkflowDefinition[] {
  return [
    { id: 'wf-alpha', label: 'Workflow Alpha', description: 'First workflow', steps: [] },
    { id: 'wf-beta', label: 'Workflow Beta', description: 'Second workflow', steps: [] },
    { id: 'wf-gamma', label: 'Workflow Gamma', description: 'Third workflow', steps: [] }
  ];
}

function buildPage(): PageDefinition {
  return {
    id: 'demo.page',
    label: 'Demo Page',
    detector: { any: [] },
    workflows: buildWorkflows()
  };
}

function setupMenu(){
  const page = buildPage();
  const registry: Registry = { pages: [page] };
  const store = new Store('spec');
  const ui = new MenuUI(registry, store);
  ui.setPage(page);
  const shadow = (ui as any).shadow as ShadowRoot;
  return { ui, store, shadow, page };
}

function mockBoundingRects(list: HTMLElement){
  const items = Array.from(list.querySelectorAll<HTMLElement>('[data-drag-item]'));
  items.forEach((item, index) => {
    const top = index * 80;
    Object.defineProperty(item, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0,
        y: top,
        width: 320,
        height: 72,
        top,
        left: 0,
        right: 320,
        bottom: top + 72,
        toJSON: () => ({ top, bottom: top + 72 })
      })
    });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mem = new Map();
  const g = globalThis as any;
  g.GM_getValue = (key: string) => mem.get(key);
  g.GM_setValue = (key: string, value: string) => { mem.set(key, value); };
  g.GM_deleteValue = (key: string) => { mem.delete(key); };
  g.GM_listValues = () => Array.from(mem.keys());
  g.GM_registerMenuCommand = vi.fn();
  g.alert = vi.fn();
  g.confirm = vi.fn(() => true);
  g.prompt = vi.fn(() => null);
  const navigatorObj = g.navigator ?? (g.navigator = {});
  if (!navigatorObj.clipboard) {
    navigatorObj.clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
  } else if (typeof navigatorObj.clipboard.writeText !== 'function') {
    navigatorObj.clipboard.writeText = vi.fn().mockResolvedValue(undefined);
  } else {
    vi.spyOn(navigatorObj.clipboard, 'writeText').mockResolvedValue(undefined);
  }
  installPointerEventPolyfill();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(Date.now());
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.getElementById('cv-menu-host')?.remove();
  document.body.innerHTML = '';
});

describe('MenuUI menu organization', () => {
  it('reorders workflows via pointer drag and persists order', () => {
    const { shadow } = setupMenu();
    const list = shadow.getElementById('cv-wf-list') as HTMLElement;
    expect(list).toBeTruthy();
    mockBoundingRects(list);

    const handle = list.querySelector('[data-drag-id="wf-alpha"] [data-drag-handle]') as HTMLElement;
    expect(handle).toBeTruthy();

    handle.dispatchEvent(createPointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, isPrimary: true, clientY: 10 }));
    handle.dispatchEvent(createPointerEvent('pointermove', { bubbles: true, pointerId: 1, isPrimary: true, clientY: 480 }));
    handle.dispatchEvent(createPointerEvent('pointerup', { bubbles: true, pointerId: 1, isPrimary: true, clientY: 480 }));

    vi.runAllTimers();

    const titles = Array.from(list.querySelectorAll('.cv-wf-title')).map((el) => el.textContent?.trim());
    expect(titles).toEqual(['Workflow Beta', 'Workflow Gamma', 'Workflow Alpha']);

    const persistedRaw = mem.get('spec:wf:menu:prefs:demo.page');
    expect(persistedRaw).toBeTruthy();
    const persisted = JSON.parse(persistedRaw!);
    expect(persisted.order.slice(0, 3)).toEqual(['wf-beta', 'wf-gamma', 'wf-alpha']);
    expect(persisted.hidden).toEqual([]);
  });

  it('moves workflows between visible and hidden lists', () => {
    const { shadow } = setupMenu();
    const list = shadow.getElementById('cv-wf-list') as HTMLElement;
    mockBoundingRects(list);

    const hideButton = shadow.querySelector<HTMLButtonElement>('[data-wf-hide="wf-beta"]');
    expect(hideButton).toBeTruthy();
    hideButton!.click();

    vi.advanceTimersByTime(250);

    const hiddenBadge = shadow.getElementById('cv-hidden-count');
    expect(hiddenBadge?.textContent).toBe('1');

    const hiddenList = shadow.getElementById('cv-hidden-list') as HTMLElement;
    const hiddenTitles = Array.from(hiddenList.querySelectorAll('.cv-hidden-title')).map((el) => el.textContent?.trim());
    expect(hiddenTitles).toContain('Workflow Beta');

    const hiddenPrefsRaw = mem.get('spec:wf:menu:prefs:demo.page');
    expect(hiddenPrefsRaw).toBeTruthy();
    const hiddenPrefs = JSON.parse(hiddenPrefsRaw!);
    expect(hiddenPrefs.hidden).toContain('wf-beta');

    const searchInput = shadow.getElementById('cv-hidden-search') as HTMLInputElement;
    expect(searchInput.disabled).toBe(false);

    const unhideButton = hiddenList.querySelector<HTMLButtonElement>('[data-hidden-unhide="wf-beta"]');
    expect(unhideButton).toBeTruthy();
    unhideButton!.click();

    vi.runAllTimers();

    const postHiddenTitles = Array.from(hiddenList.querySelectorAll('.cv-hidden-title'));
    expect(postHiddenTitles).toHaveLength(0);
    expect(hiddenBadge?.textContent).toBe('0');
    expect(searchInput.disabled).toBe(true);

    const focusTarget = shadow.activeElement as HTMLElement | null;
    expect(focusTarget?.getAttribute('data-wf-hide')).toBe('wf-beta');

    const prefsAfter = JSON.parse(mem.get('spec:wf:menu:prefs:demo.page')!);
    expect(prefsAfter.hidden).not.toContain('wf-beta');
  });

  it('supports keyboard drag with accessible announcements', () => {
    const { shadow } = setupMenu();
    const list = shadow.getElementById('cv-wf-list') as HTMLElement;
    mockBoundingRects(list);

    const handles = Array.from(list.querySelectorAll<HTMLButtonElement>('[data-drag-handle]'));
    expect(handles).toHaveLength(3);

    const betaHandle = handles[1];
    betaHandle.focus();

    betaHandle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    betaHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    betaHandle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    const announcer = shadow.getElementById('cv-wf-announcer');
    expect(announcer?.textContent).toBe('Workflow Beta dropped at position 1 of 3.');

    vi.runAllTimers();

    const titles = Array.from(list.querySelectorAll('.cv-wf-title')).map((el) => el.textContent?.trim());
    expect(titles).toEqual(['Workflow Beta', 'Workflow Alpha', 'Workflow Gamma']);

    const persistedRaw = mem.get('spec:wf:menu:prefs:demo.page');
    expect(persistedRaw).toBeTruthy();
    const persisted = JSON.parse(persistedRaw!);
    expect(persisted.order.slice(0, 3)).toEqual(['wf-beta', 'wf-alpha', 'wf-gamma']);
  });
});
