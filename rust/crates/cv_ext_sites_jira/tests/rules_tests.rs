use std::collections::HashSet;

use cv_ext_contract::{Action, RuleCategory, RuleTrigger, Site};
use cv_ext_sites_jira::jira_rules;

fn find_rule<'a>(
    rules: &'a [cv_ext_contract::RuleDefinition],
    id: &str,
) -> Option<&'a cv_ext_contract::RuleDefinition> {
    rules.iter().find(|rule| rule.id == id)
}

#[test]
fn jira_builder_rule_opens_panel_on_demand() {
    let rules = jira_rules();
    let rule = find_rule(&rules, "jira.jql.builder");
    assert!(rule.is_some());
    let Some(rule) = rule else {
        return;
    };

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
    assert!(rule.is_some());
    let Some(rule) = rule else {
        return;
    };

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
