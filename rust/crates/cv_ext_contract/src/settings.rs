use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Debug,
    #[default]
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SiteSettings {
    pub enabled: bool,
    pub default_rules: Vec<String>,
}

impl Default for SiteSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            default_rules: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ExtensionSettings {
    pub theme: String,
    pub log_level: LogLevel,
    pub log_retention_days: u16,
    pub notifications_enabled: bool,
    pub auto_run_rules: bool,
    pub sites: HashMap<String, SiteSettings>,
}

impl Default for ExtensionSettings {
    fn default() -> Self {
        Self {
            theme: "midnight".to_string(),
            log_level: LogLevel::Info,
            log_retention_days: 7,
            notifications_enabled: true,
            auto_run_rules: true,
            sites: HashMap::new(),
        }
    }
}
