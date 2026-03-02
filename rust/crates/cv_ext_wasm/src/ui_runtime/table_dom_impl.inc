use cv_ext_ui_components::table_export::{
    column_values_matching, to_csv, to_json_objects, TableExportOptions,
};
use cv_ext_ui_components::table_model::TableDataset;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use wasm_bindgen::{closure::Closure, JsCast, JsValue};

use crate::errors::WasmRuntimeError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredTableData {
    pub generated_at_ms: u64,
    pub dataset: TableDataset,
}

pub struct PopoutOptions<'a> {
    pub title: &'a str,
    pub window_name: &'a str,
    pub include_headers: bool,
    pub selected_columns: Vec<String>,
}

pub fn store_last_run(
    storage_key: &str,
    columns: &[String],
    rows: &[Vec<Value>],
) -> Result<(), WasmRuntimeError> {
    let mut out_rows: Vec<Vec<String>> = Vec::with_capacity(rows.len());
    for row in rows {
        let mut out_row: Vec<String> = Vec::with_capacity(row.len());
        for cell in row {
            let text = match cell {
                Value::String(value) => value.clone(),
                Value::Null => String::new(),
                other => other.to_string(),
            };
            out_row.push(text);
        }
        out_rows.push(out_row);
    }

    let payload = StoredTableData {
        generated_at_ms: js_sys::Date::now() as u64,
        dataset: TableDataset::new(columns.to_vec(), out_rows),
    };
    let raw = serde_json::to_string(&payload)
        .map_err(|err| WasmRuntimeError::from(format!("serialize table payload failed: {err}")))?;
    local_storage()?.set_item(storage_key, &raw).map_err(|_| {
        WasmRuntimeError::from(format!("failed to persist table payload to {storage_key}"))
    })?;
    Ok(())
}

pub fn load_last_run(storage_key: &str) -> Result<StoredTableData, WasmRuntimeError> {
    let raw = local_storage()?
        .get_item(storage_key)
        .map_err(|_| WasmRuntimeError::from(format!("failed to read {storage_key}")))?;
    let Some(raw) = raw else {
        return Err(WasmRuntimeError::from("no table data available"));
    };
    serde_json::from_str::<StoredTableData>(&raw)
        .map_err(|err| WasmRuntimeError::from(format!("parse stored table failed: {err}")))
}

pub fn copy_dataset_csv(
    dataset: &TableDataset,
    include_headers: bool,
) -> Result<(), WasmRuntimeError> {
    let csv = to_csv(
        dataset,
        &TableExportOptions {
            include_headers,
            selected_columns: None,
        },
    );
    copy_text(&csv)
}

pub fn copy_dataset_json(dataset: &TableDataset) -> Result<(), WasmRuntimeError> {
    let rows = to_json_objects(dataset);
    let raw = serde_json::to_string_pretty(&rows)
        .map_err(|err| WasmRuntimeError::from(format!("serialize json export failed: {err}")))?;
    copy_text(&raw)
}

pub fn download_dataset_csv(
    dataset: &TableDataset,
    include_headers: bool,
    filename: &str,
) -> Result<(), WasmRuntimeError> {
    let csv = to_csv(
        dataset,
        &TableExportOptions {
            include_headers,
            selected_columns: None,
        },
    );
    download_text(filename, "text/csv", &csv)
}

pub fn download_dataset_json(
    dataset: &TableDataset,
    filename: &str,
) -> Result<(), WasmRuntimeError> {
    let rows = to_json_objects(dataset);
    let raw = serde_json::to_string_pretty(&rows)
        .map_err(|err| WasmRuntimeError::from(format!("serialize json export failed: {err}")))?;
    download_text(filename, "application/json", &raw)
}

pub fn copy_matching_columns(
    dataset: &TableDataset,
    patterns: &[&str],
) -> Result<usize, WasmRuntimeError> {
    let values = column_values_matching(dataset, patterns);
    copy_text(&values.join("\n"))?;
    Ok(values.len())
}

