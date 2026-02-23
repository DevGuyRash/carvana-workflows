mod dom;
mod errors;

use cv_ext_contract::{Site, WorkflowDefinition};
use cv_ext_core::{detect_site_from_href, workflows_for_site, RuntimeEngine};
use cv_ext_workflows_jira::rows_with_derived_fields;
use wasm_bindgen::prelude::*;

use crate::errors::WasmRuntimeError;

fn parse_site(site: &str) -> Result<Site, WasmRuntimeError> {
    Site::try_from(site).map_err(WasmRuntimeError::from)
}

fn to_js_value<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(|err| JsValue::from_str(&err.to_string()))
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
pub fn run_workflow(site: String, workflow_id: String) -> Result<JsValue, JsValue> {
    let parsed = parse_site(&site).map_err(|err| JsValue::from_str(&err.to_string()))?;
    let engine = RuntimeEngine;
    let result = engine.run_workflow(parsed, &workflow_id);
    to_js_value(&result)
}

#[wasm_bindgen]
pub fn capture_jira_filter_table() -> Result<JsValue, JsValue> {
    let rows = dom::capture_table_rows("table").map_err(|err| JsValue::from_str(&err.to_string()))?;
    let derived = rows_with_derived_fields(rows);
    to_js_value(&derived)
}
