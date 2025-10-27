import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DragController, type DragAnnouncement, type DragReorderDetail } from '../src/menu/drag-controller';

type MockPointerEventInit = PointerEventInit & { clientY?: number };

function createPointerEvent(type: string, init: MockPointerEventInit): PointerEvent {
  const BasePointerEvent = globalThis.PointerEvent as typeof PointerEvent;
  return new BasePointerEvent(type, init);
}

function installPointerEventPolyfill(){
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    isPrimary: boolean;
    clientX: number;
    clientY: number;

    constructor(type: string, init: MockPointerEventInit = {}){
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.isPrimary = init.isPrimary ?? true;
      Object.defineProperty(this, 'clientX', { value: init.clientX ?? 0, configurable: true });
      Object.defineProperty(this, 'clientY', { value: init.clientY ?? 0, configurable: true });
    }
  }
  vi.stubGlobal('PointerEvent', PointerEventPolyfill as unknown as typeof PointerEvent);
}

function mockRect(top: number, height = 40): DOMRect {
  return {
    x: 0,
    y: top,
    width: 160,
    height,
    top,
    left: 0,
    right: 160,
    bottom: top + height,
    toJSON: () => ({ top, bottom: top + height })
  } as DOMRect;
}

function buildList(count: number){
  const list = document.createElement('div');
  const items: HTMLElement[] = [];
  for (let i = 0; i < count; i += 1) {
    const item = document.createElement('div');
    item.dataset.dragItem = 'true';
    item.dataset.dragId = `wf-${i}`;
    (item as any).getBoundingClientRect = () => mockRect(i * 60);
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.dataset.dragHandle = 'true';
    item.appendChild(handle);
    list.appendChild(item);
    items.push(item);
  }
  document.body.appendChild(list);
  return { list, items };
}

describe('DragController', () => {
  beforeEach(() => {
    installPointerEventPolyfill();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(Date.now());
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('emits preview and reorder events for pointer drags', () => {
    const { list, items } = buildList(3);
    const previews: DragReorderDetail[] = [];
    const reorders: DragReorderDetail[] = [];
    const announcements: DragAnnouncement[] = [];

    const controller = new DragController({
      list,
      root: list,
      onPreview: (detail) => previews.push(detail),
      onReorder: (detail) => reorders.push(detail),
      announce: (announcement) => announcements.push(announcement)
    });
    controller.attach();

    const handle = items[1].querySelector('[data-drag-handle]') as HTMLElement;

    handle.dispatchEvent(createPointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, isPrimary: true, clientY: 70 }));
    handle.dispatchEvent(createPointerEvent('pointermove', { bubbles: true, pointerId: 1, isPrimary: true, clientY: 10 }));
    handle.dispatchEvent(createPointerEvent('pointerup', { bubbles: true, pointerId: 1, isPrimary: true, clientY: 10 }));

    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({ id: 'wf-1', fromIndex: 1, toIndex: 0, mode: 'pointer', total: 3 });
    expect(reorders).toHaveLength(1);
    expect(reorders[0]).toMatchObject({ id: 'wf-1', fromIndex: 1, toIndex: 0, mode: 'pointer', total: 3 });
    expect(announcements.some((a) => a.type === 'drop' && a.mode === 'pointer')).toBe(true);

    controller.detach();
  });

  it('supports keyboard-driven reordering', () => {
    const { list, items } = buildList(3);
    const previews: DragReorderDetail[] = [];
    const reorders: DragReorderDetail[] = [];

    const controller = new DragController({
      list,
      root: list,
      onPreview: (detail) => previews.push(detail),
      onReorder: (detail) => reorders.push(detail)
    });
    controller.attach();

    const handle = items[0].querySelector('button') as HTMLElement;
    handle.focus();

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({ id: 'wf-0', fromIndex: 0, toIndex: 1, mode: 'keyboard', total: 3 });
    expect(reorders).toHaveLength(1);
    expect(reorders[0]).toMatchObject({ id: 'wf-0', fromIndex: 0, toIndex: 1, mode: 'keyboard', total: 3 });

    controller.detach();
  });
});
