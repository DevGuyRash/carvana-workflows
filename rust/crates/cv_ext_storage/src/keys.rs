pub fn workflow_options_key(workflow_id: &str, profile: &str) -> String {
    format!("wf:opts:{workflow_id}:{profile}")
}

pub fn workflow_autorun_key(workflow_id: &str) -> String {
    format!("wf:autorun:{workflow_id}")
}

pub fn workflow_history_key(workflow_id: &str) -> String {
    format!("wf:history:{workflow_id}")
}
