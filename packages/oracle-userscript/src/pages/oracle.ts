import type { PageDefinition } from '@cv/core';
import {
  OracleExpandInvoiceEnsureWorkflow,
  OracleExpandInvoicePerformWorkflow,
  OracleExpandInvoiceSearchWorkflow
} from '../workflows/oracle-expand-invoice-search';

export const OracleMainPage: PageDefinition = {
  id: 'oracle.main',
  label: 'Oracle Cloud',
  detector: { exists: { selector: 'html' } },
  workflows: [
    OracleExpandInvoiceSearchWorkflow,
    OracleExpandInvoicePerformWorkflow,
    OracleExpandInvoiceEnsureWorkflow
  ]
};
