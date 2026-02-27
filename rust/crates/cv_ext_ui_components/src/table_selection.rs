use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SelectionMode {
    None,
    CellRange,
    RowRange,
    ColumnRange,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Range {
    pub start: usize,
    pub end: usize,
}

impl Range {
    pub fn normalized(&self) -> Self {
        if self.start <= self.end {
            self.clone()
        } else {
            Self {
                start: self.end,
                end: self.start,
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TableSelectionState {
    pub mode: SelectionMode,
    pub row: Range,
    pub column: Range,
}

impl Default for TableSelectionState {
    fn default() -> Self {
        Self {
            mode: SelectionMode::None,
            row: Range::default(),
            column: Range::default(),
        }
    }
}

impl TableSelectionState {
    pub fn set_cell_range(
        &mut self,
        start_row: usize,
        end_row: usize,
        start_col: usize,
        end_col: usize,
    ) {
        self.mode = SelectionMode::CellRange;
        self.row = Range {
            start: start_row,
            end: end_row,
        }
        .normalized();
        self.column = Range {
            start: start_col,
            end: end_col,
        }
        .normalized();
    }

    pub fn set_row_range(&mut self, start_row: usize, end_row: usize) {
        self.mode = SelectionMode::RowRange;
        self.row = Range {
            start: start_row,
            end: end_row,
        }
        .normalized();
    }

    pub fn set_column_range(&mut self, start_col: usize, end_col: usize) {
        self.mode = SelectionMode::ColumnRange;
        self.column = Range {
            start: start_col,
            end: end_col,
        }
        .normalized();
    }

    pub fn clear(&mut self) {
        self.mode = SelectionMode::None;
        self.row = Range::default();
        self.column = Range::default();
    }
}

#[cfg(test)]
mod tests {
    use super::{SelectionMode, TableSelectionState};

    #[test]
    fn range_normalizes_order() {
        let mut state = TableSelectionState::default();
        state.set_cell_range(5, 2, 9, 3);
        assert_eq!(state.mode, SelectionMode::CellRange);
        assert_eq!(state.row.start, 2);
        assert_eq!(state.row.end, 5);
        assert_eq!(state.column.start, 3);
        assert_eq!(state.column.end, 9);
    }

    #[test]
    fn clear_resets_to_none() {
        let mut state = TableSelectionState::default();
        state.set_row_range(1, 3);
        state.clear();
        assert_eq!(state.mode, SelectionMode::None);
    }
}
