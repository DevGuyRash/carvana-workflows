use super::build::{BuildOptions, RESERVED_WORDS};
use super::{JqlListMode, JqlOperatorValueMode, JqlValueMode, JqlValueState, TextSearchMode};

pub(super) fn format_list_value(value: &JqlValueState, opts: BuildOptions) -> String {
    if matches!(value.mode, JqlValueMode::Function) {
        return value.text.trim().to_string();
    }
    let mut items: Vec<String> = Vec::new();
    for raw in &value.list {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        let formatted = match value.list_mode {
            JqlListMode::Raw => trimmed.to_string(),
            JqlListMode::Text => quote_if_needed(trimmed, opts),
        };
        if !formatted.is_empty() {
            items.push(formatted);
        }
    }
    if items.is_empty() {
        String::new()
    } else {
        format!("({})", items.join(", "))
    }
}

pub(super) fn format_value(
    value: &JqlValueState,
    opts: BuildOptions,
    _mode: JqlOperatorValueMode,
) -> String {
    match value.mode {
        JqlValueMode::List => format_list_value(value, opts),
        JqlValueMode::Function | JqlValueMode::Raw => value.text.trim().to_string(),
        JqlValueMode::Number | JqlValueMode::Date | JqlValueMode::Relative => {
            value.text.trim().to_string()
        }
        _ => {
            let text = value.text.trim();
            if text.is_empty() {
                String::new()
            } else {
                quote_if_needed(text, opts)
            }
        }
    }
}

pub(super) fn format_text_search_value(value: &JqlValueState) -> String {
    if matches!(value.mode, JqlValueMode::Raw | JqlValueMode::Function) {
        return value.text.trim().to_string();
    }

    let term = value.text.trim();
    if term.is_empty() {
        return String::new();
    }

    let lucene = match value.text_search_mode {
        TextSearchMode::Phrase => format!("\"{}\"", escape_lucene(term, false, false, false)),
        TextSearchMode::Wildcard => escape_lucene(term, true, false, false),
        TextSearchMode::Prefix => {
            let escaped = escape_lucene(term, true, false, false);
            if escaped.ends_with('*') {
                escaped
            } else {
                format!("{escaped}*")
            }
        }
        TextSearchMode::Suffix => {
            let escaped = escape_lucene(term, true, false, false);
            if escaped.starts_with('*') {
                escaped
            } else {
                format!("*{escaped}")
            }
        }
        TextSearchMode::Fuzzy => {
            let escaped = escape_lucene(term, false, true, false);
            if escaped.ends_with('~') {
                escaped
            } else {
                format!("{escaped}~")
            }
        }
        TextSearchMode::Proximity => {
            let escaped = escape_lucene(term, false, false, false);
            let distance = value.text_search_distance.trim();
            let distance = if distance.is_empty() { "10" } else { distance };
            format!("\"{escaped}\"~{distance}")
        }
        TextSearchMode::Boost => {
            let escaped = escape_lucene(term, false, false, true);
            let boost = value.text_search_boost.trim();
            if boost.is_empty() {
                escaped
            } else {
                format!("{escaped}^{boost}")
            }
        }
        TextSearchMode::Raw => term.to_string(),
        TextSearchMode::Simple => escape_lucene(term, false, false, false),
    };

    wrap_jql_string(&lucene)
}

pub(super) fn escape_lucene(
    input: &str,
    allow_wildcards: bool,
    allow_fuzzy: bool,
    allow_boost: bool,
) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        let is_wildcard = ch == '*' || ch == '?';
        let is_allowed = (allow_wildcards && is_wildcard)
            || (allow_fuzzy && ch == '~')
            || (allow_boost && ch == '^');
        let is_special = matches!(
            ch,
            '+' | '-'
                | '&'
                | '|'
                | '!'
                | '('
                | ')'
                | '{'
                | '}'
                | '['
                | ']'
                | '^'
                | '~'
                | '*'
                | '?'
                | ':'
        );
        if is_special && !is_allowed {
            out.push('\\');
        }
        out.push(ch);
    }
    out
}

pub(super) fn wrap_jql_string(value: &str) -> String {
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

pub(super) fn looks_like_function(raw: &str) -> bool {
    let value = raw.trim();
    if !value.contains('(') || !value.ends_with(')') {
        return false;
    }
    let mut chars = value.chars();
    match chars.next() {
        Some(ch) if ch.is_ascii_alphabetic() || ch == '_' => {}
        _ => return false,
    }
    true
}

pub(super) fn quote_if_needed(raw: &str, opts: BuildOptions) -> String {
    if !opts.auto_quote {
        return raw.to_string();
    }
    if raw.starts_with('"') && raw.ends_with('"') {
        return raw.to_string();
    }
    if looks_like_function(raw) {
        return raw.to_string();
    }
    let lower = raw.to_lowercase();
    let is_reserved = RESERVED_WORDS.iter().any(|word| *word == lower);
    let simple = raw
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'));
    if simple && !is_reserved {
        return raw.to_string();
    }
    let escaped = raw.replace('"', "\\\"");
    format!("\"{escaped}\"")
}
