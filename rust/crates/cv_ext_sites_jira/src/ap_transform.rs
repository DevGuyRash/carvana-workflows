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

fn normalize_dash_spaces(value: &str) -> String {
    let with_spaces = value
        .replace(['\u{00A0}', '\u{2007}', '\u{202F}'], " ")
        .replace('\u{2010}', "-")
        .replace('\u{2011}', "-")
        .replace('\u{2012}', "-")
        .replace('\u{2013}', "-")
        .replace('\u{2014}', "-")
        .replace('\u{2015}', "-")
        .replace('\u{FE58}', "-")
        .replace('\u{FE63}', "-")
        .replace('\u{FF0D}', "-");
    normalize_whitespace(&with_spaces)
}

fn sid(value: &str) -> String {
    normalize_dash_spaces(value)
        .chars()
        .filter(|ch| !ch.is_whitespace() && !matches!(ch, '\u{200B}' | '\u{200C}' | '\u{200D}' | '\u{2060}' | '\u{FEFF}'))
        .collect::<String>()
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
    matches!(trimmed.to_lowercase().as_str(), "n/a" | "na" | "-" | "—")
}

fn hyperlink_formula(value: &str) -> String {
    let raw = normalize_whitespace(value);
    if raw.is_empty() || raw.to_lowercase().starts_with("=hyperlink(") {
        return raw;
    }

    let url_in_parens = Regex::new(r"\((https?://[^)]+)\)").ok().and_then(|re| {
        re.captures(&raw)
            .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
    });

    let direct = if raw.to_lowercase().starts_with("http://")
        || raw.to_lowercase().starts_with("https://")
    {
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
    let Ok(capture_re) = Regex::new(&format!(r"(?i)^\s*(?:[#:\(\)\[\]\-]\s*)*{capture_pattern}"))
    else {
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
        return (
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
        );
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
            address = address[..caps.get(0).unwrap().start()]
                .trim_end_matches([',', ' '])
                .to_string();
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
    let mut parts: Vec<&str> = address
        .split(',')
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();
    if parts.len() > 1 {
        city = parts.pop().unwrap_or_default().to_string();
        address = parts.join(", ");
    }

    (address, apt, city, state, zip)
}

fn normalize_zip(value: &str) -> String {
    let cleaned = normalize_whitespace(value);
    let re = Regex::new(r"\b(\d{5})(?:[-\s]?(\d{4}))?\b").expect("zip regex");
    if let Some(caps) = re.captures(&cleaned) {
        let first = caps.get(1).map(|m| m.as_str()).unwrap_or_default();
        let second = caps.get(2).map(|m| m.as_str()).unwrap_or_default();
        if second.is_empty() {
            first.to_string()
        } else {
            format!("{first}-{second}")
        }
    } else {
        String::new()
    }
}

fn normalize_state(value: &str) -> String {
    let raw = normalize_whitespace(value).to_uppercase();
    if raw.len() == 2 && raw.chars().all(|ch| ch.is_ascii_alphabetic()) {
        return raw;
    }
    let map = [
        ("ALABAMA", "AL"),
        ("ALASKA", "AK"),
        ("ARIZONA", "AZ"),
        ("ARKANSAS", "AR"),
        ("CALIFORNIA", "CA"),
        ("COLORADO", "CO"),
        ("CONNECTICUT", "CT"),
        ("DELAWARE", "DE"),
        ("DISTRICT OF COLUMBIA", "DC"),
        ("FLORIDA", "FL"),
        ("GEORGIA", "GA"),
        ("HAWAII", "HI"),
        ("IDAHO", "ID"),
        ("ILLINOIS", "IL"),
        ("INDIANA", "IN"),
        ("IOWA", "IA"),
        ("KANSAS", "KS"),
        ("KENTUCKY", "KY"),
        ("LOUISIANA", "LA"),
        ("MAINE", "ME"),
        ("MARYLAND", "MD"),
        ("MASSACHUSETTS", "MA"),
        ("MICHIGAN", "MI"),
        ("MINNESOTA", "MN"),
        ("MISSISSIPPI", "MS"),
        ("MISSOURI", "MO"),
        ("MONTANA", "MT"),
        ("NEBRASKA", "NE"),
        ("NEVADA", "NV"),
        ("NEW HAMPSHIRE", "NH"),
        ("NEW JERSEY", "NJ"),
        ("NEW MEXICO", "NM"),
        ("NEW YORK", "NY"),
        ("NORTH CAROLINA", "NC"),
        ("NORTH DAKOTA", "ND"),
        ("OHIO", "OH"),
        ("OKLAHOMA", "OK"),
        ("OREGON", "OR"),
        ("PENNSYLVANIA", "PA"),
        ("PUERTO RICO", "PR"),
        ("RHODE ISLAND", "RI"),
        ("SOUTH CAROLINA", "SC"),
        ("SOUTH DAKOTA", "SD"),
        ("TENNESSEE", "TN"),
        ("TEXAS", "TX"),
        ("UTAH", "UT"),
        ("VERMONT", "VT"),
        ("VIRGINIA", "VA"),
        ("WASHINGTON", "WA"),
        ("WEST VIRGINIA", "WV"),
        ("WISCONSIN", "WI"),
        ("WYOMING", "WY"),
    ];
    for (name, abbr) in map {
        if raw == name {
            return abbr.to_string();
        }
    }
    String::new()
}

fn build_full_address(street: &str, apt: &str, city: &str, state: &str, zip: &str) -> String {
    let mut parts: Vec<String> = Vec::new();
    let street = normalize_whitespace(street);
    let apt = normalize_whitespace(apt);
    let mut city = normalize_whitespace(city);
    let state = normalize_state(state);
    let zip = normalize_zip(zip);
    if !street.is_empty() {
        let has_city_state_zip = Regex::new(r"(?i),\s*[A-Za-z .'\-]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$")
            .expect("full address tail regex")
            .is_match(&street);
        if has_city_state_zip {
            if !apt.is_empty() {
                return format!("{street}, {apt}");
            }
            return street;
        }
        parts.push(street);
    }
    let street_lc = parts.first().cloned().unwrap_or_default().to_lowercase();
    let city_lc = city.to_lowercase();
    if !city.is_empty() && (street_lc.contains(&format!(", {city_lc}")) || street_lc.ends_with(&city_lc)) {
        city.clear();
    }
    if !apt.is_empty() {
        parts.push(apt);
    }
    let mut tail = String::new();
    if !city.is_empty() {
        tail.push_str(&city);
        if !state.is_empty() || !zip.is_empty() {
            tail.push_str(", ");
        }
    }
    if !state.is_empty() {
        tail.push_str(&state);
        if !zip.is_empty() {
            tail.push(' ');
            tail.push_str(&zip);
        }
    } else if !zip.is_empty() {
        tail.push_str(&zip);
    }
    if !tail.is_empty() {
        parts.push(tail);
    }
    parts.join(", ")
}

fn extract_address_from_text(text: &str) -> Option<(String, String, String, String, String)> {
    let re = Regex::new(
        r"(?im)([0-9A-Za-z# .,'/\-]{4,})\n([A-Za-z .'\-]{2,}),?\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)",
    )
    .expect("address text regex");
    let caps = re.captures(text)?;
    let street = caps.get(1).map(|m| normalize_whitespace(m.as_str()))?;
    let city = caps.get(2).map(|m| normalize_whitespace(m.as_str()))?;
    let state = caps.get(3).map(|m| normalize_state(m.as_str()))?;
    let zip = caps.get(4).map(|m| normalize_zip(m.as_str()))?;
    Some((street, String::new(), city, state, zip))
}

fn parse_address_smart(
    address: &str,
    street_hint: &str,
    apt_hint: &str,
    city_hint: &str,
    state_hint: &str,
    zip_hint: &str,
    text: &str,
) -> (String, String, String, String, String, String) {
    let (mut street, mut apt, mut city, mut state, mut zip) = parse_address(address);
    if street.is_empty() {
        street = normalize_whitespace(street_hint);
    }
    if apt.is_empty() {
        apt = normalize_whitespace(apt_hint);
    }
    if city.is_empty() {
        city = normalize_whitespace(city_hint);
    }
    if !city.is_empty() {
        let city_clean_re =
            Regex::new(r"(?i)\s*,?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$").expect("city clean regex");
        city = city_clean_re.replace(&city, "").trim().to_string();
        let street_lower = street.to_lowercase();
        let city_lower = city.to_lowercase();
        if street_lower.ends_with(&format!(", {city_lower}")) {
            street = street[..street.len() - city.len() - 2]
                .trim_end_matches(',')
                .trim()
                .to_string();
        }
    }
    if state.is_empty() {
        state = normalize_state(state_hint);
    } else {
        state = normalize_state(&state);
    }
    if zip.is_empty() {
        zip = normalize_zip(zip_hint);
    } else {
        zip = normalize_zip(&zip);
    }
    if street.is_empty() || city.is_empty() || state.is_empty() || zip.is_empty() {
        if let Some((s2, a2, c2, st2, z2)) = extract_address_from_text(text) {
            if street.is_empty() {
                street = s2;
            }
            if apt.is_empty() {
                apt = a2;
            }
            if city.is_empty() {
                city = c2;
            }
            if state.is_empty() {
                state = st2;
            }
            if zip.is_empty() {
                zip = z2;
            }
        }
    }
    let full = build_full_address(&street, &apt, &city, &state, &zip);
    (full, street, apt, city, state, zip)
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

    rules.push(rule!(
        r"(?i)notice of lien online application",
        Some("MISSOURI DEPARTMENT OF REVENUE"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)villarreal\s*enterprise\s*group",
        Some("VILLARREAL ENTERPRISE GROUP LLC"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)lyft",
        Some("LYFT, INC"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)waymo",
        Some("WAYMO LLC"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)notarize",
        Some("NOTARIZE INC"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)plate express",
        Some("PLATE EXPRESS"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)scale invoice",
        Some("HARBOR TRUCK STOP INC"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)motor\s*car\s*tag\s*(?:&|and)\s*title",
        Some("MOTOR CAR TAG & TITLE"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)tag\s*agency\s*of\s*pinellas",
        Some("TAG AGENCY PROFESSIONALS"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)edealer\s*services",
        Some("eDealer Services"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)\bvitu\b|vitu llc|vitu,?\s*inc",
        Some("VITU"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)title one",
        Some("Title One"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)omv\s*express|expres+s\s*omv|\[external\](?: *carvana [a-z] #\d+)+",
        Some("Express OMV"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)daily activity summary",
        None,
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)add invoice",
        None,
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)best[- ]?pass",
        Some("Bestpass"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)ez title",
        None,
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)troy licensing office",
        None,
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)ean services llc|enterprise holdings inc",
        Some("ENTERPRISE HOLDINGS INC"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)invoice\s*\d+\s*and\s*spreadsheet|mvd\s*now|mvdnow",
        Some("MVD NOW LLC"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)hertz car sales|cv7775|hertz",
        Some("HERTZ CAR SALES"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)quick[- ]?serv",
        Some("QUICK-SERV LICENSE CENTER"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)invoice",
        None,
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)wire\s*transfer",
        None,
        Some(REQUEST_WIRE_TRANSFER),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)folder",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)walked to the dmv",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)\bncdmv\b|\bnc dmv\b",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)service oklahoma",
        Some("SERVICE OKLAHOMA"),
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)commonwealth of pennsylvania",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)market street",
        Some("Market Street"),
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_INHOUSE),
        false,
        Some("4011 N MARKET ST, Spokane, WA 99207")
    ));
    rules.push(rule!(
        r"(?i)corporate check request",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_INHOUSE),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)50 state dmv",
        None,
        Some(REQUEST_CHECK_REQUEST),
        None,
        false,
        None
    ));
    rules.push(rule!(r"(?i)dealer account no 43259|sc dmv", Some("SC DMV"), Some(REQUEST_CHECK_REQUEST), Some(MAIL_INHOUSE), false, Some("South Carolina Department of Motor / ATTN Carol Reynolds / 10311 Wilson Boulevard, Blythewood, SC 29016")));
    rules.push(rule!(
        r"(?i)(?:tarrant\s*c(?:ou)?nty\s*tax\s*assessor(?:\s*-\s*col(?:lector)?)?|rick\s*d\.?\s*barnes)",
        Some("TARRANT COUNTY TAX ASSESSOR-COLLECTOR"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)sell to carvana",
        None,
        Some(REQUEST_CHECK_REQUEST),
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)ttstc",
        None,
        Some(REQUEST_CHECK_REQUEST),
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)customer check request",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None,
        r"(?i)good\s*will|goodwill|GDW"
    ));
    rules.push(rule!(
        r"(?i)t&r check request",
        None,
        Some(REQUEST_CHECK_REQUEST),
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)title & reg checks",
        None,
        Some(REQUEST_CHECK_REQUEST),
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)carvana az processing",
        None,
        None,
        None,
        true,
        None
    ));

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

