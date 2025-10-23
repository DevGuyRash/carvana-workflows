import { describe, it, expect } from 'vitest';
import { renderTemplate, deepRenderTemplates } from '@cv/core';

describe('templating', () => {
  it('replaces simple placeholders', () => {
    const s = renderTemplate('Hello {{ opt.name }}!', { opt: { name: 'World' } });
    expect(s).toBe('Hello World!');
  });

  it('deeply renders objects', () => {
    const step = { kind: 'type', text: 'Val: {{ opt.value }}' } as any;
    const out = deepRenderTemplates(step, { opt: { value: 42 } });
    expect(out.text).toBe('Val: 42');
  });
});
