use cv_ext_ui_components::table_model::TableDataset;

#[test]
fn dataset_shape_reports_counts() {
    let data = TableDataset::new(
        vec!["A".to_string(), "B".to_string()],
        vec![vec!["1".to_string(), "2".to_string()]],
    );
    assert_eq!(data.column_count(), 2);
    assert_eq!(data.row_count(), 1);
    assert!(!data.is_empty());
}
