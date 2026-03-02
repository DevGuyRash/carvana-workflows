use cv_ext_ui_components::table_selection::{SelectionMode, TableSelectionState};

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
