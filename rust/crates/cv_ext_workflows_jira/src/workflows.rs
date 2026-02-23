use cv_ext_contract::{Action, Site, WorkflowDefinition};

pub fn jira_workflows() -> Vec<WorkflowDefinition> {
    vec![
        WorkflowDefinition {
            id: "jira.jql.builder".to_string(),
            label: "Jira: Search Builder".to_string(),
            description: "Install Jira search builder hooks from the extension runtime.".to_string(),
            site: Site::Jira,
            actions: vec![Action::Execute {
                command: "jira.install_jql_builder".to_string(),
            }],
            internal: false,
        },
        WorkflowDefinition {
            id: "jira.issue.capture.table".to_string(),
            label: "Jira: Capture Filter Table".to_string(),
            description: "Capture visible Jira filter rows and derive Stock/VIN/PID reference columns.".to_string(),
            site: Site::Jira,
            actions: vec![Action::ExtractTable {
                selector: "table".to_string(),
            }],
            internal: false,
        },
    ]
}
