import { findAll, findOne, type SelectorSpec, type WorkflowDefinition, type WorkflowExecuteContext } from '@cv/core';
import { dropdownCellByText } from '../shared/field-selectors';

const FIELD_DELAY_MS = 650;
const BUSINESS_UNIT_LABEL = 'Business Unit';
const SUPPLIER_LABEL = 'Supplier';
const SUPPLIER_NUMBER_LABEL = 'Supplier Number';
const SUPPLIER_SITE_LABEL = 'Supplier Site';
const INVOICE_GROUP_LABEL = 'Invoice Group';
const AMOUNT_LABEL = 'Amount';
const NUMBER_LABEL = 'Number';
const DESCRIPTION_LABEL = 'Description';

const isVisible = (el: HTMLElement | null) => {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeLabelText = (value: string) =>
  normalizeText(value)
    .replace(/\*/g, '')
    .replace(/\s*:\s*$/, '')
    .trim();

const findInlineListbox = (input: HTMLElement | null) => {
  if (input) {
    const combo = input.closest('[role="combobox"]') as HTMLElement | null;
    const nested = combo?.querySelector('[role="listbox"]') as HTMLElement | null;
    if (nested && isVisible(nested)) return nested;
  }
  const listboxes = Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"]')).filter(isVisible);
  if (!listboxes.length) return null;
  if (!input) return listboxes[0];
  const anchor = input.getBoundingClientRect();
  listboxes.sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    return Math.abs(aRect.top - anchor.bottom) - Math.abs(bRect.top - anchor.bottom);
  });
  return listboxes[0];
};

const listboxHasNoResults = (listbox: HTMLElement) => /no results/i.test(listbox.textContent || '');

const firstListboxOption = (listbox: HTMLElement) =>
  Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]')).find(option => {
    const text = normalizeText(option.textContent || '');
    if (!text) return false;
    if (/^more\.\.\.$/i.test(text)) return false;
    if (/^(loading|searching)\b/i.test(text)) return false;
    if (/no results/i.test(text)) return false;
    return true;
  }) || null;

const popupHasNoResults = (popup: HTMLElement) => /no results|no rows/i.test(popup.textContent || '');

const getAutosuggestPopup = (input: HTMLInputElement) => {
  const owns = input.getAttribute('aria-owns');
  if (!owns) return null;
  const popup = document.getElementById(owns) as HTMLElement | null;
  if (popup && isVisible(popup)) return popup;
  return null;
};

const firstPopupOption = (popup: HTMLElement) => {
  const candidates = [
    ...Array.from(popup.querySelectorAll<HTMLElement>('[role="option"]')),
    ...Array.from(popup.querySelectorAll<HTMLElement>('tr')),
    ...Array.from(popup.querySelectorAll<HTMLElement>('li'))
  ];
  return (
    candidates.find(option => {
      const text = normalizeText(option.textContent || '');
      if (!text) return false;
      if (/^more\.\.\.$/i.test(text)) return false;
      if (/^(loading|searching)\b/i.test(text)) return false;
      if (/no results|no rows/i.test(text)) return false;
      return true;
    }) || null
  );
};

const triggerInlineListbox = (input: HTMLInputElement) => {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));
};

const closeInlineListbox = (input: HTMLInputElement) => {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
};

const getDropdownPopupState = (input: HTMLInputElement) => {
  const baseId = input.id.replace(/::content$/, '');
  const popupContent = document.getElementById(`${baseId}::dropdownPopup::content`) as HTMLElement | null;
  const dataW = document.getElementById(`${baseId}::dropdownPopup::dropDownContent::dataW`) as HTMLElement | null;
  const searchLink = document.getElementById(`${baseId}::dropdownPopup::popupsearch`) as HTMLElement | null;
  const visible =
    (popupContent && isVisible(popupContent)) ||
    (dataW && isVisible(dataW)) ||
    (searchLink && isVisible(searchLink));
  return { popupContent, dataW, searchLink, visible };
};

const openLovPopup = async (
  lovButton: HTMLElement,
  popupId: string,
  popupContainerId: string,
  waitFor: <T>(fn: () => T | null, timeoutMs?: number, pollMs?: number) => Promise<T | null>
) => {
  const findPopup = () => {
    const direct =
      (document.getElementById(popupId) as HTMLElement | null) ||
      (document.getElementById(popupContainerId) as HTMLElement | null);
    if (isVisible(direct)) return direct;
    const textMatch = Array.from(document.querySelectorAll<HTMLElement>('div')).find(el => {
      if (!isVisible(el)) return false;
      return /search and select:/i.test(el.textContent || '');
    });
    return textMatch || null;
  };

  lovButton.click();
  let popup = await waitFor(findPopup, 8000, 250);
  if (popup) return popup;

  lovButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  lovButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  lovButton.click();
  popup = await waitFor(findPopup, 8000, 250);
  return popup;
};

const getPopupSearchRoot = (popup: HTMLElement) => {
  if (popup.querySelector('input, button, select, textarea')) return popup;
  const iframe = popup.querySelector('iframe') as HTMLIFrameElement | null;
  const doc = iframe?.contentDocument || null;
  if (doc && doc.querySelector('input, button, select, textarea')) return doc;
  return popup;
};

const getPopupResultRoots = (popup: HTMLElement) => {
  const roots: Array<HTMLElement | Document> = [popup];
  const iframe = popup.querySelector('iframe') as HTMLIFrameElement | null;
  const doc = iframe?.contentDocument || null;
  if (doc) roots.push(doc);
  return roots;
};

