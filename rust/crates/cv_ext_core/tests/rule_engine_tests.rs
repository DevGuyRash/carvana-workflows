use cv_ext_contract::{Action, RuleCategory, RuleDefinition, RuleTrigger, Site};
use cv_ext_core::RuleEngine;

fn test_user_rule(id: &str, site: Site, trigger: RuleTrigger) -> RuleDefinition {
    RuleDefinition {
        id: id.to_string(),
        label: id.to_string(),
        description: "test".to_string(),
        site,
        enabled: true,
        url_pattern: None,
        trigger,
        actions: vec![Action::Execute {
            command: "noop".to_string(),
        }],
        priority: 100,
        category: RuleCategory::UiEnhancement,
        builtin: false,
    }
}

#[test]
fn loads_builtin_rules() {
    let engine = RuleEngine::new();
    assert!(!engine.builtin_rules().is_empty());
    assert!(engine.find_rule("jira.jql.builder").is_some());
    assert!(engine.find_rule("oracle.invoice.create").is_some());
    assert!(engine.find_rule("carma.bulk.search.scrape").is_some());
}

#[test]
fn filters_by_site() {
    let engine = RuleEngine::new();
    let jira = engine.rules_for_site(Site::Jira);
    assert!(jira.iter().all(|r| r.site == Site::Jira));
    assert!(!jira.is_empty());
}

#[test]
fn separates_on_demand_from_auto() {
    let engine = RuleEngine::new().with_user_rules(vec![test_user_rule(
        "auto.1",
        Site::Jira,
        RuleTrigger::OnPageLoad,
    )]);

    let auto = engine.auto_rules(Site::Jira);
    assert!(auto.iter().any(|r| r.id == "auto.1"));

    let on_demand = engine.on_demand_rules(Site::Jira);
    assert!(on_demand
        .iter()
        .all(|r| matches!(r.trigger, RuleTrigger::OnDemand)));
}

#[test]
fn crud_user_rules() {
    let mut engine = RuleEngine::new();
    let rule = test_user_rule("user.test", Site::Jira, RuleTrigger::OnDemand);
    engine.add_user_rule(rule);
    assert!(engine.find_rule("user.test").is_some());

    assert!(engine.toggle_rule("user.test", false));
    let found = engine.find_rule("user.test");
    assert!(found.is_some());
    if let Some(rule) = found {
        assert!(!rule.enabled);
    }

    assert!(engine.remove_user_rule("user.test"));
    assert!(engine.find_rule("user.test").is_none());
}

#[test]
fn remove_nonexistent_returns_false() {
    let mut engine = RuleEngine::new();
    assert!(!engine.remove_user_rule("nonexistent"));
}

#[test]
fn toggle_nonexistent_returns_false() {
    let mut engine = RuleEngine::new();
    assert!(!engine.toggle_rule("nonexistent", true));
}
