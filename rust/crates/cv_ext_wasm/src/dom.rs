use std::collections::BTreeMap;

use wasm_bindgen::JsCast;

use crate::errors::WasmRuntimeError;

pub fn capture_table_rows(selector: &str) -> Result<Vec<BTreeMap<String, String>>, WasmRuntimeError> {
    let window = web_sys::window().ok_or("window unavailable")?;
    let document = window.document().ok_or("document unavailable")?;
    let table = document
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
