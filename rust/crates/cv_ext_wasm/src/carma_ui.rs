use serde_json::{json, Value};
use wasm_bindgen::{closure::Closure, JsCast};
use wasm_bindgen_futures::spawn_local;

use crate::{dom_inject, errors::WasmRuntimeError};

const PANEL_ID: &str = "cv-carma-scrape-panel";
const STYLE_ID: &str = "cv-carma-scrape-styles";

const PANEL_CSS: &str = r#"
#cv-carma-scrape-panel{position:fixed;bottom:16px;right:16px;width:380px;
background:
radial-gradient(120% 160% at 100% -10%, rgba(34,211,238,.18) 0%, transparent 55%),
radial-gradient(90% 120% at -20% 110%, rgba(52,211,153,.2) 0%, transparent 58%),
#101922;
border:1px solid rgba(52,211,153,.4);border-radius:12px;
box-shadow:0 8px 32px rgba(0,0,0,.45);font-family:'Inter',-apple-system,sans-serif;
z-index:2147483646;display:flex;flex-direction:column;overflow:hidden;color:#e2e8f0;
animation:cv-carma-in .2s ease}
@keyframes cv-carma-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
#cv-carma-scrape-panel .cv-cs-header{display:flex;align-items:center;justify-content:space-between;
padding:12px 16px;background:linear-gradient(135deg,#064e3b,#0f172a);border-bottom:1px solid #334155}
#cv-carma-scrape-panel .cv-cs-title{font-size:13px;font-weight:700;color:#34d399}
#cv-carma-scrape-panel .cv-cs-sub{font-size:11px;color:#7dd3fc;margin-top:2px}
#cv-carma-scrape-panel .cv-cs-close{background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;padding:2px 6px}
#cv-carma-scrape-panel .cv-cs-close:hover{color:#f87171}
#cv-carma-scrape-panel .cv-cs-body{padding:12px 16px;display:flex;flex-direction:column;gap:10px}
#cv-carma-scrape-panel .cv-cs-status{font-size:12px;color:#94a3b8;min-height:20px}
#cv-carma-scrape-panel .cv-cs-progress{height:4px;border-radius:2px;background:#1e293b;overflow:hidden}
#cv-carma-scrape-panel .cv-cs-bar{height:100%;background:linear-gradient(90deg,#34d399,#22d3ee);
transition:width .3s ease;width:0%}
#cv-carma-scrape-panel .cv-cs-stats{display:flex;gap:12px;font-size:11px;color:#64748b}
#cv-carma-scrape-panel .cv-cs-stat-value{color:#e2e8f0;font-weight:700}
#cv-carma-scrape-panel .cv-cs-chiprow{display:flex;flex-wrap:wrap;gap:6px}
#cv-carma-scrape-panel .cv-cs-chip{font-size:10px;letter-spacing:.02em;padding:4px 8px;border:1px solid #2b3a4a;border-radius:999px;background:rgba(15,23,42,.55);color:#93c5fd}
#cv-carma-scrape-panel .cv-cs-note{font-size:11px;line-height:1.35;color:#9fb3c8}
#cv-carma-scrape-panel .cv-cs-actions{display:flex;gap:8px;justify-content:flex-end}
#cv-carma-scrape-panel .cv-cs-btn{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
transition:.15s;border:none}
#cv-carma-scrape-panel .cv-cs-btn-primary{background:linear-gradient(135deg,#34d399,#22d3ee);color:#0f172a}
#cv-carma-scrape-panel .cv-cs-btn-primary:hover{box-shadow:0 0 16px rgba(52,211,153,.4)}
#cv-carma-scrape-panel .cv-cs-btn-secondary{background:#1e293b;color:#94a3b8;border:1px solid #334155}
#cv-carma-scrape-panel .cv-cs-btn-secondary:hover{border-color:#34d399;color:#e2e8f0}
#cv-carma-scrape-panel .cv-cs-btn[disabled]{opacity:.55;cursor:not-allowed;box-shadow:none}
"#;

