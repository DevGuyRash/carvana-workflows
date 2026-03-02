use std::collections::BTreeMap;

fn normalize_whitespace(value: &str) -> String {
    value
        .replace('\u{00A0}', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

pub fn normalize_header_key(value: &str) -> String {
    normalize_whitespace(value)
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}

pub fn ensure_valid_aoa(input: Vec<Vec<String>>) -> Vec<Vec<String>> {
    let fallback = vec![vec!["Column 1".to_string()], vec![String::new()]];
    if input.is_empty() || input.iter().any(|row| row.is_empty()) {
        return fallback;
    }

    let mut output = input;
    let mut max_cols = 0usize;
    for row in &output {
        max_cols = max_cols.max(row.len());
    }
    if max_cols == 0 {
        return fallback;
    }

    for row in &mut output {
        while row.len() < max_cols {
            row.push(String::new());
        }
    }

    if output.len() == 1 {
        output.push(vec![String::new(); max_cols]);
    }

    output
}

pub fn merge_header_rows(header_grid: &[Vec<String>]) -> Vec<String> {
    if header_grid.is_empty() {
        return Vec::new();
    }
    let cols = header_grid.first().map(Vec::len).unwrap_or_default();
    let mut merged = vec![String::new(); cols];
    for (col, merged_col) in merged.iter_mut().enumerate().take(cols) {
        let mut parts: Vec<String> = Vec::new();
        for row in header_grid {
            let text = normalize_whitespace(row.get(col).map(String::as_str).unwrap_or_default());
            if !text.is_empty() && !parts.iter().any(|part| part.eq_ignore_ascii_case(&text)) {
                parts.push(text);
            }
        }
        *merged_col = normalize_whitespace(&parts.join(" "));
    }
    merged
}

pub fn make_headers_unique(headers: &[String]) -> Vec<String> {
    let mut seen: BTreeMap<String, usize> = BTreeMap::new();
    let mut out = Vec::with_capacity(headers.len());
    for (index, header) in headers.iter().enumerate() {
        let base = normalize_whitespace(header);
        let base = if base.is_empty() {
            format!("Column {}", index + 1)
        } else {
            base
        };
        let key = base.to_lowercase();
        let next = seen.entry(key).or_insert(0);
        *next += 1;
        if *next == 1 {
            out.push(base);
        } else {
            out.push(format!("{base} ({})", *next));
        }
    }
    out
}

pub fn pad_aoa(aoa: &mut [Vec<String>], cols: usize) {
    for row in aoa {
        while row.len() < cols {
            row.push(String::new());
        }
    }
}
