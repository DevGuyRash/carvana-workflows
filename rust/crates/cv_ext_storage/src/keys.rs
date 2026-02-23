pub fn workflow_options_key(workflow_id: &str, profile: &str) -> String {
    format!("wf:opts:{workflow_id}:{profile}")
}

pub fn workflow_autorun_key(workflow_id: &str) -> String {
    format!("wf:autorun:{workflow_id}")
}

pub fn workflow_history_key(workflow_id: &str) -> String {
    format!("wf:history:{workflow_id}")
}

#[cfg(test)]
mod tests {
    use super::{workflow_autorun_key, workflow_history_key, workflow_options_key};

    #[test]
    fn keys_are_namespaced() {
        assert_eq!(workflow_options_key("a", "p1"), "wf:opts:a:p1");
        assert_eq!(workflow_autorun_key("a"), "wf:autorun:a");
        assert_eq!(workflow_history_key("a"), "wf:history:a");
    }
}
