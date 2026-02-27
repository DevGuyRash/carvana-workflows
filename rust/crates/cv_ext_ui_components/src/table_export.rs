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
                .map(|index| csv_escape(&dataset.columns[*index]))
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

#[cfg(test)]
mod tests {
    use super::{column_values_matching, to_csv, to_json_objects, TableExportOptions};
    use crate::table_model::TableDataset;

    fn sample() -> TableDataset {
        TableDataset::new(
            vec![
                "Reference".to_string(),
                "VIN".to_string(),
                "Stock Number".to_string(),
            ],
            vec![
                vec!["R1".to_string(), "V1".to_string(), "S1".to_string()],
                vec!["R2".to_string(), "V2".to_string(), "S2".to_string()],
            ],
        )
    }

    #[test]
    fn csv_respects_headers_and_selection() {
        let data = sample();
        let csv = to_csv(
            &data,
            &TableExportOptions {
                include_headers: true,
                selected_columns: Some(vec!["Reference".to_string(), "VIN".to_string()]),
            },
        );
        assert!(csv.starts_with("Reference,VIN"));
        assert!(csv.contains("R1,V1"));
    }

    #[test]
    fn json_object_export_has_columns() {
        let data = sample();
        let rows = to_json_objects(&data);
        assert_eq!(rows.len(), 2);
        assert_eq!(
            rows[0].get("Reference").and_then(|v| v.as_str()),
            Some("R1")
        );
    }

    #[test]
    fn column_matching_extracts_distinct_values() {
        let data = sample();
        let values = column_values_matching(&data, &["stocknumber"]);
        assert_eq!(values, vec!["S1".to_string(), "S2".to_string()]);
    }
}
