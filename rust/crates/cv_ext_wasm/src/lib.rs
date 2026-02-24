mod bridge_rules;
mod bridge_jql;
mod bridge_settings;
mod bridge_theme;
mod commands;
mod dom;
mod errors;

use cv_ext_contract::{Site, WorkflowDefinition};
use cv_ext_core::executor::ActionExecutor;
use cv_ext_core::{detect_site_from_href, workflows_for_site, RuntimeEngine};
use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

use crate::errors::WasmRuntimeError;

fn parse_site(site: &str) -> Result<Site, WasmRuntimeError> {
    Site::try_from(site).map_err(WasmRuntimeError::from)
}

fn to_js_value<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(|err| JsValue::from_str(&err.to_string()))
}

fn parse_input_context(raw: Option<String>) -> Value {
    let Some(text) = raw else {
        return Value::Null;
    };

    serde_json::from_str::<Value>(&text).unwrap_or_else(|_| {
        json!({
            "raw": text,
        })
    })
}

struct WasmActionExecutor {
    context: Value,
}

impl WasmActionExecutor {
    fn new(context: Value) -> Self {
        Self { context }
    }
}

#[async_trait::async_trait(?Send)]
impl ActionExecutor for WasmActionExecutor {
    fn now_ms(&self) -> u64 {
        js_sys::Date::now() as u64
    }

    async fn wait_for(&mut self, selector: &str, timeout_ms: u32) -> Result<Value, String> {
        dom::wait_for_selector(selector, timeout_ms)
            .await
            .map(|_| json!({"selector": selector, "timeoutMs": timeout_ms, "ok": true}))
            .map_err(|error| error.to_string())
    }

    async fn click(&mut self, selector: &str) -> Result<Value, String> {
        dom::click_selector(selector)
            .map(|_| json!({"selector": selector, "clicked": true}))
            .map_err(|error| error.to_string())
    }

    async fn type_text(&mut self, selector: &str, text: &str) -> Result<Value, String> {
        dom::type_selector(selector, text)
            .map(|_| json!({"selector": selector, "typed": true, "text": text}))
            .map_err(|error| error.to_string())
    }

    async fn extract_table(&mut self, selector: &str) -> Result<Value, String> {
        dom::capture_table_rows(selector)
            .and_then(|rows| {
                serde_json::to_value(rows)
                    .map_err(|error| WasmRuntimeError::from(format!("serialize extract table rows: {error}")))
            })
            .map_err(|error| error.to_string())
    }

    async fn execute_command(&mut self, command: &str) -> Result<Value, String> {
        commands::execute_command(command, &self.context)
            .await
            .map_err(|error| error.to_string())
    }
}

#[wasm_bindgen]
pub fn detect_site(href: String) -> String {
    detect_site_from_href(&href)
        .map(|site| site.as_str().to_string())
        .unwrap_or_else(|| "unsupported".to_string())
}

#[wasm_bindgen]
pub fn list_workflows(site: String) -> Result<JsValue, JsValue> {
    let parsed = parse_site(&site).map_err(|err| JsValue::from_str(&err.to_string()))?;
    let workflows: Vec<WorkflowDefinition> = workflows_for_site(parsed);
    to_js_value(&workflows)
}

#[wasm_bindgen]
pub async fn run_workflow(
    site: String,
    workflow_id: String,
    input_json: Option<String>,
) -> Result<JsValue, JsValue> {
    let parsed = parse_site(&site).map_err(|err| JsValue::from_str(&err.to_string()))?;
    let engine = RuntimeEngine;
    let context = parse_input_context(input_json);
    let mut executor = WasmActionExecutor::new(context);
    let result = engine
        .run_workflow_with_executor(parsed, &workflow_id, &mut executor)
        .await;
    to_js_value(&result)
}

#[wasm_bindgen]
pub async fn capture_jira_filter_table() -> Result<JsValue, JsValue> {
    let payload = commands::execute_command("jira.capture.filter_table", &Value::Null)
        .await
        .map_err(|err| JsValue::from_str(&err.to_string()))?;
    to_js_value(&payload)
}
