use serde::{Deserialize, Serialize};

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JqlJoiner {
    And,
    Or,
}

impl JqlJoiner {
    fn as_str(&self) -> &'static str {
        match self {
            Self::And => "AND",
            Self::Or => "OR",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JqlValueMode {
    Text,
    Number,
    Date,
    Relative,
    User,
    Function,
    Raw,
    List,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JqlListMode {
    Text,
    Raw,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JqlEmptyValue {
    Empty,
    Null,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextSearchMode {
    Simple,
    Phrase,
    Wildcard,
    Prefix,
    Suffix,
    Fuzzy,
    Proximity,
    Boost,
    Raw,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JqlValueState {
    pub mode: JqlValueMode,
    pub text: String,
    pub list: Vec<String>,
    pub list_mode: JqlListMode,
    pub empty_value: JqlEmptyValue,
    pub text_search_mode: TextSearchMode,
    pub text_search_distance: String,
    pub text_search_boost: String,
}

impl Default for JqlValueState {
    fn default() -> Self {
        Self {
            mode: JqlValueMode::Text,
            text: String::new(),
            list: Vec::new(),
            list_mode: JqlListMode::Text,
            empty_value: JqlEmptyValue::Empty,
            text_search_mode: TextSearchMode::Simple,
            text_search_distance: "10".to_string(),
            text_search_boost: "2".to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct JqlHistoryState {
    pub from: Option<String>,
    pub to: Option<String>,
    pub by: Option<String>,
    pub after: Option<String>,
    pub before: Option<String>,
    pub on: Option<String>,
    pub during: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JqlOperatorValueMode {
    None,
    Single,
    List,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JqlOperatorHistoryMode {
    Was,
    Changed,
}

#[derive(Debug, Clone)]
pub struct JqlOperatorDef {
    pub key: &'static str,
    pub operator: &'static str,
    pub value_mode: JqlOperatorValueMode,
    pub value_preset: Option<&'static str>,
    pub history_mode: Option<JqlOperatorHistoryMode>,
}

const OPERATOR_DEFS: &[JqlOperatorDef] = &[
    JqlOperatorDef {
        key: "equals",
        operator: "=",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "not-equals",
        operator: "!=",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "greater-than",
        operator: ">",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "greater-than-equals",
        operator: ">=",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "less-than",
        operator: "<",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "less-than-equals",
        operator: "<=",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "contains",
        operator: "~",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "not-contains",
        operator: "!~",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "in",
        operator: "IN",
        value_mode: JqlOperatorValueMode::List,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "not-in",
        operator: "NOT IN",
        value_mode: JqlOperatorValueMode::List,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "is",
        operator: "IS",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "is-not",
        operator: "IS NOT",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: None,
    },
    JqlOperatorDef {
        key: "is-empty",
        operator: "IS",
        value_mode: JqlOperatorValueMode::None,
        value_preset: Some("EMPTY"),
        history_mode: None,
    },
    JqlOperatorDef {
        key: "is-not-empty",
        operator: "IS NOT",
        value_mode: JqlOperatorValueMode::None,
        value_preset: Some("EMPTY"),
        history_mode: None,
    },
    JqlOperatorDef {
        key: "is-null",
        operator: "IS",
        value_mode: JqlOperatorValueMode::None,
        value_preset: Some("NULL"),
        history_mode: None,
    },
    JqlOperatorDef {
        key: "is-not-null",
        operator: "IS NOT",
        value_mode: JqlOperatorValueMode::None,
        value_preset: Some("NULL"),
        history_mode: None,
    },
    JqlOperatorDef {
        key: "was",
        operator: "WAS",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: Some(JqlOperatorHistoryMode::Was),
    },
    JqlOperatorDef {
        key: "was-not",
        operator: "WAS NOT",
        value_mode: JqlOperatorValueMode::Single,
        value_preset: None,
        history_mode: Some(JqlOperatorHistoryMode::Was),
    },
    JqlOperatorDef {
        key: "was-in",
        operator: "WAS IN",
        value_mode: JqlOperatorValueMode::List,
        value_preset: None,
        history_mode: Some(JqlOperatorHistoryMode::Was),
    },
    JqlOperatorDef {
        key: "was-not-in",
        operator: "WAS NOT IN",
        value_mode: JqlOperatorValueMode::List,
        value_preset: None,
        history_mode: Some(JqlOperatorHistoryMode::Was),
    },
    JqlOperatorDef {
        key: "was-empty",
        operator: "WAS",
        value_mode: JqlOperatorValueMode::None,
        value_preset: Some("EMPTY"),
        history_mode: Some(JqlOperatorHistoryMode::Was),
    },
    JqlOperatorDef {
        key: "was-not-empty",
        operator: "WAS NOT",
        value_mode: JqlOperatorValueMode::None,
        value_preset: Some("EMPTY"),
        history_mode: Some(JqlOperatorHistoryMode::Was),
    },
    JqlOperatorDef {
        key: "changed",
        operator: "CHANGED",
        value_mode: JqlOperatorValueMode::None,
        value_preset: None,
        history_mode: Some(JqlOperatorHistoryMode::Changed),
    },
];

fn resolve_operator(key: &str) -> &'static JqlOperatorDef {
    OPERATOR_DEFS
        .iter()
        .find(|def| def.key == key)
        .unwrap_or(&OPERATOR_DEFS[0])
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SortDirection {
    Asc,
    Desc,
}

impl SortDirection {
    fn as_str(&self) -> &'static str {
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
    Clause(JqlClauseState),
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
        children: vec![JqlNodeState::Clause(clause)],
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
            group.children.push(JqlNodeState::Clause(JqlClauseState {
                id: clause_id,
                joiner: None,
                not: false,
                field: String::new(),
                field_label: Some(String::new()),
                operator_key: "equals".to_string(),
                value: JqlValueState::default(),
                history: JqlHistoryState::default(),
            }));
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
                children: vec![JqlNodeState::Clause(JqlClauseState {
                    id: first_clause_id,
                    joiner: None,
                    not: false,
                    field: String::new(),
                    field_label: Some(String::new()),
                    operator_key: "equals".to_string(),
                    value: JqlValueState::default(),
                    history: JqlHistoryState::default(),
                })],
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

fn find_group_mut<'a>(group: &'a mut JqlGroupState, id: &str) -> Option<&'a mut JqlGroupState> {
    if group.id == id {
        return Some(group);
    }
    for child in group.children.iter_mut() {
        if let JqlNodeState::Group(nested) = child {
            if let Some(found) = find_group_mut(nested, id) {
                return Some(found);
            }
        }
    }
    None
}

fn find_clause_mut<'a>(group: &'a mut JqlGroupState, id: &str) -> Option<&'a mut JqlClauseState> {
    for child in group.children.iter_mut() {
        match child {
            JqlNodeState::Clause(clause) if clause.id == id => return Some(clause),
            JqlNodeState::Group(nested) => {
                if let Some(found) = find_clause_mut(nested, id) {
                    return Some(found);
                }
            }
            _ => {}
        }
    }
    None
}

fn remove_node_by_id(group: &mut JqlGroupState, id: &str) -> bool {
    let before = group.children.len();
    group.children.retain(|child| match child {
        JqlNodeState::Clause(clause) => clause.id != id,
        JqlNodeState::Group(nested) => nested.id != id,
    });
    if group.children.len() < before {
        return true;
    }
    for child in group.children.iter_mut() {
        if let JqlNodeState::Group(nested) = child {
            if remove_node_by_id(nested, id) {
                return true;
            }
        }
    }
    false
}

const RESERVED_WORDS: &[&str] = &[
    "and", "or", "not", "in", "is", "was", "changed", "empty", "null", "order by", "asc", "desc",
    "from", "to", "by", "after", "before", "on", "during",
];

#[derive(Debug, Clone, Copy)]
pub struct BuildOptions {
    pub auto_quote: bool,
}

impl Default for BuildOptions {
    fn default() -> Self {
        Self { auto_quote: true }
    }
}

pub fn build_jql(state: &JqlBuilderState, opts: BuildOptions) -> String {
    let query = build_group(&state.root, opts);
    let order_by = build_order_by(&state.sorts);
    match (query.is_empty(), order_by.is_empty()) {
        (true, true) => String::new(),
        (false, true) => query,
        (true, false) => order_by,
        (false, false) => format!("{query} {order_by}").trim().to_string(),
    }
}

fn build_order_by(sorts: &[JqlSortState]) -> String {
    let mut items: Vec<String> = Vec::new();
    for sort in sorts {
        let field = sort.field.trim();
        if field.is_empty() {
            continue;
        }
        items.push(format!("{field} {}", sort.direction.as_str()));
    }
    if items.is_empty() {
        String::new()
    } else {
        format!("ORDER BY {}", items.join(", "))
    }
}

fn build_group(group: &JqlGroupState, opts: BuildOptions) -> String {
    let mut pieces: Vec<String> = Vec::new();
    for child in &group.children {
        let fragment = build_node(child, opts);
        if fragment.is_empty() {
            continue;
        }
        if !pieces.is_empty() {
            let joiner = child_joiner(child).unwrap_or(group.mode).as_str();
            pieces.push(joiner.to_string());
        }
        pieces.push(fragment);
    }

    if pieces.is_empty() {
        return String::new();
    }

    let joined = pieces.join(" ");
    let needs_wrap = pieces.len() > 1;
    let mut value = if needs_wrap {
        format!("({joined})")
    } else {
        joined
    };
    if group.not {
        value = format!("NOT ({value})");
    }
    value
}

fn child_joiner(node: &JqlNodeState) -> Option<JqlJoiner> {
    match node {
        JqlNodeState::Clause(clause) => clause.joiner,
        JqlNodeState::Group(group) => group.joiner,
    }
}

fn build_node(node: &JqlNodeState, opts: BuildOptions) -> String {
    match node {
        JqlNodeState::Group(group) => build_group(group, opts),
        JqlNodeState::Clause(clause) => build_clause(clause, opts),
    }
}

fn build_clause(clause: &JqlClauseState, opts: BuildOptions) -> String {
    let field = clause.field.trim();
    if field.is_empty() {
        return String::new();
    }

    let operator = resolve_operator(&clause.operator_key);
    let value = match operator.value_mode {
        JqlOperatorValueMode::None => operator.value_preset.unwrap_or("").to_string(),
        JqlOperatorValueMode::Single => {
            if operator.operator == "~" || operator.operator == "!~" {
                format_text_search_value(&clause.value)
            } else {
                format_value(&clause.value, opts, JqlOperatorValueMode::Single)
            }
        }
        JqlOperatorValueMode::List => format_list_value(&clause.value, opts),
    };

    let mut expr = format!("{field} {}", operator.operator);
    if !value.is_empty() {
        expr.push(' ');
        expr.push_str(&value);
    }

    if let Some(history_mode) = operator.history_mode {
        let history = build_history(&clause.history, history_mode, opts);
        if !history.is_empty() {
            expr.push(' ');
            expr.push_str(&history);
        }
    }

    if clause.not {
        format!("NOT ({expr})")
    } else {
        expr
    }
}

fn build_history(
    history: &JqlHistoryState,
    mode: JqlOperatorHistoryMode,
    opts: BuildOptions,
) -> String {
    let mut parts: Vec<String> = Vec::new();
    match mode {
        JqlOperatorHistoryMode::Changed => {
            if let Some(from) = history
                .from
                .as_ref()
                .map(|v| v.trim())
                .filter(|v| !v.is_empty())
            {
                parts.push(format!("FROM {}", quote_if_needed(from, opts)));
            }
            if let Some(to) = history
                .to
                .as_ref()
                .map(|v| v.trim())
                .filter(|v| !v.is_empty())
            {
                parts.push(format!("TO {}", quote_if_needed(to, opts)));
            }
        }
        JqlOperatorHistoryMode::Was => {}
    }
    for (label, maybe) in [
        ("BY", history.by.as_deref()),
        ("AFTER", history.after.as_deref()),
        ("BEFORE", history.before.as_deref()),
        ("ON", history.on.as_deref()),
        ("DURING", history.during.as_deref()),
    ] {
        if let Some(value) = maybe.map(|v| v.trim()).filter(|v| !v.is_empty()) {
            parts.push(format!("{label} {}", quote_if_needed(value, opts)));
        }
    }
    parts.join(" ")
}

fn format_list_value(value: &JqlValueState, opts: BuildOptions) -> String {
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

fn format_value(value: &JqlValueState, opts: BuildOptions, _mode: JqlOperatorValueMode) -> String {
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

fn format_text_search_value(value: &JqlValueState) -> String {
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

fn escape_lucene(
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

fn wrap_jql_string(value: &str) -> String {
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

fn looks_like_function(raw: &str) -> bool {
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

fn quote_if_needed(raw: &str, opts: BuildOptions) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_basic_query() {
        let mut state = default_state();
        if let JqlNodeState::Clause(ref mut clause) = state.root.children[0] {
            clause.field = "assignee".to_string();
            clause.value.text = "currentUser()".to_string();
            clause.value.mode = JqlValueMode::Function;
        }
        let query = build_jql(&state, BuildOptions::default());
        assert_eq!(query, "assignee = currentUser()");
    }
}
