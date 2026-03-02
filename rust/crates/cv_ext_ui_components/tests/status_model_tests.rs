use cv_ext_ui_components::status_model::StatusSurfaceModel;

#[test]
fn oracle_status_maps_to_known_css_class() {
    let model = StatusSurfaceModel::for_oracle_validation("validated");
    assert_eq!(model.css_class, "cv-validated");
}
