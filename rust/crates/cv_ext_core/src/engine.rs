use cv_ext_contract::{RunResult, Site};

use crate::registry::workflows_for_site;

#[derive(Default)]
pub struct RuntimeEngine;

impl RuntimeEngine {
    pub fn list_workflows(&self, site: Site) -> Vec<String> {
        workflows_for_site(site).into_iter().map(|wf| wf.id).collect()
    }

    pub fn run_workflow(&self, site: Site, workflow_id: &str) -> RunResult {
        let workflow = workflows_for_site(site)
            .into_iter()
            .find(|wf| wf.id == workflow_id);

        match workflow {
            Some(found) => RunResult {
                workflow_id: found.id,
                status: "ready".to_string(),
                detail: "workflow routed to rust runtime".to_string(),
            },
            None => RunResult {
                workflow_id: workflow_id.to_string(),
                status: "missing".to_string(),
                detail: "workflow id is not registered for this site".to_string(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use cv_ext_contract::Site;

    use super::RuntimeEngine;

    #[test]
    fn lists_site_workflows() {
        let engine = RuntimeEngine;
        let workflows = engine.list_workflows(Site::Jira);
        assert!(workflows.iter().any(|id| id == "jira.issue.capture.table"));
    }
}
