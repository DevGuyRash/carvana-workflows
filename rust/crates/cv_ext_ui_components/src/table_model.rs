use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TableDataset {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

impl TableDataset {
    pub fn new(columns: Vec<String>, rows: Vec<Vec<String>>) -> Self {
        Self { columns, rows }
    }

    pub fn row_count(&self) -> usize {
        self.rows.len()
    }

    pub fn column_count(&self) -> usize {
        self.columns.len()
    }

    pub fn is_empty(&self) -> bool {
        self.columns.is_empty() || self.rows.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::TableDataset;

    #[test]
    fn dataset_shape_reports_counts() {
        let data = TableDataset::new(
            vec!["A".to_string(), "B".to_string()],
            vec![vec!["1".to_string(), "2".to_string()]],
        );
        assert_eq!(data.column_count(), 2);
        assert_eq!(data.row_count(), 1);
        assert!(!data.is_empty());
    }
}