const findLabelByText = (labels: HTMLLabelElement[], labelText: string) => {
  const target = normalizeLabelText(labelText).toLowerCase();
  const normalized = labels.map(label => ({
    label,
    text: normalizeLabelText(label.textContent || '').toLowerCase(),
    hasFor: Boolean(label.getAttribute('for'))
  }));
  const pick = (matches: typeof normalized) =>
    matches.find(entry => entry.hasFor)?.label || matches[0]?.label || null;
  const exact = normalized.filter(entry => entry.text === target);
  if (exact.length) return pick(exact);
  const starts = normalized.filter(entry => entry.text.startsWith(target));
  if (starts.length) return pick(starts);
  const includes = normalized.filter(entry => entry.text.includes(target));
  if (includes.length) return pick(includes);
  return null;
};

const getLabelValue = (labelText: string) => {
  const label = findLabelByText(Array.from(document.querySelectorAll('label')), labelText);
  if (!label) return '';
  const forId = label.getAttribute('for');
  const el = forId ? document.getElementById(forId) : null;
  if (!el) return '';
  if ('value' in el) {
    return String((el as HTMLInputElement).value || '').trim();
  }
  return normalizeText(el.textContent || '');
};

const getLabelRowValue = (labelText: string) => {
  const label = findLabelByText(Array.from(document.querySelectorAll('label')), labelText);
  if (!label) return '';
  const forId = label.getAttribute('for');
  const byId = forId ? document.getElementById(forId) : null;
  if (byId && 'value' in byId) {
    return String((byId as HTMLInputElement).value || '').trim();
  }

  const row = label.closest('tr');
  if (!row) return '';
  const rowText = normalizeText(row.textContent || '');
  const labelTextNormalized = normalizeLabelText(labelText);
  if (!rowText) return '';
  const remainder = normalizeText(rowText.replace(labelTextNormalized, ''));
  return remainder;
};

const getSupplierNumberValue = (scope?: Element | null) => {
  const root = scope || document;
  const label = findLabelByText(Array.from(root.querySelectorAll('label')), SUPPLIER_NUMBER_LABEL);
  if (label) {
    const forId = label.getAttribute('for');
    const byId = forId ? document.getElementById(forId) : null;
    if (byId && 'value' in byId) {
      const value = String((byId as HTMLInputElement).value || '').trim();
      if (value) return value;
    }
    const row = label.closest('tr');
    const rowText = normalizeText(row?.textContent || '');
    const match = rowText.match(/supplier number\\s*([^\\s]+)/i);
    if (match?.[1]) return match[1];
  }

  const labeled = Array.from(root.querySelectorAll<HTMLElement>('[aria-label], [data-afr-title]')).find(el => {
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const afr = (el.getAttribute('data-afr-title') || '').toLowerCase();
    return aria.includes('supplier number') || afr.includes('supplier number');
  });
  if (labeled) {
    const value = normalizeText(labeled.textContent || '');
    const match = value.match(/supplier number\\s*([^\\s]+)/i);
    if (match?.[1]) return match[1];
    if (value) return value;
  }

  const text = normalizeText(root.textContent || '');
  const match = text.match(/supplier number\\s*([^\\s]+)/i);
  return match?.[1] || '';
};

const waitForSupplierNumber = async (
  waitFor: <T>(fn: () => T | null, timeoutMs?: number, pollMs?: number) => Promise<T | null>,
  timeoutMs = 12000,
  scope?: Element | null
) => {
  const result = await waitFor(() => {
    const value = getSupplierNumberValue(scope);
    return value ? value : null;
  }, timeoutMs, 300);
  return Boolean(result);
};

const attemptInlineSelection = async (
  ctx: { log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void },
  input: HTMLInputElement,
  text: string,
  waitFor: <T>(fn: () => T | null, timeoutMs?: number, pollMs?: number) => Promise<T | null>,
  label: string,
  matchText: string,
  blur: () => void
) => {
  await typeWithKeyboardEvents(input, text);
  triggerInlineListbox(input);

  let listbox = await waitFor(() => findInlineListbox(input), 8000, 150);
  if (!listbox) {
    triggerInlineListbox(input);
    listbox = await waitFor(() => findInlineListbox(input), 4000, 150);
  }

  if (listbox) {
    const option = await waitFor(() => firstListboxOption(listbox), 8000, 150);
    if (option) {
      const desired = normalizeText(matchText).toLowerCase();
      const options = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'));
      const match =
        options.find(opt => normalizeText(opt.textContent || '').toLowerCase().includes(desired)) || option;
      match.click();
      await waitFor(() => !findInlineListbox(input), 5000, 150);
      blur();
      await new Promise(resolve => setTimeout(resolve, FIELD_DELAY_MS));
      return true;
    }

    if (listboxHasNoResults(listbox)) {
      ctx.log(`${label} inline search returned no results; falling back to LOV.`, 'warn');
    } else {
      ctx.log(`${label} inline listbox had no selectable options; falling back to LOV.`, 'warn');
    }
    closeInlineListbox(input);
    blur();
    await new Promise(resolve => setTimeout(resolve, FIELD_DELAY_MS));
  }

  const popup = await waitFor(() => getAutosuggestPopup(input), 2500, 150);
  if (popup) {
    const option = await waitFor(() => firstPopupOption(popup), 6000, 150);
    if (option) {
      option.click();
      await waitFor(() => !getAutosuggestPopup(input), 4000, 150);
      blur();
      await new Promise(resolve => setTimeout(resolve, FIELD_DELAY_MS));
      return true;
    }
    if (popupHasNoResults(popup)) {
      ctx.log(`${label} autosuggest returned no results; falling back to LOV.`, 'warn');
    } else {
      ctx.log(`${label} autosuggest had no selectable options; falling back to LOV.`, 'warn');
    }
  } else if (!listbox) {
    ctx.log(`${label} inline listbox did not appear; falling back to LOV.`, 'warn');
  }

  const dropdown = getDropdownPopupState(input);
  if (dropdown.visible) {
    const dataText = normalizeText(dropdown.dataW?.textContent || '');
    if (dataText && /no results/i.test(dataText)) {
      ctx.log(`${label} inline search returned no results; falling back to LOV.`, 'warn');
      return false;
    }

    const rows = dropdown.dataW ? Array.from(dropdown.dataW.querySelectorAll('tr')) : [];
    const desired = normalizeText(matchText).toLowerCase();
    const rowMatch = rows.find(row => normalizeText(row.textContent || '').toLowerCase().includes(desired));
    const firstRow = rows.find(row => {
      const text = normalizeText(row.textContent || '');
      return text && !/no results/i.test(text);
    });
    const selectedRow = rowMatch || firstRow;
    if (selectedRow) {
      (selectedRow as HTMLElement).click();
      blur();
      await new Promise(resolve => setTimeout(resolve, FIELD_DELAY_MS));
      return true;
    }

    if (dropdown.searchLink && isVisible(dropdown.searchLink)) {
      dropdown.searchLink.click();
    }
  }
  return false;
};

