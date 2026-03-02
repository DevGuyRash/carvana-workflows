use serde::{Deserialize, Serialize};

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JqlJoiner {
    And,
    Or,
}

impl JqlJoiner {
    pub(super) fn as_str(&self) -> &'static str {
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
