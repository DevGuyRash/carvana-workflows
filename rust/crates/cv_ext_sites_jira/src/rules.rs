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
