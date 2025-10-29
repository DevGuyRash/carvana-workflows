import type { PageDefinition } from '@cv/core';
import {
  OracleExpandInvoiceEnsureWorkflow,
  OracleExpandInvoicePerformWorkflow,
  OracleExpandInvoiceSearchWorkflow
} from '../workflows/oracle-expand-invoice-search';
import { OracleInvoiceCreatorWorkflow } from '../workflows/oracle-invoice-creator';
import {
  OracleInvoiceValidationAlertWorkflow,
  OracleInvoiceValidationVerifyWorkflow
} from '../workflows/oracle-invoice-validation-alert';

export const OracleMainPage: PageDefinition = {
  id: 'oracle.main',
  label: 'Oracle Cloud',
  detector: { exists: { selector: 'html' } },
  workflows: [
    OracleExpandInvoiceSearchWorkflow,
    OracleExpandInvoicePerformWorkflow,
    OracleExpandInvoiceEnsureWorkflow,
    OracleInvoiceValidationAlertWorkflow,
    OracleInvoiceValidationVerifyWorkflow,
    OracleInvoiceCreatorWorkflow
  ]
};
