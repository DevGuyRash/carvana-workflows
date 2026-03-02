use std::collections::BTreeMap;

use regex::Regex;

use super::address::parse_address_smart;
use super::ap_output_columns;
use super::constants::{
    INVOICE_VALUE_FORMULA, MAIL_HUB_CHECKS, MAIL_INHOUSE, MAIL_MISC, REQUEST_CHECK_REQUEST,
    REQUEST_GOODWILL, REQUEST_INVOICE, REQUEST_TITLE_REG, REQUEST_WIRE_TRANSFER,
    STATUS_NOT_FINISHED, TRACKING_ID_DEFAULT,
};
use super::extraction::find_value_near_label;
use super::normalize::{
    hyperlink_formula, is_blank, normalize_dash_spaces, normalize_header, normalize_whitespace,
    parse_money, sid,
};
use super::vendor_rules::{apply_vendor_rule, vendor_rules};

pub fn transform_filter_rows(
    captured_rows: Vec<BTreeMap<String, String>>,
    today_mmddyyyy: &str,
) -> (Vec<String>, Vec<Vec<String>>) {
    if captured_rows.is_empty() {
        return (ap_output_columns(), Vec::new());
    }
    let mut headers: Vec<String> = Vec::new();
    for row in &captured_rows {
        for key in row.keys() {
            if !headers.iter().any(|existing| existing == key) {
                headers.push(key.clone());
            }
        }
    }
    let mut aoa = Vec::with_capacity(captured_rows.len() + 1);
    aoa.push(headers.clone());
    for row in captured_rows {
        aoa.push(
            headers
                .iter()
                .map(|header| row.get(header).cloned().unwrap_or_default())
                .collect::<Vec<_>>(),
        );
    }
    transform_filter_table_aoa(aoa, today_mmddyyyy)
}

include!("transform_table_aoa.inc");
