use std::collections::BTreeMap;

use regex::Regex;

const INVOICE_VALUE_FORMULA: &str = r#"=LET(_c,MATCH("Oracle Invoice Number",$1:$1,0),_v,INDEX($A:$XFD,ROW(),_c),NOT(OR(ISBLANK(_v),LEN(TRIM(_v))=0,LOWER(TRIM(_v))="n/a",_v="-",_v="—")))"#;

const STATUS_NOT_FINISHED: &str = "NOT FINISHED";
const TRACKING_ID_DEFAULT: &str = "0000000001";

const REQUEST_INVOICE: &str = "Invoice";
const REQUEST_CHECK_REQUEST: &str = "Check Request";
const REQUEST_GOODWILL: &str = "Goodwill";
const REQUEST_TITLE_REG: &str = "Title & Reg";
const REQUEST_WIRE_TRANSFER: &str = "Wire Transfer";

const MAIL_MISC: &str = "MISC";
const MAIL_INHOUSE: &str = "INHOUSE";
const MAIL_HUB_CHECKS: &str = "HUB CHECKS";

pub fn ap_output_columns() -> Vec<String> {
    vec![
        "Status",
        "Invoice Exists",
        "Oracle Error",
        "Auto Close",
        "Tracking ID",
        "Key",
        "Vendor",
        "Oracle Invoice Number",
        "Request Type",
        "Mailing Instructions",
        "Reference",
        "Invoice",
        "StockNumber",
        "VIN",
        "PID",
        "Final Amount",
        "Address",
        "Street Address",
        "Apt/Suite",
        "City",
        "State",
        "Zip",
        "Amount to be paid",
        "Fee Amount",
        "Tax Amount",
        "Description",
        "AP Department",
        "AP Description",
        "AP Request Type",
    ]
    .into_iter()
    .map(|s| s.to_string())
    .collect()
}

