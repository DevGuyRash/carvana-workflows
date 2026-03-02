use cv_ext_ui_components::PanelTabs;

#[test]
fn tabs_only_accept_allowed_values() {
    let mut tabs = PanelTabs::new(vec!["a", "b"], "a");
    tabs.set_active("b");
    assert_eq!(tabs.active(), "b");
    tabs.set_active("x");
    assert_eq!(tabs.active(), "b");
}
