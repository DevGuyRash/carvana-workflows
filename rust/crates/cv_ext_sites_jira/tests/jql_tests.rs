use cv_ext_sites_jira::jql::{JqlNodeState, JqlValueMode};
use cv_ext_sites_jira::{build_jql_query, default_jql_state, JqlBuildOptions};

#[test]
fn builds_basic_query() {
    let mut state = default_jql_state();
    if let Some(JqlNodeState::Clause(clause)) = state.root.children.first_mut() {
        clause.field = "assignee".to_string();
        clause.value.text = "currentUser()".to_string();
        clause.value.mode = JqlValueMode::Function;
    }
    let query = build_jql_query(&state, JqlBuildOptions::default());
    assert_eq!(query, "assignee = currentUser()");
}
