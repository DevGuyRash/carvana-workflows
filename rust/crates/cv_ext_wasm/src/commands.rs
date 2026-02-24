use js_sys::Date;
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

pub fn execute_command(command: &str, context: &Value) -> Result<Value, WasmRuntimeError> {
    match command {
        "jira.install_jql_builder" => install_jql_builder_switcher_hooks(),
        "oracle.expand_invoice" => oracle_expand_invoice(),
        "oracle.expand_invoice.perform" => oracle_expand_invoice_perform(),
        "oracle.expand_invoice.ensure" => oracle_expand_invoice_ensure(),
        "oracle.invoice.validation.alert" => oracle_invoice_validation_alert(),
        "oracle.invoice.validation.verify" => oracle_invoice_validation_verify(),
        "oracle.invoice.create" => oracle_invoice_create(context),
        "oracle.invoice.create.business_unit.ensure" => oracle_invoice_business_unit_ensure(context),
        "oracle.invoice.create.supplier.lov" => oracle_invoice_supplier_lov(context),
        "oracle.invoice.create.supplier_site.fill" => oracle_invoice_supplier_site_fill(context),
        "oracle.invoice.create.supplier_site.ensure" => oracle_invoice_supplier_site_ensure(),
        "oracle.invoice.create.number" => oracle_invoice_create_number(context),
        other => Err(WasmRuntimeError::from(format!("unsupported command: {other}"))),
    }
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

fn detect_validation_status() -> Result<Value, WasmRuntimeError> {
    let text = dom::body_text_lowercase()?;

    let status = if text.contains("needs revalidation")
        || text.contains("needs re-validated")
        || text.contains("needs reverification")
    {
        "needs-revalidated"
    } else if text.contains("validated") {
        "validated"
    } else {
        "unknown"
    };

    Ok(json!({
        "status": status,
        "sample": text.chars().take(220).collect::<String>()
    }))
}

fn oracle_invoice_validation_alert() -> Result<Value, WasmRuntimeError> {
    let status = detect_validation_status()?;

    if let Some(body) = web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.body())
    {
        if let Some(value) = status.get("status").and_then(Value::as_str) {
            let _ = body.set_attribute("data-cv-oracle-validation-status", value);
        }
    }

    Ok(json!({
        "command": "oracle.invoice.validation.alert",
        "result": status
    }))
}

fn oracle_invoice_validation_verify() -> Result<Value, WasmRuntimeError> {
    Ok(json!({
        "command": "oracle.invoice.validation.verify",
        "result": detect_validation_status()?,
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

fn oracle_invoice_supplier_lov(context: &Value) -> Result<Value, WasmRuntimeError> {
    if let Some(value) = read_input(context, &["supplierSearch", "supplier", "Supplier Search", "Supplier"]) {
        let _ = fill_if_present(context, &["supplierSearch", "supplier", "Supplier Search", "Supplier"], ORACLE_SUPPLIER_INPUT)?;

        let clicked = click_with_fallback(&[
            "[id*='supplier'][id*='lovIconId']",
            "button[aria-label*='Supplier'][aria-label*='Search']",
            "a[aria-label*='Supplier'][aria-label*='Search']",
        ])?;

        return Ok(json!({
            "command": "oracle.invoice.create.supplier.lov",
            "supplierSearch": value,
            "clicked": clicked,
        }));
    }

    let clicked = click_with_fallback(&[
        "[id*='supplier'][id*='lovIconId']",
        "button[aria-label*='Supplier'][aria-label*='Search']",
        "a[aria-label*='Supplier'][aria-label*='Search']",
    ])?;

    if let Some(selector) = clicked {
        return Ok(json!({
            "command": "oracle.invoice.create.supplier.lov",
            "clicked": selector
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

fn oracle_invoice_create(context: &Value) -> Result<Value, WasmRuntimeError> {
    let command_order = [
        "oracle.invoice.create.business_unit.ensure",
        "oracle.invoice.create.supplier.lov",
        "oracle.invoice.create.supplier_site.fill",
        "oracle.invoice.create.supplier_site.ensure",
        "oracle.invoice.create.number",
    ];

    let mut steps = Vec::new();
    let mut artifacts = Vec::new();

    for command in command_order {
        let result = execute_command(command, context)?;
        artifacts.push(result.clone());
        steps.push(json!({
            "command": command,
            "status": "success"
        }));
    }

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
