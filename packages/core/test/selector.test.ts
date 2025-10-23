import { describe, it, expect } from 'vitest';
import { findAll } from '@cv/core';

describe('selector', () => {
  it('matches text.includes', () => {
    document.body.innerHTML = `<button>Resolve</button>`;
    const els = findAll({ tag: 'button', text: { includes: 'resol', caseInsensitive: true } }, { visibleOnly: true });
    expect(els.length).toBe(1);
  });
});
