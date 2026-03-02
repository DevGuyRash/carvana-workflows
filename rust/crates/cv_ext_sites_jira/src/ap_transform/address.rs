use regex::Regex;

use super::normalize::normalize_whitespace;

pub(super) fn parse_address(value: &str) -> (String, String, String, String, String) {
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

    let zip = Regex::new(r"\b\d{5}(?:-\d{4})?\b")
        .ok()
        .and_then(|re| {
            re.find_iter(&address)
                .last()
                .map(|m| m.as_str().to_string())
        })
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
            if let Some(full) = caps.get(0) {
                address = address[..full.start()]
                    .trim_end_matches([',', ' '])
                    .to_string();
            }
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

pub(super) fn normalize_zip(value: &str) -> String {
    let cleaned = normalize_whitespace(value);
    let Ok(re) = Regex::new(r"\b(\d{5})(?:[-\s]?(\d{4}))?\b") else {
        return String::new();
    };
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

pub(super) fn normalize_state(value: &str) -> String {
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

pub(super) fn build_full_address(
    street: &str,
    apt: &str,
    city: &str,
    state: &str,
    zip: &str,
) -> String {
    let mut parts: Vec<String> = Vec::new();
    let street = normalize_whitespace(street);
    let apt = normalize_whitespace(apt);
    let mut city = normalize_whitespace(city);
    let state = normalize_state(state);
    let zip = normalize_zip(zip);
    if !street.is_empty() {
        let has_city_state_zip =
            Regex::new(r"(?i),\s*[A-Za-z .'\-]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$")
                .ok()
                .is_some_and(|re| re.is_match(&street));
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
    if !city.is_empty()
        && (street_lc.contains(&format!(", {city_lc}")) || street_lc.ends_with(&city_lc))
    {
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
    let Ok(re) = Regex::new(
        r"(?im)([0-9A-Za-z# .,'/\-]{4,})\n([A-Za-z .'\-]{2,}),?\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)",
    ) else {
        return None;
    };
    let caps = re.captures(text)?;
    let street = caps.get(1).map(|m| normalize_whitespace(m.as_str()))?;
    let city = caps.get(2).map(|m| normalize_whitespace(m.as_str()))?;
    let state = caps.get(3).map(|m| normalize_state(m.as_str()))?;
    let zip = caps.get(4).map(|m| normalize_zip(m.as_str()))?;
    Some((street, String::new(), city, state, zip))
}

pub(super) fn parse_address_smart(
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
        if let Ok(city_clean_re) = Regex::new(r"(?i)\s*,?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$") {
            city = city_clean_re.replace(&city, "").trim().to_string();
        }
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
