use std::collections::BTreeMap;

use cv_ext_sites_jira::rows_with_derived_fields;

#[test]
fn derives_reference_fields() {
    let mut row = BTreeMap::new();
    row.insert(
        "Summary".to_string(),
        "Need title check 123456 VIN 1M8GDM9AXKP042788 PID 7654321".to_string(),
    );

    let rows = rows_with_derived_fields(vec![row]);
    assert_eq!(rows.len(), 1);

    let first = rows.first();
    assert!(first.is_some());
    if let Some(first) = first {
        assert_eq!(first.get("StockNumber").map(String::as_str), Some("123456"));
        assert_eq!(
            first.get("VIN").map(String::as_str),
            Some("1M8GDM9AXKP042788")
        );
        assert_eq!(first.get("PID").map(String::as_str), Some("7654321"));
        assert!(first
            .get("Reference")
            .map(|v| v.starts_with("HUB-123456-"))
            .unwrap_or(false));
        assert!(first
            .get("Invoice")
            .map(|v| v.ends_with("-TR"))
            .unwrap_or(false));
    }
}