pub fn open_popout_with_dataset(
    dataset: &TableDataset,
    options: &PopoutOptions<'_>,
) -> Result<(), WasmRuntimeError> {
    let features = "width=1300,height=800,noopener,noreferrer";
    let popout = window()?
        .open_with_url_and_target_and_features("about:blank", options.window_name, features)
        .map_err(|_| WasmRuntimeError::from("failed to open popout window"))?
        .ok_or_else(|| WasmRuntimeError::from("popout blocked by browser"))?;
    let doc = popout
        .document()
        .ok_or_else(|| WasmRuntimeError::from("popout document unavailable"))?;

    let headers_html = dataset
        .columns
        .iter()
        .map(|column| format!("<th>{}</th>", html_escape(column)))
        .collect::<Vec<_>>()
        .join("");
    let rows_html = dataset
        .rows
        .iter()
        .map(|row| {
            let cells = row
                .iter()
                .map(|cell| format!("<td>{}</td>", html_escape(cell)))
                .collect::<Vec<_>>()
                .join("");
            format!("<tr>{cells}</tr>")
        })
        .collect::<Vec<_>>()
        .join("");

    let selected_csv = to_csv(
        dataset,
        &TableExportOptions {
            include_headers: options.include_headers,
            selected_columns: Some(options.selected_columns.clone()),
        },
    );
    let visible_csv = to_csv(
        dataset,
        &TableExportOptions {
            include_headers: options.include_headers,
            selected_columns: None,
        },
    );

    doc.set_title(options.title);
    if let Some(head) = doc.head() {
        let style = doc
            .create_element("style")
            .map_err(|_| WasmRuntimeError::from("failed to create popout style"))?;
        style.set_inner_html(
            "body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:#f8fafc;color:#0f172a}\
            .top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff;border-bottom:1px solid #e2e8f0;position:sticky;top:0}\
            .title{font-weight:800}.actions{display:flex;gap:8px;flex-wrap:wrap}\
            button{border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:6px 10px;cursor:pointer;font-weight:700}\
            button:hover{background:#f1f5f9}.table-wrap{overflow:auto;height:calc(100vh - 62px)}\
            table{border-collapse:collapse;width:max(100%,1200px)}\
            th,td{border:1px solid #e2e8f0;padding:6px 8px;font-size:12px;text-align:left;white-space:nowrap}\
            th{position:sticky;top:0;background:#f8fafc;z-index:1}",
        );
        let _ = head.append_child(&style);
    }
    if let Some(body) = doc.body() {
        body.set_inner_html(&format!(
            r#"<div class="top"><div class="title">{} ({})</div><div class="actions"><button id="copy-visible">Copy Visible</button><button id="copy-selection">Copy Selection</button><button id="close">Close</button></div></div><div class="table-wrap"><table><thead><tr>{}</tr></thead><tbody>{}</tbody></table></div>"#,
            html_escape(options.title),
            dataset.rows.len(),
            headers_html,
            rows_html
        ));
    }

    if let Some(copy_visible) = doc.get_element_by_id("copy-visible") {
        let visible_csv_cloned = visible_csv.clone();
        let popout_window = popout.clone();
        let copy_handler =
            Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |_event: web_sys::Event| {
                let _ = clipboard_write_text(&popout_window, &visible_csv_cloned);
            }));
        let _ = copy_visible
            .add_event_listener_with_callback("click", copy_handler.as_ref().unchecked_ref());
        copy_handler.forget();
    }

    if let Some(copy_selection) = doc.get_element_by_id("copy-selection") {
        let selected_csv_cloned = selected_csv.clone();
        let fallback_csv = visible_csv.clone();
        let popout_window = popout.clone();
        let copy_handler =
            Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |_event: web_sys::Event| {
                let text = if selected_csv_cloned.is_empty() {
                    fallback_csv.clone()
                } else {
                    selected_csv_cloned.clone()
                };
                let _ = clipboard_write_text(&popout_window, &text);
            }));
        let _ = copy_selection
            .add_event_listener_with_callback("click", copy_handler.as_ref().unchecked_ref());
        copy_handler.forget();
    }

    if let Some(close_btn) = doc.get_element_by_id("close") {
        let popout_window = popout.clone();
        let close_handler =
            Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |_event: web_sys::Event| {
                let _ = popout_window.close();
            }));
        let _ = close_btn
            .add_event_listener_with_callback("click", close_handler.as_ref().unchecked_ref());
        close_handler.forget();
    }
    let _ = popout.focus();
    Ok(())
}

pub fn copy_text(text: &str) -> Result<(), WasmRuntimeError> {
    clipboard_write_text(&window()?, text)
}

fn window() -> Result<web_sys::Window, WasmRuntimeError> {
    web_sys::window().ok_or_else(|| WasmRuntimeError::from("window unavailable"))
}

fn document() -> Result<web_sys::Document, WasmRuntimeError> {
    window()?
        .document()
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))
}

fn local_storage() -> Result<web_sys::Storage, WasmRuntimeError> {
    window()?
        .local_storage()
        .map_err(|_| WasmRuntimeError::from("localStorage access failed"))?
        .ok_or_else(|| WasmRuntimeError::from("localStorage unavailable"))
}

fn clipboard_write_text(win: &web_sys::Window, text: &str) -> Result<(), WasmRuntimeError> {
    let navigator = js_sys::Reflect::get(win.as_ref(), &JsValue::from_str("navigator"))
        .map_err(|_| WasmRuntimeError::from("navigator unavailable"))?;
    let clipboard = js_sys::Reflect::get(&navigator, &JsValue::from_str("clipboard"))
        .map_err(|_| WasmRuntimeError::from("clipboard API unavailable"))?;
    let write_text = js_sys::Reflect::get(&clipboard, &JsValue::from_str("writeText"))
        .map_err(|_| WasmRuntimeError::from("clipboard.writeText unavailable"))?
        .dyn_into::<js_sys::Function>()
        .map_err(|_| WasmRuntimeError::from("clipboard.writeText is not callable"))?;
    let _ = write_text
        .call1(&clipboard, &JsValue::from_str(text))
        .map_err(|_| WasmRuntimeError::from("clipboard writeText call failed"))?;
    Ok(())
}

fn download_text(filename: &str, mime: &str, content: &str) -> Result<(), WasmRuntimeError> {
    let doc = document()?;
    let body = doc
        .body()
        .ok_or_else(|| WasmRuntimeError::from("body unavailable"))?;
    let a = doc
        .create_element("a")
        .map_err(|_| WasmRuntimeError::from("failed to create anchor"))?
        .dyn_into::<web_sys::HtmlAnchorElement>()
        .map_err(|_| WasmRuntimeError::from("failed to cast anchor"))?;
    let encoded = js_sys::encode_uri_component(content);
    a.set_href(&format!("data:{mime};charset=utf-8,{encoded}"));
    a.set_download(filename);
    let _ = a.style().set_property("display", "none");
    body.append_child(&a)
        .map_err(|_| WasmRuntimeError::from("failed to append anchor"))?;
    a.click();
    let _ = body.remove_child(&a);
    Ok(())
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
