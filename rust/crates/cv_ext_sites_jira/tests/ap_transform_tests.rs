use std::collections::BTreeMap;

use cv_ext_sites_jira::ap_transform::{transform_filter_rows, transform_filter_table_aoa};

#[test]
fn builds_reference_and_amount_defaults() {
    let mut row = BTreeMap::new();
    row.insert("Key".to_string(), "ABC-123".to_string());
    row.insert(
        "Description".to_string(),
        "Need title check stock 123456 vin 1M8GDM9AXKP042788 pid 7654321".to_string(),
    );
    row.insert("Fee Amount".to_string(), "10".to_string());
    row.insert("Tax Amount".to_string(), "2".to_string());

    let (cols, out) = transform_filter_rows(vec![row], "01012026");
    assert_eq!(cols.len(), 29);
    assert_eq!(out.len(), 1);
    let first = out.first();
    assert!(first.is_some());
    assert_eq!(
        first
            .and_then(|row| row.get(10))
            .map(String::as_str)
            .map(|v| v.starts_with("HUB-")),
        Some(true)
    );
    assert_eq!(
        first.and_then(|row| row.get(15)).map(String::as_str),
        Some("12")
    );
    assert_eq!(
        first.and_then(|row| row.get(22)).map(String::as_str),
        Some("12")
    );
}

#[test]
fn aoa_transform_reconstructs_split_address_fields() {
    let data = vec![
        vec![
            "Key".to_string(),
            "Street Address".to_string(),
            "City".to_string(),
            "State".to_string(),
            "Zip".to_string(),
            "Description".to_string(),
        ],
        vec![
            "ABC-123".to_string(),
            "4011 N MARKET ST".to_string(),
            "Spokane".to_string(),
            "WA".to_string(),
            "99207".to_string(),
            "market street".to_string(),
        ],
    ];
    let (_cols, out) = transform_filter_table_aoa(data, "01012026");
    let first = out.first();
    assert!(first.is_some());
    assert_eq!(
        first.and_then(|row| row.get(16)).map(String::as_str),
        Some("4011 N MARKET ST, Spokane, WA 99207")
    );
    assert_eq!(
        first.and_then(|row| row.get(20)).map(String::as_str),
        Some("WA")
    );
    assert_eq!(
        first.and_then(|row| row.get(21)).map(String::as_str),
        Some("99207")
    );
}
