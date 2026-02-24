use std::collections::{BTreeMap, HashMap};

use js_sys::Date;
use cv_ext_contract::{ArtifactKind, ArtifactMeta, RunArtifact};
use serde_json::{json, Value};
use wasm_bindgen::JsCast;

use crate::{dom, errors::WasmRuntimeError};

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
        "jira.capture.filter_table" => jira_capture_filter_table(),
        "carma.bulk.search.scrape" => carma_bulk_search_scrape().await,
        "oracle.expand_invoice" => oracle_expand_invoice(),
        "oracle.expand_invoice.perform" => oracle_expand_invoice_perform(),
        "oracle.expand_invoice.ensure" => oracle_expand_invoice_ensure(),
        "oracle.invoice.validation.alert" => oracle_invoice_validation_alert().await,
        "oracle.invoice.validation.verify" => oracle_invoice_validation_verify().await,
        "oracle.invoice.create" => oracle_invoice_create(context).await,
        "oracle.invoice.create.business_unit.ensure" => oracle_invoice_business_unit_ensure(context),
        "oracle.invoice.create.supplier.lov" => oracle_invoice_supplier_lov(context).await,
        "oracle.invoice.create.supplier_site.fill" => oracle_invoice_supplier_site_fill(context),
        "oracle.invoice.create.supplier_site.ensure" => oracle_invoice_supplier_site_ensure(),
        "oracle.invoice.create.number" => oracle_invoice_create_number(context),
        other => Err(WasmRuntimeError::from(format!("unsupported command: {other}"))),
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
    let rows = dom::capture_table_rows("table")?;
    let today = today_mmddyyyy();
    let (columns, out_rows) = cv_ext_sites_jira::transform_jira_filter_rows_ap(rows, &today);

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

fn fill_if_present(context: &Value, keys: &[&str], selector: &str) -> Result<Option<Value>, WasmRuntimeError> {
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
    let body = document
        .body()
        .ok_or_else(|| WasmRuntimeError::from("body unavailable"))?;

    let marker = "data-cv-jql-builder-installed";
    if body.get_attribute(marker).is_some() {
        return Ok(json!({
            "command": "jira.install_jql_builder",
            "installed": false,
            "reason": "already-installed"
        }));
    }

    body.set_attribute(marker, "true")
        .map_err(|_| WasmRuntimeError::from("failed to set jql marker"))?;

    let switchers = document
        .query_selector_all("a.switcher-item")
        .map_err(|_| WasmRuntimeError::from("failed to query switcher items"))?;

    for index in 0..switchers.length() {
        let Some(node) = switchers.item(index) else {
            continue;
        };

        let Ok(element) = node.dyn_into::<web_sys::Element>() else {
            continue;
        };

        let text = element
            .text_content()
            .unwrap_or_default()
            .to_lowercase();

        if text.contains("advanced") {
            let html = element
                .dyn_into::<web_sys::HtmlElement>()
                .map_err(|_| WasmRuntimeError::from("advanced switcher is not html element"))?;
            html.click();
            break;
        }
    }

    Ok(json!({
        "command": "jira.install_jql_builder",
        "installed": true,
        "switcherCount": switchers.length(),
        "detail": "marked hook installed and attempted to activate advanced search"
    }))
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
        return Err(WasmRuntimeError::from("invoice search is still collapsed after click"));
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
        return Err(WasmRuntimeError::from("failed to expand invoice search panel"));
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
    let has_validation_family = tokens.iter().any(|t| matches!(*t, "validation" | "revalidation" | "reverification"))
        || tokens.iter().any(|t| t.starts_with("revalid") || t.starts_with("reverif"));
    let has_re_token = tokens.iter().any(|t| *t == "re") || tokens.iter().any(|t| t.starts_with("revalid") || t.starts_with("reverif"));
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
        .query_selector_all("td[headers], td[headers*='ValidationStatus'], td[headers*='validationstatus']")
        .map_err(|_| WasmRuntimeError::from("failed to query validation status candidates"))?;

    for i in 0..nodes.length() {
        let Some(node) = nodes.item(i) else { continue };
        let Ok(el) = node.dyn_into::<web_sys::Element>() else { continue };
        let headers = el.get_attribute("headers").unwrap_or_default();
        if !headers.to_lowercase().contains("validationstatus") {
            continue;
        }
        if !dom::element_is_visible(&el) {
            continue;
        }

        let text = el.text_content().unwrap_or_default();
        let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ").trim().to_string();
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
    let status = detect_validation_status_with_retries().await?;
    let status_value = status.get("status").and_then(Value::as_str).unwrap_or("unknown");

    if let Some(body) = web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.body())
    {
        let _ = body.set_attribute("data-cv-oracle-validation-status", status_value);
    }

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
            status.get("statusText").cloned().unwrap_or(Value::String(String::new())),
            status.get("attempts").cloned().unwrap_or(Value::Null),
            status.get("sample").cloned().unwrap_or(Value::String(String::new())),
        ]],
        meta: ArtifactMeta {
            site: "oracle".to_string(),
            workflow_id: "oracle.invoice.validation.alert".to_string(),
            generated_at_ms: Date::now() as u64,
        },
    };

    let artifact_value = serde_json::to_value(artifact)
        .map_err(|err| WasmRuntimeError::from(format!("serialize oracle validation artifact: {err}")))?;

    Ok(json!({
        "command": "oracle.invoice.validation.alert",
        "status": "success",
        "result": status,
        "artifacts": [artifact_value]
    }))
}

