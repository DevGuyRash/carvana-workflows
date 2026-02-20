import { describe, expect, it } from 'vitest';
import { parseTerms } from './terms';

describe('parseTerms', () => {
  it('supports mixed separators in a single input', () => {
    const parsed = parseTerms('1234, 123\n12345');
    expect(parsed.map((term) => term.term)).toEqual(['1234', '123', '12345']);
  });

  it('supports semicolon, pipe, and tab separators', () => {
    const parsed = parseTerms('A1;B2|C3\tD4');
    expect(parsed.map((term) => term.term)).toEqual(['A1', 'B2', 'C3', 'D4']);
  });

  it('extracts terms from URLs even with mixed separators', () => {
    const parsed = parseTerms('https://carma.cvnacorp.com/research/search/TERM-ONE, https://carma.cvnacorp.com/research/search/TERM-TWO');
    expect(parsed.map((term) => term.term)).toEqual(['TERM-ONE', 'TERM-TWO']);
  });
});