fn control_panel_html() -> &'static str {
    r#"<div class="cv-cs-header">
  <div>
    <div class="cv-cs-title">Carma Scraper</div>
    <div class="cv-cs-sub">Bulk Search Workspace</div>
  </div>
  <button class="cv-cs-close" title="Close">✕</button>
</div>
<div class="cv-cs-body">
  <div class="cv-cs-status">Ready — click Start to scrape visible tables</div>
  <div class="cv-cs-chiprow">
    <span class="cv-cs-chip">Multi-page capture</span>
    <span class="cv-cs-chip">Duplicate-safe</span>
    <span class="cv-cs-chip">Reference IDs</span>
  </div>
  <div class="cv-cs-note">Run from your current result page. The scraper tracks progress live and keeps this panel open until complete.</div>
  <div class="cv-cs-progress"><div class="cv-cs-bar"></div></div>
  <div class="cv-cs-stats">
    <span>Pages: <span class="cv-cs-stat-value" data-stat="pages">0</span></span>
    <span>Rows: <span class="cv-cs-stat-value" data-stat="rows">0</span></span>
    <span>Dupes: <span class="cv-cs-stat-value" data-stat="dupes">0</span></span>
  </div>
  <div class="cv-cs-actions">
    <button class="cv-cs-btn cv-cs-btn-secondary" data-cv-action="close">Close</button>
    <button class="cv-cs-btn cv-cs-btn-primary" data-cv-action="start">▶ Start Scrape</button>
  </div>
</div>"#
}

fn progress_panel_html() -> &'static str {
    r#"<div class="cv-cs-header">
  <span class="cv-cs-title">🚗 Carma Scraper</span>
  <button class="cv-cs-close" title="Close">✕</button>
</div>
<div class="cv-cs-body">
  <div class="cv-cs-status">Ready to scrape</div>
  <div class="cv-cs-progress"><div class="cv-cs-bar"></div></div>
  <div class="cv-cs-stats">
    <span>Pages: <span class="cv-cs-stat-value" data-stat="pages">0</span></span>
    <span>Rows: <span class="cv-cs-stat-value" data-stat="rows">0</span></span>
    <span>Dupes: <span class="cv-cs-stat-value" data-stat="dupes">0</span></span>
  </div>
  <div class="cv-cs-actions">
    <button class="cv-cs-btn cv-cs-btn-secondary" data-cv-action="close">Close</button>
  </div>
</div>"#
}

pub fn show_control_panel() -> Result<Value, WasmRuntimeError> {
    dom_inject::inject_style(STYLE_ID, PANEL_CSS)?;

    let doc = web_sys::window()
        .and_then(|w| w.document())
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;

    if let Some(existing) = doc.get_element_by_id(PANEL_ID) {
        let html = existing
            .dyn_into::<web_sys::HtmlElement>()
            .map_err(|_| WasmRuntimeError::from("panel cast failed"))?;
        html.set_inner_html(control_panel_html());
        html.style().set_property("display", "flex").ok();
        bind_panel_events(&html)?;
        return Ok(json!({
            "command": "carma.show_panel",
            "panelVisible": true
        }));
    }

    let panel = dom_inject::inject_or_update_banner(PANEL_ID, "", control_panel_html())?;
    bind_panel_events(&panel)?;

    Ok(json!({
        "command": "carma.show_panel",
        "panelVisible": true,
        "detail": "Carma scraper control panel opened"
    }))
}

