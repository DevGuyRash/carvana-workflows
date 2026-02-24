use cv_ext_contract::{Action, Site, RuleDefinition, RuleTrigger, RuleCategory};

pub fn carma_rules() -> Vec<RuleDefinition> {
    vec![RuleDefinition {
        id: "carma.bulk.search.scrape".to_string(),
        label: "Carma: Bulk Search Scrape".to_string(),
        description: "Scrape bulk search result tables and export CSV/JSON from extension runtime.".to_string(),
        site: Site::Carma,
        enabled: true,
        url_pattern: None,
        trigger: RuleTrigger::OnDemand,
        actions: vec![Action::Execute {
            command: "carma.bulk.search.scrape".to_string(),
        }],
        priority: 100,
        category: RuleCategory::DataCapture,
        builtin: true,
    }]
}
