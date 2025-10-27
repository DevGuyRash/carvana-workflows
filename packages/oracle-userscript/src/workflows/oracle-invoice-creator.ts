import type { WorkflowDefinition } from '@cv/core';
import {
  autoSuggestOptionByText,
  dropdownCellByText,
  inputByLabel,
  lovButtonByLabel,
  textareaByLabel
} from '../shared/field-selectors';

const BUSINESS_UNIT_LABEL = 'Business Unit';
const SUPPLIER_LABEL = 'Supplier';
const SUPPLIER_SITE_LABEL = 'Supplier Site';
const INVOICE_GROUP_LABEL = 'Invoice Group';
const AMOUNT_LABEL = 'Amount';
const NUMBER_LABEL = 'Number';
const DESCRIPTION_LABEL = 'Description';

const businessUnitInput = inputByLabel(BUSINESS_UNIT_LABEL);
const supplierInput = inputByLabel(SUPPLIER_LABEL);
const supplierSiteInput = inputByLabel(SUPPLIER_SITE_LABEL);
const invoiceGroupInput = inputByLabel(INVOICE_GROUP_LABEL);
const amountInput = {
  selector: 'input[aria-label="Amount"]',
  visible: true
};
const numberInput = inputByLabel(NUMBER_LABEL);
const descriptionTextarea = textareaByLabel(DESCRIPTION_LABEL);

export const OracleInvoiceCreatorWorkflow: WorkflowDefinition = {
  id: 'oracle.invoice.create',
  label: 'Oracle: Invoice Creator (Header)',
  description: 'Captures invoice header data and fills the Oracle form.',
  steps: [
    {
      kind: 'captureData',
      id: 'invoiceHeader',
      prompt: [
        'Enter invoice header values as key=value (one per line).',
        'Required keys: Business Unit, Supplier, Supplier Site, Invoice Group, Amount, Number, Description.',
        'Optional keys: Supplier Search (type text if different from Supplier).',
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
        { pattern: 'business\\s*unit\\s*[:=]\\s*([^\\n]+)', into: 'businessUnit', flags: 'i' },
        { pattern: 'supplier\\s*[:=]\\s*([^\\n]+)', into: 'supplier', flags: 'i' },
        { pattern: 'supplier\\s*site\\s*[:=]\\s*([^\\n]+)', into: 'supplierSite', flags: 'i' },
        { pattern: 'invoice\\s*group\\s*[:=]\\s*([^\\n]+)', into: 'invoiceGroup', flags: 'i' },
        { pattern: 'amount\\s*[:=]\\s*([^\\n]+)', into: 'amountRaw', flags: 'i' },
        { pattern: 'amount\\s*[:=]\\s*[^0-9]*([0-9.,]+)', into: 'amountNumeric', flags: 'i', group: 1 },
        { pattern: '\\bnumber\\b\\s*[:=]\\s*([^\\n]+)', into: 'invoiceNumber', flags: 'i' },
        { pattern: 'description\\s*[:=]\\s*([^\\n]+)', into: 'description', flags: 'i' }
      ]
    },
    {
      kind: 'waitFor',
      target: lovButtonByLabel(BUSINESS_UNIT_LABEL),
      wait: { timeoutMs: 20000, visibleOnly: true }
    },
    {
      kind: 'click',
      target: lovButtonByLabel(BUSINESS_UNIT_LABEL),
      postWaitFor: {
        ...businessUnitInput,
        attribute: { 'aria-expanded': 'true' }
      },
      postWaitTimeoutMs: 15000,
      postWaitPollMs: 400
    },
    {
      kind: 'waitFor',
      target: dropdownCellByText('{{vars.businessUnit}}'),
      wait: { timeoutMs: 15000, visibleOnly: true }
    },
    {
      kind: 'click',
      target: dropdownCellByText('{{vars.businessUnit}}')
    },
    {
      kind: 'waitFor',
      target: {
        ...businessUnitInput,
        attribute: { value: { includes: '{{vars.businessUnit}}', caseInsensitive: true } }
      },
      wait: { timeoutMs: 15000, visibleOnly: true }
    },
    {
      kind: 'waitFor',
      target: {
        ...businessUnitInput,
        attribute: { 'aria-expanded': 'false' }
      },
      wait: { timeoutMs: 10000, visibleOnly: true }
    },
    {
      kind: 'delay',
      ms: 650
    },
    {
      kind: 'click',
      target: supplierInput
    },
    {
      kind: 'type',
      target: supplierInput,
      text: '{{vars.supplier}}',
      clearFirst: true
    },
    {
      kind: 'waitFor',
      target: autoSuggestOptionByText('{{vars.supplier}}'),
      wait: { timeoutMs: 15000, visibleOnly: true }
    },
    {
      kind: 'click',
      target: autoSuggestOptionByText('{{vars.supplier}}')
    },
    {
      kind: 'waitFor',
      target: {
        ...supplierInput,
        attribute: { value: { includes: '{{vars.supplier}}', caseInsensitive: true } }
      },
      wait: { timeoutMs: 15000, visibleOnly: true }
    },
    {
      kind: 'delay',
      ms: 650
    },
    {
      kind: 'click',
      target: supplierSiteInput
    },
    {
      kind: 'type',
      target: supplierSiteInput,
      text: '{{vars.supplierSite}}',
      clearFirst: true
    },
    {
      kind: 'waitFor',
      target: autoSuggestOptionByText('{{vars.supplierSite}}'),
      wait: { timeoutMs: 15000, visibleOnly: true }
    },
    {
      kind: 'click',
      target: autoSuggestOptionByText('{{vars.supplierSite}}')
    },
    {
      kind: 'waitFor',
      target: {
        ...supplierSiteInput,
        attribute: { value: { includes: '{{vars.supplierSite}}', caseInsensitive: true } }
      },
      wait: { timeoutMs: 15000, visibleOnly: true }
    },
    {
      kind: 'delay',
      ms: 650
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
      ms: 650
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
      ms: 650
    },
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
      ms: 650
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