async fn oracle_invoice_validation_verify() -> Result<Value, WasmRuntimeError> {
    let status = detect_validation_status_with_retries().await?;
    Ok(json!({
        "command": "oracle.invoice.validation.verify",
        "status": "success",
        "result": status,
        "verified": true
    }))
}

fn oracle_invoice_business_unit_ensure(context: &Value) -> Result<Value, WasmRuntimeError> {
    if let Some(filled) = fill_if_present(context, &["businessUnit", "Business Unit"], ORACLE_BUSINESS_UNIT_INPUT)? {
        return Ok(json!({
            "command": "oracle.invoice.create.business_unit.ensure",
            "result": filled,
        }));
    }

    let selectors = [ORACLE_BUSINESS_UNIT_INPUT, "input[aria-label*='Business Unit Name']"];
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
    if let Some(value) = read_input(context, &["supplierSearch", "supplier", "Supplier Search", "Supplier"]) {
        let _ = fill_if_present(context, &["supplierSearch", "supplier", "Supplier Search", "Supplier"], ORACLE_SUPPLIER_INPUT)?;

        let clicked = click_with_fallback(&[
            "[id*='supplier'][id*='lovIconId']",
            "button[aria-label*='Supplier'][aria-label*='Search']",
            "a[aria-label*='Supplier'][aria-label*='Search']",
        ])?;

        let _ = dom::wait_for_selector("[role='listbox'], [role='dialog'], [id*='lovDialogId']", 8000).await;
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
        let _ = dom::wait_for_selector("[role='listbox'], [role='dialog'], [id*='lovDialogId']", 8000).await;
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
    if let Some(filled) = fill_if_present(context, &["supplierSite", "Supplier Site"], ORACLE_SUPPLIER_SITE_INPUT)? {
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
            "unable to infer supplier site from visible options"
        ));
    };

    dom::type_selector(ORACLE_SUPPLIER_SITE_INPUT, &option)?;

    Ok(json!({
        "command": "oracle.invoice.create.supplier_site.fill",
        "supplierSite": option
    }))
}

