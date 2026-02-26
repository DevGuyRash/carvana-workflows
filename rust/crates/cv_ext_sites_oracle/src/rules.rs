use cv_ext_contract::{Action, RuleCategory, RuleDefinition, RuleTrigger, Site};

fn rule(
    id: &str,
    label: &str,
    command: &str,
    internal: bool,
    category: RuleCategory,
    trigger: RuleTrigger,
) -> RuleDefinition {
    RuleDefinition {
        id: id.to_string(),
        label: label.to_string(),
        description: "Oracle workflow executed by Rust extension runtime.".to_string(),
        site: Site::Oracle,
        enabled: true,
        url_pattern: None,
        trigger,
        actions: vec![Action::Execute {
            command: command.to_string(),
        }],
        priority: if internal { 200 } else { 100 },
        category,
        builtin: true,
    }
}

pub fn oracle_rules() -> Vec<RuleDefinition> {
    vec![
        rule(
            "oracle.search.invoice.expand",
            "Oracle: Expand Search Invoice",
            "oracle.expand_invoice",
            false,
            RuleCategory::Navigation,
            RuleTrigger::OnPageLoad,
        ),
        rule(
            "oracle.search.invoice.expand.perform",
            "Oracle: Expand Invoice Perform",
            "oracle.expand_invoice.perform",
            true,
            RuleCategory::Navigation,
            RuleTrigger::OnDemand,
        ),
        rule(
            "oracle.search.invoice.expand.ensure",
            "Oracle: Expand Invoice Ensure",
            "oracle.expand_invoice.ensure",
            true,
            RuleCategory::Navigation,
            RuleTrigger::OnDemand,
        ),
        rule(
            "oracle.invoice.validation.alert",
            "Oracle: Invoice Validation Alert",
            "oracle.invoice.validation.alert",
            false,
            RuleCategory::Validation,
            RuleTrigger::OnPageLoad,
        ),
        rule(
            "oracle.invoice.validation.verify",
            "Oracle: Invoice Validation Verify",
            "oracle.invoice.validation.verify",
            true,
            RuleCategory::Validation,
            RuleTrigger::OnDemand,
        ),
        rule(
            "oracle.invoice.create",
            "Oracle: Invoice Create",
            "oracle.invoice.create",
            false,
            RuleCategory::FormAutomation,
            RuleTrigger::OnDemand,
        ),
        rule(
            "oracle.invoice.create.businessUnit.ensure",
            "Oracle: Invoice Business Unit Ensure",
            "oracle.invoice.create.business_unit.ensure",
            true,
            RuleCategory::FormAutomation,
            RuleTrigger::OnDemand,
        ),
        rule(
            "oracle.invoice.create.supplier.lov",
            "Oracle: Invoice Supplier LOV",
            "oracle.invoice.create.supplier.lov",
            true,
            RuleCategory::FormAutomation,
            RuleTrigger::OnDemand,
        ),
        rule(
            "oracle.invoice.create.supplierSite.fill",
            "Oracle: Invoice Supplier Site Fill",
            "oracle.invoice.create.supplier_site.fill",
            true,
            RuleCategory::FormAutomation,
            RuleTrigger::OnDemand,
        ),
        rule(
            "oracle.invoice.create.supplierSite.ensure",
            "Oracle: Invoice Supplier Site Ensure",
            "oracle.invoice.create.supplier_site.ensure",
            true,
            RuleCategory::FormAutomation,
            RuleTrigger::OnDemand,
        ),
        rule(
            "oracle.invoice.create.number",
            "Oracle: Invoice Number",
            "oracle.invoice.create.number",
            true,
            RuleCategory::FormAutomation,
            RuleTrigger::OnDemand,
        ),
    ]
}
