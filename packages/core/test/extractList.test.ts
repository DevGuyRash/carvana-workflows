import { describe, it, expect } from 'vitest';
import { extractListData } from '@cv/core';

describe('extractListData', () => {
  it('extracts top N anchors text+href', () => {
    document.body.innerHTML = `
      <a href="https://a.example/x">First</a>
      <a href="/rel">Second</a>
      <a>Third (no href)</a>
    `;
    const rows = extractListData(
      { selector: 'a' },
      [{ key: 'text', take: 'text' }, { key: 'href', take: 'href' }],
      10,
      { visibleOnly: false }
    );
    expect(rows.length).toBe(3);
    expect(rows[0].text).toBe('First');
    expect(rows[0].href).toMatch('https://a.example/x');
    expect(rows[2].href).toBe(''); // no href
  });
});
