use std::collections::BTreeMap;

use cv_ext_ui_components::{table_capture, table_model::TableDataset};
use js_sys::Date;
use wasm_bindgen::JsCast;

use crate::errors::WasmRuntimeError;

const DEFAULT_POLL_MS: u32 = 50;

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
    query_selector(selector)?
        .ok_or_else(|| WasmRuntimeError::from(format!("selector not found: {selector}")))
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

pub async fn sleep_ms(delay_ms: u32) {
    gloo_timers::future::TimeoutFuture::new(delay_ms).await;
}

pub async fn wait_for_selector(selector: &str, timeout_ms: u32) -> Result<(), WasmRuntimeError> {
    let started = Date::now();
    let deadline = started + timeout_ms as f64;

    while Date::now() <= deadline {
        if let Some(element) = query_selector(selector)? {
            if element_is_visible(&element) {
                return Ok(());
            }
        }
        sleep_ms(DEFAULT_POLL_MS).await;
    }

    Err(WasmRuntimeError::from(format!(
        "timeout waiting for selector '{selector}'"
    )))
}

pub fn click_selector(selector: &str) -> Result<(), WasmRuntimeError> {
    let element = query_selector_required(selector)?;
    let html = element.dyn_into::<web_sys::HtmlElement>().map_err(|_| {
        WasmRuntimeError::from(format!(
            "selector '{selector}' is not clickable html element"
        ))
    })?;
    html.click();
    Ok(())
}

fn dispatch_bubbling_event(
    target: &web_sys::EventTarget,
    name: &str,
) -> Result<(), WasmRuntimeError> {
    let init = web_sys::EventInit::new();
    init.set_bubbles(true);
    init.set_cancelable(true);

    let event = web_sys::Event::new_with_event_init_dict(name, &init)
        .map_err(|_| WasmRuntimeError::from(format!("failed to create event '{name}'")))?;
    target
        .dispatch_event(&event)
        .map_err(|_| WasmRuntimeError::from(format!("dispatch_event failed for '{name}'")))?;
    Ok(())
}

