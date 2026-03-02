use super::format::{format_list_value, format_text_search_value, format_value, quote_if_needed};
use super::operators::resolve_operator;
use super::{
    JqlBuilderState, JqlClauseState, JqlGroupState, JqlHistoryState, JqlJoiner, JqlNodeState,
    JqlOperatorHistoryMode, JqlOperatorValueMode, JqlSortState,
};

pub(super) const RESERVED_WORDS: &[&str] = &[
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

pub(super) fn build_order_by(sorts: &[JqlSortState]) -> String {
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

pub(super) fn build_group(group: &JqlGroupState, opts: BuildOptions) -> String {
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

pub(super) fn child_joiner(node: &JqlNodeState) -> Option<JqlJoiner> {
    match node {
        JqlNodeState::Clause(clause) => clause.joiner,
        JqlNodeState::Group(group) => group.joiner,
    }
}

pub(super) fn build_node(node: &JqlNodeState, opts: BuildOptions) -> String {
    match node {
        JqlNodeState::Group(group) => build_group(group, opts),
        JqlNodeState::Clause(clause) => build_clause(clause, opts),
    }
}

pub(super) fn build_clause(clause: &JqlClauseState, opts: BuildOptions) -> String {
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

pub(super) fn build_history(
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
