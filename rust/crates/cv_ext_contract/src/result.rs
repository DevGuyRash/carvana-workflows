use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunStatus {
    Success,
    Failed,
    Partial,
    Skipped,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RuntimeError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactKind {
    Table,
    Records,
    Diagnostic,
    Alert,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactMeta {
    pub site: String,
    pub workflow_id: String,
    pub generated_at_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunArtifact {
    pub kind: ArtifactKind,
    pub name: String,
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Value>>,
    pub meta: ArtifactMeta,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RunStepReport {
    pub index: usize,
    pub action_kind: String,
    pub target: Option<String>,
    pub status: RunStatus,
    pub started_at_ms: u64,
    pub ended_at_ms: u64,
    pub detail: String,
    pub data: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RunReport {
    pub workflow_id: String,
    pub site: String,
    pub status: RunStatus,
    pub detail: String,
    pub started_at_ms: u64,
    pub ended_at_ms: u64,
    pub steps: Vec<RunStepReport>,
    pub artifacts: Vec<RunArtifact>,
    pub error: Option<RuntimeError>,
}

pub type RunResult = RunReport;