const typeWithKeyboardEvents = async (
  input: HTMLInputElement,
  text: string,
  delayMs = 60
) => {
  input.focus();
  input.value = '';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  for (const ch of text) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: ch, bubbles: true }));
    input.value = `${input.value ?? ''}${ch}`;
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const invoiceHeaderScope: SelectorSpec = {
  selector: 'div[id$=":sh1"]',
  text: { includes: 'Invoice Header', caseInsensitive: true },
  visible: true
};

const resolvedField = (key: string): SelectorSpec => ({
  id: `{{vars.invoiceFieldIds.${key}}}`,
  visible: true
});

const businessUnitInput = resolvedField('businessUnit');
const supplierInput = resolvedField('supplier');
const supplierSiteInput = resolvedField('supplierSite');
const invoiceGroupInput = resolvedField('invoiceGroup');
const amountInput = resolvedField('amount');
const numberInput = resolvedField('number');
const descriptionTextarea = resolvedField('description');
const businessUnitLovButton = resolvedField('businessUnitLov');
const supplierLovButton = resolvedField('supplierLov');
const supplierSiteLovButton = resolvedField('supplierSiteLov');
const baseSelectorChecks: Array<{ label: string; spec: SelectorSpec }> = [
  { label: 'Invoice Header section', spec: invoiceHeaderScope },
  { label: BUSINESS_UNIT_LABEL, spec: businessUnitInput },
  { label: `${BUSINESS_UNIT_LABEL} Search`, spec: businessUnitLovButton },
  { label: SUPPLIER_LABEL, spec: supplierInput },
  { label: `${SUPPLIER_LABEL} Search`, spec: supplierLovButton },
  { label: SUPPLIER_SITE_LABEL, spec: supplierSiteInput },
  { label: `${SUPPLIER_SITE_LABEL} Search`, spec: supplierSiteLovButton },
  { label: INVOICE_GROUP_LABEL, spec: invoiceGroupInput },
  { label: AMOUNT_LABEL, spec: amountInput },
  { label: DESCRIPTION_LABEL, spec: descriptionTextarea }
];

const resolveInvoiceHeaderIds = (scope: Element) => {
  const labels = Array.from(scope.querySelectorAll('label'));
  const findLabel = (name: string) => findLabelByText(labels, name);
  const resolveByLabel = (name: string) => {
    const label = findLabel(name);
    const forId = label?.getAttribute('for');
    if (forId) return forId;
    const row = label?.closest('tr');
    const input = row?.querySelector('input, textarea') as HTMLElement | null;
    return input?.id || null;
  };
  const businessUnitId = resolveByLabel(BUSINESS_UNIT_LABEL);
  const supplierId = resolveByLabel(SUPPLIER_LABEL);
  const supplierSiteId = resolveByLabel(SUPPLIER_SITE_LABEL);
  const invoiceGroupId = resolveByLabel(INVOICE_GROUP_LABEL);
  const amountId = resolveByLabel(AMOUNT_LABEL);
  const numberId = resolveByLabel(NUMBER_LABEL);
  const descriptionId = resolveByLabel(DESCRIPTION_LABEL);

  const businessUnitInput = businessUnitId ? document.getElementById(businessUnitId) : null;
  const businessUnitRow = businessUnitInput?.closest('tr') || null;
  const businessUnitLov = businessUnitRow?.querySelector('[title^="Search:"], [aria-label^="Search:"]') as HTMLElement | null;
  const supplierInput = supplierId ? document.getElementById(supplierId) : null;
  const supplierRow = supplierInput?.closest('tr') || null;
  const supplierLov = supplierRow?.querySelector('[title^="Search:"], [aria-label^="Search:"]') as HTMLElement | null;
  const supplierSiteInput = supplierSiteId ? document.getElementById(supplierSiteId) : null;
  const supplierSiteRow = supplierSiteInput?.closest('tr') || null;
  const supplierSiteLov = supplierSiteRow?.querySelector('[title^="Search:"], [aria-label^="Search:"]') as HTMLElement | null;

  return {
    businessUnit: businessUnitId,
    supplier: supplierId,
    supplierSite: supplierSiteId,
    invoiceGroup: invoiceGroupId,
    amount: amountId,
    number: numberId,
    description: descriptionId,
    businessUnitLov: businessUnitLov?.id || null,
    supplierLov: supplierLov?.id || null,
    supplierSiteLov: supplierSiteLov?.id || null
  };
};

