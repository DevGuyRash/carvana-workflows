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

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::carma_rules;
    use cv_ext_contract::{Action, RuleCategory, RuleTrigger, Site};

    fn find_rule<'a>(
        rules: &'a [cv_ext_contract::RuleDefinition],
        id: &str,
    ) -> &'a cv_ext_contract::RuleDefinition {
        rules.iter().find(|rule| rule.id == id).unwrap_or_else(|| {
            panic!("missing expected Carma rule: {id}");
        })
    }

    #[test]
    fn carma_show_panel_rule_is_user_facing() {
        let rules = carma_rules();
        let rule = find_rule(&rules, "carma.show_panel");

        assert_eq!(rule.site, Site::Carma);
        assert_eq!(rule.trigger, RuleTrigger::OnDemand);
        assert_eq!(rule.priority, 100);
        assert_eq!(rule.category, RuleCategory::DataCapture);
        assert_eq!(
            rule.actions,
            vec![Action::Execute {
                command: "carma.show_panel".to_string()
            }]
        );
    }

    #[test]
    fn carma_bulk_scrape_rule_is_internal_command() {
        let rules = carma_rules();
        let rule = find_rule(&rules, "carma.bulk.search.scrape");

        assert_eq!(rule.site, Site::Carma);
        assert_eq!(rule.trigger, RuleTrigger::OnDemand);
        assert_eq!(rule.priority, 200);
        assert_eq!(rule.category, RuleCategory::DataCapture);
        assert_eq!(
            rule.actions,
            vec![Action::Execute {
                command: "carma.bulk.search.scrape".to_string()
            }]
        );
    }

    #[test]
    fn carma_rules_have_unique_ids() {
        let rules = carma_rules();
        let unique_count = rules
            .iter()
            .map(|rule| rule.id.as_str())
            .collect::<HashSet<_>>()
            .len();

        assert_eq!(unique_count, rules.len());
    }
}