pub fn type_selector(selector: &str, text: &str) -> Result<(), WasmRuntimeError> {
    let element = query_selector_required(selector)?;

    if let Ok(input) = element.clone().dyn_into::<web_sys::HtmlInputElement>() {
        input.set_value(text);
        let target: web_sys::EventTarget = element.clone().dyn_into().map_err(|_| {
            WasmRuntimeError::from(format!("selector '{selector}' is not an event target"))
        })?;
        let _ = dispatch_bubbling_event(&target, "input");
        let _ = dispatch_bubbling_event(&target, "change");
        return Ok(());
    }

    if let Ok(textarea) = element.clone().dyn_into::<web_sys::HtmlTextAreaElement>() {
        textarea.set_value(text);
        let target: web_sys::EventTarget = element.clone().dyn_into().map_err(|_| {
            WasmRuntimeError::from(format!("selector '{selector}' is not an event target"))
        })?;
        let _ = dispatch_bubbling_event(&target, "input");
        let _ = dispatch_bubbling_event(&target, "change");
        return Ok(());
    }

    if let Ok(select) = element.clone().dyn_into::<web_sys::HtmlSelectElement>() {
        select.set_value(text);
        let target: web_sys::EventTarget = element.clone().dyn_into().map_err(|_| {
            WasmRuntimeError::from(format!("selector '{selector}' is not an event target"))
        })?;
        let _ = dispatch_bubbling_event(&target, "input");
        let _ = dispatch_bubbling_event(&target, "change");
        return Ok(());
    }

    element.set_attribute("value", text).map_err(|_| {
        WasmRuntimeError::from(format!(
            "failed to set value attribute for selector '{selector}'"
        ))
    })?;
    element.set_text_content(Some(text));

    if let Ok(target) = element.clone().dyn_into::<web_sys::EventTarget>() {
        let _ = dispatch_bubbling_event(&target, "input");
        let _ = dispatch_bubbling_event(&target, "change");
    }
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

    if let Ok(textarea) = element.clone().dyn_into::<web_sys::HtmlTextAreaElement>() {
        let value = textarea.value();
        let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
        return Ok(Some(normalized.trim().to_string()));
    }

    if let Ok(select) = element.clone().dyn_into::<web_sys::HtmlSelectElement>() {
        let value = select.value();
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

fn normalize_whitespace(text: &str) -> String {
    text.replace('\u{00A0}', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn cell_value(cell: &web_sys::Element) -> Result<String, WasmRuntimeError> {
    if let Ok(Some(found)) = cell.query_selector("input, textarea, select") {
        if let Ok(input) = found.clone().dyn_into::<web_sys::HtmlInputElement>() {
            let input_type = input.type_().to_lowercase();
            if input_type == "checkbox" || input_type == "radio" {
                return Ok(if input.checked() {
                    "TRUE".to_string()
                } else {
                    "FALSE".to_string()
                });
            }
            return Ok(normalize_whitespace(&input.value()));
        }

        if let Ok(textarea) = found.clone().dyn_into::<web_sys::HtmlTextAreaElement>() {
            return Ok(normalize_whitespace(&textarea.value()));
        }

        if let Ok(select) = found.clone().dyn_into::<web_sys::HtmlSelectElement>() {
            if let Ok(Some(option)) = select.query_selector("option:checked") {
                let text = option.text_content().unwrap_or_default();
                if !normalize_whitespace(&text).is_empty() {
                    return Ok(normalize_whitespace(&text));
                }
            }
            return Ok(normalize_whitespace(&select.value()));
        }
    }

    let text = if let Ok(html) = cell.clone().dyn_into::<web_sys::HtmlElement>() {
        html.inner_text()
    } else {
        cell.text_content().unwrap_or_default()
    };
    let mut normalized = normalize_whitespace(&text);

    if let Ok(links) = cell.query_selector_all("a[href]") {
        if links.length() == 1 {
            if let Some(node) = links.item(0) {
                if let Ok(anchor) = node.dyn_into::<web_sys::HtmlAnchorElement>() {
                    let href = anchor.href();
                    if href.starts_with("http://") || href.starts_with("https://") {
                        if !normalized.contains(&href) {
                            let anchor_text =
                                normalize_whitespace(&anchor.text_content().unwrap_or_default());
                            let label = if normalized.is_empty() {
                                anchor_text
                            } else {
                                normalized.clone()
                            };
                            if !label.is_empty() && label != href {
                                normalized = format!("{label} ({href})");
                            } else if normalized.is_empty() {
                                normalized = href;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(normalized)
}

fn span_num(element: &web_sys::Element, attr: &str) -> usize {
    element
        .get_attribute(attr)
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(1)
        .max(1)
}

fn row_cells(row: &web_sys::Element) -> Result<Vec<web_sys::Element>, WasmRuntimeError> {
    if let Ok(node_list) = row.query_selector_all(":scope > td, :scope > th") {
        if node_list.length() > 0 {
            let mut out = Vec::new();
            for i in 0..node_list.length() {
                let Some(node) = node_list.item(i) else {
                    continue;
                };
                let el = node
                    .dyn_into::<web_sys::Element>()
                    .map_err(|_| WasmRuntimeError::from("cell cast failed"))?;
                out.push(el);
            }
            return Ok(out);
        }
    }

    let nodes = row
        .query_selector_all(
            ":scope > [role='cell'], :scope > [role='gridcell'], :scope > [role='columnheader']",
        )
        .map_err(|_| WasmRuntimeError::from("query role cells failed"))?;

    let mut out = Vec::new();
    for i in 0..nodes.length() {
        let Some(node) = nodes.item(i) else { continue };
        let el = node
            .dyn_into::<web_sys::Element>()
            .map_err(|_| WasmRuntimeError::from("cell cast failed"))?;
        out.push(el);
    }
    Ok(out)
}

#[derive(Clone)]
struct PendingSpan {
    text: String,
    remaining_rows: usize,
}

fn build_grid(rows: &[web_sys::Element]) -> Result<(Vec<Vec<String>>, usize), WasmRuntimeError> {
    let mut grid: Vec<Vec<String>> = Vec::new();
    let mut spans: Vec<Option<PendingSpan>> = Vec::new();
    let mut max_cols: usize = 0;

    for row in rows {
        let mut out: Vec<Option<String>> = Vec::new();

        for (col, span) in spans.iter_mut().enumerate() {
            if let Some(pending) = span {
                if pending.remaining_rows > 0 {
                    while out.len() <= col {
                        out.push(None);
                    }
                    out[col] = Some(pending.text.clone());
                    pending.remaining_rows -= 1;
                    if pending.remaining_rows == 0 {
                        *span = None;
                    }
                }
            }
        }

        let cells = row_cells(row)?;
        let mut col = 0usize;
        for cell in cells {
            while col < out.len() && out[col].is_some() {
                col += 1;
            }

            let text = cell_value(&cell)?;
            let colspan = span_num(&cell, "colspan");
            let rowspan = span_num(&cell, "rowspan");

            while out.len() < col + colspan {
                out.push(None);
            }

            out[col] = Some(text.clone());
            for k in 1..colspan {
                out[col + k] = Some(String::new());
            }

            if rowspan > 1 {
                while spans.len() < col + colspan {
                    spans.push(None);
                }
                for k in 0..colspan {
                    spans[col + k] = Some(PendingSpan {
                        text: if k == 0 { text.clone() } else { String::new() },
                        remaining_rows: rowspan - 1,
                    });
                }
            }

            col += colspan;
        }

        max_cols = max_cols.max(out.len()).max(spans.len());
        let mut resolved = Vec::with_capacity(out.len());
        for value in out {
            resolved.push(value.unwrap_or_default());
        }
        grid.push(resolved);
    }

    for row in grid.iter_mut() {
        while row.len() < max_cols {
            row.push(String::new());
        }
    }

    Ok((grid, max_cols))
}

fn is_direct_row(table: &web_sys::Element, row: &web_sys::Element) -> bool {
    if let Ok(Some(found)) = row.closest("table") {
        found == *table
    } else {
        false
    }
}

fn table_from_element(element: &web_sys::Element) -> Option<web_sys::Element> {
    if element.tag_name().eq_ignore_ascii_case("table") {
        return Some(element.clone());
    }
    if let Ok(Some(closest)) = element.closest("table") {
        return Some(closest);
    }
    element.query_selector("table").ok().flatten()
}

pub fn capture_table_aoa(selector: &str) -> Result<Vec<Vec<String>>, WasmRuntimeError> {
    let root = document()?
        .query_selector(selector)
        .map_err(|_| WasmRuntimeError::from("query_selector failed"))?
        .ok_or("no matching element")?;

    let table = table_from_element(&root);

    let mut all_rows: Vec<web_sys::Element> = Vec::new();
    let mut header_rows: Vec<web_sys::Element> = Vec::new();
    let body_rows: Vec<web_sys::Element>;

    if let Some(table) = table {
        if let Ok(row_nodes) = table.query_selector_all("tr") {
            for i in 0..row_nodes.length() {
                let Some(node) = row_nodes.item(i) else {
                    continue;
                };
                let Ok(row_el) = node.dyn_into::<web_sys::Element>() else {
                    continue;
                };
                if is_direct_row(&table, &row_el) {
                    all_rows.push(row_el);
                }
            }
        }

        if all_rows.is_empty() {
            return Err(WasmRuntimeError::from("no matching rows found in table"));
        }

        if let Ok(thead_rows) = table.query_selector_all("thead tr") {
            for i in 0..thead_rows.length() {
                let Some(node) = thead_rows.item(i) else {
                    continue;
                };
                let Ok(row_el) = node.dyn_into::<web_sys::Element>() else {
                    continue;
                };
                if is_direct_row(&table, &row_el) {
                    header_rows.push(row_el);
                }
            }
        }
        if header_rows.is_empty() {
            header_rows.push(all_rows[0].clone());
        }

        body_rows = all_rows
            .into_iter()
            .filter(|row| !header_rows.iter().any(|header| header == row))
            .collect();
    } else {
        if let Ok(role_rows) = root.query_selector_all(r#"[role="row"]"#) {
            for i in 0..role_rows.length() {
                let Some(node) = role_rows.item(i) else {
                    continue;
                };
                let Ok(row_el) = node.dyn_into::<web_sys::Element>() else {
                    continue;
                };
                all_rows.push(row_el);
            }
        }
        if all_rows.is_empty() {
            if let Ok(children) = root.query_selector_all(":scope > *") {
                for i in 0..children.length() {
                    let Some(node) = children.item(i) else {
                        continue;
                    };
                    let Ok(child) = node.dyn_into::<web_sys::Element>() else {
                        continue;
                    };
                    all_rows.push(child);
                }
            }
        }
        if all_rows.is_empty() {
            return Err(WasmRuntimeError::from("no rows found in selected element"));
        }
        header_rows.push(all_rows[0].clone());
        body_rows = all_rows.into_iter().skip(1).collect();
    }

    let (header_grid, header_cols) = build_grid(&header_rows)?;
    if header_grid.is_empty() || header_cols == 0 {
        return Err(WasmRuntimeError::from("unable to extract headers"));
    }
    let merged_headers = table_capture::merge_header_rows(&header_grid);
    let headers = table_capture::make_headers_unique(&merged_headers);

    let (body_grid, body_cols) = build_grid(&body_rows)?;
    let col_count = headers.len().max(header_cols).max(body_cols);
    let mut padded_headers = headers;
    while padded_headers.len() < col_count {
        padded_headers.push(format!("Column {}", padded_headers.len() + 1));
    }

    let mut aoa = Vec::with_capacity(body_grid.len() + 1);
    aoa.push(padded_headers);
    for mut row in body_grid {
        while row.len() < col_count {
            row.push(String::new());
        }
        aoa.push(row);
    }
    Ok(table_capture::ensure_valid_aoa(aoa))
}

pub fn capture_table_dataset(selector: &str) -> Result<TableDataset, WasmRuntimeError> {
    let aoa = capture_table_aoa(selector)?;
    let headers = aoa.first().cloned().unwrap_or_default();
    let rows = aoa.into_iter().skip(1).collect::<Vec<_>>();
    Ok(TableDataset::new(headers, rows))
}

pub fn capture_table_rows(
    selector: &str,
) -> Result<Vec<BTreeMap<String, String>>, WasmRuntimeError> {
    let dataset = capture_table_dataset(selector)?;
    let mut records = Vec::with_capacity(dataset.rows.len());
    for row in dataset.rows {
        let mut record = BTreeMap::new();
        let mut any = false;
        for (idx, header) in dataset.columns.iter().enumerate() {
            let value = row.get(idx).cloned().unwrap_or_default();
            if !value.trim().is_empty() {
                any = true;
            }
            record.insert(header.clone(), value);
        }
        if any {
            records.push(record);
        }
    }
    Ok(records)
}
