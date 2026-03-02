use regex::Regex;

use super::normalize::normalize_whitespace;

pub(super) fn find_value_near_label(text: &str, label: &str, capture_pattern: &str) -> String {
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
