const DEFAULT_HANDLE_SELECTOR = '[data-drag-handle]';
const DEFAULT_ITEM_SELECTOR = '[data-drag-item]';

type DragMode = 'pointer' | 'keyboard';

type DragItemSnapshot = {
  element: HTMLElement;
  id: string;
};

type DragMetric = DragItemSnapshot & {
  index: number;
  top: number;
  mid: number;
  bottom: number;
};

type PointerState = {
  pointerId: number;
  handle: HTMLElement;
  metrics: DragMetric[];
  startIndex: number;
  currentIndex: number;
  total: number;
};

type KeyboardState = {
  handle: HTMLElement;
  metrics: DragMetric[];
  startIndex: number;
  currentIndex: number;
  total: number;
};

export type DragReorderDetail = {
  id: string;
  fromIndex: number;
  toIndex: number;
  total: number;
  mode: DragMode;
  element: HTMLElement;
};

export type DragAnnouncement =
  | { type: 'lift'; mode: DragMode; id: string; index: number; total: number; element: HTMLElement }
  | { type: 'move'; mode: DragMode; id: string; fromIndex: number; toIndex: number; total: number; element: HTMLElement }
  | { type: 'drop'; mode: DragMode; id: string; fromIndex: number; toIndex: number; total: number; element: HTMLElement }
  | { type: 'cancel'; mode: DragMode; id: string; index: number; total: number; element: HTMLElement };

export interface DragControllerOptions {
  list: HTMLElement;
  root?: HTMLElement | ShadowRoot;
  handleSelector?: string;
  itemSelector?: string;
  getId?: (element: HTMLElement) => string | null | undefined;
  isDisabled?: (element: HTMLElement) => boolean;
  onPreview?: (detail: DragReorderDetail) => void;
  onReorder: (detail: DragReorderDetail) => void;
  announce?: (announcement: DragAnnouncement) => void;
}

function isSpaceKey(key: string): boolean {
  return key === ' ' || key === 'Spacebar';
}

export class DragController {
  private readonly list: HTMLElement;
  private readonly root: HTMLElement | ShadowRoot;
  private readonly handleSelector: string;
  private readonly itemSelector: string;
  private readonly getId: (element: HTMLElement) => string | null | undefined;
  private readonly isDisabled?: (element: HTMLElement) => boolean;
  private readonly onPreview?: (detail: DragReorderDetail) => void;
  private readonly onReorder: (detail: DragReorderDetail) => void;
  private readonly announce?: (announcement: DragAnnouncement) => void;
  private active = false;
  private pointerState: PointerState | null = null;
  private keyboardState: KeyboardState | null = null;
  private pointerFrame = 0;
  private pendingY: number | null = null;

  constructor(options: DragControllerOptions){
    this.list = options.list;
    this.root = options.root ?? options.list;
    this.handleSelector = options.handleSelector ?? DEFAULT_HANDLE_SELECTOR;
    this.itemSelector = options.itemSelector ?? DEFAULT_ITEM_SELECTOR;
    this.getId = options.getId ?? ((el) => el.dataset.dragId ?? el.dataset.id ?? null);
    this.isDisabled = options.isDisabled;
    this.onPreview = options.onPreview;
    this.onReorder = options.onReorder;
    this.announce = options.announce;
  }

  attach(){
    if (this.active) return;
    this.active = true;
    this.root.addEventListener('pointerdown', this.handlePointerDown as EventListener, { passive: false });
    this.root.addEventListener('keydown', this.handleKeyDown as EventListener);
    this.root.addEventListener('focusout', this.handleFocusOut as EventListener);
  }

  detach(){
    if (!this.active) return;
    this.active = false;
    this.root.removeEventListener('pointerdown', this.handlePointerDown as EventListener);
    this.root.removeEventListener('keydown', this.handleKeyDown as EventListener);
    this.root.removeEventListener('focusout', this.handleFocusOut as EventListener);
    this.cleanupPointerListeners();
    this.clearPointerFrame();
    this.pointerState = null;
    this.keyboardState = null;
  }

