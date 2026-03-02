use serde_json::{Map, Value};

use crate::table_model::TableDataset;

#[derive(Debug, Clone, Default)]
pub struct TableExportOptions {
    pub include_headers: bool,
    pub selected_columns: Option<Vec<String>>,
}

pub fn csv_escape(value: &str) -> String {
    let escaped = value.replace('"', "\"\"");
    if escaped.contains(',') || escaped.contains('\n') || escaped.contains('"') {
        format!("\"{escaped}\"")
    } else {
        escaped
    }
}

pub fn to_csv(dataset: &TableDataset, opts: &TableExportOptions) -> String {
    let indexes = resolve_column_indexes(dataset, opts.selected_columns.as_ref());
    let mut lines: Vec<String> = Vec::with_capacity(dataset.rows.len() + 1);
    if opts.include_headers {
        lines.push(
            indexes
                .iter()
                .map(|index| {
                    csv_escape(
                        dataset
                            .columns
                            .get(*index)
                            .map(String::as_str)
                            .unwrap_or_default(),
                    )
                })
                .collect::<Vec<_>>()
                .join(","),
        );
    }
    for row in &dataset.rows {
        lines.push(
            indexes
                .iter()
                .map(|index| csv_escape(row.get(*index).map(String::as_str).unwrap_or_default()))
                .collect::<Vec<_>>()
                .join(","),
        );
    }
    lines.join("\n")
}

pub fn to_json_objects(dataset: &TableDataset) -> Vec<Map<String, Value>> {
    dataset
        .rows
        .iter()
        .map(|row| {
            let mut map = Map::new();
            for (index, column) in dataset.columns.iter().enumerate() {
                map.insert(
                    column.clone(),
                    Value::String(row.get(index).cloned().unwrap_or_default()),
                );
            }
            map
        })
        .collect()
}

pub fn column_values_matching(dataset: &TableDataset, patterns: &[&str]) -> Vec<String> {
    let indexes: Vec<usize> = dataset
        .columns
        .iter()
        .enumerate()
        .filter_map(|(index, column)| {
            let normalized = normalize_header(column);
            if patterns.iter().any(|pattern| normalized.contains(pattern)) {
                Some(index)
            } else {
                None
            }
        })
        .collect();
    let mut out: Vec<String> = Vec::new();
    for row in &dataset.rows {
        for index in &indexes {
            let value = row.get(*index).cloned().unwrap_or_default();
            let cleaned = value.split_whitespace().collect::<Vec<_>>().join(" ");
            if !cleaned.is_empty() && !out.contains(&cleaned) {
                out.push(cleaned);
            }
        }
    }
    out
}

fn resolve_column_indexes(dataset: &TableDataset, selected: Option<&Vec<String>>) -> Vec<usize> {
    let mut indexes: Vec<usize> = Vec::new();
    if let Some(selected) = selected {
        for selected_name in selected {
            if let Some(index) = dataset.columns.iter().position(|col| col == selected_name) {
                indexes.push(index);
            }
        }
    }
    if indexes.is_empty() {
        indexes = (0..dataset.columns.len()).collect();
    }
    indexes
}

fn normalize_header(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}
