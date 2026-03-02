use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Action {
    WaitFor { selector: String, timeout_ms: u32 },
    Click { selector: String },
    Type { selector: String, text: String },
    ExtractTable { selector: String },
    Execute { command: String },
}