  refresh(){
    if (this.pointerState) {
      const metrics = this.computeMetrics();
      this.pointerState.metrics = metrics;
      this.pointerState.total = metrics.length;
    }
    if (this.keyboardState) {
      const metrics = this.computeMetrics();
      this.keyboardState.metrics = metrics;
      this.keyboardState.total = metrics.length;
      const activeItem = this.keyboardState.handle.closest<HTMLElement>(this.itemSelector);
      if (!activeItem) return;
      const index = metrics.findIndex((metric) => metric.element === activeItem);
      if (index >= 0) {
        this.keyboardState.startIndex = index;
        this.keyboardState.currentIndex = index;
      }
    }
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (!this.active) return;
    if (event.button !== 0 || !event.isPrimary) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const handle = target.closest<HTMLElement>(this.handleSelector);
    if (!handle) return;
    const item = handle.closest<HTMLElement>(this.itemSelector);
    if (!item) return;
    if (!(this.list.contains(item))) return;
    if (this.isDisabled?.(item)) return;
    const id = this.getId(item);
    if (!id) return;

    const metrics = this.computeMetrics();
    const startIndex = metrics.findIndex((metric) => metric.element === item);
    if (startIndex === -1) return;

    this.cleanupPointerListeners();
    this.pointerState = {
      pointerId: event.pointerId,
      handle,
      metrics,
      startIndex,
      currentIndex: startIndex,
      total: metrics.length
    };

    if (typeof handle.setPointerCapture === 'function') {
      try {
        handle.setPointerCapture(event.pointerId);
      } catch (err) {
        // ignore capture errors in unsupported environments
      }
    }
    handle.addEventListener('pointermove', this.handlePointerMove, { passive: false });
    handle.addEventListener('pointerup', this.handlePointerUp, { passive: false });
    handle.addEventListener('pointercancel', this.handlePointerCancel, { passive: false });
    this.keyboardState = null;
    this.announce?.({ type: 'lift', mode: 'pointer', id, index: startIndex, total: metrics.length, element: item });
    event.preventDefault();
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.pointerState) return;
    if (event.pointerId !== this.pointerState.pointerId) return;
    this.pendingY = event.clientY;
    if (!this.pointerFrame) {
      this.pointerFrame = requestAnimationFrame(this.flushPointerMove);
    }
    event.preventDefault();
  };

  private flushPointerMove = () => {
    this.pointerFrame = 0;
    if (!this.pointerState || this.pendingY === null) return;
    const y = this.pendingY;
    this.pendingY = null;
    const { metrics, currentIndex, startIndex, total } = this.pointerState;
    const targetIndex = this.resolveIndex(y, metrics);
    if (targetIndex === currentIndex) return;
    this.pointerState.currentIndex = targetIndex;
    const item = metrics[startIndex];
    const detail: DragReorderDetail = {
      id: item.id,
      fromIndex: startIndex,
      toIndex: targetIndex,
      total,
      mode: 'pointer',
      element: item.element
    };
    this.onPreview?.(detail);
    this.announce?.({ type: 'move', mode: 'pointer', id: item.id, fromIndex: startIndex, toIndex: targetIndex, total, element: item.element });
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (!this.pointerState) return;
    if (event.pointerId !== this.pointerState.pointerId) return;
    event.preventDefault();
    const state = this.pointerState;
    this.cleanupPointerListeners();
    this.clearPointerFrame();
    this.pointerState = null;
    const metrics = state.metrics;
    const item = metrics[state.startIndex];
    if (!item) return;
    if (state.currentIndex !== state.startIndex) {
      const detail: DragReorderDetail = {
        id: item.id,
        fromIndex: state.startIndex,
        toIndex: state.currentIndex,
        total: state.total,
        mode: 'pointer',
        element: item.element
      };
      this.onReorder(detail);
      this.announce?.({ type: 'drop', mode: 'pointer', id: item.id, fromIndex: state.startIndex, toIndex: state.currentIndex, total: state.total, element: item.element });
    } else {
      this.announce?.({ type: 'cancel', mode: 'pointer', id: item.id, index: state.startIndex, total: state.total, element: item.element });
    }
  };

  private handlePointerCancel = (event: PointerEvent) => {
    if (!this.pointerState) return;
    if (event.pointerId !== this.pointerState.pointerId) return;
    const state = this.pointerState;
    this.cleanupPointerListeners();
    this.clearPointerFrame();
    this.pointerState = null;
    const metrics = state.metrics;
    const item = metrics[state.startIndex];
    if (item) {
      this.announce?.({ type: 'cancel', mode: 'pointer', id: item.id, index: state.startIndex, total: state.total, element: item.element });
    }
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this.active) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const handle = target.closest<HTMLElement>(this.handleSelector);
    if (!handle) return;
    const item = handle.closest<HTMLElement>(this.itemSelector);
    if (!item) return;
    if (!(this.list.contains(item))) return;
    if (this.isDisabled?.(item)) return;
    const id = this.getId(item);
    if (!id) return;

    if (isSpaceKey(event.key)) {
      event.preventDefault();
      if (this.keyboardState && this.keyboardState.handle === handle) {
        this.commitKeyboardDrag();
      } else {
        this.startKeyboardDrag(handle, item, id);
      }
      return;
    }

    if (!this.keyboardState || this.keyboardState.handle !== handle) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelKeyboardDrag();
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const delta = event.key === 'ArrowUp' ? -1 : 1;
      this.updateKeyboardTarget(this.keyboardState.currentIndex + delta);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.updateKeyboardTarget(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.updateKeyboardTarget(this.keyboardState.total - 1);
    }
  };

  private handleFocusOut = (event: FocusEvent) => {
    if (!this.keyboardState) return;
    const handle = this.keyboardState.handle;
    const related = event.relatedTarget as HTMLElement | null;
    if (related && (related === handle || handle.contains(related))) return;
    this.cancelKeyboardDrag();
  };

  private startKeyboardDrag(handle: HTMLElement, item: HTMLElement, id: string){
    const metrics = this.computeMetrics();
    const startIndex = metrics.findIndex((metric) => metric.element === item);
    if (startIndex === -1) return;
    this.pointerState = null;
    this.keyboardState = {
      handle,
      metrics,
      startIndex,
      currentIndex: startIndex,
      total: metrics.length
    };
    this.announce?.({ type: 'lift', mode: 'keyboard', id, index: startIndex, total: metrics.length, element: item });
  }

  private updateKeyboardTarget(targetIndex: number){
    if (!this.keyboardState) return;
    const state = this.keyboardState;
    if (state.total <= 0) return;
    const bounded = Math.max(0, Math.min(state.total - 1, targetIndex));
    if (bounded === state.currentIndex) return;
    state.currentIndex = bounded;
    const item = state.metrics[state.startIndex];
    if (!item) return;
    const detail: DragReorderDetail = {
      id: item.id,
      fromIndex: state.startIndex,
      toIndex: bounded,
      total: state.total,
      mode: 'keyboard',
      element: item.element
    };
    this.onPreview?.(detail);
    this.announce?.({ type: 'move', mode: 'keyboard', id: item.id, fromIndex: state.startIndex, toIndex: bounded, total: state.total, element: item.element });
  }

  private commitKeyboardDrag(){
    if (!this.keyboardState) return;
    const state = this.keyboardState;
    const item = state.metrics[state.startIndex];
    if (!item) {
      this.keyboardState = null;
      return;
    }
    if (state.currentIndex !== state.startIndex) {
      const detail: DragReorderDetail = {
        id: item.id,
        fromIndex: state.startIndex,
        toIndex: state.currentIndex,
        total: state.total,
        mode: 'keyboard',
        element: item.element
      };
      this.onReorder(detail);
      this.announce?.({ type: 'drop', mode: 'keyboard', id: item.id, fromIndex: state.startIndex, toIndex: state.currentIndex, total: state.total, element: item.element });
    } else {
      this.announce?.({ type: 'cancel', mode: 'keyboard', id: item.id, index: state.startIndex, total: state.total, element: item.element });
    }
    this.keyboardState = null;
  }

  private cancelKeyboardDrag(){
    if (!this.keyboardState) return;
    const state = this.keyboardState;
    const item = state.metrics[state.startIndex];
    if (item) {
      this.announce?.({ type: 'cancel', mode: 'keyboard', id: item.id, index: state.startIndex, total: state.total, element: item.element });
    }
    this.keyboardState = null;
  }

  private cleanupPointerListeners(){
    if (!this.pointerState) return;
    const { handle, pointerId } = this.pointerState;
    if (typeof handle.releasePointerCapture === 'function') {
      try {
        handle.releasePointerCapture(pointerId);
      } catch (err) {
        // ignore release failures (e.g., pointer already released)
      }
    }
    handle.removeEventListener('pointermove', this.handlePointerMove);
    handle.removeEventListener('pointerup', this.handlePointerUp);
    handle.removeEventListener('pointercancel', this.handlePointerCancel);
  }

  private clearPointerFrame(){
    if (!this.pointerFrame) return;
    cancelAnimationFrame(this.pointerFrame);
    this.pointerFrame = 0;
    this.pendingY = null;
  }

  private computeMetrics(): DragMetric[] {
    const nodes = Array.from(this.list.querySelectorAll<HTMLElement>(this.itemSelector));
    const metrics: DragMetric[] = [];
    let index = 0;
    for (const element of nodes) {
      if (!element.isConnected) continue;
      if (this.isDisabled?.(element)) continue;
      const id = this.getId(element);
      if (!id) continue;
      const rect = element.getBoundingClientRect();
      metrics.push({
        element,
        id,
        index,
        top: rect.top,
        mid: rect.top + (rect.height / 2),
        bottom: rect.bottom
      });
      index += 1;
    }
    return metrics;
  }

  private resolveIndex(y: number, metrics: DragMetric[]): number {
    if (metrics.length === 0) return 0;
    let target = metrics.length - 1;
    for (let i = 0; i < metrics.length; i += 1) {
      if (y < metrics[i].mid) {
        target = i;
        break;
      }
    }
    return target;
  }
}
