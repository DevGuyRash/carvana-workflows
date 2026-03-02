use serde::{Deserialize, Serialize};

use crate::{Action, Site};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    pub id: String,
    pub label: String,
    pub description: String,
    pub site: Site,
    pub actions: Vec<Action>,
    pub internal: bool,
}