fn normalize_whitespace(value: &str) -> String {
    value
        .replace('\u{00A0}', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn normalize_header(value: &str) -> String {
    normalize_whitespace(value)
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}

fn is_blank(value: &str) -> bool {
    let trimmed = normalize_whitespace(value);
    if trimmed.is_empty() {
        return true;
    }
    matches!(
        trimmed.to_lowercase().as_str(),
        "n/a" | "na" | "-" | "—"
    )
}

fn header_value(row: &BTreeMap<String, String>, candidates: &[&str]) -> String {
    for candidate in candidates {
        let needle = normalize_header(candidate);
        for (key, value) in row {
            if normalize_header(key) == needle {
                return normalize_whitespace(value);
            }
        }
    }
    String::new()
}

fn header_value_exact(row: &BTreeMap<String, String>, exact_header: &str) -> String {
    let needle = normalize_whitespace(exact_header).to_lowercase();
    for (key, value) in row {
        if normalize_whitespace(key).to_lowercase() == needle {
            return normalize_whitespace(value);
        }
    }
    String::new()
}

fn hyperlink_formula(value: &str) -> String {
    let raw = normalize_whitespace(value);
    if raw.is_empty() || raw.to_lowercase().starts_with("=hyperlink(") {
        return raw;
    }

    let url_in_parens = Regex::new(r"\((https?://[^)]+)\)")
        .ok()
        .and_then(|re| re.captures(&raw).and_then(|c| c.get(1).map(|m| m.as_str().to_string())));

    let direct = if raw.to_lowercase().starts_with("http://") || raw.to_lowercase().starts_with("https://") {
        Some(raw.clone())
    } else {
        None
    };

    let url = url_in_parens.or(direct);
    let Some(url) = url else {
        return raw;
    };

    let title = if let Some((prefix, _)) = raw.split_once(&format!("({url})")) {
        let candidate = normalize_whitespace(prefix);
        if !candidate.is_empty() {
            candidate
        } else {
            url.clone()
        }
    } else {
        url.split('/')
            .filter(|s| !s.is_empty())
            .last()
            .unwrap_or(&url)
            .to_string()
    };

    let escaped_url = url.replace('"', r#""""#);
    let escaped_title = title.replace('"', r#"\""#);
    format!(r#"=HYPERLINK("{escaped_url}","{escaped_title}")"#)
}

fn parse_money(value: &str) -> Option<f64> {
    let cleaned = normalize_whitespace(value).replace(['$', ','], "");
    cleaned.parse::<f64>().ok()
}

fn find_value_near_label(text: &str, label: &str, capture_pattern: &str) -> String {
    let Ok(label_re) = Regex::new(&format!(r"(?i)\b{label}(?:\s*number(?:s)?)?\b")) else {
        return String::new();
    };
    let Ok(capture_re) = Regex::new(&format!(r"(?i)^\s*(?:[#:\(\)\[\]\-]\s*)*{capture_pattern}")) else {
        return String::new();
    };

    let mut cursor = 0usize;
    while let Some(found) = label_re.find_at(text, cursor) {
        cursor = found.end();
        let after = &text[found.end()..];
        let first_line = after.split('\n').next().unwrap_or_default();
        if let Some(caps) = capture_re.captures(first_line) {
            if let Some(m) = caps.get(1) {
                return normalize_whitespace(m.as_str());
            }
        }

        let mut lines = after.split('\n');
        for line in lines.by_ref().take(8) {
            if normalize_whitespace(line).is_empty() {
                continue;
            }
            if !line.chars().any(|ch| ch.is_ascii_alphanumeric()) {
                continue;
            }
            if let Some(caps) = Regex::new(&format!(r"(?i)^\s*{capture_pattern}"))
                .ok()
                .and_then(|re| re.captures(line))
            {
                if let Some(m) = caps.get(1) {
                    return normalize_whitespace(m.as_str());
                }
            }
            break;
        }
    }
    String::new()
}

fn parse_address(value: &str) -> (String, String, String, String, String) {
    let mut address = normalize_whitespace(value).replace(" | ", ",");
    address = normalize_whitespace(&address.replace('\n', " "));

    if address.is_empty() {
        return (String::new(), String::new(), String::new(), String::new(), String::new());
    }

    let zip = Regex::new(r"\b\d{5}(?:-\d{4})?\b(?!.*\b\d{5})")
        .ok()
        .and_then(|re| re.find(&address).map(|m| m.as_str().to_string()))
        .unwrap_or_default();
    if !zip.is_empty() {
        address = address.replace(&zip, "");
        address = address.trim_end_matches([',', ' ']).to_string();
    }

    let mut state = String::new();
    if let Some(caps) = Regex::new(r"(?:,|\s)([A-Za-z]{2})\s*$")
        .ok()
        .and_then(|re| re.captures(&address))
    {
        if let Some(m) = caps.get(1) {
            state = m.as_str().to_uppercase();
            address = address[..caps.get(0).unwrap().start()].trim_end_matches([',', ' ']).to_string();
        }
    }

    let mut apt = String::new();
    if let Some(m) = Regex::new(r"(?i)\b(?:apt|unit|ste|suite|#)\s*[\w-]+")
        .ok()
        .and_then(|re| re.find(&address).map(|m| m.as_str().to_string()))
    {
        apt = m.clone();
        address = address.replace(&m, "");
        address = normalize_whitespace(&address);
        address = address.trim_end_matches([',', ' ']).to_string();
    }

    let mut city = String::new();
    let mut parts: Vec<&str> = address.split(',').map(|p| p.trim()).filter(|p| !p.is_empty()).collect();
    if parts.len() > 1 {
        city = parts.pop().unwrap_or_default().to_string();
        address = parts.join(", ");
    }

    (address, apt, city, state, zip)
}

#[derive(Clone)]
struct VendorRule {
    pattern: Regex,
    vendor: Option<&'static str>,
    request_type: Option<&'static str>,
    mailing: Option<&'static str>,
    auto_close: bool,
    address_override: Option<&'static str>,
    exclude: Option<Regex>,
}

fn vendor_rules() -> Vec<VendorRule> {
    let mut rules = Vec::new();
    macro_rules! rule {
        ($re:expr, $vendor:expr, $rt:expr, $mail:expr, $auto:expr, $addr:expr) => {{
            VendorRule {
                pattern: Regex::new($re).expect("rule regex valid"),
                vendor: $vendor,
                request_type: $rt,
                mailing: $mail,
                auto_close: $auto,
                address_override: $addr,
                exclude: None,
            }
        }};
        ($re:expr, $vendor:expr, $rt:expr, $mail:expr, $auto:expr, $addr:expr, $exclude:expr) => {{
            VendorRule {
                pattern: Regex::new($re).expect("rule regex valid"),
                vendor: $vendor,
                request_type: $rt,
                mailing: $mail,
                auto_close: $auto,
                address_override: $addr,
                exclude: Some(Regex::new($exclude).expect("exclude regex valid")),
            }
        }};
    }

    rules.push(rule!(r"(?i)notice of lien online application", Some("MISSOURI DEPARTMENT OF REVENUE"), None, None, false, None));
    rules.push(rule!(r"(?i)villarreal\s*enterprise\s*group", Some("VILLARREAL ENTERPRISE GROUP LLC"), None, None, false, None));
    rules.push(rule!(r"(?i)lyft", Some("LYFT, INC"), None, None, false, None));
    rules.push(rule!(r"(?i)waymo", Some("WAYMO LLC"), None, None, false, None));
    rules.push(rule!(r"(?i)notarize", Some("NOTARIZE INC"), None, None, false, None));
    rules.push(rule!(r"(?i)plate express", Some("PLATE EXPRESS"), None, None, false, None));
    rules.push(rule!(r"(?i)motor\s*car\s*tag\s*(?:&|and)\s*title", Some("MOTOR CAR TAG & TITLE"), None, None, false, None));
    rules.push(rule!(r"(?i)edealer\s*services", Some("eDealer Services"), None, None, false, None));
    rules.push(rule!(r"(?i)\bvitu\b|vitu llc|vitu,?\s*inc", Some("VITU"), Some(REQUEST_INVOICE), Some(MAIL_MISC), true, None));
    rules.push(rule!(r"(?i)title one", Some("Title One"), Some(REQUEST_INVOICE), Some(MAIL_MISC), true, None));
    rules.push(rule!(r"(?i)omv\s*express|expres+s\s*omv|\[external\](?: *carvana [a-z] #\d+)+", Some("Express OMV"), Some(REQUEST_INVOICE), Some(MAIL_MISC), true, None));
    rules.push(rule!(r"(?i)daily activity summary", None, Some(REQUEST_INVOICE), Some(MAIL_MISC), true, None));
    rules.push(rule!(r"(?i)add invoice", None, Some(REQUEST_INVOICE), Some(MAIL_MISC), true, None));
    rules.push(rule!(r"(?i)best[- ]?pass", Some("Bestpass"), Some(REQUEST_INVOICE), Some(MAIL_MISC), false, None));
    rules.push(rule!(r"(?i)ez title", None, Some(REQUEST_INVOICE), Some(MAIL_MISC), false, None));
    rules.push(rule!(r"(?i)troy licensing office", None, Some(REQUEST_INVOICE), Some(MAIL_MISC), true, None));
    rules.push(rule!(r"(?i)ean services llc|enterprise holdings inc", Some("ENTERPRISE HOLDINGS INC"), Some(REQUEST_INVOICE), Some(MAIL_MISC), false, None));
    rules.push(rule!(r"(?i)invoice\s*\d+\s*and\s*spreadsheet|mvd\s*now|mvdnow", Some("MVD NOW LLC"), Some(REQUEST_INVOICE), Some(MAIL_MISC), false, None));
    rules.push(rule!(r"(?i)hertz car sales|cv7775|hertz", Some("HERTZ CAR SALES"), Some(REQUEST_INVOICE), Some(MAIL_MISC), false, None));
    rules.push(rule!(r"(?i)quick[- ]?serv", Some("QUICK-SERV LICENSE CENTER"), Some(REQUEST_INVOICE), Some(MAIL_MISC), true, None));
    rules.push(rule!(r"(?i)invoice", None, Some(REQUEST_INVOICE), Some(MAIL_MISC), false, None));
    rules.push(rule!(r"(?i)wire\s*transfer", None, Some(REQUEST_WIRE_TRANSFER), Some(MAIL_MISC), false, None));
    rules.push(rule!(r"(?i)folder", None, Some(REQUEST_CHECK_REQUEST), Some(MAIL_HUB_CHECKS), false, None));
    rules.push(rule!(r"(?i)walked to the dmv", None, Some(REQUEST_CHECK_REQUEST), Some(MAIL_HUB_CHECKS), false, None));
    rules.push(rule!(r"(?i)\bncdmv\b|\bnc dmv\b", None, Some(REQUEST_CHECK_REQUEST), Some(MAIL_HUB_CHECKS), false, None));
    rules.push(rule!(r"(?i)service oklahoma", None, Some(REQUEST_CHECK_REQUEST), Some(MAIL_HUB_CHECKS), false, None));
    rules.push(rule!(r"(?i)commonwealth of pennsylvania", None, Some(REQUEST_CHECK_REQUEST), Some(MAIL_HUB_CHECKS), false, None));
    rules.push(rule!(r"(?i)market street", Some("Market Street"), Some(REQUEST_CHECK_REQUEST), Some(MAIL_INHOUSE), false, Some("4011 N MARKET ST, Spokane, WA 99207")));
    rules.push(rule!(r"(?i)corporate check request", None, Some(REQUEST_CHECK_REQUEST), Some(MAIL_INHOUSE), false, None));
    rules.push(rule!(r"(?i)50 state dmv", None, Some(REQUEST_CHECK_REQUEST), None, false, None));
    rules.push(rule!(r"(?i)dealer account no 43259|sc dmv", Some("SC DMV"), Some(REQUEST_CHECK_REQUEST), Some(MAIL_INHOUSE), false, Some("South Carolina Department of Motor / ATTN Carol Reynolds / 10311 Wilson Boulevard, Blythewood, SC 29016")));
    rules.push(rule!(r"(?i)sell to carvana", None, Some(REQUEST_CHECK_REQUEST), None, false, None));
    rules.push(rule!(r"(?i)ttstc", None, Some(REQUEST_CHECK_REQUEST), None, false, None));
    rules.push(rule!(r"(?i)customer check request", None, Some(REQUEST_CHECK_REQUEST), Some(MAIL_HUB_CHECKS), false, None, r"(?i)good\s*will|goodwill|GDW"));
    rules.push(rule!(r"(?i)t&r check request", None, Some(REQUEST_CHECK_REQUEST), None, false, None));
    rules.push(rule!(r"(?i)title & reg checks", None, Some(REQUEST_CHECK_REQUEST), None, false, None));
    rules.push(rule!(r"(?i)carvana az processing", None, None, None, true, None));

    rules
}

fn apply_vendor_rule(output: &mut [String], rule: &VendorRule) {
    if let Some(vendor) = rule.vendor {
        output[6] = vendor.to_string();
    }
    if let Some(request_type) = rule.request_type {
        output[8] = request_type.to_string();
    }
    if let Some(mailing) = rule.mailing {
        output[9] = mailing.to_string();
    }
    if rule.auto_close {
        output[3] = "TRUE".to_string();
    }
    if let Some(addr) = rule.address_override {
        output[16] = addr.to_string();
    }
}

pub fn transform_filter_rows(
    captured_rows: Vec<BTreeMap<String, String>>,
    today_mmddyyyy: &str,
) -> (Vec<String>, Vec<Vec<String>>) {
    let columns = ap_output_columns();
    let rules = vendor_rules();

    let mut out_rows: Vec<Vec<String>> = Vec::new();

    let vin_capture = r"([A-HJ-NPR-Z0-9]{11,17})\b";
    let stock_capture = r"([A-Z0-9-]{3,})\b";
    let pid_capture = r"(\d{3,})\b";
    let vin_strict = Regex::new(r"^[A-HJ-NPR-Z0-9]{11,17}$").expect("vin regex");
    let stc_re = Regex::new(r"(?i)(^|\b)stc(\b|$)").expect("stc regex");

    for row in captured_rows {
        let mut out = vec![String::new(); columns.len()];

        out[0] = STATUS_NOT_FINISHED.to_string();
        out[3] = "FALSE".to_string();
        out[4] = TRACKING_ID_DEFAULT.to_string();

        let oracle_invoice = header_value(
            &row,
            &["Oracle Invoice Number", "Oracle invoice #", "Oracle Invoice #"],
        );
        out[7] = oracle_invoice.clone();
        out[1] = if is_blank(&oracle_invoice) {
            "False".to_string()
        } else {
            "True".to_string()
        };

        let oracle_error = header_value(&row, &["Oracle Error"]);
        out[2] = if matches!(oracle_error.trim().to_lowercase().as_str(), "yes" | "true") {
            "TRUE".to_string()
        } else {
            "FALSE".to_string()
        };

        let key = header_value(&row, &["Key"]);
        out[5] = hyperlink_formula(&key);

        out[6] = header_value(&row, &["Vendor"]);
        out[9] = header_value(&row, &["Mailing Instructions", "Mail Instructions", "Mailing"]);
        out[16] = header_value(&row, &["Address"]);

        let fee_raw = header_value(&row, &["Fee Amount", "Fees"]);
        let tax_raw = header_value(&row, &["Tax Amount", "Taxes", "Tax"]);
        out[23] = fee_raw.clone();
        out[24] = tax_raw.clone();

        out[25] = header_value(&row, &["Description", "Details", "Issue Details"]);
        out[26] = header_value(&row, &["AP Department", "AP Dept", "Department", "AP Department "]);
        out[27] = header_value(
            &row,
            &[
                "AP Description",
                "AP Desc",
                "AP-Description",
                "AP description",
                "A/P Description",
            ],
        );
        out[28] = header_value(
            &row,
            &["AP Request Type", "AP Type", "AP RequestType", "Request Type (AP)"],
        );

        let summary = header_value(&row, &["Summary", "Issue Summary", "Ticket Summary", "Title"]);
        let txt = row
            .values()
            .map(|v| normalize_whitespace(v))
            .collect::<Vec<_>>()
            .join("\n");

        // Stock/VIN/PID extraction with label-based fallback.
        let mut stock = header_value_exact(&row, "StockNumber");
        if is_blank(&stock) {
            stock = header_value_exact(&row, "Stock Number");
        }
        let mut vin = header_value(&row, &["VIN", "VIN Number", "VIN Numbers"]);
        let mut pid = header_value(&row, &["PID", "PID Number"]);

        if is_blank(&stock) {
            stock = find_value_near_label(&txt, "stock", stock_capture);
        }
        if is_blank(&vin) {
            vin = find_value_near_label(&txt, "vin", vin_capture);
        }
        if is_blank(&pid) {
            pid = find_value_near_label(&txt, "pid", pid_capture);
        }

        if !stock.is_empty() && vin_strict.is_match(&stock) {
            stock.clear();
        }

        let any_id = !is_blank(&stock) || !is_blank(&vin) || !is_blank(&pid);
        let stock_d = if any_id {
            if is_blank(&stock) { "STOCK".to_string() } else { stock.clone() }
        } else {
            String::new()
        };
        let vin_d = if any_id {
            if is_blank(&vin) { "VIN".to_string() } else { vin.clone() }
        } else {
            String::new()
        };
        let pid_d = if any_id {
            if is_blank(&pid) { "PID".to_string() } else { pid.clone() }
        } else {
            String::new()
        };

        out[12] = stock_d.clone();
        out[13] = vin_d.clone();
        out[14] = pid_d.clone();
        out[10] = if any_id {
            format!("HUB-{stock_d}-{vin_d}-{pid_d}")
        } else {
            String::new()
        };

        out[11] = format!(
            "{}-TR",
            if !is_blank(&stock) {
                stock.clone()
            } else {
                today_mmddyyyy.to_string()
            }
        );

        // Final Amount: CRA -> Amount -> Fee+Tax -> default 0
        let cra = header_value(&row, &["Check Request Amount", "Check Request Amt"]);
        let amt = header_value(
            &row,
            &["Amount to be paid", "Amount to be Paid", "Amount Payable", "Amount"],
        );
        let mut final_amount = if !is_blank(&cra) {
            cra
        } else if !is_blank(&amt) {
            amt
        } else {
            let fee = parse_money(&fee_raw);
            let tax = parse_money(&tax_raw);
            if fee.is_some() || tax.is_some() {
                let sum = fee.unwrap_or(0.0) + tax.unwrap_or(0.0);
                sum.to_string()
            } else {
                String::new()
            }
        };
        if is_blank(&final_amount) {
            final_amount = "0".to_string();
        }
        out[15] = final_amount.clone();
        out[22] = final_amount;

        // Request type inference from invoice suffix
        let compact_invoice = oracle_invoice.replace(char::is_whitespace, "").to_uppercase();
        if compact_invoice.ends_with("CR") {
            out[8] = REQUEST_CHECK_REQUEST.to_string();
        } else if compact_invoice.ends_with("GDW") {
            out[8] = REQUEST_GOODWILL.to_string();
        } else if compact_invoice.ends_with("TR") {
            out[8] = REQUEST_TITLE_REG.to_string();
        }

        if out[6].is_empty() && !summary.is_empty() {
            out[6] = summary;
        }

        let good = Regex::new(r"(?i)good\s*will|goodwill").ok().map(|re| re.is_match(&txt)).unwrap_or(false);
        let hub = Regex::new(r"(?i)hub\s*checks").ok().map(|re| re.is_match(&txt)).unwrap_or(false);
        let gdw = compact_invoice.ends_with("GDW");
        let apd = out[26].clone();
        let apx = out[27].clone();

        if !hub && !good && !gdw && Regex::new(r"(?i)logistics").unwrap().is_match(&apd) {
            out[8] = REQUEST_CHECK_REQUEST.to_string();
            out[9] = MAIL_INHOUSE.to_string();
        }
        if !hub && !good && !gdw && stc_re.is_match(&format!("{apd} {apx}")) {
            out[8] = REQUEST_CHECK_REQUEST.to_string();
            out[9] = MAIL_INHOUSE.to_string();
        }
        if stc_re.is_match(&format!("{apd} {apx}")) && good {
            out[8] = REQUEST_GOODWILL.to_string();
            out[9] = MAIL_INHOUSE.to_string();
        }
        if !hub && !good && !gdw && Regex::new(r"(?i)finance\s*operations").unwrap().is_match(&apd) {
            out[8] = REQUEST_CHECK_REQUEST.to_string();
            out[9] = MAIL_INHOUSE.to_string();
        }
        if Regex::new(r"(?i)\b(title\s*&?\s*reg(istration)?|t\s*&\s*r|t/r|title\s*and\s*registration|title&registration)\b")
            .unwrap()
            .is_match(&apx)
        {
            out[8] = REQUEST_CHECK_REQUEST.to_string();
        }

        for rule in &rules {
            if rule.pattern.is_match(&txt) {
                if rule.exclude.as_ref().is_some_and(|ex| ex.is_match(&txt)) {
                    continue;
                }
                apply_vendor_rule(&mut out, rule);
            }
        }

        if out[8] == REQUEST_INVOICE || out[8] == REQUEST_WIRE_TRANSFER {
            out[9] = MAIL_MISC.to_string();
        }

        for rule in &rules {
            if rule.pattern.is_match(&txt) {
                if rule.exclude.as_ref().is_some_and(|ex| ex.is_match(&txt)) {
                    continue;
                }
                apply_vendor_rule(&mut out, rule);
            }
        }

        let mi = out[9].clone();
        out[9] = if Regex::new(r"(?i)inhouse").unwrap().is_match(&mi) {
            MAIL_INHOUSE.to_string()
        } else if Regex::new(r"(?i)hub\s*checks").unwrap().is_match(&mi) {
            MAIL_HUB_CHECKS.to_string()
        } else if Regex::new(r"(?i)misc").unwrap().is_match(&mi) {
            MAIL_MISC.to_string()
        } else {
            mi
        };

        let (street, apt, city, state, zip) = parse_address(&out[16]);
        out[17] = street;
        out[18] = apt;
        out[19] = city;
        out[20] = state;
        out[21] = zip;

        // Invoice Exists becomes formula for excel.
        out[1] = INVOICE_VALUE_FORMULA.to_string();

        out_rows.push(out);
    }

    out_rows.sort_by(|a, b| {
        for idx in [9usize, 8usize, 1usize, 2usize, 6usize, 5usize] {
            let a_val = a.get(idx).cloned().unwrap_or_default().to_lowercase();
            let b_val = b.get(idx).cloned().unwrap_or_default().to_lowercase();
            if a_val == b_val {
                continue;
            }
            if a_val.is_empty() {
                return std::cmp::Ordering::Greater;
            }
            if b_val.is_empty() {
                return std::cmp::Ordering::Less;
            }
            return a_val.cmp(&b_val);
        }
        std::cmp::Ordering::Equal
    });

    (columns, out_rows)
}

#[cfg(test)]
mod tests {
    use super::transform_filter_rows;
    use std::collections::BTreeMap;

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
        assert!(out[0][10].starts_with("HUB-"));
        assert_eq!(out[0][15], "12");
        assert_eq!(out[0][22], "12");
    }
}

