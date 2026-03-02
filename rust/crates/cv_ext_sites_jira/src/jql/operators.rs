use super::{JqlOperatorDef, JqlOperatorHistoryMode, JqlOperatorValueMode};

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

const DEFAULT_OPERATOR_DEF: JqlOperatorDef = JqlOperatorDef {
    key: "=",
    operator: "=",
    value_mode: JqlOperatorValueMode::Single,
    value_preset: None,
    history_mode: None,
};

pub(super) fn resolve_operator(key: &str) -> &'static JqlOperatorDef {
    OPERATOR_DEFS
        .iter()
        .find(|def| def.key == key)
        .or_else(|| OPERATOR_DEFS.first())
        .unwrap_or(&DEFAULT_OPERATOR_DEF)
}