pub fn transform_filter_table_aoa(
    captured_table: Vec<Vec<String>>,
    today_mmddyyyy: &str,
) -> (Vec<String>, Vec<Vec<String>>) {
    let columns = ap_output_columns();
    let rules = vendor_rules();
    let mut out_rows: Vec<Vec<String>> = Vec::new();

    if captured_table.is_empty() {
        return (columns, out_rows);
    }
    let header_row = captured_table.first().cloned().unwrap_or_default();
    let mut mp: BTreeMap<String, usize> = BTreeMap::new();
    for (idx, header) in header_row.iter().enumerate() {
        mp.insert(normalize_header(header), idx);
    }
    let ix = |names: &[&str]| -> Option<usize> {
        names.iter()
            .map(|name| normalize_header(name))
            .find_map(|key| mp.get(&key).copied())
    };
    let ix_exact = |name: &str| -> Option<usize> {
        header_row.iter().position(|header| {
            normalize_whitespace(header).eq_ignore_ascii_case(&normalize_whitespace(name))
        })
    };
    let val = |row: &[String], idx: Option<usize>| -> String {
        idx.and_then(|i| row.get(i))
            .map(|text| normalize_whitespace(text))
            .unwrap_or_default()
    };

    let vin_capture = r"([A-HJ-NPR-Z0-9]{11,17})\b";
    let stock_capture = r"((?:[A-Z0-9&]{2,8}-)?\d{7,12}(?:-(?:[A-Z]{2,8}|\d{1,4}))?)\b";
    let pid_capture = r"(\d{3,})\b";
    let vin_strict = Regex::new(r"^[A-HJ-NPR-Z0-9]{11,17}$").expect("vin regex");
    let stc_re = Regex::new(r"(?i)(^|\b)stc(\b|$)").expect("stc regex");
    let descriptor_re = Regex::new(r"(?i)(?:^|[^A-Z0-9&])((?:[A-Z0-9&]{2,8}-)?\d{7,12})(?:-([A-Z]{2,8}|\d{1,4}))?-([A-HJ-NPR-Z0-9]{11,17})(?:-(\d{3,}))?(?:-[A-Z0-9&]{2,30})*(?:$|[^A-Z0-9&])").expect("descriptor regex");
    let stock_split_re =
        Regex::new(r"(?i)^((?:[A-Z0-9&]{2,8}-)?\d{7,12})(?:-([A-Z]{2,8}|\d{1,4}))?$")
            .expect("stock split regex");

    let i_oe = ix(&["Oracle Error"]);
    let i_k = ix(&["Key"]);
    let i_v = ix(&["Vendor"]);
    let i_oin = ix(&[
        "Oracle Invoice Number",
        "Oracle invoice #",
        "Oracle Invoice #",
    ]);
    let i_mi = ix(&["Mailing Instructions", "Mail Instructions", "Mailing"]);
    let i_adr = ix(&[
        "Address",
        "Mailing Address",
        "Payee Address",
        "Remit Address",
        "Remittance Address",
        "Mail To Address",
        "Mail-To Address",
    ]);
    let i_str = ix(&[
        "Street Address",
        "Street",
        "Address Line 1",
        "Address1",
        "Address 1",
        "Address Line1",
        "Line 1",
        "Line1",
    ]);
    let i_apt = ix(&[
        "Apt/Suite",
        "Apt",
        "Suite",
        "Unit",
        "Address Line 2",
        "Address2",
        "Address 2",
        "Address Line2",
        "Line 2",
        "Line2",
    ]);
    let i_city = ix(&["City", "Town"]);
    let i_state = ix(&["State", "Province", "Region"]);
    let i_zip = ix(&[
        "Zip",
        "Zip Code",
        "ZipCode",
        "Postal Code",
        "PostalCode",
        "Post Code",
        "PostCode",
    ]);
    let i_cra = ix(&["Check Request Amount", "Check Request Amt"]);
    let i_amt = ix(&[
        "Amount to be paid",
        "Amount to be Paid",
        "Amount Payable",
        "Amount",
    ]);
    let i_fee = ix(&["Fee Amount", "Fees"]);
    let i_tax = ix(&["Tax Amount", "Taxes", "Tax"]);
    let i_sn1 = ix_exact("StockNumber");
    let i_sn2 = ix_exact("Stock Number");
    let i_vin = ix(&["VIN", "VIN Number", "VIN Numbers"]);
    let i_pid = ix(&["PID", "PID Number"]);
    let i_d = ix(&["Description", "Details", "Issue Details"]);
    let i_apd = ix(&["AP Department", "AP Dept", "Department", "AP Department "]);
    let i_apx = ix(&[
        "AP Description",
        "AP Desc",
        "AP-Description",
        "AP description",
        "A/P Description",
    ]);
    let i_aptype = ix(&[
        "AP Request Type",
        "AP Type",
        "AP RequestType",
        "Request Type (AP)",
    ]);
    let i_sum = ix(&["Summary", "Issue Summary", "Ticket Summary", "Title"]);

    for row in captured_table.into_iter().skip(1) {
        let mut out = vec![String::new(); columns.len()];
        out[0] = STATUS_NOT_FINISHED.to_string();
        out[3] = "FALSE".to_string();
        out[4] = TRACKING_ID_DEFAULT.to_string();
        let oracle_invoice = sid(&val(&row, i_oin));
        out[7] = oracle_invoice.clone();
        out[1] = if is_blank(&oracle_invoice) { "False" } else { "True" }.to_string();
        let oracle_error = val(&row, i_oe);
        out[2] = if matches!(oracle_error.trim().to_lowercase().as_str(), "yes" | "true") {
            "TRUE".to_string()
        } else {
            "FALSE".to_string()
        };
        let key = val(&row, i_k);
        out[5] = hyperlink_formula(&key);
        out[6] = val(&row, i_v);
        out[9] = val(&row, i_mi);
        out[16] = val(&row, i_adr);
        let raw_street = val(&row, i_str);
        let raw_apt = val(&row, i_apt);
        let raw_city = val(&row, i_city);
        let raw_state = val(&row, i_state);
        let raw_zip = val(&row, i_zip);

        let fee_raw = val(&row, i_fee);
        let tax_raw = val(&row, i_tax);
        out[23] = fee_raw.clone();
        out[24] = tax_raw.clone();
        out[25] = val(&row, i_d);
        out[26] = val(&row, i_apd);
        out[27] = val(&row, i_apx);
        out[28] = val(&row, i_aptype);

        let summary = val(&row, i_sum);
        let txt = row
            .iter()
            .map(|v| normalize_whitespace(v))
            .collect::<Vec<_>>()
            .join("\n");

        let mut stock = sid(&val(&row, i_sn1));
        if is_blank(&stock) {
            stock = sid(&val(&row, i_sn2));
        }
        let mut vin = sid(&val(&row, i_vin));
        let mut pid = sid(&val(&row, i_pid));
        if is_blank(&stock) {
            stock = find_value_near_label(&txt, "stock", stock_capture);
        }
        if is_blank(&vin) {
            vin = find_value_near_label(&txt, "vin", vin_capture);
        }
        if is_blank(&pid) {
            pid = find_value_near_label(&txt, "pid", pid_capture);
        }
        let descriptor_input = normalize_dash_spaces(&txt).to_uppercase();
        if let Some(caps) = descriptor_re.captures(&descriptor_input) {
            if is_blank(&stock) {
                let base = caps.get(1).map(|m| m.as_str()).unwrap_or_default();
                let tag = caps.get(2).map(|m| m.as_str()).unwrap_or_default();
                stock = if tag.is_empty() {
                    base.to_string()
                } else {
                    format!("{base}-{tag}")
                };
            }
            if is_blank(&vin) {
                vin = caps
                    .get(3)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default();
            }
            if is_blank(&pid) {
                pid = caps
                    .get(4)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default();
            }
        }
        stock = sid(&stock);
        vin = sid(&vin);
        pid = sid(&pid);
        if !stock.is_empty() && vin_strict.is_match(&stock) {
            stock.clear();
        }
        let mut stock_for_invoice = stock.clone();
        if let Some(caps) = stock_split_re.captures(&stock) {
            let base = sid(caps.get(1).map(|m| m.as_str()).unwrap_or_default()).to_uppercase();
            let tag = sid(caps.get(2).map(|m| m.as_str()).unwrap_or_default()).to_uppercase();
            stock = if tag.is_empty() {
                base.clone()
            } else {
                format!("{base}-{tag}")
            };
            let numeric = Regex::new(r"^[A-Z0-9&]{2,8}-")
                .expect("stock prefix strip regex")
                .replace(&base, "")
                .to_string();
            stock_for_invoice = if tag.is_empty() {
                numeric
            } else {
                format!("{numeric}-{tag}")
            };
        }

        let any_id = !is_blank(&stock) || !is_blank(&vin) || !is_blank(&pid);
        let stock_d = if any_id {
            if is_blank(&stock) {
                "STOCK".to_string()
            } else {
                stock.clone()
            }
        } else {
            String::new()
        };
        let vin_d = if any_id {
            if is_blank(&vin) {
                "VIN".to_string()
            } else {
                vin.clone()
            }
        } else {
            String::new()
        };
        let pid_d = if any_id {
            if is_blank(&pid) {
                "PID".to_string()
            } else {
                pid.clone()
            }
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
            if !is_blank(&stock_for_invoice) {
                stock_for_invoice.clone()
            } else {
                today_mmddyyyy.to_string()
            }
        );

        let cra = val(&row, i_cra);
        let amt = val(&row, i_amt);
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

        let compact_invoice = oracle_invoice
            .replace(char::is_whitespace, "")
            .to_uppercase();
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

        let good = Regex::new(r"(?i)good\s*will|goodwill")
            .ok()
            .map(|re| re.is_match(&txt))
            .unwrap_or(false);
        let hub = Regex::new(r"(?i)hub\s*checks")
            .ok()
            .map(|re| re.is_match(&txt))
            .unwrap_or(false);
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
        if !hub
            && !good
            && !gdw
            && Regex::new(r"(?i)finance\s*operations")
                .unwrap()
                .is_match(&apd)
        {
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

        let (full, street, apt, city, state, zip) = parse_address_smart(
            &out[16], &raw_street, &raw_apt, &raw_city, &raw_state, &raw_zip, &txt,
        );
        if !full.is_empty() {
            out[16] = full;
        }
        out[17] = street;
        out[18] = apt;
        out[19] = city;
        out[20] = state;
        out[21] = zip;

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

    for row in &mut out_rows {
        row[1] = INVOICE_VALUE_FORMULA.to_string();
    }

    (columns, out_rows)
}

#[cfg(test)]
mod tests {
    use super::{transform_filter_rows, transform_filter_table_aoa};
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
        assert_eq!(out[0][16], "4011 N MARKET ST, Spokane, WA 99207");
        assert_eq!(out[0][20], "WA");
        assert_eq!(out[0][21], "99207");
    }
}
