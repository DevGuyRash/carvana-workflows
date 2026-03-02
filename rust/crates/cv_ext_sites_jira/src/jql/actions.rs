use super::tree::{find_clause_mut, find_group_mut, remove_node_by_id};
use super::{
    JqlBuilderState, JqlClauseState, JqlGroupState, JqlHistoryState, JqlJoiner, JqlListMode,
    JqlNodeState, JqlSortState, JqlValueMode, JqlValueState, SortDirection,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum JqlAction {
    SetClauseField {
        clause_id: String,
        field: String,
        field_label: Option<String>,
    },
    SetClauseOperator {
        clause_id: String,
        operator_key: String,
    },
    SetClauseNot {
        clause_id: String,
        not: bool,
    },
    SetClauseJoiner {
        clause_id: String,
        joiner: Option<JqlJoiner>,
    },
    SetValueMode {
        clause_id: String,
        mode: JqlValueMode,
    },
    SetValueText {
        clause_id: String,
        text: String,
    },
    SetValueList {
        clause_id: String,
        list: Vec<String>,
        list_mode: Option<JqlListMode>,
    },
    SetGroupMode {
        group_id: String,
        mode: JqlJoiner,
    },
    SetGroupNot {
        group_id: String,
        not: bool,
    },
    SetGroupJoiner {
        group_id: String,
        joiner: Option<JqlJoiner>,
    },
    AddClause {
        group_id: String,
        clause_id: String,
    },
    AddGroup {
        group_id: String,
        new_group_id: String,
        first_clause_id: String,
    },
    RemoveNode {
        node_id: String,
    },
    AddSort {
        sort_id: String,
        field: String,
        direction: SortDirection,
    },
    RemoveSort {
        sort_id: String,
    },
    SetSettings {
        auto_quote: Option<bool>,
        run_search: Option<bool>,
        show_all_operators: Option<bool>,
        prefer_field_ids: Option<bool>,
    },
}

pub fn apply_action(state: &mut JqlBuilderState, action: JqlAction) -> Result<(), String> {
    match action {
        JqlAction::SetClauseField {
            clause_id,
            field,
            field_label,
        } => {
            let clause = find_clause_mut(&mut state.root, &clause_id).ok_or("clause not found")?;
            clause.field = field;
            clause.field_label = field_label;
            Ok(())
        }
        JqlAction::SetClauseOperator {
            clause_id,
            operator_key,
        } => {
            let clause = find_clause_mut(&mut state.root, &clause_id).ok_or("clause not found")?;
            clause.operator_key = operator_key;
            Ok(())
        }
        JqlAction::SetClauseNot { clause_id, not } => {
            let clause = find_clause_mut(&mut state.root, &clause_id).ok_or("clause not found")?;
            clause.not = not;
            Ok(())
        }
        JqlAction::SetClauseJoiner { clause_id, joiner } => {
            let clause = find_clause_mut(&mut state.root, &clause_id).ok_or("clause not found")?;
            clause.joiner = joiner;
            Ok(())
        }
        JqlAction::SetValueMode { clause_id, mode } => {
            let clause = find_clause_mut(&mut state.root, &clause_id).ok_or("clause not found")?;
            clause.value.mode = mode;
            Ok(())
        }
        JqlAction::SetValueText { clause_id, text } => {
            let clause = find_clause_mut(&mut state.root, &clause_id).ok_or("clause not found")?;
            clause.value.text = text;
            Ok(())
        }
        JqlAction::SetValueList {
            clause_id,
            list,
            list_mode,
        } => {
            let clause = find_clause_mut(&mut state.root, &clause_id).ok_or("clause not found")?;
            clause.value.list = list;
            if let Some(mode) = list_mode {
                clause.value.list_mode = mode;
            }
            Ok(())
        }
        JqlAction::SetGroupMode { group_id, mode } => {
            let group = find_group_mut(&mut state.root, &group_id).ok_or("group not found")?;
            group.mode = mode;
            Ok(())
        }
        JqlAction::SetGroupNot { group_id, not } => {
            let group = find_group_mut(&mut state.root, &group_id).ok_or("group not found")?;
            group.not = not;
            Ok(())
        }
        JqlAction::SetGroupJoiner { group_id, joiner } => {
            let group = find_group_mut(&mut state.root, &group_id).ok_or("group not found")?;
            group.joiner = joiner;
            Ok(())
        }
        JqlAction::AddClause {
            group_id,
            clause_id,
        } => {
            let group = find_group_mut(&mut state.root, &group_id).ok_or("group not found")?;
            group
                .children
                .push(JqlNodeState::Clause(Box::new(JqlClauseState {
                    id: clause_id,
                    joiner: None,
                    not: false,
                    field: String::new(),
                    field_label: Some(String::new()),
                    operator_key: "equals".to_string(),
                    value: JqlValueState::default(),
                    history: JqlHistoryState::default(),
                })));
            Ok(())
        }
        JqlAction::AddGroup {
            group_id,
            new_group_id,
            first_clause_id,
        } => {
            let group = find_group_mut(&mut state.root, &group_id).ok_or("group not found")?;
            group.children.push(JqlNodeState::Group(JqlGroupState {
                id: new_group_id,
                joiner: None,
                not: false,
                mode: JqlJoiner::And,
                children: vec![JqlNodeState::Clause(Box::new(JqlClauseState {
                    id: first_clause_id,
                    joiner: None,
                    not: false,
                    field: String::new(),
                    field_label: Some(String::new()),
                    operator_key: "equals".to_string(),
                    value: JqlValueState::default(),
                    history: JqlHistoryState::default(),
                }))],
            }));
            Ok(())
        }
        JqlAction::RemoveNode { node_id } => {
            if state.root.id == node_id {
                return Err("cannot remove root group".to_string());
            }
            if remove_node_by_id(&mut state.root, &node_id) {
                Ok(())
            } else {
                Err("node not found".to_string())
            }
        }
        JqlAction::AddSort {
            sort_id,
            field,
            direction,
        } => {
            state.sorts.push(JqlSortState {
                id: sort_id,
                field,
                direction,
            });
            Ok(())
        }
        JqlAction::RemoveSort { sort_id } => {
            let before = state.sorts.len();
            state.sorts.retain(|s| s.id != sort_id);
            if state.sorts.len() < before {
                Ok(())
            } else {
                Err("sort not found".to_string())
            }
        }
        JqlAction::SetSettings {
            auto_quote,
            run_search,
            show_all_operators,
            prefer_field_ids,
        } => {
            if let Some(v) = auto_quote {
                state.settings.auto_quote = v;
            }
            if let Some(v) = run_search {
                state.settings.run_search = v;
            }
            if let Some(v) = show_all_operators {
                state.settings.show_all_operators = v;
            }
            if let Some(v) = prefer_field_ids {
                state.settings.prefer_field_ids = v;
            }
            Ok(())
        }
    }
}
