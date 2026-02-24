use std::collections::BTreeMap;

use js_sys::Date;
use wasm_bindgen::JsCast;

use crate::errors::WasmRuntimeError;

fn window() -> Result<web_sys::Window, WasmRuntimeError> {
    web_sys::window().ok_or("window unavailable".into())
}

fn document() -> Result<web_sys::Document, WasmRuntimeError> {
    window()?.document().ok_or("document unavailable".into())
}

pub fn query_selector(selector: &str) -> Result<Option<web_sys::Element>, WasmRuntimeError> {
    document()?
        .query_selector(selector)
        .map_err(|_| WasmRuntimeError::from(format!("query_selector failed for '{selector}'")))
}

pub fn query_selector_required(selector: &str) -> Result<web_sys::Element, WasmRuntimeError> {
    query_selector(selector)?.ok_or_else(|| WasmRuntimeError::from(format!("selector not found: {selector}")))
}

pub fn element_is_visible(element: &web_sys::Element) -> bool {
    if element
        .get_attribute("hidden")
        .map(|value| !value.is_empty())
        .unwrap_or(false)
    {
        return false;
    }

    if element
        .get_attribute("aria-hidden")
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    {
        return false;
    }

    if let Ok(html) = element.clone().dyn_into::<web_sys::HtmlElement>() {
        return html.offset_width() > 0 || html.offset_height() > 0;
    }

    true
}

pub fn wait_for_selector(selector: &str, timeout_ms: u32) -> Result<(), WasmRuntimeError> {
    let started = Date::now();
    let deadline = started + timeout_ms as f64;

    while Date::now() <= deadline {
        if let Some(element) = query_selector(selector)? {
            if element_is_visible(&element) {
                return Ok(());
            }
        }
    }

    Err(WasmRuntimeError::from(format!(
        "timeout waiting for selector '{selector}'"
    )))
}

pub fn click_selector(selector: &str) -> Result<(), WasmRuntimeError> {
    let element = query_selector_required(selector)?;
    let html = element
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| WasmRuntimeError::from(format!("selector '{selector}' is not clickable html element")))?;
    html.click();
    Ok(())
}

pub fn type_selector(selector: &str, text: &str) -> Result<(), WasmRuntimeError> {
    let element = query_selector_required(selector)?;

    if let Ok(input) = element.clone().dyn_into::<web_sys::HtmlInputElement>() {
        input.set_value(text);
        return Ok(());
    }

    element.set_attribute("value", text).map_err(|_| {
        WasmRuntimeError::from(format!("failed to set value attribute for selector '{selector}'"))
    })?;
    element.set_text_content(Some(text));
    Ok(())
}

pub fn element_value(selector: &str) -> Result<Option<String>, WasmRuntimeError> {
    let Some(element) = query_selector(selector)? else {
        return Ok(None);
    };

    if let Ok(input) = element.clone().dyn_into::<web_sys::HtmlInputElement>() {
        let value = input.value();
        let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
        return Ok(Some(normalized.trim().to_string()));
    }

    let value = element
        .get_attribute("value")
        .or_else(|| element.text_content())
        .unwrap_or_default();
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    Ok(Some(normalized.trim().to_string()))
}

pub fn body_text_lowercase() -> Result<String, WasmRuntimeError> {
    let body = document()?
        .body()
        .ok_or_else(|| WasmRuntimeError::from("document body unavailable"))?;
    Ok(body
        .text_content()
        .unwrap_or_default()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase())
}

pub fn capture_table_rows(selector: &str) -> Result<Vec<BTreeMap<String, String>>, WasmRuntimeError> {
    let table = document()?
        .query_selector(selector)
        .map_err(|_| WasmRuntimeError::from("query_selector failed"))?
        .ok_or("no matching table")?;

    let headers = extract_headers(&table)?;
    let row_nodes = table
        .query_selector_all("tbody tr, tr")
        .map_err(|_| WasmRuntimeError::from("query rows failed"))?;

    let mut rows = Vec::new();
    for i in 0..row_nodes.length() {
        let Some(node) = row_nodes.item(i) else {
            continue;
        };
        let element = node
            .dyn_into::<web_sys::Element>()
            .map_err(|_| WasmRuntimeError::from("row cast failed"))?;

        let cells = element
            .query_selector_all("th, td")
            .map_err(|_| WasmRuntimeError::from("query cells failed"))?;

        if cells.length() == 0 {
            continue;
        }

        let mut record = BTreeMap::new();
        for cell_index in 0..cells.length() {
            let Some(cell) = cells.item(cell_index) else {
                continue;
            };
            let el = cell
                .dyn_into::<web_sys::Element>()
                .map_err(|_| WasmRuntimeError::from("cell cast failed"))?;
            let text = el.text_content().unwrap_or_default().trim().to_string();
            let header = headers
                .get(cell_index as usize)
                .cloned()
                .unwrap_or_else(|| format!("Column {}", cell_index + 1));
            record.insert(header, text);
        }

        if !record.is_empty() {
            rows.push(record);
        }
    }

    Ok(rows)
}

fn extract_headers(table: &web_sys::Element) -> Result<Vec<String>, WasmRuntimeError> {
    let header_nodes = table
        .query_selector_all("thead th, tr:first-child th, tr:first-child td")
        .map_err(|_| WasmRuntimeError::from("query headers failed"))?;

    let mut headers = Vec::new();
    for i in 0..header_nodes.length() {
        let Some(node) = header_nodes.item(i) else {
            continue;
        };
        let element = node
            .dyn_into::<web_sys::Element>()
            .map_err(|_| WasmRuntimeError::from("header cast failed"))?;
        let text = element.text_content().unwrap_or_default().trim().to_string();
        headers.push(if text.is_empty() {
            format!("Column {}", i + 1)
        } else {
            text
        });
    }

    Ok(headers)
}
