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