const verifyInvoiceHeaderSelectors = () => ({
  kind: 'execute' as const,
  run: (ctx: WorkflowExecuteContext) => {
    const scope = findOne(invoiceHeaderScope, { visibleOnly: true });
    if (!scope) {
      throw new Error('Invoice Header section not found.');
    }

    const skipNumber = ctx.options?.skipInvoiceNumber ?? true;
    const fieldIds = resolveInvoiceHeaderIds(scope);
    const required: Array<{ key: keyof typeof fieldIds; label: string }> = [
      { key: 'businessUnit', label: BUSINESS_UNIT_LABEL },
      { key: 'supplier', label: SUPPLIER_LABEL },
      { key: 'supplierLov', label: `${SUPPLIER_LABEL} Search` },
      { key: 'supplierSite', label: SUPPLIER_SITE_LABEL },
      { key: 'invoiceGroup', label: INVOICE_GROUP_LABEL },
      { key: 'amount', label: AMOUNT_LABEL },
      { key: 'description', label: DESCRIPTION_LABEL },
      { key: 'businessUnitLov', label: `${BUSINESS_UNIT_LABEL} Search` }
    ];
    if (!skipNumber) {
      required.push({ key: 'number', label: NUMBER_LABEL });
    }

    const missing: string[] = [];
    for (const entry of required) {
      if (!fieldIds[entry.key]) missing.push(entry.label);
    }
    if (missing.length) {
      throw new Error(`Selector verification failed: missing ${missing.join(', ')}`);
    }

    const requireId = (value: string | null, label: string): string => {
      if (!value) {
        throw new Error(`Selector verification failed: missing ${label}`);
      }
      return value;
    };

    const requiredIds = {
      businessUnit: requireId(fieldIds.businessUnit, BUSINESS_UNIT_LABEL),
      supplier: requireId(fieldIds.supplier, SUPPLIER_LABEL),
      supplierLov: requireId(fieldIds.supplierLov, `${SUPPLIER_LABEL} Search`),
      supplierSite: requireId(fieldIds.supplierSite, SUPPLIER_SITE_LABEL),
      invoiceGroup: requireId(fieldIds.invoiceGroup, INVOICE_GROUP_LABEL),
      amount: requireId(fieldIds.amount, AMOUNT_LABEL),
      description: requireId(fieldIds.description, DESCRIPTION_LABEL),
      businessUnitLov: requireId(fieldIds.businessUnitLov, `${BUSINESS_UNIT_LABEL} Search`),
      number: fieldIds.number ? requireId(fieldIds.number, NUMBER_LABEL) : null,
      supplierSiteLov: fieldIds.supplierSiteLov
    };

    ctx.setVar('invoiceFieldIds', { ...fieldIds, ...requiredIds });

    const checks: Array<{ label: string; spec: SelectorSpec }> = [
      { label: 'Invoice Header section', spec: invoiceHeaderScope },
      { label: BUSINESS_UNIT_LABEL, spec: { id: requiredIds.businessUnit, visible: true } },
      { label: `${BUSINESS_UNIT_LABEL} Search`, spec: { id: requiredIds.businessUnitLov, visible: true } },
      { label: SUPPLIER_LABEL, spec: { id: requiredIds.supplier, visible: true } },
      { label: `${SUPPLIER_LABEL} Search`, spec: { id: requiredIds.supplierLov, visible: true } },
      { label: SUPPLIER_SITE_LABEL, spec: { id: requiredIds.supplierSite, visible: true } },
      { label: INVOICE_GROUP_LABEL, spec: { id: requiredIds.invoiceGroup, visible: true } },
      { label: AMOUNT_LABEL, spec: { id: requiredIds.amount, visible: true } },
      { label: DESCRIPTION_LABEL, spec: { id: requiredIds.description, visible: true } }
    ];
    if (!skipNumber) {
      checks.push({ label: NUMBER_LABEL, spec: { id: requiredIds.number ?? undefined, visible: true } });
    }
    if (requiredIds.supplierSiteLov) {
      checks.push({ label: `${SUPPLIER_SITE_LABEL} Search`, spec: { id: requiredIds.supplierSiteLov, visible: true } });
    } else {
      ctx.log('Supplier Site search icon not found; LOV fallback will be skipped.', 'warn');
    }
    const failures: string[] = [];
    for (const check of checks) {
      const matches = findAll(check.spec, { visibleOnly: true });
      if (matches.length !== 1) {
        failures.push(`${check.label} (${matches.length})`);
      }
    }
    if (failures.length) {
      throw new Error(`Selector verification failed: ${failures.join(', ')}`);
    }

    ctx.log(`Verified ${checks.length} invoice header selectors.`);
    return true;
  }
});

