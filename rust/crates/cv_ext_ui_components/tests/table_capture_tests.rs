use cv_ext_ui_components::table_capture::{
    ensure_valid_aoa, make_headers_unique, merge_header_rows, normalize_header_key,
};

#[test]
fn aoa_has_header_and_one_row_minimum() {
    let out = ensure_valid_aoa(vec![vec!["A".to_string()]]);
    assert_eq!(out.len(), 2);
    assert_eq!(out.first(), Some(&vec!["A".to_string()]));
    assert_eq!(out.get(1), Some(&vec![String::new()]));
}

#[test]
fn merged_headers_dedupes_by_column() {
    let merged = merge_header_rows(&[
        vec!["Mailing".to_string(), "Amount".to_string()],
        vec!["Instructions".to_string(), "Amount".to_string()],
    ]);
    assert_eq!(
        merged.first().map(String::as_str),
        Some("Mailing Instructions")
    );
    assert_eq!(merged.get(1).map(String::as_str), Some("Amount"));
}

#[test]
fn unique_headers_add_suffixes() {
    let out = make_headers_unique(&["A".to_string(), "A".to_string(), String::new()]);
    assert_eq!(out, vec!["A", "A (2)", "Column 3"]);
}

#[test]
fn normalize_header_key_strips_symbols() {
    assert_eq!(normalize_header_key("Stock Number"), "stocknumber");
    assert_eq!(normalize_header_key("A/P Description"), "apdescription");
}
