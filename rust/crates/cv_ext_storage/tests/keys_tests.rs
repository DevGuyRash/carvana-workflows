use cv_ext_storage::keys::{workflow_autorun_key, workflow_history_key, workflow_options_key};

#[test]
fn keys_are_namespaced() {
    assert_eq!(workflow_options_key("a", "p1"), "wf:opts:a:p1");
    assert_eq!(workflow_autorun_key("a"), "wf:autorun:a");
    assert_eq!(workflow_history_key("a"), "wf:history:a");
}