export const OracleInvoiceCreatorWorkflow: WorkflowDefinition = {
  id: 'oracle.invoice.create',
  label: 'Oracle: Invoice Creator (Header)',
  description: 'Captures invoice header data and fills the Oracle form.',
  options: [
    { key: 'skipInvoiceNumber', label: 'Skip Invoice Number', type: 'boolean', default: true }
  ],
  steps: [
    verifyInvoiceHeaderSelectors(),
    {
      kind: 'captureData',
      id: 'invoiceHeader',
      prompt: [
        'Enter invoice header values as key=value (one per line).',
        'Required keys: Business Unit, Supplier, Invoice Group, Amount, Description.',
        'Optional keys: Supplier Site (omit for auto-fill), Number, Supplier Search (type text if different from Supplier).',
        '',
        'Example:',
        '  Business Unit=CARV LLC BU',
        '  Supplier=WA DOL',
        '  Supplier Site=MAIN-PURCH',
        '  Invoice Group=INHOUSE',
        '  Amount=$1,234.56',
        '  Number=INV-123',
        '  Description=Example invoice'
      ].join('\n'),
      rememberKey: 'invoice.header',
      required: true,
      patterns: [
        { pattern: 'business\\s*unit\\s*[:=][ \\t]*([^\\n]+)', into: 'businessUnit', flags: 'i' },
        { pattern: 'supplier\\s*[:=][ \\t]*([^\\n]+)', into: 'supplier', flags: 'i' },
        { pattern: 'supplier\\s*search\\s*[:=][ \\t]*([^\\n]+)', into: 'supplierSearch', flags: 'i' },
        { pattern: 'supplier\\s*site\\s*[:=][ \\t]*([^\\n]+)', into: 'supplierSite', flags: 'i' },
        { pattern: 'invoice\\s*group\\s*[:=][ \\t]*([^\\n]+)', into: 'invoiceGroup', flags: 'i' },
        { pattern: 'amount\\s*[:=][ \\t]*([^\\n]+)', into: 'amountRaw', flags: 'i' },
        { pattern: 'amount\\s*[:=][ \\t]*[^0-9\\n]*([0-9.,]+)', into: 'amountNumeric', flags: 'i', group: 1 },
        { pattern: '\\bnumber\\b\\s*[:=][ \\t]*([^\\n]+)', into: 'invoiceNumber', flags: 'i' },
        { pattern: 'description\\s*[:=][ \\t]*([^\\n]+)', into: 'description', flags: 'i' }
      ]
    },
    {
      kind: 'execute',
      run: async (ctx) => {
        await ctx.runWorkflow('oracle.invoice.create.businessUnit.ensure', { silent: true, shareVars: true });
        return true;
      }
    },
    {
      kind: 'execute',
      run: async (ctx) => {
        await ctx.runWorkflow('oracle.invoice.create.supplier.lov', { silent: true, shareVars: true });
        return true;
      }
    },
    {
      kind: 'execute',
      run: async (ctx) => {
        const supplierSiteRaw = (ctx.getVar<string>('supplierSite') || '').trim();
        const autoFill = !supplierSiteRaw || /^(auto|auto\\s*fill|auto\\s*fills|autofill)$/i.test(supplierSiteRaw);
        if (autoFill) {
          ctx.log('Supplier Site not provided; waiting for auto-fill.');
          await ctx.runWorkflow('oracle.invoice.create.supplierSite.ensure', { silent: true, shareVars: true });
          return true;
        }
        await ctx.runWorkflow('oracle.invoice.create.supplierSite.fill', { silent: true, shareVars: true });
        return true;
      }
    },
    {
      kind: 'delay',
      ms: FIELD_DELAY_MS
    },
    {
      kind: 'click',
      target: invoiceGroupInput
    },
    {
      kind: 'type',
      target: invoiceGroupInput,
      text: '{{vars.invoiceGroup}}',
      clearFirst: true
    },
    {
      kind: 'delay',
      ms: FIELD_DELAY_MS
    },
    {
      kind: 'click',
      target: amountInput
    },
    {
      kind: 'type',
      target: amountInput,
      text: '{{vars.amountNumeric}}',
      clearFirst: true
    },
    {
      kind: 'delay',
      ms: FIELD_DELAY_MS
    },
    {
      kind: 'execute',
      run: async (ctx) => {
        const skipNumber = ctx.options?.skipInvoiceNumber ?? true;
        if (skipNumber) {
          ctx.log('Skipping invoice number fill (skipInvoiceNumber enabled).');
          return true;
        }
        const invoiceNumber = ctx.getVar<string>('invoiceNumber');
        if (!invoiceNumber) {
          ctx.log('Invoice number missing; skipping number field.', 'warn');
          return true;
        }
        await ctx.runWorkflow('oracle.invoice.create.number', { silent: true, shareVars: true });
        return true;
      }
    },
    {
      kind: 'click',
      target: descriptionTextarea
    },
    {
      kind: 'type',
      target: descriptionTextarea,
      text: '{{vars.description}}',
      clearFirst: true
    }
  ]
};

