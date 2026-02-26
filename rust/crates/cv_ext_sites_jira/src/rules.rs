use cv_ext_contract::{Action, RuleCategory, RuleDefinition, RuleTrigger, Site};

pub fn jira_rules() -> Vec<RuleDefinition> {
    vec![
        RuleDefinition {
            id: "jira.jql.builder".to_string(),
            label: "Jira: Search Builder".to_string(),
            description: "Open Jira search builder panel from the extension runtime.".to_string(),
            site: Site::Jira,
            enabled: true,
            url_pattern: None,
            trigger: RuleTrigger::OnDemand,
            actions: vec![Action::Execute {
                command: "jira.open_jql_builder".to_string(),
            }],
            priority: 100,
            category: RuleCategory::UiEnhancement,
            builtin: true,
        },
        RuleDefinition {
            id: "jira.jql.builder.install".to_string(),
            label: "Jira: Search Builder Install Hooks".to_string(),
            description: "Install Jira search builder hooks from the extension runtime.".to_string(),
            site: Site::Jira,
            enabled: true,
            url_pattern: None,
            trigger: RuleTrigger::OnPageLoad,
            actions: vec![Action::Execute {
                command: "jira.install_jql_builder".to_string(),
            }],
            priority: 200,
            category: RuleCategory::UiEnhancement,
            builtin: true,
        },
        RuleDefinition {
            id: "jira.issue.capture.table".to_string(),
            label: "Jira: Capture Filter Table".to_string(),
            description: "Capture Jira filter rows and transform to AP export schema (Reference/Invoice routing and amounts).".to_string(),
            site: Site::Jira,
            enabled: true,
            url_pattern: None,
            trigger: RuleTrigger::OnDemand,
            actions: vec![Action::Execute {
                command: "jira.capture.filter_table".to_string(),
            }],
            priority: 100,
            category: RuleCategory::DataCapture,
            builtin: true,
        },
    ]
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::jira_rules;
    use cv_ext_contract::{Action, RuleCategory, RuleTrigger, Site};

    fn find_rule<'a>(
        rules: &'a [cv_ext_contract::RuleDefinition],
        id: &str,
    ) -> &'a cv_ext_contract::RuleDefinition {
        rules.iter().find(|rule| rule.id == id).unwrap_or_else(|| {
            panic!("missing expected Jira rule: {id}");
        })
    }

    #[test]
    fn jira_builder_rule_opens_panel_on_demand() {
        let rules = jira_rules();
        let rule = find_rule(&rules, "jira.jql.builder");

        assert_eq!(rule.site, Site::Jira);
        assert_eq!(rule.trigger, RuleTrigger::OnDemand);
        assert_eq!(rule.priority, 100);
        assert_eq!(rule.category, RuleCategory::UiEnhancement);
        assert_eq!(
            rule.actions,
            vec![Action::Execute {
                command: "jira.open_jql_builder".to_string()
            }]
        );
    }

    #[test]
    fn jira_builder_install_rule_is_internal_page_load_hook() {
        let rules = jira_rules();
        let rule = find_rule(&rules, "jira.jql.builder.install");

        assert_eq!(rule.site, Site::Jira);
        assert_eq!(rule.trigger, RuleTrigger::OnPageLoad);
        assert_eq!(rule.priority, 200);
        assert_eq!(rule.category, RuleCategory::UiEnhancement);
        assert_eq!(
            rule.actions,
            vec![Action::Execute {
                command: "jira.install_jql_builder".to_string()
            }]
        );
    }

    #[test]
    fn jira_rules_have_unique_ids() {
        let rules = jira_rules();
        let unique_count = rules
            .iter()
            .map(|rule| rule.id.as_str())
            .collect::<HashSet<_>>()
            .len();

        assert_eq!(unique_count, rules.len());
    }
}