fn bind_panel_events(panel: &web_sys::HtmlElement) -> Result<(), WasmRuntimeError> {
    let close_handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(|_e: web_sys::Event| {
            let _ = dom_inject::remove_element(PANEL_ID);
        }));
    if let Ok(Some(btn)) = panel.query_selector(".cv-cs-close") {
        btn.add_event_listener_with_callback("click", close_handler.as_ref().unchecked_ref())
            .ok();
    }
    if let Ok(Some(btn)) = panel.query_selector("[data-cv-action='close']") {
        btn.add_event_listener_with_callback("click", close_handler.as_ref().unchecked_ref())
            .ok();
    }
    close_handler.forget();

    let start_handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(|e: web_sys::Event| {
            if let Some(target) = e.target() {
                if let Ok(button) = target.dyn_into::<web_sys::HtmlElement>() {
                    button.set_attribute("disabled", "true").ok();
                    button.set_inner_text("Running...");
                }
            }
            spawn_local(async {
                let result = crate::commands::execute_command(
                    "carma.bulk.search.scrape",
                    &serde_json::Value::Null,
                )
                .await;
                if let Err(err) = result {
                    let _ = update_progress(&format!("❌ {err}"), 0, 0, 0, 0);
                }
            });
        }));
    if let Ok(Some(btn)) = panel.query_selector("[data-cv-action='start']") {
        btn.add_event_listener_with_callback("click", start_handler.as_ref().unchecked_ref())
            .ok();
    }
    start_handler.forget();

    Ok(())
}

pub fn show_progress_panel() -> Result<(), WasmRuntimeError> {
    dom_inject::inject_style(STYLE_ID, PANEL_CSS)?;

    let doc = web_sys::window()
        .and_then(|w| w.document())
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;

    if let Some(existing) = doc.get_element_by_id(PANEL_ID) {
        existing.set_inner_html(progress_panel_html());
        let html = existing
            .dyn_into::<web_sys::HtmlElement>()
            .map_err(|_| WasmRuntimeError::from("panel cast failed"))?;
        html.style().set_property("display", "flex").ok();
        bind_close_only(&html);
        return Ok(());
    }

    let panel = dom_inject::inject_or_update_banner(PANEL_ID, "", progress_panel_html())?;
    bind_close_only(&panel);
    Ok(())
}

fn bind_close_only(panel: &web_sys::HtmlElement) {
    let close_handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(|_e: web_sys::Event| {
            let _ = dom_inject::remove_element(PANEL_ID);
        }));
    if let Ok(Some(btn)) = panel.query_selector(".cv-cs-close") {
        btn.add_event_listener_with_callback("click", close_handler.as_ref().unchecked_ref())
            .ok();
    }
    if let Ok(Some(btn)) = panel.query_selector("[data-cv-action='close']") {
        btn.add_event_listener_with_callback("click", close_handler.as_ref().unchecked_ref())
            .ok();
    }
    close_handler.forget();
}

pub fn update_progress(
    status: &str,
    pages: u32,
    rows: u32,
    dupes: u32,
    pct: u32,
) -> Result<(), WasmRuntimeError> {
    let doc = web_sys::window()
        .and_then(|w| w.document())
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;
    let Some(panel) = doc.get_element_by_id(PANEL_ID) else {
        return Ok(());
    };
    if let Ok(Some(el)) = panel.query_selector(".cv-cs-status") {
        el.set_text_content(Some(status));
    }
    if let Ok(Some(bar)) = panel.query_selector(".cv-cs-bar") {
        if let Ok(html) = bar.dyn_into::<web_sys::HtmlElement>() {
            html.style().set_property("width", &format!("{pct}%")).ok();
        }
    }
    for (attr, val) in [("pages", pages), ("rows", rows), ("dupes", dupes)] {
        if let Ok(Some(el)) = panel.query_selector(&format!("[data-stat='{attr}']")) {
            el.set_text_content(Some(&val.to_string()));
        }
    }
    Ok(())
}

pub fn show_complete(rows: u32, dupes: u32, pages: u32) -> Result<(), WasmRuntimeError> {
    update_progress(
        &format!("✅ Complete — {rows} rows from {pages} pages ({dupes} dupes skipped)"),
        pages,
        rows,
        dupes,
        100,
    )?;
    Ok(())
}