export const OracleInvoiceCreatorBusinessUnitEnsureWorkflow: WorkflowDefinition = {
  id: 'oracle.invoice.create.businessUnit.ensure',
  label: '[internal] Oracle: Invoice Creator (Business Unit Ensure)',
  description: 'Ensures the Business Unit is selected in the invoice header.',
  internal: true,
  steps: [
    {
      kind: 'execute',
      run: async (ctx) => {
        const desired = (ctx.getVar<string>('businessUnit') || '').trim();
        if (!desired) {
          ctx.log('Business Unit missing; skipping selection.', 'warn');
          return true;
        }

        const fieldIds = ctx.getVar<Record<string, string | null>>('invoiceFieldIds') || {};
        let businessUnitId = fieldIds.businessUnit;
        let lovId = fieldIds.businessUnitLov;

        const scope = findOne(invoiceHeaderScope, { visibleOnly: true });
        if (scope && (!businessUnitId || !lovId)) {
          const resolved = resolveInvoiceHeaderIds(scope);
          businessUnitId = businessUnitId || resolved.businessUnit;
          lovId = lovId || resolved.businessUnitLov;
          ctx.setVar('invoiceFieldIds', { ...fieldIds, ...resolved });
        }

        const input = businessUnitId
          ? (document.getElementById(businessUnitId) as HTMLInputElement | null)
          : null;
        if (input && input.value && input.value.toLowerCase().includes(desired.toLowerCase())) {
          return true;
        }

        if (!lovId || !input) {
          if (input) {
            input.focus();
            input.value = desired;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.blur();
            await new Promise(resolve => setTimeout(resolve, FIELD_DELAY_MS));
          }
          ctx.log('Business Unit search icon missing; filled input directly.', 'warn');
          return true;
        }

        const waitFor = async <T>(fn: () => T | null, timeoutMs = 15000, pollMs = 250) => {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            const result = fn();
            if (result) return result;
            await new Promise(resolve => setTimeout(resolve, pollMs));
          }
          return null;
        };

        const lovButton = document.getElementById(lovId) as HTMLElement | null;
        lovButton?.click?.();

        const popup = await waitFor(() => {
          const candidates = Array.from(document.querySelectorAll('div[id$=\"dropdownPopup::content\"]'));
          return candidates.find(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }) as HTMLElement | null;
        }, 10000);

        if (!popup) {
          ctx.log('Business Unit dropdown did not appear.', 'warn');
          return true;
        }

        const normalize = (value: string) => value.replace(/\\s+/g, ' ').trim().toLowerCase();
        const target = normalize(desired);
        const option = Array.from(popup.querySelectorAll('td span')).find(el =>
          normalize(el.textContent || '').includes(target)
        );

        if (!option) {
          ctx.log(`Business Unit option not found: ${desired}`, 'warn');
          return true;
        }

        (option as HTMLElement).click();

        await waitFor(() => {
          const value = (input.value || '').toLowerCase();
          return value.includes(target) ? input : null;
        }, 10000);

        await new Promise(resolve => setTimeout(resolve, FIELD_DELAY_MS));
        return true;
      }
    }
  ]
};

export const OracleInvoiceCreatorSupplierLovWorkflow: WorkflowDefinition = {
  id: 'oracle.invoice.create.supplier.lov',
  label: '[internal] Oracle: Invoice Creator (Supplier LOV)',
  description: 'Selects the supplier using the Search and Select dialog.',
  internal: true,
  steps: [
    {
      kind: 'execute',
      run: async (ctx) => {
        const fieldIds = ctx.getVar<Record<string, string | null>>('invoiceFieldIds') || {};
        let supplierId = fieldIds.supplier;
        let supplierLovId = fieldIds.supplierLov;
        const supplier = (ctx.getVar<string>('supplier') || '').trim();
        const supplierSearch = (ctx.getVar<string>('supplierSearch') || supplier).trim();
        const matchText = (supplier || supplierSearch).trim();

        if (!supplierSearch) {
          ctx.log('Supplier value missing; skipping supplier selection.', 'warn');
          return true;
        }

        const scope = findOne(invoiceHeaderScope, { visibleOnly: true });
        if (scope && (!supplierId || !supplierLovId)) {
          const resolved = resolveInvoiceHeaderIds(scope);
          supplierId = supplierId || resolved.supplier;
          supplierLovId = supplierLovId || resolved.supplierLov;
          ctx.setVar('invoiceFieldIds', { ...fieldIds, ...resolved });
        }

        const supplierInput = supplierId
          ? (document.getElementById(supplierId) as HTMLInputElement | null)
          : null;

        const waitFor = async <T>(fn: () => T | null, timeoutMs = 15000, pollMs = 300) => {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            const result = fn();
            if (result) return result;
            await new Promise(resolve => setTimeout(resolve, pollMs));
          }
          return null;
        };

        const matchTarget = normalizeText(matchText).toLowerCase();
        const blurTargetId = fieldIds.invoiceGroup || fieldIds.amount || fieldIds.description || null;
        const blur = () => {
          if (blurTargetId) {
            const blurTarget = document.getElementById(blurTargetId);
            blurTarget?.click?.();
            return;
          }
          supplierInput?.blur();
        };
        const matches = (value: string) => normalizeText(value).toLowerCase().includes(matchTarget);

        if (supplierInput) {
        const inlineSelected = await attemptInlineSelection(
          ctx,
          supplierInput,
          supplierSearch,
          waitFor,
          SUPPLIER_LABEL,
          matchText,
          blur
        );
        if (inlineSelected) {
          const hasSupplierNumber = await waitForSupplierNumber(waitFor, 12000, scope);
          if (hasSupplierNumber) {
            return true;
          }
          ctx.log('Supplier selected inline but Supplier Number did not populate; falling back to LOV.', 'warn');
        }
        }

        if (!supplierLovId || !supplierId) {
          ctx.log('Supplier search icon missing; unable to open LOV dialog.', 'warn');
          return true;
        }

        const baseId = supplierId.replace(/::content$/, '');
        const popupId = `${baseId}lovPopupId::content`;
        const popupContainerId = `${baseId}lovPopupId::popup-container`;
        const lovButton = document.getElementById(supplierLovId) as HTMLElement | null;
        if (!lovButton) {
          ctx.log('Supplier search icon missing; unable to open LOV dialog.', 'warn');
          return true;
        }

        const popup = await openLovPopup(lovButton, popupId, popupContainerId, waitFor);

        if (!popup) {
          ctx.log('Supplier search dialog did not open.', 'warn');
          return true;
        }

        const popupRoot = getPopupSearchRoot(popup);
        const inputByAria = Array.from(popupRoot.querySelectorAll<HTMLInputElement>('input')).find(el =>
          /supplier/i.test((el.getAttribute('aria-label') || '').trim())
        );
        const labelFor = Array.from(popupRoot.querySelectorAll('label')).find(label =>
          normalizeText(label.textContent || '') === 'Supplier'
        )?.getAttribute('for')?.trim();
        const inputByLabel = labelFor
          ? (popupRoot.querySelector(`#${CSS.escape(labelFor)}`) as HTMLInputElement | null)
          : null;
        const input =
          inputByAria ||
          inputByLabel ||
          (popupRoot.querySelector('input') as HTMLInputElement | null);

        if (!input) {
          ctx.log('Supplier search input not found in dialog.', 'warn');
          return true;
        }

        input.focus();
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.value = supplierSearch;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        const searchButton = Array.from(popupRoot.querySelectorAll('button')).find(
          button => /^search$/i.test((button.textContent || '').trim())
        );
        searchButton?.click?.();

        const row = await waitFor(() => {
          const rows = getPopupResultRoots(popup).flatMap(root =>
            Array.from(root.querySelectorAll('tr'))
          );
          const match = rows.find(candidate => {
            const text = normalizeText(candidate.textContent || '');
            if (!text || /no rows to display/i.test(text)) return false;
            return text.toLowerCase().includes(matchTarget);
          });
          const first = rows.find(candidate => {
            const text = normalizeText(candidate.textContent || '');
            return text && !/no rows to display/i.test(text);
          });
          return match || first || null;
        }, 15000, 300);

        if (!row) {
          ctx.log(`Supplier search returned no rows for "${matchText}".`, 'warn');
          const cancelButton = Array.from(popupRoot.querySelectorAll('button')).find(
            button => /^cancel$/i.test((button.textContent || '').trim())
          );
          cancelButton?.click?.();
          return true;
        }

        row.click();

        const okButton = Array.from(popupRoot.querySelectorAll('button')).find(
          button => /^ok$/i.test((button.textContent || '').trim())
        );
        okButton?.click?.();

        if (supplierInput) {
          await waitFor(() => {
            const value = (supplierInput.value || '').trim();
            return value && value.toLowerCase().includes(matchTarget);
          }, 15000, 300);
          await waitForSupplierNumber(waitFor, 12000, scope);
          blur();
        }

        await new Promise(resolve => setTimeout(resolve, FIELD_DELAY_MS));
        return true;
      }
    }
  ]
};

