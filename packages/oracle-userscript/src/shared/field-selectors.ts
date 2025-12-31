import type { SelectorSpec } from '@cv/core';

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rowByLabel = (label: string, scope?: SelectorSpec): SelectorSpec => ({
  selector: 'tr',
  text: { includes: label, caseInsensitive: true },
  visible: true,
  ...(scope ? { within: scope } : {})
});

export const lovButtonByLabel = (label: string, scope?: SelectorSpec): SelectorSpec => ({
  selector: '[title],[aria-label]',
  within: rowByLabel(label, scope),
  visible: true,
  or: [
    { attribute: { title: { regex: `Search:\\s*${escapeForRegex(label)}`, flags: 'i' } } },
    { attribute: { 'aria-label': { regex: `Search:\\s*${escapeForRegex(label)}`, flags: 'i' } } }
  ]
});

export const inputByLabel = (label: string, scope?: SelectorSpec): SelectorSpec => ({
  selector: 'input',
  within: rowByLabel(label, scope),
  visible: true
});

export const textareaByLabel = (label: string, scope?: SelectorSpec): SelectorSpec => ({
  selector: 'textarea',
  within: rowByLabel(label, scope),
  visible: true
});

export const dropdownCellByText = (textTemplate: string, scope?: SelectorSpec): SelectorSpec => ({
  selector: 'td span',
  text: { includes: textTemplate, caseInsensitive: true },
  visible: true,
  within: scope ?? { selector: 'div[id$="dropdownPopup::content"]', visible: true }
});

export const autoSuggestOptionByText = (textTemplate: string, scope?: SelectorSpec): SelectorSpec => ({
  selector: 'li[role="option"]',
  text: { includes: textTemplate, caseInsensitive: true },
  visible: true,
  ...(scope ? { within: scope } : {})
});
