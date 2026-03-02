use crate::{Action, Site};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuleTrigger {
    OnPageLoad,
    OnDemand,
    OnUrlMatch,
    OnElementAppear { selector: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuleCategory {
    DataCapture,
    FormAutomation,
    UiEnhancement,
    Navigation,
    Validation,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuleDefinition {
    pub id: String,
    pub label: String,
    pub description: String,
    pub site: Site,
    pub enabled: bool,
    pub url_pattern: Option<String>,
    pub trigger: RuleTrigger,
    pub actions: Vec<Action>,
    pub priority: u16,
    pub category: RuleCategory,
    pub builtin: bool,
}
