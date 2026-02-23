import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PERSISTED_STATE } from './constants';
import { createUi, installFab } from './ui';
import type { PersistedState } from './types';

const noop = () => {};

describe('main ui click feedback', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('adds click feedback class for modal action buttons', () => {
    const persisted: PersistedState = JSON.parse(JSON.stringify(DEFAULT_PERSISTED_STATE));
    const ui = createUi(persisted, {
      onStart: noop,
      onCancel: noop,
      onDownloadCsv: noop,
      onCopyCsv: noop,
      onDownloadJson: noop,
      onCopyJson: noop,
      onPopoutTable: noop,
      onCopyStock: noop,
      onCopyVin: noop,
      onCopyPid: noop,
      onCopyReference: noop,
      onScrapeOptionsChange: noop,
      onUniquenessOptionsChange: noop,
      onPopoutOptionsChange: noop,
      onThemeOptionsChange: noop,
      onUiStateChange: noop,
      onClose: noop,
    });

    ui.start.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ui.start.classList.contains('cbss-clicked')).toBe(true);
  });

  it('adds click feedback class for fab button', () => {
    installFab(noop);
    const fab = document.getElementById('cbss-fab') as HTMLButtonElement | null;
    expect(fab).toBeTruthy();
    fab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fab?.classList.contains('cbss-clicked')).toBe(true);
  });
});
