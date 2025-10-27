import { describe, expect, it } from 'vitest';

import {
  autoSuggestOptionByText,
  dropdownCellByText,
  inputByLabel,
  lovButtonByLabel,
  textareaByLabel
} from '../src/shared/field-selectors';

describe('oracle field selectors', () => {
  it('builds a LOV button selector scoped by label', () => {
    const spec = lovButtonByLabel('Business Unit');
    expect(spec.selector).toBe('a[title*="Search:"]');
    expect(spec.within).toEqual(
      expect.objectContaining({
        selector: 'tr',
        text: expect.objectContaining({ includes: 'Business Unit', caseInsensitive: true })
      })
    );
    expect(spec.attribute?.title).toEqual(
      expect.objectContaining({ regex: expect.stringContaining('Search'), flags: 'i' })
    );
  });

  it('builds dropdown cell selector using provided text template', () => {
    const spec = dropdownCellByText('{{vars.value}}');
    expect(spec.selector).toBe('td');
    expect(spec.text).toEqual(expect.objectContaining({ includes: '{{vars.value}}', caseInsensitive: true }));
  });

  it('builds autosuggest option selector', () => {
    const spec = autoSuggestOptionByText('Supplier');
    expect(spec.selector).toBe('li[role="option"]');
    expect(spec.visible).toBe(true);
  });

  it('creates input and textarea selectors scoped by label', () => {
    const inputSpec = inputByLabel('Supplier');
    expect(inputSpec.selector).toBe('input');
    expect(inputSpec.within).toEqual(
      expect.objectContaining({ text: expect.objectContaining({ includes: 'Supplier', caseInsensitive: true }) })
    );

    const textareaSpec = textareaByLabel('Description');
    expect(textareaSpec.selector).toBe('textarea');
  });
});
