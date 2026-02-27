use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, HashMap};
use std::rc::Rc;

use cv_ext_contract::{ArtifactKind, ArtifactMeta, RunArtifact};
use futures::future::join_all;
use js_sys::Date;
use serde_json::{json, Value};
use wasm_bindgen::JsCast;

use crate::{carma_ui::CarmaPanelState, dom, errors::WasmRuntimeError};

const ORACLE_INVOICE_BUTTON: &str = "a[role='button'][aria-label*='Search: Invoice']";
const ORACLE_SUPPLIER_INPUT: &str = "input[aria-label*='Supplier'], input[id*='supplier']";
const ORACLE_SUPPLIER_SITE_INPUT: &str =
    "input[aria-label*='Supplier Site'], input[id*='SupplierSite'], input[id*='supplierSite']";
const ORACLE_INVOICE_GROUP_INPUT: &str =
    "input[aria-label='Invoice Group'], input[aria-label*='Invoice Group'], input[id*='InvoiceGroup']";
const ORACLE_AMOUNT_INPUT: &str =
    "input[aria-label='Amount'], input[aria-label*='Amount'], input[id*='Amount']";
const ORACLE_DESCRIPTION_INPUT: &str =
    "textarea[aria-label*='Description'], input[aria-label*='Description'], textarea[id*='Description'], input[id*='Description']";
const ORACLE_INVOICE_NUMBER_INPUT: &str =
    "input[aria-label='Number'], input[aria-label*='Invoice Number'], input[id*='InvoiceNumber'], input[id*='invoiceNumber']";
const ORACLE_BUSINESS_UNIT_INPUT: &str =
    "input[aria-label*='Business Unit'], input[id*='BusinessUnit'], input[id*='businessUnit']";

pub async fn execute_command(command: &str, context: &Value) -> Result<Value, WasmRuntimeError> {
    match command {
        "jira.install_jql_builder" => install_jql_builder_switcher_hooks(),
        "jira.open_jql_builder" => open_jql_builder_panel(),
        "jira.capture.filter_table" => jira_capture_filter_table(),
        "carma.show_panel" => carma_show_panel(),
        "carma.bulk.search.scrape" => carma_bulk_search_scrape(context).await,
        "carma.bulk.search.cancel" => carma_bulk_search_cancel(),
        "oracle.expand_invoice" => oracle_expand_invoice(),
        "oracle.expand_invoice.perform" => oracle_expand_invoice_perform(),
        "oracle.expand_invoice.ensure" => oracle_expand_invoice_ensure(),
        "oracle.invoice.validation.alert" => oracle_invoice_validation_alert().await,
        "oracle.invoice.validation.verify" => oracle_invoice_validation_verify(context).await,
        "oracle.invoice.create" => oracle_invoice_create(context).await,
        "oracle.invoice.create.business_unit.ensure" => {
            oracle_invoice_business_unit_ensure(context)
        }
        "oracle.invoice.create.supplier.lov" => oracle_invoice_supplier_lov(context).await,
        "oracle.invoice.create.supplier_site.fill" => oracle_invoice_supplier_site_fill(context),
        "oracle.invoice.create.supplier_site.ensure" => oracle_invoice_supplier_site_ensure(context),
        "oracle.invoice.create.number" => oracle_invoice_create_number(context),
        other => Err(WasmRuntimeError::from(format!(
            "unsupported command: {other}"
        ))),
    }
}

fn today_mmddyyyy() -> String {
    let now = Date::new_0();
    let month = now.get_month() + 1;
    let day = now.get_date();
    let year = now.get_full_year();
    format!("{month:02}{day:02}{year}")
}

fn jira_capture_filter_table() -> Result<Value, WasmRuntimeError> {
    let table = dom::capture_table_aoa("table")?;
    let today = today_mmddyyyy();
    let (columns, out_rows) = cv_ext_sites_jira::ap_transform::transform_filter_table_aoa(table, &today);
    let _ = crate::jql_panel::store_capture_table(&columns, &out_rows);

    let mut artifact_rows: Vec<Vec<Value>> = Vec::with_capacity(out_rows.len());
    for row in out_rows {
        artifact_rows.push(row.into_iter().map(Value::String).collect());
    }

    let artifact = RunArtifact {
        kind: ArtifactKind::Table,
        name: "jira.filter_table.ap".to_string(),
        columns,
        rows: artifact_rows,
        meta: ArtifactMeta {
            site: "jira".to_string(),
            workflow_id: "jira.issue.capture.table".to_string(),
            generated_at_ms: Date::now() as u64,
        },
    };

    let artifact_value = serde_json::to_value(artifact)
        .map_err(|err| WasmRuntimeError::from(format!("serialize jira AP artifact: {err}")))?;

    Ok(json!({
        "command": "jira.capture.filter_table",
        "status": "success",
        "artifacts": [artifact_value],
        "diagnostics": {
            "today": today,
        }
    }))
}

