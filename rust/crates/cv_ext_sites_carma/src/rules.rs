use cv_ext_contract::{Action, RuleCategory, RuleDefinition, RuleTrigger, Site};

pub fn carma_rules() -> Vec<RuleDefinition> {
    vec![
        RuleDefinition {
            id: "carma.show_panel".to_string(),
            label: "Carma: Bulk Scraper".to_string(),
            description: "Open the Carma bulk search scraper control panel.".to_string(),
            site: Site::Carma,
            enabled: true,
            url_pattern: None,
            trigger: RuleTrigger::OnDemand,
            actions: vec![Action::Execute {
                command: "carma.show_panel".to_string(),
            }],
            priority: 100,
            category: RuleCategory::DataCapture,
            builtin: true,
        },
        RuleDefinition {
            id: "carma.bulk.search.scrape".to_string(),
            label: "Carma: Run Bulk Scrape".to_string(),
            description:
                "Scrape bulk search result tables and export CSV/JSON from extension runtime."
                    .to_string(),
            site: Site::Carma,
            enabled: true,
            url_pattern: None,
            trigger: RuleTrigger::OnDemand,
            actions: vec![Action::Execute {
                command: "carma.bulk.search.scrape".to_string(),
            }],
            priority: 200,
            category: RuleCategory::DataCapture,
            builtin: true,
        },
    ]
}