export const OracleInvoiceCreatorNumberWorkflow: WorkflowDefinition = {
  id: 'oracle.invoice.create.number',
  label: '[internal] Oracle: Invoice Creator (Number)',
  description: 'Fills the invoice number field for the Oracle invoice header.',
  internal: true,
  steps: [
    {
      kind: 'click',
      target: numberInput
    },
    {
      kind: 'type',
      target: numberInput,
      text: '{{vars.invoiceNumber}}',
      clearFirst: true
    },
    {
      kind: 'delay',
      ms: FIELD_DELAY_MS
    }
  ]
};

export const OracleInvoiceCreatorSupplierSiteFillWorkflow: WorkflowDefinition = {
  id: 'oracle.invoice.create.supplierSite.fill',
  label: '[internal] Oracle: Invoice Creator (Supplier Site Fill)',
  description: 'Fills the supplier site field for the Oracle invoice header.',
  internal: true,
  steps: [
    {
      kind: 'execute',
      run: async (ctx) => {
        const supplierSite = (ctx.getVar<string>('supplierSite') || '').trim();
        if (!supplierSite) {
          ctx.log('Supplier Site missing; skipping fill.', 'warn');
          return true;
        }

        const fieldIds = ctx.getVar<Record<string, string | null>>('invoiceFieldIds') || {};
        const supplierSiteId = fieldIds.supplierSite;
        const supplierSiteLovId = fieldIds.supplierSiteLov;
        if (!supplierSiteId) {
          ctx.log('Supplier Site id missing; unable to fill.', 'warn');
          return true;
        }

        const scope = findOne(invoiceHeaderScope, { visibleOnly: true });
        const input = document.getElementById(supplierSiteId) as HTMLInputElement | null;
        if (!input) {
          ctx.log('Supplier Site input not found; unable to fill.', 'warn');
          return true;
        }

        const waitFor = async <T>(fn: () => T | null, timeoutMs = 2500, pollMs = 200) => {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            const result = fn();
            if (result) return result;
            await new Promise(resolve => setTimeout(resolve, pollMs));
          }
          return null;
        };

        const target = normalizeText(supplierSite).toLowerCase();
        const matches = (value: string) => normalizeText(value).toLowerCase().includes(target);
        const blurTargetId = fieldIds.invoiceGroup || fieldIds.amount || fieldIds.description || null;
        const blur = () => {
          if (blurTargetId) {
            const blurTarget = document.getElementById(blurTargetId);
            blurTarget?.click?.();
            return;
          }
          input.blur();
        };

        const hasSupplierNumber = await waitForSupplierNumber(waitFor, 12000, scope);
        if (!hasSupplierNumber) {
          ctx.log('Supplier Number missing; supplier not validated. Skipping Supplier Site fill.', 'warn');
          return true;
        }

        const inlineSelected = await attemptInlineSelection(
          ctx,
          input,
          supplierSite,
          waitFor,
          SUPPLIER_SITE_LABEL,
          supplierSite,
          blur
        );
        if (inlineSelected) return true;

        if (!supplierSiteLovId) {
          ctx.log('Supplier Site search icon missing; keeping typed value.', 'warn');
          return true;
        }

        const baseId = supplierSiteId.replace(/::content$/, '');
        const popupId = `${baseId}lovPopupId::content`;
        const popupContainerId = `${baseId}lovPopupId::popup-container`;
        const lovButton = document.getElementById(supplierSiteLovId) as HTMLElement | null;
        const popup = lovButton
          ? await openLovPopup(lovButton, popupId, popupContainerId, waitFor)
          : null;

        if (!popup) {
          ctx.log('Supplier Site search dialog did not open.', 'warn');
          return true;
        }

        const popupRoot = getPopupSearchRoot(popup);
        const inputByAria = Array.from(popupRoot.querySelectorAll<HTMLInputElement>('input')).find(el =>
          /site/i.test((el.getAttribute('aria-label') || '').trim())
        );
        const labelFor = Array.from(popupRoot.querySelectorAll('label')).find(label =>
          /site/i.test(normalizeText(label.textContent || ''))
        )?.getAttribute('for')?.trim();
        const inputByLabel = labelFor
          ? (popupRoot.querySelector(`#${CSS.escape(labelFor)}`) as HTMLInputElement | null)
          : null;
        const dialogInput =
          inputByAria ||
          inputByLabel ||
          (popupRoot.querySelector('input') as HTMLInputElement | null);

        if (!dialogInput) {
          ctx.log('Supplier Site search input not found in dialog.', 'warn');
          return true;
        }

        dialogInput.focus();
        dialogInput.value = '';
        dialogInput.dispatchEvent(new Event('input', { bubbles: true }));
        dialogInput.dispatchEvent(new Event('change', { bubbles: true }));
        dialogInput.value = supplierSite;
        dialogInput.dispatchEvent(new Event('input', { bubbles: true }));
        dialogInput.dispatchEvent(new Event('change', { bubbles: true }));

        const searchButton = Array.from(popupRoot.querySelectorAll('button')).find(
          button => /^search$/i.test((button.textContent || '').trim())
        );
        searchButton?.click?.();

        const row = await waitFor(() => {
          const rows = getPopupResultRoots(popup).flatMap(root =>
            Array.from(root.querySelectorAll('tr'))
          );
          const match = rows.find(candidate => {
            const text = normalizeText(candidate.textContent || '');
            if (!text || /no rows to display/i.test(text)) return false;
            return text.toLowerCase().includes(target);
          });
          const first = rows.find(candidate => {
            const text = normalizeText(candidate.textContent || '');
            return text && !/no rows to display/i.test(text);
          });
          return match || first || null;
        }, 15000, 300);

        if (!row) {
          ctx.log(`Supplier Site search returned no rows for "${supplierSite}".`, 'warn');
          const cancelButton = Array.from(popupRoot.querySelectorAll('button')).find(
            button => /^cancel$/i.test((button.textContent || '').trim())
          );
          cancelButton?.click?.();
          return true;
        }

        row.click();
        const okButton = Array.from(popupRoot.querySelectorAll('button')).find(
          button => /^ok$/i.test((button.textContent || '').trim())
        );
        okButton?.click?.();

        await waitFor(() => (matches(input.value || '') ? input : null), 15000, 300);
        blur();
        await new Promise(resolve => setTimeout(resolve, FIELD_DELAY_MS));
        return true;
      }
    }
  ]
};