fn read_input(context: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = context.get(*key).and_then(Value::as_str) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn read_bool_input(context: &Value, keys: &[&str], default: bool) -> bool {
    for key in keys {
        if let Some(value) = context.get(*key) {
            if let Some(parsed) = value.as_bool() {
                return parsed;
            }
            if let Some(text) = value.as_str() {
                match text.trim().to_lowercase().as_str() {
                    "1" | "true" | "yes" | "y" | "on" => return true,
                    "0" | "false" | "no" | "n" | "off" => return false,
                    _ => {}
                }
            }
        }
    }
    default
}

fn fill_if_present(
    context: &Value,
    keys: &[&str],
    selector: &str,
) -> Result<Option<Value>, WasmRuntimeError> {
    let Some(value) = read_input(context, keys) else {
        return Ok(None);
    };

    if dom::query_selector(selector)?.is_none() {
        return Ok(Some(json!({
            "selector": selector,
            "filled": false,
            "reason": "selector_missing",
            "value": value,
        })));
    }

    dom::type_selector(selector, &value)?;
    Ok(Some(json!({
        "selector": selector,
        "filled": true,
        "value": value,
    })))
}

fn click_with_fallback(selectors: &[&str]) -> Result<Option<String>, WasmRuntimeError> {
    for selector in selectors {
        if dom::query_selector(selector)?.is_some() {
            dom::click_selector(selector)?;
            return Ok(Some((*selector).to_string()));
        }
    }

    Ok(None)
}

fn install_jql_builder_switcher_hooks() -> Result<Value, WasmRuntimeError> {
    let window = web_sys::window().ok_or_else(|| WasmRuntimeError::from("window unavailable"))?;
    let document = window
        .document()
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;
    crate::jql_panel::install(&document)
}

fn open_jql_builder_panel() -> Result<Value, WasmRuntimeError> {
    let window = web_sys::window().ok_or_else(|| WasmRuntimeError::from("window unavailable"))?;
    let document = window
        .document()
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;
    crate::jql_panel::open_panel(&document)
}

fn oracle_invoice_button() -> Result<web_sys::Element, WasmRuntimeError> {
    dom::query_selector_required(ORACLE_INVOICE_BUTTON)
}

fn invoice_button_expanded(button: &web_sys::Element) -> bool {
    button
        .get_attribute("aria-expanded")
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn oracle_expand_invoice() -> Result<Value, WasmRuntimeError> {
    let button = oracle_invoice_button()?;
    if invoice_button_expanded(&button) {
        return Ok(json!({
            "command": "oracle.expand_invoice",
            "expanded": true,
            "detail": "already expanded"
        }));
    }

    dom::click_selector(ORACLE_INVOICE_BUTTON)?;
    let button = oracle_invoice_button()?;
    if !invoice_button_expanded(&button) {
        return Err(WasmRuntimeError::from(
            "invoice search is still collapsed after click",
        ));
    }

    Ok(json!({
        "command": "oracle.expand_invoice",
        "expanded": true,
        "detail": "expanded invoice search"
    }))
}

fn oracle_expand_invoice_perform() -> Result<Value, WasmRuntimeError> {
    let button = oracle_invoice_button()?;
    if invoice_button_expanded(&button) {
        return Ok(json!({
            "command": "oracle.expand_invoice.perform",
            "expanded": true,
            "detail": "already expanded"
        }));
    }

    dom::click_selector(ORACLE_INVOICE_BUTTON)?;
    let button = oracle_invoice_button()?;
    if !invoice_button_expanded(&button) {
        return Err(WasmRuntimeError::from(
            "failed to expand invoice search panel",
        ));
    }

    Ok(json!({
        "command": "oracle.expand_invoice.perform",
        "expanded": true,
        "detail": "expanded invoice search panel"
    }))
}

fn oracle_expand_invoice_ensure() -> Result<Value, WasmRuntimeError> {
    let button = oracle_invoice_button()?;
    if !invoice_button_expanded(&button) {
        return Err(WasmRuntimeError::from("invoice search panel is collapsed"));
    }

    Ok(json!({
        "command": "oracle.expand_invoice.ensure",
        "expanded": true,
        "detail": "invoice search panel is expanded"
    }))
}

fn normalize_match_text(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphabetic() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn classify_invoice_validation_status(text: &str) -> &'static str {
    let normalized = normalize_match_text(text);
    if normalized.is_empty() {
        return "unknown";
    }
    let tokens: Vec<&str> = normalized.split(' ').collect();
    let has_needs = tokens.iter().any(|t| *t == "needs");
    let has_validated = tokens.iter().any(|t| *t == "validated");
    let has_validation_family = tokens
        .iter()
        .any(|t| matches!(*t, "validation" | "revalidation" | "reverification"))
        || tokens
            .iter()
            .any(|t| t.starts_with("revalid") || t.starts_with("reverif"));
    let has_re_token = tokens.iter().any(|t| *t == "re")
        || tokens
            .iter()
            .any(|t| t.starts_with("revalid") || t.starts_with("reverif"));
    let has_negation = tokens.iter().any(|t| matches!(*t, "not" | "unvalidated"));

    if has_needs && (has_validated || has_validation_family) && has_re_token {
        return "needs-revalidated";
    }
    if has_validated && !has_negation && !(has_needs && has_re_token) {
        return "validated";
    }
    if tokens.len() == 1 && tokens[0] == "validated" {
        return "validated";
    }
    "unknown"
}

fn find_validation_status_text() -> Result<Option<String>, WasmRuntimeError> {
    let window = web_sys::window().ok_or_else(|| WasmRuntimeError::from("window unavailable"))?;
    let document = window
        .document()
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;

    let nodes = document
        .query_selector_all(
            "td[headers], td[headers*='ValidationStatus'], td[headers*='validationstatus']",
        )
        .map_err(|_| WasmRuntimeError::from("failed to query validation status candidates"))?;

    for i in 0..nodes.length() {
        let Some(node) = nodes.item(i) else { continue };
        let Ok(el) = node.dyn_into::<web_sys::Element>() else {
            continue;
        };
        let headers = el.get_attribute("headers").unwrap_or_default();
        if !headers.to_lowercase().contains("validationstatus") {
            continue;
        }
        if !dom::element_is_visible(&el) {
            continue;
        }

        let text = el.text_content().unwrap_or_default();
        let normalized = text
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .trim()
            .to_string();
        if normalized.is_empty() {
            continue;
        }
        return Ok(Some(normalized));
    }

    Ok(None)
}

async fn detect_validation_status_with_retries() -> Result<Value, WasmRuntimeError> {
    let max_duration_ms: u32 = 12_000;
    let initial_delay_ms: u32 = 200;
    let max_delay_ms: u32 = 1_200;
    let backoff_multiplier: f64 = 1.6;

    let started = Date::now();
    let deadline = started + max_duration_ms as f64;
    let mut delay = initial_delay_ms;
    let mut attempt = 0u32;
    let mut last_text: Option<String> = None;
    let mut last_status = "unknown".to_string();

    while Date::now() <= deadline || attempt == 0 {
        attempt += 1;

        if let Some(text) = find_validation_status_text()? {
            let status = classify_invoice_validation_status(&text).to_string();
            last_text = Some(text);
            last_status = status.clone();
            if status != "unknown" {
                break;
            }
        }

        if Date::now() >= deadline {
            break;
        }
        dom::sleep_ms(delay).await;
        delay = ((delay as f64) * backoff_multiplier).ceil() as u32;
        if delay > max_delay_ms {
            delay = max_delay_ms;
        }
    }

    let body_sample = dom::body_text_lowercase()?;
    let sample = body_sample.chars().take(220).collect::<String>();

    Ok(json!({
        "status": last_status,
        "statusText": last_text.unwrap_or_default(),
        "attempts": attempt,
        "sample": sample,
        "exhaustedRetries": Date::now() >= deadline
    }))
}

async fn oracle_invoice_validation_alert() -> Result<Value, WasmRuntimeError> {
    crate::oracle_banner::show_banner("checking", "Detecting validation status...")?;

    let status = detect_validation_status_with_retries().await?;
    let status_value = status
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let status_text = status
        .get("statusText")
        .and_then(Value::as_str)
        .unwrap_or("");

    let detail = if status_text.is_empty() {
        format!("Status: {status_value}")
    } else {
        status_text.to_string()
    };
    crate::oracle_banner::show_banner(status_value, &detail)?;
    crate::oracle_banner::setup_spa_persistence(status_value.to_string())?;

    let artifact = RunArtifact {
        kind: ArtifactKind::Alert,
        name: "oracle.invoice.validation".to_string(),
        columns: vec![
            "status".to_string(),
            "statusText".to_string(),
            "attempts".to_string(),
            "sample".to_string(),
        ],
        rows: vec![vec![
            Value::String(status_value.to_string()),
            status
                .get("statusText")
                .cloned()
                .unwrap_or(Value::String(String::new())),
            status.get("attempts").cloned().unwrap_or(Value::Null),
            status
                .get("sample")
                .cloned()
                .unwrap_or(Value::String(String::new())),
        ]],
        meta: ArtifactMeta {
            site: "oracle".to_string(),
            workflow_id: "oracle.invoice.validation.alert".to_string(),
            generated_at_ms: Date::now() as u64,
        },
    };

    let artifact_value = serde_json::to_value(artifact).map_err(|err| {
        WasmRuntimeError::from(format!("serialize oracle validation artifact: {err}"))
    })?;

    Ok(json!({
        "command": "oracle.invoice.validation.alert",
        "status": "success",
        "result": status,
        "artifacts": [artifact_value]
    }))
}

async fn oracle_invoice_validation_verify(context: &Value) -> Result<Value, WasmRuntimeError> {
    let status = detect_validation_status_with_retries().await?;
    let expected_status = read_input(context, &["expectedStatus", "expected_status"])
        .unwrap_or_default();
    let observed_status = status
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let expected_snippet = read_input(context, &["expectedSnippet", "expected_snippet"])
        .unwrap_or_default();
    let observed_text = status
        .get("statusText")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let status_matches = expected_status.is_empty() || expected_status == observed_status;
    let snippet_matches = expected_snippet.is_empty()
        || observed_text
            .to_lowercase()
            .contains(&expected_snippet.to_lowercase());
    let verified = status_matches && snippet_matches;
    Ok(json!({
        "command": "oracle.invoice.validation.verify",
        "status": if verified { "success" } else { "mismatch" },
        "result": status,
        "verified": verified,
        "comparison": {
            "expectedStatus": expected_status,
            "observedStatus": observed_status,
            "statusMatches": status_matches,
            "expectedSnippet": expected_snippet,
            "snippetMatches": snippet_matches
        }
    }))
}

fn oracle_invoice_business_unit_ensure(context: &Value) -> Result<Value, WasmRuntimeError> {
    if let Some(filled) = fill_if_present(
        context,
        &["businessUnit", "Business Unit"],
        ORACLE_BUSINESS_UNIT_INPUT,
    )? {
        return Ok(json!({
            "command": "oracle.invoice.create.business_unit.ensure",
            "result": filled,
        }));
    }

    let selectors = [
        ORACLE_BUSINESS_UNIT_INPUT,
        "input[aria-label*='Business Unit Name']",
    ];
    for selector in selectors {
        let value = dom::element_value(selector)?.unwrap_or_default();
        if !value.trim().is_empty() {
            return Ok(json!({
                "command": "oracle.invoice.create.business_unit.ensure",
                "businessUnit": value
            }));
        }
    }

    Err(WasmRuntimeError::from("business unit value is empty"))
}

async fn click_first_visible_option() -> Result<Option<String>, WasmRuntimeError> {
    let window = web_sys::window().ok_or_else(|| WasmRuntimeError::from("window unavailable"))?;
    let document = window
        .document()
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;

    let option_nodes = document
        .query_selector_all("[role='listbox'] [role='option'], [role='option']")
        .map_err(|_| WasmRuntimeError::from("failed to query dropdown options"))?;

    for index in 0..option_nodes.length() {
        let Some(node) = option_nodes.item(index) else {
            continue;
        };
        let Ok(element) = node.dyn_into::<web_sys::Element>() else {
            continue;
        };

        if !dom::element_is_visible(&element) {
            continue;
        }

        let text = element
            .text_content()
            .unwrap_or_default()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        let trimmed = text.trim().to_string();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.to_lowercase().contains("no results") {
            continue;
        }

        if let Ok(html) = element.dyn_into::<web_sys::HtmlElement>() {
            html.click();
            return Ok(Some(trimmed));
        }
    }

    Ok(None)
}

async fn oracle_invoice_supplier_lov(context: &Value) -> Result<Value, WasmRuntimeError> {
    if let Some(value) = read_input(
        context,
        &["supplierSearch", "supplier", "Supplier Search", "Supplier"],
    ) {
        let _ = fill_if_present(
            context,
            &["supplierSearch", "supplier", "Supplier Search", "Supplier"],
            ORACLE_SUPPLIER_INPUT,
        )?;

        let clicked = click_with_fallback(&[
            "[id*='supplier'][id*='lovIconId']",
            "button[aria-label*='Supplier'][aria-label*='Search']",
            "a[aria-label*='Supplier'][aria-label*='Search']",
        ])?;

        let _ = dom::wait_for_selector(
            "[role='listbox'], [role='dialog'], [id*='lovDialogId']",
            8000,
        )
        .await;
        let selected = click_first_visible_option().await?;

        return Ok(json!({
            "command": "oracle.invoice.create.supplier.lov",
            "supplierSearch": value,
            "clicked": clicked,
            "selected": selected,
        }));
    }

    let clicked = click_with_fallback(&[
        "[id*='supplier'][id*='lovIconId']",
        "button[aria-label*='Supplier'][aria-label*='Search']",
        "a[aria-label*='Supplier'][aria-label*='Search']",
    ])?;

    if let Some(selector) = clicked {
        let _ = dom::wait_for_selector(
            "[role='listbox'], [role='dialog'], [id*='lovDialogId']",
            8000,
        )
        .await;
        let selected = click_first_visible_option().await?;
        return Ok(json!({
            "command": "oracle.invoice.create.supplier.lov",
            "clicked": selector,
            "selected": selected
        }));
    }

    Err(WasmRuntimeError::from("supplier LOV trigger not found"))
}

fn first_visible_option_text() -> Result<Option<String>, WasmRuntimeError> {
    let window = web_sys::window().ok_or_else(|| WasmRuntimeError::from("window unavailable"))?;
    let document = window
        .document()
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;

    let option_nodes = document
        .query_selector_all("[role='listbox'] [role='option'], [role='option']")
        .map_err(|_| WasmRuntimeError::from("failed to query dropdown options"))?;

    for index in 0..option_nodes.length() {
        let Some(node) = option_nodes.item(index) else {
            continue;
        };
        let Ok(element) = node.dyn_into::<web_sys::Element>() else {
            continue;
        };

        if !dom::element_is_visible(&element) {
            continue;
        }

        let text = element
            .text_content()
            .unwrap_or_default()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        let trimmed = text.trim().to_string();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.to_lowercase().contains("no results") {
            continue;
        }

        return Ok(Some(trimmed));
    }

    Ok(None)
}

fn oracle_invoice_supplier_site_fill(context: &Value) -> Result<Value, WasmRuntimeError> {
    if let Some(filled) = fill_if_present(
        context,
        &["supplierSite", "Supplier Site"],
        ORACLE_SUPPLIER_SITE_INPUT,
    )? {
        return Ok(json!({
            "command": "oracle.invoice.create.supplier_site.fill",
            "result": filled,
        }));
    }

    let current = dom::element_value(ORACLE_SUPPLIER_SITE_INPUT)?.unwrap_or_default();
    if !current.trim().is_empty() {
        return Ok(json!({
            "command": "oracle.invoice.create.supplier_site.fill",
            "supplierSite": current,
            "detail": "already filled"
        }));
    }

    let Some(option) = first_visible_option_text()? else {
        return Err(WasmRuntimeError::from(
            "unable to infer supplier site from visible options",
        ));
    };

    dom::type_selector(ORACLE_SUPPLIER_SITE_INPUT, &option)?;

    Ok(json!({
        "command": "oracle.invoice.create.supplier_site.fill",
        "supplierSite": option
    }))
}

fn oracle_invoice_supplier_site_ensure(context: &Value) -> Result<Value, WasmRuntimeError> {
    let value = dom::element_value(ORACLE_SUPPLIER_SITE_INPUT)?.unwrap_or_default();
    if value.trim().is_empty() {
        let allow_without_number = read_bool_input(
            context,
            &["allowSupplierSiteWithoutNumber", "allow_supplier_site_without_number"],
            false,
        );
        let invoice_number = dom::element_value(ORACLE_INVOICE_NUMBER_INPUT)?.unwrap_or_default();
        if allow_without_number && invoice_number.trim().is_empty() {
            return Ok(json!({
                "command": "oracle.invoice.create.supplier_site.ensure",
                "supplierSite": "",
                "detail": "allowed-empty due to allowSupplierSiteWithoutNumber"
            }));
        }
        return Err(WasmRuntimeError::from("supplier site value is empty"));
    }

    Ok(json!({
        "command": "oracle.invoice.create.supplier_site.ensure",
        "supplierSite": value
    }))
}

fn default_invoice_number() -> String {
    let now = Date::new_0();
    let month = now.get_month() + 1;
    let day = now.get_date();
    let year = now.get_full_year();
    format!("{month:02}{day:02}{year}-TR")
}

fn oracle_invoice_create_number(context: &Value) -> Result<Value, WasmRuntimeError> {
    if read_bool_input(context, &["skipInvoiceNumber", "skip_invoice_number"], false) {
        return Ok(json!({
            "command": "oracle.invoice.create.number",
            "detail": "skipped due to skipInvoiceNumber=true"
        }));
    }

    if let Some(value) = read_input(context, &["invoiceNumber", "Number", "Invoice Number"]) {
        dom::type_selector(ORACLE_INVOICE_NUMBER_INPUT, &value)?;
        return Ok(json!({
            "command": "oracle.invoice.create.number",
            "invoiceNumber": value,
            "detail": "filled from workflow input"
        }));
    }

    let current = dom::element_value(ORACLE_INVOICE_NUMBER_INPUT)?.unwrap_or_default();
    if !current.trim().is_empty() {
        return Ok(json!({
            "command": "oracle.invoice.create.number",
            "invoiceNumber": current,
            "detail": "already set"
        }));
    }

    let generated = default_invoice_number();
    dom::type_selector(ORACLE_INVOICE_NUMBER_INPUT, &generated)?;

    Ok(json!({
        "command": "oracle.invoice.create.number",
        "invoiceNumber": generated,
        "detail": "generated from local date"
    }))
}

async fn oracle_invoice_create(context: &Value) -> Result<Value, WasmRuntimeError> {
    let mut steps = Vec::new();
    let mut artifacts = Vec::new();
    let options = json!({
        "skipInvoiceNumber": read_bool_input(context, &["skipInvoiceNumber", "skip_invoice_number"], false),
        "allowDocumentScope": read_bool_input(context, &["allowDocumentScope", "allow_document_scope"], false),
        "allowSupplierSiteWithoutNumber": read_bool_input(context, &["allowSupplierSiteWithoutNumber", "allow_supplier_site_without_number"], false)
    });

    // Best effort: many Oracle forms keep invoice fields hidden until the search
    // region is expanded, so try to expand first without failing the workflow.
    if let Ok(expand_result) = oracle_expand_invoice().or_else(|_| oracle_expand_invoice_ensure()) {
        artifacts.push(expand_result);
        steps.push(json!({"command": "oracle.expand_invoice", "status": "success"}));
        dom::sleep_ms(60).await;
    }

    let step1 = oracle_invoice_business_unit_ensure(context)?;
    artifacts.push(step1.clone());
    steps.push(
        json!({"command": "oracle.invoice.create.business_unit.ensure", "status": "success"}),
    );
    dom::sleep_ms(60).await;

    let step2 = oracle_invoice_supplier_lov(context).await?;
    artifacts.push(step2.clone());
    steps.push(json!({"command": "oracle.invoice.create.supplier.lov", "status": "success"}));
    dom::sleep_ms(60).await;

    let step3 = oracle_invoice_supplier_site_fill(context)?;
    artifacts.push(step3.clone());
    steps.push(json!({"command": "oracle.invoice.create.supplier_site.fill", "status": "success"}));
    dom::sleep_ms(60).await;

    let step4 = oracle_invoice_supplier_site_ensure(context)?;
    artifacts.push(step4.clone());
    steps.push(
        json!({"command": "oracle.invoice.create.supplier_site.ensure", "status": "success"}),
    );
    dom::sleep_ms(60).await;

    let step5 = oracle_invoice_create_number(context)?;
    artifacts.push(step5.clone());
    steps.push(json!({"command": "oracle.invoice.create.number", "status": "success"}));
    dom::sleep_ms(60).await;

    if let Some(filled) = fill_if_present(
        context,
        &["invoiceGroup", "Invoice Group"],
        ORACLE_INVOICE_GROUP_INPUT,
    )? {
        artifacts.push(json!({
            "command": "oracle.invoice.create.invoice_group",
            "result": filled,
        }));
    }

    if let Some(filled) = fill_if_present(
        context,
        &[
            "amountNumeric",
            "amountRaw",
            "Amount",
            "Amount Numeric",
            "Amount Raw",
        ],
        ORACLE_AMOUNT_INPUT,
    )? {
        artifacts.push(json!({
            "command": "oracle.invoice.create.amount",
            "result": filled,
        }));
    }

    if let Some(filled) = fill_if_present(
        context,
        &["description", "Description"],
        ORACLE_DESCRIPTION_INPUT,
    )? {
        artifacts.push(json!({
            "command": "oracle.invoice.create.description",
            "result": filled,
        }));
    }

    Ok(json!({
        "command": "oracle.invoice.create",
        "steps": steps,
        "artifacts": artifacts,
        "options": options,
        "input": context,
    }))
}

fn normalized_label(text: &str) -> String {
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn element_label(element: &web_sys::Element) -> String {
    let text = element.text_content().unwrap_or_default();
    let aria = element.get_attribute("aria-label").unwrap_or_default();
    let title = element.get_attribute("title").unwrap_or_default();
    normalized_label(&format!("{text} {aria} {title}"))
}

fn element_disabled(element: &web_sys::Element) -> bool {
    if element
        .get_attribute("disabled")
        .map(|v| !v.is_empty())
        .unwrap_or(false)
    {
        return true;
    }
    if element
        .get_attribute("aria-disabled")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    {
        return true;
    }
    false
}

fn derive_carma_reference(row: &BTreeMap<String, String>) -> String {
    let mut stock = String::new();
    let mut vin = String::new();
    let mut pid = String::new();

    for (key, value) in row {
        let k = normalize_header_like(key);
        let v = value
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .trim()
            .to_string();
        if v.is_empty() {
            continue;
        }

        if stock.is_empty()
            && (k.contains("latestpurchasestocknumber")
                || k == "stocknumber"
                || k.contains("stocknumber"))
        {
            stock = v.clone();
            continue;
        }
        if vin.is_empty() && (k == "vin" || k.contains("latestpurchasevin")) {
            vin = v.clone();
            continue;
        }
        if pid.is_empty()
            && (k.contains("latestpurchasepurchaseid")
                || k == "purchaseid"
                || k.contains("purchaseid"))
        {
            pid = v.clone();
            continue;
        }
    }

    if stock.is_empty() && vin.is_empty() && pid.is_empty() {
        return String::new();
    }

    format!(
        "HUB-{}-{}-{}",
        if stock.is_empty() {
            "STOCK"
        } else {
            stock.as_str()
        },
        if vin.is_empty() { "VIN" } else { vin.as_str() },
        if pid.is_empty() { "PID" } else { pid.as_str() }
    )
}

fn row_value_by_header_like<'a>(
    row: &'a BTreeMap<String, String>,
    patterns: &[&str],
) -> Option<&'a str> {
    row.iter().find_map(|(key, value)| {
        let normalized = normalize_header_like(key);
        if patterns.iter().any(|pattern| normalized.contains(pattern)) {
            Some(value.as_str())
        } else {
            None
        }
    })
}

fn is_meaningful_value(value: Option<&str>) -> bool {
    let Some(value) = value else {
        return false;
    };
    let text = value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();
    if text.is_empty() {
        return false;
    }
    let lowered = text.to_lowercase();
    !matches!(
        lowered.as_str(),
        "null" | "undefined" | "no purchase(s) found." | "no purchases found."
    )
}

fn keep_row_by_filters(row: &BTreeMap<String, String>, options: &CarmaPanelState) -> bool {
    if options.scrape.require_purchase_id
        && !is_meaningful_value(row_value_by_header_like(
            row,
            &["purchaseid", "latestpurchasepurchaseid"],
        ))
    {
        return false;
    }
    if options.scrape.require_vin
        && !is_meaningful_value(row_value_by_header_like(row, &["vin", "latestpurchasevin"]))
    {
        return false;
    }
    if options.scrape.require_stock_number
        && !is_meaningful_value(row_value_by_header_like(
            row,
            &["stocknumber", "latestpurchasestocknumber"],
        ))
    {
        return false;
    }
    true
}

fn row_uniqueness_key(row: &BTreeMap<String, String>, options: &CarmaPanelState) -> String {
    if !options.uniqueness.enabled {
        return format!("{row:?}");
    }
    let mut parts: Vec<String> = Vec::new();
    if options.uniqueness.key_stock {
        let stock = row_value_by_header_like(row, &["stocknumber", "latestpurchasestocknumber"])
            .unwrap_or("")
            .trim()
            .to_string();
        parts.push(format!("stock:{stock}"));
    }
    if options.uniqueness.key_vin {
        let vin = row_value_by_header_like(row, &["vin", "latestpurchasevin"])
            .unwrap_or("")
            .trim()
            .to_string();
        parts.push(format!("vin:{vin}"));
    }
    if options.uniqueness.key_pid {
        let pid = row_value_by_header_like(row, &["purchaseid", "latestpurchasepurchaseid"])
            .unwrap_or("")
            .trim()
            .to_string();
        parts.push(format!("pid:{pid}"));
    }
    let key = parts
        .into_iter()
        .filter(|part| !part.ends_with(':'))
        .collect::<Vec<_>>()
        .join("|");
    if key.is_empty() {
        format!("{row:?}")
    } else {
        key
    }
}

fn row_fingerprint(row: &BTreeMap<String, String>) -> String {
    row.iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("|")
}

fn resolve_uniqueness_date_header(
    records: &[BTreeMap<String, String>],
    options: &CarmaPanelState,
) -> Option<String> {
    if !options.uniqueness.enabled || options.uniqueness.strategy != "latest_by_date" {
        return None;
    }
    if records.is_empty() {
        return None;
    }
    let first_row = &records[0];
    if options.uniqueness.date_mode == "manual" {
        let wanted = normalize_header_like(&options.uniqueness.date_header);
        if wanted.is_empty() {
            return None;
        }
        return first_row.keys().find_map(|key| {
            if normalize_header_like(key) == wanted {
                Some(key.clone())
            } else {
                None
            }
        });
    }

    let patterns = ["date", "created", "updated", "purchasedate", "transactiondate"];
    first_row.keys().find_map(|key| {
        let normalized = normalize_header_like(key);
        if patterns.iter().any(|pattern| normalized.contains(pattern)) {
            Some(key.clone())
        } else {
            None
        }
    })
}

fn parse_date_rank(raw: &str) -> Option<i64> {
    let text = raw.trim();
    if text.is_empty() {
        return None;
    }

    let parts = text
        .split(|ch: char| !ch.is_ascii_digit())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    if parts.len() >= 3 {
        let (year, month, day) = if parts[0].len() == 4 {
            (parts[0], parts[1], parts[2])
        } else if parts[2].len() == 4 {
            (parts[2], parts[0], parts[1])
        } else {
            ("", "", "")
        };
        if let (Ok(year), Ok(month), Ok(day)) = (
            year.parse::<i64>(),
            month.parse::<i64>(),
            day.parse::<i64>(),
        ) {
            if (1900..=9999).contains(&year) && (1..=12).contains(&month) && (1..=31).contains(&day)
            {
                return Some((year * 10_000) + (month * 100) + day);
            }
        }
    }

    let digits = text.chars().filter(|ch| ch.is_ascii_digit()).collect::<String>();
    if digits.len() == 8 {
        if let Ok(value) = digits.parse::<i64>() {
            let as_year = value / 10_000;
            if (1900..=9999).contains(&as_year) {
                return Some(value);
            }
            let month = value / 1_000_000;
            let day = (value / 10_000) % 100;
            let year = value % 10_000;
            if (1..=12).contains(&month) && (1..=31).contains(&day) && (1900..=9999).contains(&year)
            {
                return Some((year * 10_000) + (month * 100) + day);
            }
        }
    }
    None
}

fn should_replace_duplicate(
    strategy: &str,
    existing: &BTreeMap<String, String>,
    candidate: &BTreeMap<String, String>,
    date_header: Option<&str>,
) -> bool {
    match strategy {
        "first_seen" => false,
        "last_seen" => true,
        "latest_by_date" => {
            let existing_rank = date_header
                .and_then(|header| existing.get(header))
                .and_then(|value| parse_date_rank(value));
            let candidate_rank = date_header
                .and_then(|header| candidate.get(header))
                .and_then(|value| parse_date_rank(value));
            match (existing_rank, candidate_rank) {
                (None, Some(_)) => true,
                (Some(_), None) => false,
                (Some(a), Some(b)) if b > a => true,
                (Some(a), Some(b)) if b < a => false,
                _ => row_fingerprint(candidate) > row_fingerprint(existing),
            }
        }
        _ => false,
    }
}

fn load_carma_panel_options() -> CarmaPanelState {
    crate::carma_ui::load_panel_state()
        .ok()
        .and_then(|value| {
            serde_json::from_value::<crate::menu_state::StateEnvelope<CarmaPanelState>>(value).ok()
        })
        .map(|envelope| envelope.payload)
        .unwrap_or_default()
}

thread_local! {
    static CARMA_CANCEL_REQUESTED: Cell<bool> = const { Cell::new(false) };
}

fn set_carma_cancel_requested(value: bool) {
    CARMA_CANCEL_REQUESTED.with(|flag| flag.set(value));
}

fn carma_cancel_requested() -> bool {
    CARMA_CANCEL_REQUESTED.with(Cell::get)
}

fn normalize_header_like(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}

fn carma_show_panel() -> Result<Value, WasmRuntimeError> {
    crate::carma_ui::show_control_panel()
}

fn carma_bulk_search_cancel() -> Result<Value, WasmRuntimeError> {
    set_carma_cancel_requested(true);
    Ok(json!({
        "command": "carma.bulk.search.cancel",
        "status": "success",
        "cancelRequested": true
    }))
}

fn parse_carma_terms(context: &Value) -> Vec<(String, String)> {
    let raw = context
        .get("termsText")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let base_url = "https://carma.cvnacorp.com/research/search/".to_string();
    raw.split(|ch: char| matches!(ch, '\n' | '\r' | ',' | ';' | '|' | '\t'))
        .map(str::trim)
        .filter(|term| !term.is_empty())
        .map(|term| {
            let normalized = if term.starts_with("http://") || term.starts_with("https://") {
                if let Some(idx) = term.find("/research/search/") {
                    let value = &term[(idx + "/research/search/".len())..];
                    js_sys::decode_uri_component(value)
                        .ok()
                        .and_then(|decoded| decoded.as_string())
                        .unwrap_or_else(|| value.to_string())
                } else {
                    term.to_string()
                }
            } else {
                term.to_string()
            };
            let encoded = js_sys::encode_uri_component(&normalized)
                .as_string()
                .unwrap_or_else(|| normalized.clone());
            (normalized, format!("{base_url}{encoded}"))
        })
        .collect()
}

fn read_block_title(block: &web_sys::Element) -> String {
    block
        .query_selector(".cpl__block__header-title")
        .ok()
        .flatten()
        .and_then(|el| el.text_content())
        .map(|text| text.split_whitespace().collect::<Vec<_>>().join(" "))
        .unwrap_or_else(|| "Table".to_string())
}

fn scrape_block_rows(
    block: &web_sys::Element,
    table_name: &str,
    page: u32,
    term: &str,
    url: &str,
) -> Vec<BTreeMap<String, String>> {
    let Some(table) = block
        .query_selector("table[data-testid='data-table'], table")
        .ok()
        .flatten()
    else {
        return Vec::new();
    };

    let mut headers: Vec<String> = Vec::new();
    if let Ok(thead_rows) = table.query_selector_all("thead tr") {
        if thead_rows.length() > 0 {
            if let Some(last) = thead_rows.item(thead_rows.length() - 1) {
                if let Ok(last_row) = last.dyn_into::<web_sys::Element>() {
                    if let Ok(ths) = last_row.query_selector_all("th") {
                        for i in 0..ths.length() {
                            if let Some(node) = ths.item(i) {
                                if let Ok(th) = node.dyn_into::<web_sys::Element>() {
                                    let text = th
                                        .text_content()
                                        .unwrap_or_default()
                                        .split_whitespace()
                                        .collect::<Vec<_>>()
                                        .join(" ");
                                    headers.push(if text.is_empty() {
                                        format!("Column {}", i + 1)
                                    } else {
                                        text
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if headers.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    if let Ok(trs) = table.query_selector_all("tbody tr") {
        for i in 0..trs.length() {
            let Some(node) = trs.item(i) else { continue };
            let Ok(tr) = node.dyn_into::<web_sys::Element>() else {
                continue;
            };
            let Ok(tds) = tr.query_selector_all("td") else {
                continue;
            };
            let mut row = BTreeMap::new();
            for (idx, header) in headers.iter().enumerate() {
                let value = tds
                    .item(idx as u32)
                    .and_then(|n| n.dyn_into::<web_sys::Element>().ok())
                    .and_then(|cell| cell.text_content())
                    .unwrap_or_default()
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ");
                row.insert(header.clone(), value);
            }
            row.insert("searchTerm".to_string(), term.to_string());
            row.insert("searchUrl".to_string(), url.to_string());
            row.insert("table".to_string(), table_name.to_string());
            row.insert("page".to_string(), page.to_string());
            out.push(row);
        }
    }
    out
}

fn find_next_page_in_block(block: &web_sys::Element) -> Option<web_sys::HtmlElement> {
    let nodes = block.query_selector_all("button, a, [role='button']").ok()?;
    for i in 0..nodes.length() {
        let node = nodes.item(i)?;
        let el = node.dyn_into::<web_sys::Element>().ok()?;
        let label = element_label(&el);
        if !(label.contains("next") || label.contains('›') || label.contains('»')) {
            continue;
        }
        if element_disabled(&el) {
            continue;
        }
        if !dom::element_is_visible(&el) {
            continue;
        }
        if let Ok(html) = el.dyn_into::<web_sys::HtmlElement>() {
            return Some(html);
        }
    }
    None
}

fn gather_blocks_with_tables(doc: &web_sys::Document) -> Vec<web_sys::Element> {
    let mut blocks = Vec::new();
    if let Ok(nodes) = doc.query_selector_all(".cpl__block") {
        for i in 0..nodes.length() {
            let Some(node) = nodes.item(i) else { continue };
            let Ok(block) = node.dyn_into::<web_sys::Element>() else {
                continue;
            };
            if block
                .query_selector("table[data-testid='data-table']")
                .ok()
                .flatten()
                .is_some()
            {
                blocks.push(block);
            }
        }
    }
    if blocks.is_empty() {
        if let Ok(nodes) = doc.query_selector_all("table[data-testid='data-table'], table") {
            for i in 0..nodes.length() {
                let Some(node) = nodes.item(i) else { continue };
                let Ok(table) = node.dyn_into::<web_sys::Element>() else {
                    continue;
                };
                let block = table
                    .closest(".cpl__block")
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| table.clone());
                if !blocks.iter().any(|existing| existing.is_same_node(Some(&block))) {
                    blocks.push(block);
                }
            }
        }
    }
    blocks
}

fn is_key_column_label(text: &str) -> bool {
    let normalized = text
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>();
    normalized.contains("purchaseid")
        || normalized.contains("vin")
        || normalized.contains("stocknumber")
}

fn clean_inline_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn find_clickable_by_text(root: &web_sys::Element, text: &str) -> Option<web_sys::Element> {
    let nodes = root.query_selector_all("button, [role='button'], a").ok()?;
    let needle = text.to_lowercase();
    for i in 0..nodes.length() {
        let node = nodes.item(i)?;
        let el = node.dyn_into::<web_sys::Element>().ok()?;
        let label = element_label(&el);
        if label == needle {
            return Some(el);
        }
    }
    None
}

async fn open_dropdown_menu(button: &web_sys::Element) -> Option<web_sys::Element> {
    let html = button.clone().dyn_into::<web_sys::HtmlElement>().ok()?;
    html.click();
    dom::sleep_ms(120).await;

    let dropdown = button
        .closest(".dropdown")
        .ok()
        .flatten()
        .or_else(|| button.parent_element())?;
    let menu = dropdown.query_selector(".dropdown-menu").ok().flatten()?;

    let style = menu.get_attribute("style").unwrap_or_default().to_lowercase();
    let class_name = menu.get_attribute("class").unwrap_or_default().to_lowercase();
    let visibly_open = class_name.contains("show")
        || style.contains("display: block")
        || dom::element_is_visible(&menu);
    if visibly_open { Some(menu) } else { None }
}

async fn apply_columns_mode(block: &web_sys::Element, mode: &str) {
    if mode == "none" {
        return;
    }
    let Some(edit_button) = find_clickable_by_text(block, "edit columns") else {
        return;
    };
    let Some(menu) = open_dropdown_menu(&edit_button).await else {
        return;
    };
    let Ok(inputs) = menu.query_selector_all("input[type='checkbox']") else {
        return;
    };
    for i in 0..inputs.length() {
        let Some(node) = inputs.item(i) else { continue };
        let Ok(input) = node.dyn_into::<web_sys::HtmlInputElement>() else {
            continue;
        };
        if input.disabled() {
            continue;
        }
        let text = input
            .closest("label,div")
            .ok()
            .flatten()
            .and_then(|el| el.text_content())
            .unwrap_or_default();
        if mode == "all" {
            if !input.checked() {
                input.click();
            }
            continue;
        }
        if mode == "key" && is_key_column_label(&text) && !input.checked() {
            input.click();
        }
    }
    if let Some(doc) = block.owner_document() {
        if let Some(body) = doc.body() {
            body.click();
        }
    }
}

fn find_show_button(block: &web_sys::Element) -> Option<web_sys::Element> {
    let mut candidates: Vec<web_sys::Element> = Vec::new();
    if let Ok(nodes) = block.query_selector_all("button, [role='button'], a") {
        for i in 0..nodes.length() {
            let Some(node) = nodes.item(i) else { continue };
            let Ok(el) = node.dyn_into::<web_sys::Element>() else {
                continue;
            };
            candidates.push(el);
        }
    }
    if candidates.is_empty() {
        if let Some(doc) = block.owner_document() {
            if let Ok(nodes) = doc.query_selector_all("button, [role='button'], a") {
                for i in 0..nodes.length() {
                    let Some(node) = nodes.item(i) else { continue };
                    let Ok(el) = node.dyn_into::<web_sys::Element>() else {
                        continue;
                    };
                    candidates.push(el);
                }
            }
        }
    }
    for el in candidates {
        let label = element_label(&el);
        if label.starts_with("show") && label.chars().any(|ch| ch.is_ascii_digit()) {
            return Some(el);
        }
    }
    None
}

fn parse_current_show_size(button: &web_sys::Element) -> Option<u32> {
    let text = clean_inline_text(&button.text_content().unwrap_or_default());
    for token in text.split(' ') {
        if let Ok(value) = token.parse::<u32>() {
            return Some(value);
        }
    }
    None
}

fn find_show_target(menu: &web_sys::Element, size: u32) -> Option<web_sys::Element> {
    let Ok(items) = menu.query_selector_all("a, button, [role='menuitem'], [role='option']") else {
        return None;
    };
    for i in 0..items.length() {
        let Some(node) = items.item(i) else { continue };
        let Ok(el) = node.dyn_into::<web_sys::Element>() else {
            continue;
        };
        let label = element_label(&el);
        if label == size.to_string()
            || (label.contains("show")
                && label
                    .split(' ')
                    .any(|token| token.parse::<u32>().ok() == Some(size)))
        {
            return Some(el);
        }
    }
    None
}

fn read_current_page_in_block(block: &web_sys::Element) -> Option<u32> {
    let Ok(nodes) = block.query_selector_all("button, [role='button'], span, div, li, a") else {
        return None;
    };
    for i in 0..nodes.length() {
        let Some(node) = nodes.item(i) else { continue };
        let Ok(el) = node.dyn_into::<web_sys::Element>() else {
            continue;
        };
        let label = element_label(&el);
        if !label.contains("page") {
            continue;
        }
        for token in label.split(' ') {
            if let Ok(num) = token.parse::<u32>() {
                if num > 0 {
                    return Some(num);
                }
            }
        }
    }
    None
}

async fn wait_for_page_transition(block: &web_sys::Element, previous_page: Option<u32>) {
    let started = Date::now();
    let deadline = started + 8_000f64;
    let mut last_signature = String::new();
    while Date::now() <= deadline {
        if let Some(prev) = previous_page {
            if let Some(current) = read_current_page_in_block(block) {
                if current > prev {
                    return;
                }
            }
        }
        let sig = scrape_block_rows(block, "", 0, "", "")
            .first()
            .map(|row| format!("{row:?}"))
            .unwrap_or_default();
        if !sig.is_empty() {
            if last_signature.is_empty() {
                last_signature = sig;
            } else if last_signature != sig {
                return;
            }
        }
        dom::sleep_ms(100).await;
    }
}

async fn set_show_100(block: &web_sys::Element) {
    let Some(show_button) = find_show_button(block) else {
        return;
    };
    if parse_current_show_size(&show_button) == Some(100) {
        return;
    }
    let Some(menu) = open_dropdown_menu(&show_button).await else {
        return;
    };
    let Some(target) = find_show_target(&menu, 100) else {
        return;
    };
    if let Ok(html) = target.dyn_into::<web_sys::HtmlElement>() {
        html.click();
    }
    dom::sleep_ms(150).await;
    if let Some(doc) = block.owner_document() {
        if let Some(body) = doc.body() {
            body.click();
        }
    }
}

fn create_hidden_iframe() -> Result<web_sys::HtmlIFrameElement, WasmRuntimeError> {
    let window = web_sys::window().ok_or_else(|| WasmRuntimeError::from("window unavailable"))?;
    let doc = window
        .document()
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;
    let body = doc
        .body()
        .ok_or_else(|| WasmRuntimeError::from("body unavailable"))?;

    let iframe = doc
        .create_element("iframe")
        .map_err(|_| WasmRuntimeError::from("failed to create iframe"))?
        .dyn_into::<web_sys::HtmlIFrameElement>()
        .map_err(|_| WasmRuntimeError::from("failed to cast iframe"))?;
    iframe
        .set_attribute("style", "position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;opacity:0;pointer-events:none;")
        .ok();
    let _ = body.append_child(&iframe);
    Ok(iframe)
}

async fn load_document_into_iframe(
    iframe: &web_sys::HtmlIFrameElement,
    url: &str,
) -> Result<web_sys::Document, WasmRuntimeError> {
    iframe.set_src(url);

    let started = Date::now();
    let deadline = started + 30_000f64;
    while Date::now() <= deadline {
        if carma_cancel_requested() {
            return Err(WasmRuntimeError::from("scrape canceled"));
        }
        if let Some(inner) = iframe.content_document() {
            if inner
                .query_selector("table[data-testid='data-table'], table")
                .ok()
                .flatten()
                .is_some()
            {
                return Ok(inner);
            }
            let body_text = inner
                .body()
                .and_then(|b| b.text_content())
                .unwrap_or_default()
                .to_lowercase();
            if body_text.contains("no results")
                || body_text.contains("no customers found")
                || body_text.contains("no purchases found")
            {
                return Ok(inner);
            }
        }
        dom::sleep_ms(200).await;
    }
    Err(WasmRuntimeError::from("iframe load timeout"))
}

fn extract_rows_from_records(
    mut records: Vec<BTreeMap<String, String>>,
    panel_state: &CarmaPanelState,
) -> (Vec<String>, Vec<Vec<Value>>, u32, Option<String>) {
    let mut duplicates: u32 = 0;
    let mut seen: HashMap<String, BTreeMap<String, String>> = HashMap::new();
    records.sort_by(|a, b| row_fingerprint(a).cmp(&row_fingerprint(b)));
    let resolved_date_header = resolve_uniqueness_date_header(&records, panel_state);

    for mut row in records {
        let reference = derive_carma_reference(&row);
        if !reference.is_empty() {
            row.insert("Reference".to_string(), reference.clone());
        }
        let uniqueness_key = row_uniqueness_key(&row, panel_state);
        if let Some(existing) = seen.get(&uniqueness_key) {
            duplicates += 1;
            if !should_replace_duplicate(
                &panel_state.uniqueness.strategy,
                existing,
                &row,
                resolved_date_header.as_deref(),
            ) {
                continue;
            }
        }
        if !reference.is_empty() && !panel_state.uniqueness.enabled && seen.contains_key(&reference)
        {
            duplicates += 1;
            continue;
        }
        seen.insert(uniqueness_key, row);
    }

    let mut out: Vec<BTreeMap<String, String>> = seen.into_values().collect();
    out.sort_by(|a, b| a.get("Reference").cmp(&b.get("Reference")));
    if panel_state.scrape.column_mode == "key" {
        for row in &mut out {
            let keys: Vec<String> = row.keys().cloned().collect();
            for key in keys {
                let normalized = normalize_header_like(&key);
                let keep = key == "Reference"
                    || normalized.contains("stocknumber")
                    || normalized.contains("vin")
                    || normalized.contains("purchaseid")
                    || normalized == "searchterm"
                    || normalized == "searchurl"
                    || normalized == "table"
                    || normalized == "page";
                if !keep {
                    row.remove(&key);
                }
            }
        }
    }

    let mut columns: Vec<String> = Vec::new();
        for row in &out {
        for key in row.keys() {
            if !columns.contains(key) {
                columns.push(key.clone());
            }
        }
    }
    columns.sort();
    if columns.contains(&"Reference".to_string()) {
        columns.retain(|c| c != "Reference");
        columns.insert(0, "Reference".to_string());
    }

    let mut artifact_rows: Vec<Vec<Value>> = Vec::with_capacity(out.len());
    for row in out {
        let mut values = Vec::with_capacity(columns.len());
        for column in &columns {
            values.push(Value::String(row.get(column).cloned().unwrap_or_default()));
        }
        artifact_rows.push(values);
    }
    (columns, artifact_rows, duplicates, resolved_date_header)
}

async fn prepare_block_for_scrape(block: &web_sys::Element, panel_state: &CarmaPanelState) {
    apply_columns_mode(block, &panel_state.scrape.column_mode).await;
    if panel_state.scrape.set_show_to_100 {
        set_show_100(block).await;
    }
}

async fn scrape_block_pages_for_term(
    block: &web_sys::Element,
    panel_state: &CarmaPanelState,
    max_pages: u32,
    table_name: &str,
    term: &str,
    url: &str,
    rows_out: &mut Vec<BTreeMap<String, String>>,
    pages_out: &mut u32,
) {
    prepare_block_for_scrape(block, panel_state).await;
    let mut page: u32 = 1;
    loop {
        let mut rows = scrape_block_rows(block, table_name, page, term, url);
        rows.retain(|row| keep_row_by_filters(row, panel_state));
        rows_out.extend(rows);
        *pages_out += 1;
        if !panel_state.scrape.paginate_all_pages || page >= max_pages {
            break;
        }
        let previous_page = read_current_page_in_block(block);
        let Some(next) = find_next_page_in_block(block) else {
            break;
        };
        next.click();
        wait_for_page_transition(block, previous_page).await;
        page += 1;
        if carma_cancel_requested() {
            break;
        }
    }
}

async fn scrape_blocks_from_document(
    doc: &web_sys::Document,
    panel_state: &CarmaPanelState,
    max_pages: u32,
    term: &str,
    url: &str,
    rows_out: &mut Vec<BTreeMap<String, String>>,
    pages_out: &mut u32,
) {
    let blocks = gather_blocks_with_tables(doc);
    for block in blocks {
        if carma_cancel_requested() {
            break;
        }
        let table_name = read_block_title(&block);
        scrape_block_pages_for_term(
            &block,
            panel_state,
            max_pages,
            &table_name,
            term,
            url,
            rows_out,
            pages_out,
        )
        .await;
    }
}

async fn carma_bulk_search_scrape(context: &Value) -> Result<Value, WasmRuntimeError> {
    set_carma_cancel_requested(false);
    let panel_state = load_carma_panel_options();
    let terms = parse_carma_terms(context);
    let terms_total = terms.len();
    let max_pages = panel_state.scrape.max_pages.max(1);

    crate::carma_ui::show_progress_panel()?;
    let _ = crate::carma_ui::clear_progress_log();
    crate::carma_ui::update_progress("Starting scrape...", 0, 0, 0, 5)?;

    let mut all_rows: Vec<BTreeMap<String, String>> = Vec::new();
    let mut pages_visited: u32 = 0;

    if terms.is_empty() {
        crate::carma_ui::update_progress("Using current page table(s)...", 0, 0, 0, 10)?;
        let window =
            web_sys::window().ok_or_else(|| WasmRuntimeError::from("window unavailable"))?;
        let doc = window
            .document()
            .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;
        dom::wait_for_selector("table[data-testid='data-table'], table", 12_000).await?;
        scrape_blocks_from_document(
            &doc,
            &panel_state,
            max_pages,
            "",
            "",
            &mut all_rows,
            &mut pages_visited,
        )
        .await;
    } else {
        let worker_count = usize::from(panel_state.scrape.max_concurrency.max(1)).min(terms.len());
        let term_count = terms_total;
        crate::carma_ui::update_progress(
            &format!("Starting {} worker(s)...", worker_count),
            0,
            0,
            0,
            10,
        )?;

        let shared_rows = Rc::new(RefCell::new(Vec::<BTreeMap<String, String>>::new()));
        let shared_pages = Rc::new(Cell::new(0u32));
        let next_index = Rc::new(Cell::new(0usize));
        let processed_terms = Rc::new(Cell::new(0usize));
        let panel_state = Rc::new(panel_state.clone());
        let terms = Rc::new(terms);

        let mut workers = Vec::with_capacity(worker_count);
        for worker_id in 0..worker_count {
            let shared_rows = Rc::clone(&shared_rows);
            let shared_pages = Rc::clone(&shared_pages);
            let next_index = Rc::clone(&next_index);
            let processed_terms = Rc::clone(&processed_terms);
            let panel_state = Rc::clone(&panel_state);
            let terms = Rc::clone(&terms);

            workers.push(async move {
                let Ok(iframe) = create_hidden_iframe() else {
                    return;
                };
                loop {
                    if carma_cancel_requested() {
                        break;
                    }
                    let idx = next_index.get();
                    if idx >= terms.len() {
                        break;
                    }
                    next_index.set(idx + 1);
                    let (term, url) = (&terms[idx].0, &terms[idx].1);
                    let _ = crate::carma_ui::update_progress(
                        &format!("[W{}] ({}/{}) {}", worker_id + 1, idx + 1, terms.len(), term),
                        shared_pages.get(),
                        shared_rows.borrow().len() as u32,
                        0,
                        (((processed_terms.get() as f64) / (terms.len() as f64)) * 70.0) as u32
                            + 10,
                    );

                    let Ok(doc) = load_document_into_iframe(&iframe, url).await else {
                        let done = processed_terms.get() + 1;
                        processed_terms.set(done);
                        let _ = crate::carma_ui::update_progress(
                            &format!("[W{}] skipped {}", worker_id + 1, term),
                            shared_pages.get(),
                            shared_rows.borrow().len() as u32,
                            0,
                            (((done as f64) / (terms.len() as f64)) * 70.0) as u32 + 10,
                        );
                        continue;
                    };

                    let mut term_rows = Vec::new();
                    let mut term_pages = 0u32;
                    scrape_blocks_from_document(
                        &doc,
                        panel_state.as_ref(),
                        max_pages,
                        term,
                        url,
                        &mut term_rows,
                        &mut term_pages,
                    )
                    .await;

                    if !term_rows.is_empty() {
                        shared_rows.borrow_mut().extend(term_rows);
                    }
                    shared_pages.set(shared_pages.get() + term_pages);
                    let done = processed_terms.get() + 1;
                    processed_terms.set(done);
                    let _ = crate::carma_ui::update_progress(
                        &format!("[W{}] done {}", worker_id + 1, term),
                        shared_pages.get(),
                        shared_rows.borrow().len() as u32,
                        0,
                        (((done as f64) / (terms.len() as f64)) * 70.0) as u32 + 10,
                    );
                }
                let _ = iframe.remove();
            });
        }

        join_all(workers).await;
        pages_visited = shared_pages.get();
        all_rows = shared_rows.take();
        let _ = crate::carma_ui::update_progress(
            &format!("Processed {}/{} term(s)", processed_terms.get(), term_count),
            pages_visited,
            all_rows.len() as u32,
            0,
            80,
        );
    }

    let rows_seen = all_rows.len();
    crate::carma_ui::update_progress("Deduplicating...", pages_visited, rows_seen as u32, 0, 90)?;
    let (columns, artifact_rows, duplicates, resolved_date_header) =
        extract_rows_from_records(all_rows, &panel_state);
    let final_count = artifact_rows.len() as u32;
    crate::carma_ui::store_last_run(&columns, &artifact_rows)?;
    if carma_cancel_requested() {
        crate::carma_ui::update_progress("Canceled.", pages_visited, final_count, duplicates, 100)?;
    } else {
        crate::carma_ui::show_complete(final_count, duplicates, pages_visited)?;
    }

    let artifact = RunArtifact {
        kind: ArtifactKind::Table,
        name: "carma.bulk.search.scrape".to_string(),
        columns,
        rows: artifact_rows,
        meta: ArtifactMeta {
            site: "carma".to_string(),
            workflow_id: "carma.bulk.search.scrape".to_string(),
            generated_at_ms: Date::now() as u64,
        },
    };
    let artifact_value = serde_json::to_value(artifact)
        .map_err(|err| WasmRuntimeError::from(format!("serialize carma scrape artifact: {err}")))?;

    Ok(json!({
        "command": "carma.bulk.search.scrape",
        "status": if carma_cancel_requested() { "canceled" } else { "success" },
        "artifacts": [artifact_value],
        "diagnostics": {
            "pagesVisited": pages_visited,
            "rowsSeen": rows_seen,
            "duplicatesSkipped": duplicates,
            "uniquenessEnabled": panel_state.uniqueness.enabled,
            "uniquenessStrategy": panel_state.uniqueness.strategy,
            "resolvedDateColumn": resolved_date_header,
            "columnMode": panel_state.scrape.column_mode,
            "maxPages": max_pages,
            "termsProcessed": terms_total
        }
    }))
}
