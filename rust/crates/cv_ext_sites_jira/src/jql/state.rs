use super::{JqlHistoryState, JqlJoiner, JqlValueState};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SortDirection {
    Asc,
    Desc,
}

impl SortDirection {
    pub(super) fn as_str(&self) -> &'static str {
        match self {
            Self::Asc => "ASC",
            Self::Desc => "DESC",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JqlSortState {
    pub id: String,
    pub field: String,
    pub direction: SortDirection,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JqlClauseState {
    pub id: String,
    pub joiner: Option<JqlJoiner>,
    pub not: bool,
    pub field: String,
    pub field_label: Option<String>,
    pub operator_key: String,
    pub value: JqlValueState,
    pub history: JqlHistoryState,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JqlGroupState {
    pub id: String,
    pub joiner: Option<JqlJoiner>,
    pub not: bool,
    pub mode: JqlJoiner,
    pub children: Vec<JqlNodeState>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum JqlNodeState {
    Clause(Box<JqlClauseState>),
    Group(JqlGroupState),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuilderSettings {
    pub auto_quote: bool,
    pub run_search: bool,
    pub show_all_operators: bool,
    pub prefer_field_ids: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuilderUiState {
    pub active_clause_id: Option<String>,
    pub field_filter: String,
    pub function_filter: String,
    pub panel_collapsed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JqlBuilderState {
    pub root: JqlGroupState,
    pub sorts: Vec<JqlSortState>,
    pub settings: BuilderSettings,
    pub ui: BuilderUiState,
}

pub fn default_state() -> JqlBuilderState {
    let clause = JqlClauseState {
        id: "clause-1".to_string(),
        joiner: None,
        not: false,
        field: String::new(),
        field_label: Some(String::new()),
        operator_key: "equals".to_string(),
        value: JqlValueState::default(),
        history: JqlHistoryState::default(),
    };
    let root = JqlGroupState {
        id: "root".to_string(),
        joiner: None,
        not: false,
        mode: JqlJoiner::And,
        children: vec![JqlNodeState::Clause(Box::new(clause))],
    };
    JqlBuilderState {
        root,
        sorts: Vec::new(),
        settings: BuilderSettings {
            auto_quote: true,
            run_search: false,
            show_all_operators: false,
            prefer_field_ids: false,
        },
        ui: BuilderUiState {
            active_clause_id: None,
            field_filter: String::new(),
            function_filter: String::new(),
            panel_collapsed: false,
        },
    }
}
