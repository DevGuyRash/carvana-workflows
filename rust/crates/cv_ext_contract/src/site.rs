use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Site {
    Jira,
    Oracle,
    Carma,
}

impl Site {
    pub fn as_str(self) -> &'static str {
        match self {
            Site::Jira => "jira",
            Site::Oracle => "oracle",
            Site::Carma => "carma",
        }
    }
}

impl TryFrom<&str> for Site {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.to_lowercase().as_str() {
            "jira" => Ok(Site::Jira),
            "oracle" => Ok(Site::Oracle),
            "carma" => Ok(Site::Carma),
            other => Err(format!("unsupported site: {other}")),
        }
    }
}
