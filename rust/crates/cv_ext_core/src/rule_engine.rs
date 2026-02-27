use cv_ext_contract::{RuleDefinition, RuleTrigger, Site};

use crate::registry::rules_for_site;

pub struct RuleEngine {
    builtin_rules: Vec<RuleDefinition>,
    user_rules: Vec<RuleDefinition>,
}

impl RuleEngine {
    pub fn new() -> Self {
        let mut builtin_rules = Vec::new();
        for site in &[Site::Jira, Site::Oracle, Site::Carma] {
            builtin_rules.extend(rules_for_site(*site));
        }
        Self {
            builtin_rules,
            user_rules: Vec::new(),
        }
    }

    pub fn with_user_rules(mut self, rules: Vec<RuleDefinition>) -> Self {
        self.user_rules = rules;
        self
    }

    pub fn all_rules(&self) -> Vec<&RuleDefinition> {
        self.builtin_rules
            .iter()
            .chain(self.user_rules.iter())
            .collect()
    }

    pub fn rules_for_site(&self, site: Site) -> Vec<&RuleDefinition> {
        self.all_rules()
            .into_iter()
            .filter(|rule| rule.site == site && rule.enabled)
            .collect()
    }

    pub fn auto_rules(&self, site: Site) -> Vec<&RuleDefinition> {
        self.rules_for_site(site)
            .into_iter()
            .filter(|rule| !matches!(rule.trigger, RuleTrigger::OnDemand))
            .collect()
    }

    pub fn on_demand_rules(&self, site: Site) -> Vec<&RuleDefinition> {
        self.rules_for_site(site)
            .into_iter()
            .filter(|rule| matches!(rule.trigger, RuleTrigger::OnDemand))
            .collect()
    }

    pub fn find_rule(&self, rule_id: &str) -> Option<&RuleDefinition> {
        self.all_rules().into_iter().find(|rule| rule.id == rule_id)
    }

    pub fn add_user_rule(&mut self, rule: RuleDefinition) {
        self.user_rules.push(rule);
    }

    pub fn remove_user_rule(&mut self, rule_id: &str) -> bool {
        let before = self.user_rules.len();
        self.user_rules.retain(|rule| rule.id != rule_id);
        self.user_rules.len() < before
    }

    pub fn toggle_rule(&mut self, rule_id: &str, enabled: bool) -> bool {
        for rule in self.user_rules.iter_mut() {
            if rule.id == rule_id {
                rule.enabled = enabled;
                return true;
            }
        }
        false
    }

    pub fn user_rules(&self) -> &[RuleDefinition] {
        &self.user_rules
    }

    pub fn builtin_rules(&self) -> &[RuleDefinition] {
        &self.builtin_rules
    }
}

impl Default for RuleEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use cv_ext_contract::{Action, RuleCategory, RuleDefinition, RuleTrigger, Site};

    use super::RuleEngine;

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
        let found = engine.find_rule("user.test").unwrap();
        assert!(!found.enabled);

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
}
