use cv_ext_contract::{ArtifactKind, Site};
use cv_ext_core::{executor::ActionExecutor, RuntimeEngine};
use futures::executor::block_on;
use serde_json::{json, Value};

struct TestExecutor;

#[async_trait::async_trait(?Send)]
impl ActionExecutor for TestExecutor {
    fn now_ms(&self) -> u64 {
        1
    }

    async fn wait_for(&mut self, selector: &str, _timeout_ms: u32) -> Result<Value, String> {
        Ok(json!({"selector": selector}))
    }

    async fn click(&mut self, selector: &str) -> Result<Value, String> {
        Ok(json!({"selector": selector}))
    }

    async fn type_text(&mut self, selector: &str, text: &str) -> Result<Value, String> {
        Ok(json!({"selector": selector, "text": text}))
    }

    async fn extract_table(&mut self, selector: &str) -> Result<Value, String> {
        Ok(json!([{"selector": selector, "value": "ok"}]))
    }

    async fn execute_command(&mut self, command: &str) -> Result<Value, String> {
        Ok(json!({
            "command": command,
            "artifacts": [
                {
                    "kind": "table",
                    "name": "test-artifact",
                    "columns": ["col"],
                    "rows": [["value"]],
                    "meta": { "site": "carma", "workflowId": "carma.bulk.search.scrape", "generatedAtMs": 1 }
                }
            ]
        }))
    }
}

#[test]
fn lists_site_workflows() {
    let engine = RuntimeEngine;
    let workflows = engine.list_workflows(Site::Jira);
    assert!(workflows.iter().any(|id| id == "jira.issue.capture.table"));
}

#[test]
fn executes_workflow_with_reports() {
    let engine = RuntimeEngine;
    let mut executor = TestExecutor;
    let report = block_on(engine.run_workflow_with_executor(
        Site::Carma,
        "carma.bulk.search.scrape",
        &mut executor,
    ));

    assert_eq!(report.workflow_id, "carma.bulk.search.scrape");
    assert_eq!(report.site, "carma");
    assert_eq!(report.steps.len(), 1);
    assert_eq!(report.artifacts.len(), 1);
    assert_eq!(
        report.artifacts.first().map(|artifact| &artifact.kind),
        Some(&ArtifactKind::Table)
    );
}

#[test]
fn reports_missing_workflow() {
    let engine = RuntimeEngine;
    let mut executor = TestExecutor;
    let report = block_on(engine.run_workflow_with_executor(Site::Jira, "missing", &mut executor));

    assert_eq!(report.workflow_id, "missing");
    assert!(report.error.is_some());
}
