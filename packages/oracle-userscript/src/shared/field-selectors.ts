import type { SelectorSpec } from '@cv/core';

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rowByLabel = (label: string): SelectorSpec => ({
  selector: 'tr',
  text: { includes: label, caseInsensitive: true },
  visible: true
});

export const lovButtonByLabel = (label: string): SelectorSpec => ({
  selector: 'a[title*="Search:"]',
  attribute: {
    title: { regex: `Search:\\s*${escapeForRegex(label)}`, flags: 'i' }
  },
  within: rowByLabel(label),
  visible: true
});

export const inputByLabel = (label: string): SelectorSpec => ({
  selector: 'input',
  within: rowByLabel(label),
  visible: true
});

export const textareaByLabel = (label: string): SelectorSpec => ({
  selector: 'textarea',
  within: rowByLabel(label),
  visible: true
});

export const dropdownCellByText = (textTemplate: string): SelectorSpec => ({
  selector: 'td',
  text: { includes: textTemplate, caseInsensitive: true },
  visible: true
});

export const autoSuggestOptionByText = (textTemplate: string): SelectorSpec => ({
  selector: 'li[role="option"]',
  text: { includes: textTemplate, caseInsensitive: true },
  visible: true
});
