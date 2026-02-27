use cv_ext_contract::{
    Action, ArtifactKind, ArtifactMeta, RunArtifact, RunReport, RunStatus, RunStepReport,
    RuntimeError, Site,
};
use serde_json::{json, Value};

use crate::{executor::ActionExecutor, registry::workflows_for_site};

#[derive(Default)]
pub struct RuntimeEngine;

impl RuntimeEngine {
    pub fn list_workflows(&self, site: Site) -> Vec<String> {
        workflows_for_site(site)
            .into_iter()
            .map(|wf| wf.id)
            .collect()
    }

    pub async fn run_workflow_with_executor<E: ActionExecutor>(
        &self,
        site: Site,
        workflow_id: &str,
        executor: &mut E,
    ) -> RunReport {
        let started_at_ms = executor.now_ms();

        let Some(workflow) = workflows_for_site(site)
            .into_iter()
            .find(|wf| wf.id == workflow_id)
        else {
            return RunReport {
                workflow_id: workflow_id.to_string(),
                site: site.as_str().to_string(),
                status: RunStatus::Failed,
                detail: "workflow id is not registered for this site".to_string(),
                started_at_ms,
                ended_at_ms: executor.now_ms(),
                steps: Vec::new(),
                artifacts: Vec::new(),
                error: Some(RuntimeError {
                    code: "workflow_missing".to_string(),
                    message: format!(
                        "workflow '{workflow_id}' is not registered for site {}",
                        site.as_str()
                    ),
                }),
            };
        };

        let mut steps = Vec::new();
        let mut artifacts = Vec::new();
        let mut had_success = false;
        let mut workflow_error: Option<RuntimeError> = None;

        for (index, action) in workflow.actions.iter().enumerate() {
            let step_started_at_ms = executor.now_ms();
            let (kind, target, outcome) = execute_action(executor, action).await;
            let step_ended_at_ms = executor.now_ms();

            match outcome {
                Ok(data) => {
                    had_success = true;
                    if let Action::ExtractTable { .. } = action {
                        if let Some(artifact) = artifact_from_extract_table(
                            site.as_str(),
                            workflow_id,
                            step_ended_at_ms,
                            index,
                            &data,
                        ) {
                            artifacts.push(artifact);
                        }
                    }

                    if let Action::Execute { command } = action {
                        if let Some(found) = data.get("artifacts").and_then(Value::as_array) {
                            for (artifact_index, artifact) in found.iter().enumerate() {
                                if let Ok(parsed) =
                                    serde_json::from_value::<RunArtifact>(artifact.clone())
                                {
                                    artifacts.push(parsed);
                                } else {
                                    artifacts.push(RunArtifact {
                                        kind: ArtifactKind::Diagnostic,
                                        name: format!("{workflow_id}:{command}:{artifact_index}"),
                                        columns: vec!["json".to_string()],
                                        rows: vec![vec![artifact.clone()]],
                                        meta: ArtifactMeta {
                                            site: site.as_str().to_string(),
                                            workflow_id: workflow_id.to_string(),
                                            generated_at_ms: step_ended_at_ms,
                                        },
                                    });
                                }
                            }
                        }
                    }

                    steps.push(RunStepReport {
                        index,
                        action_kind: kind,
                        target,
                        status: RunStatus::Success,
                        started_at_ms: step_started_at_ms,
                        ended_at_ms: step_ended_at_ms,
                        detail: "step completed".to_string(),
                        data: Some(data),
                    });
                }
                Err(message) => {
                    steps.push(RunStepReport {
                        index,
                        action_kind: kind,
                        target,
                        status: RunStatus::Failed,
                        started_at_ms: step_started_at_ms,
                        ended_at_ms: step_ended_at_ms,
                        detail: message.clone(),
                        data: None,
                    });
                    workflow_error = Some(RuntimeError {
                        code: "step_failed".to_string(),
                        message,
                    });
                    break;
                }
            }
        }

        let ended_at_ms = executor.now_ms();
        let status = if workflow_error.is_some() {
            if had_success {
                RunStatus::Partial
            } else {
                RunStatus::Failed
            }
        } else {
            RunStatus::Success
        };

        let detail = match status {
            RunStatus::Success => "workflow completed".to_string(),
            RunStatus::Partial => "workflow partially completed".to_string(),
            RunStatus::Failed => "workflow failed".to_string(),
            RunStatus::Skipped => "workflow skipped".to_string(),
        };

        RunReport {
            workflow_id: workflow.id,
            site: site.as_str().to_string(),
            status,
            detail,
            started_at_ms,
            ended_at_ms,
            steps,
            artifacts,
            error: workflow_error,
        }
    }
}

fn artifact_from_extract_table(
    site: &str,
    workflow_id: &str,
    generated_at_ms: u64,
    step_index: usize,
    data: &Value,
) -> Option<RunArtifact> {
    let rows = data.as_array()?;
    let mut columns: Vec<String> = Vec::new();
    for row in rows {
        let Some(object) = row.as_object() else {
            continue;
        };
        for key in object.keys() {
            if !columns.contains(key) {
                columns.push(key.clone());
            }
        }
    }
    columns.sort();

    let mut out_rows: Vec<Vec<Value>> = Vec::new();
    for row in rows {
        let Some(object) = row.as_object() else {
            continue;
        };
        let mut values = Vec::with_capacity(columns.len());
        for column in &columns {
            values.push(object.get(column).cloned().unwrap_or(Value::Null));
        }
        out_rows.push(values);
    }

    Some(RunArtifact {
        kind: ArtifactKind::Table,
        name: format!("{workflow_id}:extract_table:{step_index}"),
        columns,
        rows: out_rows,
        meta: ArtifactMeta {
            site: site.to_string(),
            workflow_id: workflow_id.to_string(),
            generated_at_ms,
        },
    })
}

async fn execute_action<E: ActionExecutor>(
    executor: &mut E,
    action: &Action,
) -> (String, Option<String>, Result<Value, String>) {
    match action {
        Action::WaitFor {
            selector,
            timeout_ms,
        } => (
            "wait_for".to_string(),
            Some(selector.clone()),
            executor.wait_for(selector, *timeout_ms).await,
        ),
        Action::Click { selector } => (
            "click".to_string(),
            Some(selector.clone()),
            executor.click(selector).await,
        ),
        Action::Type { selector, text } => (
            "type".to_string(),
            Some(selector.clone()),
            executor.type_text(selector, text).await,
        ),
        Action::ExtractTable { selector } => (
            "extract_table".to_string(),
            Some(selector.clone()),
            executor.extract_table(selector).await,
        ),
        Action::Execute { command } => (
            "execute".to_string(),
            Some(command.clone()),
            executor.execute_command(command).await,
        ),
    }
}

pub fn ok_payload(kind: &str, target: &str) -> Value {
    json!({
        "kind": kind,
        "target": target,
        "ok": true,
    })
}

#[cfg(test)]
mod tests {
    use cv_ext_contract::{ArtifactKind, Site};
    use futures::executor::block_on;
    use serde_json::{json, Value};

    use super::RuntimeEngine;
    use crate::executor::ActionExecutor;

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
        assert_eq!(report.artifacts[0].kind, ArtifactKind::Table);
    }

    #[test]
    fn reports_missing_workflow() {
        let engine = RuntimeEngine;
        let mut executor = TestExecutor;
        let report =
            block_on(engine.run_workflow_with_executor(Site::Jira, "missing", &mut executor));

        assert_eq!(report.workflow_id, "missing");
        assert!(report.error.is_some());
    }
}
