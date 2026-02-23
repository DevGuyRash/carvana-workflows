use cv_ext_contract::{Action, Site, WorkflowDefinition};

fn wf(id: &str, label: &str, command: &str, internal: bool) -> WorkflowDefinition {
    WorkflowDefinition {
        id: id.to_string(),
        label: label.to_string(),
        description: "Oracle workflow executed by Rust extension runtime.".to_string(),
        site: Site::Oracle,
        actions: vec![Action::Execute {
            command: command.to_string(),
        }],
        internal,
    }
}

pub fn oracle_workflows() -> Vec<WorkflowDefinition> {
    vec![
        wf("oracle.search.invoice.expand", "Oracle: Expand Search Invoice", "oracle.expand_invoice", false),
        wf("oracle.search.invoice.expand.perform", "Oracle: Expand Invoice Perform", "oracle.expand_invoice.perform", true),
        wf("oracle.search.invoice.expand.ensure", "Oracle: Expand Invoice Ensure", "oracle.expand_invoice.ensure", true),
        wf("oracle.invoice.validation.alert", "Oracle: Invoice Validation Alert", "oracle.invoice.validation.alert", false),
        wf("oracle.invoice.validation.verify", "Oracle: Invoice Validation Verify", "oracle.invoice.validation.verify", true),
        wf("oracle.invoice.create", "Oracle: Invoice Create", "oracle.invoice.create", false),
        wf("oracle.invoice.create.businessUnit.ensure", "Oracle: Invoice Business Unit Ensure", "oracle.invoice.create.business_unit.ensure", true),
        wf("oracle.invoice.create.supplier.lov", "Oracle: Invoice Supplier LOV", "oracle.invoice.create.supplier.lov", true),
        wf("oracle.invoice.create.supplierSite.fill", "Oracle: Invoice Supplier Site Fill", "oracle.invoice.create.supplier_site.fill", true),
        wf("oracle.invoice.create.supplierSite.ensure", "Oracle: Invoice Supplier Site Ensure", "oracle.invoice.create.supplier_site.ensure", true),
        wf("oracle.invoice.create.number", "Oracle: Invoice Number", "oracle.invoice.create.number", true),
    ]
}
