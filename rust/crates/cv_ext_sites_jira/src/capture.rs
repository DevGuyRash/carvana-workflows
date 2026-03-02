use std::collections::BTreeMap;

fn normalize(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn normalize_header(value: &str) -> String {
    normalize(value).to_lowercase()
}

fn find_value<'a>(row: &'a BTreeMap<String, String>, names: &[&str]) -> Option<&'a str> {
    for (k, v) in row {
        let normalized = normalize_header(k);
        if names.iter().any(|name| normalized == *name) {
            let candidate = normalize(v);
            if !candidate.is_empty() {
                return Some(v.as_str());
            }
        }
    }
    None
}

fn extract_first_regex(text: &str, pattern: &str) -> Option<String> {
    let regex = regex::Regex::new(pattern).ok()?;
    regex.find(text).map(|m| m.as_str().to_string())
}

fn derive_identifiers(row: &BTreeMap<String, String>) -> (String, String, String) {
    let joined = row
        .values()
        .map(|v| normalize(v))
        .collect::<Vec<_>>()
        .join(" |");

    let stock = find_value(row, &["stock", "stock number", "stocknumber"])
        .map(normalize)
        .or_else(|| extract_first_regex(&joined, r"\b\d{6}\b"))
        .unwrap_or_default();

    let vin = find_value(row, &["vin"])
        .map(normalize)
        .or_else(|| extract_first_regex(&joined, r"\b[A-HJ-NPR-Z0-9]{17}\b"))
        .unwrap_or_default();

    let pid = find_value(row, &["pid", "purchase id", "purchaseid"])
        .map(normalize)
        .or_else(|| extract_first_regex(&joined, r"\b\d{7,10}\b"))
        .unwrap_or_default();

    (stock, vin, pid)
}

fn build_reference(stock: &str, vin: &str, pid: &str) -> String {
    if stock.is_empty() && vin.is_empty() && pid.is_empty() {
        return String::new();
    }

    format!(
        "HUB-{}-{}-{}",
        if stock.is_empty() { "STOCK" } else { stock },
        if vin.is_empty() { "VIN" } else { vin },
        if pid.is_empty() { "PID" } else { pid }
    )
}

fn build_invoice(stock: &str) -> String {
    if !stock.is_empty() {
        return format!("{stock}-TR");
    }

    "MMDDYYYY-TR".to_string()
}

pub fn rows_with_derived_fields(
    rows: Vec<BTreeMap<String, String>>,
) -> Vec<BTreeMap<String, String>> {
    rows.into_iter()
        .map(|mut row| {
            let identifiers = derive_identifiers(&row);
            let stock_id = identifiers.0;
            let vin_value = identifiers.1;
            let pid_value = identifiers.2;
            let reference = build_reference(&stock_id, &vin_value, &pid_value);
            let invoice = build_invoice(&stock_id);

            row.insert("StockNumber".to_string(), stock_id);
            row.insert("VIN".to_string(), vin_value);
            row.insert("PID".to_string(), pid_value);
            row.insert("Reference".to_string(), reference);
            row.insert("Invoice".to_string(), invoice);
            row
        })
        .collect()
}