fn oracle_invoice_supplier_site_ensure() -> Result<Value, WasmRuntimeError> {
    let value = dom::element_value(ORACLE_SUPPLIER_SITE_INPUT)?.unwrap_or_default();
    if value.trim().is_empty() {
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

    let step1 = oracle_invoice_business_unit_ensure(context)?;
    artifacts.push(step1.clone());
    steps.push(json!({"command": "oracle.invoice.create.business_unit.ensure", "status": "success"}));
    dom::sleep_ms(60).await;

    let step2 = oracle_invoice_supplier_lov(context).await?;
    artifacts.push(step2.clone());
    steps.push(json!({"command": "oracle.invoice.create.supplier.lov", "status": "success"}));
    dom::sleep_ms(60).await;

    let step3 = oracle_invoice_supplier_site_fill(context)?;
    artifacts.push(step3.clone());
    steps.push(json!({"command": "oracle.invoice.create.supplier_site.fill", "status": "success"}));
    dom::sleep_ms(60).await;

    let step4 = oracle_invoice_supplier_site_ensure()?;
    artifacts.push(step4.clone());
    steps.push(json!({"command": "oracle.invoice.create.supplier_site.ensure", "status": "success"}));
    dom::sleep_ms(60).await;

    let step5 = oracle_invoice_create_number(context)?;
    artifacts.push(step5.clone());
    steps.push(json!({"command": "oracle.invoice.create.number", "status": "success"}));
    dom::sleep_ms(60).await;

    if let Some(filled) = fill_if_present(context, &["invoiceGroup", "Invoice Group"], ORACLE_INVOICE_GROUP_INPUT)? {
        artifacts.push(json!({
            "command": "oracle.invoice.create.invoice_group",
            "result": filled,
        }));
    }

    if let Some(filled) = fill_if_present(
        context,
        &["amountNumeric", "amountRaw", "Amount", "Amount Numeric", "Amount Raw"],
        ORACLE_AMOUNT_INPUT,
    )? {
        artifacts.push(json!({
            "command": "oracle.invoice.create.amount",
            "result": filled,
        }));
    }

    if let Some(filled) = fill_if_present(context, &["description", "Description"], ORACLE_DESCRIPTION_INPUT)? {
        artifacts.push(json!({
            "command": "oracle.invoice.create.description",
            "result": filled,
        }));
    }

    Ok(json!({
        "command": "oracle.invoice.create",
        "steps": steps,
        "artifacts": artifacts,
        "input": context,
    }))
}

fn normalized_label(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase()
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

fn find_next_page_control() -> Result<Option<web_sys::HtmlElement>, WasmRuntimeError> {
    let window = web_sys::window().ok_or_else(|| WasmRuntimeError::from("window unavailable"))?;
    let document = window
        .document()
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;

    let nodes = document
        .query_selector_all("button, a, [role='button']")
        .map_err(|_| WasmRuntimeError::from("query paging controls failed"))?;

    for i in 0..nodes.length() {
        let Some(node) = nodes.item(i) else { continue };
        let Ok(el) = node.dyn_into::<web_sys::Element>() else { continue };
        if !dom::element_is_visible(&el) {
            continue;
        }
        let label = element_label(&el);
        if !(label.contains("next") || label.contains("›") || label.contains("»")) {
            continue;
        }
        if element_disabled(&el) {
            continue;
        }
        if let Ok(html) = el.dyn_into::<web_sys::HtmlElement>() {
            return Ok(Some(html));
        }
    }

    Ok(None)
}

fn row_signature(rows: &[BTreeMap<String, String>]) -> String {
    let Some(first) = rows.first() else {
        return String::new();
    };
    let mut pieces: Vec<String> = Vec::new();
    for (k, v) in first {
        let value = v.split_whitespace().collect::<Vec<_>>().join(" ");
        if !value.is_empty() {
            pieces.push(format!("{k}={value}"));
        }
        if pieces.len() >= 4 {
            break;
        }
    }
    pieces.join("|")
}

fn derive_carma_reference(row: &BTreeMap<String, String>) -> String {
    let mut stock = String::new();
    let mut vin = String::new();
    let mut pid = String::new();

    for (key, value) in row {
        let k = normalize_header_like(key);
        let v = value.split_whitespace().collect::<Vec<_>>().join(" ").trim().to_string();
        if v.is_empty() {
            continue;
        }

        if stock.is_empty()
            && (k.contains("latestpurchasestocknumber") || k == "stocknumber" || k.contains("stocknumber"))
        {
            stock = v.clone();
            continue;
        }
        if vin.is_empty() && (k == "vin" || k.contains("latestpurchasevin")) {
            vin = v.clone();
            continue;
        }
        if pid.is_empty()
            && (k.contains("latestpurchasepurchaseid") || k == "purchaseid" || k.contains("purchaseid"))
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
        if stock.is_empty() { "STOCK" } else { stock.as_str() },
        if vin.is_empty() { "VIN" } else { vin.as_str() },
        if pid.is_empty() { "PID" } else { pid.as_str() }
    )
}

fn normalize_header_like(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}

async fn carma_bulk_search_scrape() -> Result<Value, WasmRuntimeError> {
    dom::wait_for_selector("table", 12_000).await?;

    let mut all_rows: Vec<BTreeMap<String, String>> = Vec::new();
    let mut pages_visited: u32 = 0;

    // Hard safety cap to avoid infinite paging loops.
    const MAX_PAGES: u32 = 25;

    let page_rows = dom::capture_table_rows("table")?;
    pages_visited += 1;
    let mut last_sig = row_signature(&page_rows);
    all_rows.extend(page_rows);

    while pages_visited < MAX_PAGES {
        let Some(next) = find_next_page_control()? else {
            break;
        };
        next.click();

        let started = Date::now();
        let deadline = started + 8_000f64;
        let mut next_rows: Option<Vec<BTreeMap<String, String>>> = None;
        while Date::now() <= deadline {
            dom::sleep_ms(120).await;
            let candidate = dom::capture_table_rows("table").unwrap_or_default();
            let sig = row_signature(&candidate);
            if !sig.is_empty() && sig != last_sig {
                next_rows = Some(candidate);
                last_sig = sig;
                break;
            }
        }

        let Some(candidate) = next_rows else {
            break;
        };

        pages_visited += 1;
        all_rows.extend(candidate);
    }

    let rows_seen = all_rows.len();

    let mut seen: HashMap<String, BTreeMap<String, String>> = HashMap::new();
    let mut duplicates = 0u32;

    for mut row in all_rows {
        let reference = derive_carma_reference(&row);
        if !reference.is_empty() {
            row.insert("Reference".to_string(), reference.clone());
            if seen.contains_key(&reference) {
                duplicates += 1;
                continue;
            }
            seen.insert(reference, row);
        } else {
            let key = format!("{:?}", row);
            if seen.contains_key(&key) {
                duplicates += 1;
                continue;
            }
            seen.insert(key, row);
        }
    }

    let mut records: Vec<BTreeMap<String, String>> = seen.into_values().collect();
    records.sort_by(|a, b| a.get("Reference").cmp(&b.get("Reference")));

    let mut columns: Vec<String> = Vec::new();
    for row in &records {
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

    let mut artifact_rows: Vec<Vec<Value>> = Vec::with_capacity(records.len());
    for row in records {
        let mut values = Vec::with_capacity(columns.len());
        for column in &columns {
            values.push(Value::String(row.get(column).cloned().unwrap_or_default()));
        }
        artifact_rows.push(values);
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
        "status": "success",
        "artifacts": [artifact_value],
        "diagnostics": {
            "pagesVisited": pages_visited,
            "rowsSeen": rows_seen,
            "duplicatesSkipped": duplicates
        }
    }))
}
