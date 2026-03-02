use std::collections::HashSet;

use cv_ext_contract::{Action, RuleCategory, RuleTrigger, Site};
use cv_ext_sites_carma::carma_rules;

fn find_rule<'a>(
    rules: &'a [cv_ext_contract::RuleDefinition],
    id: &str,
) -> Option<&'a cv_ext_contract::RuleDefinition> {
    rules.iter().find(|rule| rule.id == id)
}

#[test]
fn carma_show_panel_rule_is_user_facing() {
    let rules = carma_rules();
    let rule = find_rule(&rules, "carma.show_panel");
    assert!(rule.is_some());
    let Some(rule) = rule else {
        return;
    };

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
    assert!(rule.is_some());
    let Some(rule) = rule else {
        return;
    };

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