export const OracleInvoiceCreatorSupplierSiteEnsureWorkflow: WorkflowDefinition = {
  id: 'oracle.invoice.create.supplierSite.ensure',
  label: '[internal] Oracle: Invoice Creator (Supplier Site Ensure)',
  description: 'Waits for the supplier site field to auto-fill in the Oracle invoice header.',
  internal: true,
  steps: [
    {
      kind: 'execute',
      run: async (ctx) => {
        const fieldIds = ctx.getVar<Record<string, string | null>>('invoiceFieldIds') || {};
        const supplierSiteId = fieldIds.supplierSite;
        if (!supplierSiteId) {
          ctx.log('Supplier Site id missing; skipping auto-fill wait.', 'warn');
          return true;
        }

        const blurTargetId = fieldIds.invoiceGroup || fieldIds.amount || fieldIds.description || null;
        const supplierSiteInput = document.getElementById(supplierSiteId) as HTMLInputElement | null;
        supplierSiteInput?.click?.();
        if (blurTargetId) {
          const blurTarget = document.getElementById(blurTargetId);
          blurTarget?.click?.();
        }

        const timeoutMs = 30000;
        const pollMs = 500;
        const start = Date.now();
        let value = '';
        while (Date.now() - start < timeoutMs) {
          const el = document.getElementById(supplierSiteId) as HTMLInputElement | null;
          value = (el?.value || '').trim();
          if (value) break;
          await new Promise(resolve => setTimeout(resolve, pollMs));
        }

        if (!value) {
          ctx.log('Supplier Site did not auto-fill within 30s.', 'warn');
          return true;
        }

        ctx.log(`Supplier Site auto-filled: ${value}`);
        if (blurTargetId) {
          const blurTarget = document.getElementById(blurTargetId);
          blurTarget?.click?.();
        }
        await new Promise(resolve => setTimeout(resolve, FIELD_DELAY_MS));
        return true;
      }
    }
  ]
};
