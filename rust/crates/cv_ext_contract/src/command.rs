use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CommandTarget {
    Background,
    Content,
    SidePanel,
    Popup,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CommandType {
    DetectSite,
    ListWorkflows,
    RunWorkflow,
    CaptureTable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommandEnvelope {
    pub id: String,
    pub schema_version: u16,
    pub target: CommandTarget,
    pub command_type: CommandType,
    pub payload: Option<String>,
}
