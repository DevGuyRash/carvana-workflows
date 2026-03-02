use regex::Regex;

pub(super) fn normalize_whitespace(value: &str) -> String {
    value
        .replace('\u{00A0}', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

pub(super) fn normalize_dash_spaces(value: &str) -> String {
    let with_spaces = value
        .replace(['\u{00A0}', '\u{2007}', '\u{202F}'], " ")
        .replace(
            [
                '\u{2010}', '\u{2011}', '\u{2012}', '\u{2013}', '\u{2014}', '\u{2015}', '\u{FE58}',
                '\u{FE63}', '\u{FF0D}',
            ],
            "-",
        );
    normalize_whitespace(&with_spaces)
}

pub(super) fn sid(value: &str) -> String {
    normalize_dash_spaces(value)
        .chars()
        .filter(|ch| {
            !ch.is_whitespace()
                && !matches!(
                    ch,
                    '\u{200B}' | '\u{200C}' | '\u{200D}' | '\u{2060}' | '\u{FEFF}'
                )
        })
        .collect::<String>()
        .trim()
        .to_string()
}

pub(super) fn normalize_header(value: &str) -> String {
    normalize_whitespace(value)
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}

pub(super) fn is_blank(value: &str) -> bool {
    let trimmed = normalize_whitespace(value);
    if trimmed.is_empty() {
        return true;
    }
    matches!(trimmed.to_lowercase().as_str(), "n/a" | "na" | "-" | "—")
}

pub(super) fn hyperlink_formula(value: &str) -> String {
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
            .rfind(|segment| !segment.is_empty())
            .unwrap_or(&url)
            .to_string()
    };

    let escaped_url = url.replace('"', r#""""#);
    let escaped_title = title.replace('"', r#"\""#);
    format!(r#"=HYPERLINK("{escaped_url}","{escaped_title}")"#)
}

pub(super) fn parse_money(value: &str) -> Option<f64> {
    let cleaned = normalize_whitespace(value).replace(['$', ','], "");
    cleaned.parse::<f64>().ok()
}
