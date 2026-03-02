use cv_ext_ui_components::table_export::{
    column_values_matching, to_csv, to_json_objects, TableExportOptions,
};
use cv_ext_ui_components::table_model::TableDataset;

fn sample() -> TableDataset {
    TableDataset::new(
        vec![
            "Reference".to_string(),
            "VIN".to_string(),
            "Stock Number".to_string(),
        ],
        vec![
            vec!["R1".to_string(), "V1".to_string(), "S1".to_string()],
            vec!["R2".to_string(), "V2".to_string(), "S2".to_string()],
        ],
    )
}

#[test]
fn csv_respects_headers_and_selection() {
    let data = sample();
    let csv = to_csv(
        &data,
        &TableExportOptions {
            include_headers: true,
            selected_columns: Some(vec!["Reference".to_string(), "VIN".to_string()]),
        },
    );
    assert!(csv.starts_with("Reference,VIN"));
    assert!(csv.contains("R1,V1"));
}

#[test]
fn json_object_export_has_columns() {
    let data = sample();
    let rows = to_json_objects(&data);
    assert_eq!(rows.len(), 2);
    let first_row = rows.first();
    assert!(first_row.is_some());
    assert_eq!(
        first_row
            .and_then(|row| row.get("Reference"))
            .and_then(|v| v.as_str()),
        Some("R1")
    );
}

#[test]
fn column_matching_extracts_distinct_values() {
    let data = sample();
    let values = column_values_matching(&data, &["stocknumber"]);
    assert_eq!(values, vec!["S1".to_string(), "S2".to_string()]);
}
