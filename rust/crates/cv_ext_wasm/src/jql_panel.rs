use js_sys::Reflect;
use serde_json::{json, Value};
use wasm_bindgen::{closure::Closure, JsCast, JsValue};

use crate::{dom, dom_inject, errors::WasmRuntimeError};

const PANEL_ID: &str = "cv-jql-builder-panel";
const STYLE_ID: &str = "cv-jql-builder-styles";
const OBSERVER_KEY: &str = "__cvJqlBuilderObserver";
const BUTTON_CLASS: &str = "cv-jql-builder-toggle";
const SWITCHER_SELECTOR: &str = "a.switcher-item, button.switcher-item, a, button";
const ADVANCED_INPUT: &str =
    "textarea#advanced-search, textarea[name='jql'], textarea[aria-label='Advanced Query'], input[aria-label='Advanced Query']";
const SEARCH_BTN: &str =
    "button.search-button, button[title='Search for issues'], button[aria-label='Search for issues']";

const PANEL_CSS: &str = r#"
#cv-jql-builder-panel{position:fixed;bottom:16px;right:16px;width:420px;max-height:60vh;
background:
radial-gradient(130% 165% at 105% -10%, rgba(59,130,246,.2) 0%, transparent 58%),
radial-gradient(105% 130% at -18% 108%, rgba(34,211,238,.16) 0%, transparent 62%),
#101922;
border:1px solid #3b82f680;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.45),0 0 0 1px rgba(59,130,246,.15);
font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;z-index:2147483646;
display:flex;flex-direction:column;overflow:hidden;color:#e2e8f0;animation:cv-jql-in .2s ease}
@keyframes cv-jql-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
#cv-jql-builder-panel .cv-jql-header{display:flex;align-items:center;justify-content:space-between;
padding:12px 16px;background:linear-gradient(135deg,#1e293b,#0f172a);border-bottom:1px solid #334155}
#cv-jql-builder-panel .cv-jql-title{font-size:13px;font-weight:700;
background:linear-gradient(135deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
#cv-jql-builder-panel .cv-jql-sub{font-size:11px;color:#7dd3fc;margin-top:2px}
#cv-jql-builder-panel .cv-jql-close{background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;
padding:2px 6px;border-radius:4px;transition:.15s}
#cv-jql-builder-panel .cv-jql-close:hover{color:#f87171;background:rgba(248,113,113,.12)}
#cv-jql-builder-panel .cv-jql-body{padding:12px 16px;display:flex;flex-direction:column;gap:10px;overflow-y:auto}
#cv-jql-builder-panel .cv-jql-note{font-size:11px;line-height:1.35;color:#9fb3c8}
#cv-jql-builder-panel .cv-jql-chiprow{display:flex;gap:6px;flex-wrap:wrap}
#cv-jql-builder-panel .cv-jql-chip{font-size:10px;letter-spacing:.02em;padding:4px 8px;border:1px solid #2b3a4a;border-radius:999px;background:rgba(15,23,42,.55);color:#93c5fd}
#cv-jql-builder-panel .cv-jql-presets{display:flex;gap:6px;flex-wrap:wrap}
#cv-jql-builder-panel .cv-jql-preset{padding:4px 10px;border-radius:999px;border:1px solid #334155;
background:rgba(15,23,42,.72);color:#b8c7da;font-size:11px;font-weight:600;cursor:pointer;transition:.15s;white-space:nowrap}
#cv-jql-builder-panel .cv-jql-preset:hover{border-color:#60a5fa;color:#f8fafc;background:rgba(59,130,246,.18)}
#cv-jql-builder-panel .cv-jql-textarea{width:100%;min-height:80px;max-height:180px;resize:vertical;
background:rgba(8,16,27,.88);border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-family:'JetBrains Mono',monospace;
font-size:12px;padding:10px;outline:none;transition:.15s;line-height:1.45}
#cv-jql-builder-panel .cv-jql-textarea:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.2)}
#cv-jql-builder-panel .cv-jql-actions{display:flex;gap:8px;justify-content:flex-end}
#cv-jql-builder-panel .cv-jql-btn{padding:6px 16px;border-radius:8px;font-size:12px;font-weight:600;
cursor:pointer;transition:.15s;border:1px solid transparent}
#cv-jql-builder-panel .cv-jql-btn-primary{background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;border:none}
#cv-jql-builder-panel .cv-jql-btn-primary:hover{box-shadow:0 0 16px rgba(59,130,246,.4);transform:translateY(-1px)}
#cv-jql-builder-panel .cv-jql-btn-secondary{background:rgba(30,41,59,.78);color:#b8c7da;border:1px solid #334155}
#cv-jql-builder-panel .cv-jql-btn-secondary:hover{border-color:#60a5fa;color:#f8fafc}
@media (max-width:640px){
#cv-jql-builder-panel{left:10px;right:10px;bottom:10px;width:auto;max-height:72vh}
#cv-jql-builder-panel .cv-jql-actions{justify-content:stretch}
#cv-jql-builder-panel .cv-jql-btn{flex:1}
}
"#;

const PRESETS: &[(&str, &str)] = &[
    (
        "My Open",
        "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
    ),
    (
        "Unresolved",
        "resolution = Unresolved ORDER BY created DESC",
    ),
    ("Recent Updated", "updated >= -7d ORDER BY updated DESC"),
    (
        "AP Queue",
        "project = AP AND resolution = Unresolved ORDER BY priority DESC, created ASC",
    ),
];

fn normalize_text(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_lowercase()
}

fn find_toggle(doc: &web_sys::Document, label: &str) -> Option<web_sys::HtmlElement> {
    let nodes = doc.query_selector_all(SWITCHER_SELECTOR).ok()?;
    let target = normalize_text(label);
    for i in 0..nodes.length() {
        let node = nodes.item(i)?;
        let el = node.dyn_into::<web_sys::Element>().ok()?;
        if normalize_text(&el.text_content().unwrap_or_default()) == target {
            return el.dyn_into::<web_sys::HtmlElement>().ok();
        }
    }
    None
}

fn ensure_advanced_mode(doc: &web_sys::Document) {
    if dom::query_selector(ADVANCED_INPUT).ok().flatten().is_some() {
        return;
    }
    if let Some(toggle) = find_toggle(doc, "advanced") {
        toggle.click();
    }
}

fn apply_jql(query: &str) -> Result<(), WasmRuntimeError> {
    dom::type_selector(ADVANCED_INPUT, query)?;
    Ok(())
}

fn apply_and_search(query: &str) -> Result<(), WasmRuntimeError> {
    apply_jql(query)?;
    if dom::query_selector(SEARCH_BTN)?.is_some() {
        dom::click_selector(SEARCH_BTN)?;
    }
    Ok(())
}

fn build_panel_html() -> String {
    let mut presets_html = String::new();
    for (label, _jql) in PRESETS {
        presets_html.push_str(&format!(
            r#"<button class="cv-jql-preset" data-cv-jql-preset="{}">{}</button>"#,
            html_escape(label),
            html_escape(label)
        ));
    }

    format!(
        r#"<div class="cv-jql-header">
  <div>
    <div class="cv-jql-title">JQL Builder</div>
    <div class="cv-jql-sub">Advanced Search Workspace</div>
  </div>
  <button class="cv-jql-close" title="Close">✕</button>
</div>
<div class="cv-jql-body">
  <div class="cv-jql-chiprow">
    <span class="cv-jql-chip">Preset-driven</span>
    <span class="cv-jql-chip">One-click apply</span>
    <span class="cv-jql-chip">Fast search run</span>
  </div>
  <div class="cv-jql-note">Pick a preset or write custom JQL, then apply or run search directly.</div>
  <div class="cv-jql-presets">{presets_html}</div>
  <textarea class="cv-jql-textarea" placeholder="Enter JQL query..." spellcheck="false"></textarea>
  <div class="cv-jql-actions">
    <button class="cv-jql-btn cv-jql-btn-secondary" data-cv-action="apply">Apply</button>
    <button class="cv-jql-btn cv-jql-btn-primary" data-cv-action="search">Run Search</button>
  </div>
</div>"#
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn get_jql_for_preset(label: &str) -> Option<&'static str> {
    PRESETS
        .iter()
        .find(|(l, _)| *l == label)
        .map(|(_, jql)| *jql)
}

fn toggle_panel_visibility() -> Result<bool, WasmRuntimeError> {
    let doc = document()?;
    if let Some(panel) = doc.get_element_by_id(PANEL_ID) {
        let html = panel
            .dyn_into::<web_sys::HtmlElement>()
            .map_err(|_| WasmRuntimeError::from("panel cast failed"))?;
        let display = html
            .style()
            .get_property_value("display")
            .unwrap_or_default();
        if display == "none" {
            html.style().set_property("display", "flex").ok();
            return Ok(true);
        } else {
            html.style().set_property("display", "none").ok();
            return Ok(false);
        }
    }
    create_panel()?;
    Ok(true)
}

fn ensure_panel_visible() -> Result<(), WasmRuntimeError> {
    let doc = document()?;
    if let Some(panel) = doc.get_element_by_id(PANEL_ID) {
        let html = panel
            .dyn_into::<web_sys::HtmlElement>()
            .map_err(|_| WasmRuntimeError::from("panel cast failed"))?;
        let display = html
            .style()
            .get_property_value("display")
            .unwrap_or_default();
        if display == "none" {
            html.style().set_property("display", "flex").ok();
        }
        sync_panel_textarea_from_advanced(&html)?;
        return Ok(());
    }
    create_panel()?;
    Ok(())
}

pub fn open_panel(doc: &web_sys::Document) -> Result<Value, WasmRuntimeError> {
    // Ensure base hooks and builder button are present, then force the panel visible.
    let _ = install(doc)?;
    ensure_panel_visible()?;

    Ok(json!({
        "command": "jira.open_jql_builder",
        "installed": true,
        "panelVisible": true,
        "detail": "JQL builder panel opened"
    }))
}
fn document() -> Result<web_sys::Document, WasmRuntimeError> {
    web_sys::window()
        .ok_or("window unavailable")?
        .document()
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))
}

fn create_panel() -> Result<(), WasmRuntimeError> {
    let doc = document()?;
    ensure_advanced_mode(&doc);
    dom_inject::inject_style(STYLE_ID, PANEL_CSS)?;

    let current_jql = dom::element_value(ADVANCED_INPUT)?.unwrap_or_default();
    let html = build_panel_html();
    let panel = dom_inject::inject_or_update_banner(PANEL_ID, "", &html)?;

    if let Ok(Some(ta)) = panel.query_selector(".cv-jql-textarea") {
        if let Ok(textarea) = ta.dyn_into::<web_sys::HtmlTextAreaElement>() {
            textarea.set_value(&current_jql);
            let _ = textarea.focus();
        }
    }

    let close_handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(|_e: web_sys::Event| {
            let _ = dom_inject::remove_element(PANEL_ID);
        }));
    if let Ok(Some(close_btn)) = panel.query_selector(".cv-jql-close") {
        close_btn
            .add_event_listener_with_callback("click", close_handler.as_ref().unchecked_ref())
            .ok();
    }
    close_handler.forget();

    let panel_ref = panel.clone();
    let preset_handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |e: web_sys::Event| {
            let Some(target) = e.target() else { return };
            let Ok(el) = target.dyn_into::<web_sys::Element>() else {
                return;
            };
            let Some(label) = el.get_attribute("data-cv-jql-preset") else {
                return;
            };
            let Some(jql) = get_jql_for_preset(&label) else {
                return;
            };
            if let Ok(Some(ta)) = panel_ref.query_selector(".cv-jql-textarea") {
                if let Ok(textarea) = ta.dyn_into::<web_sys::HtmlTextAreaElement>() {
                    textarea.set_value(jql);
                }
            }
        }));
    if let Ok(Some(presets_el)) = panel.query_selector(".cv-jql-presets") {
        presets_el
            .add_event_listener_with_callback("click", preset_handler.as_ref().unchecked_ref())
            .ok();
    }
    preset_handler.forget();

    let panel_ref2 = panel.clone();
    let action_handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |e: web_sys::Event| {
            let Some(target) = e.target() else { return };
            let Ok(el) = target.dyn_into::<web_sys::Element>() else {
                return;
            };
            let Some(action) = el.get_attribute("data-cv-action") else {
                return;
            };
            let query = panel_ref2
                .query_selector(".cv-jql-textarea")
                .ok()
                .flatten()
                .and_then(|ta| ta.dyn_into::<web_sys::HtmlTextAreaElement>().ok())
                .map(|ta| ta.value())
                .unwrap_or_default();
            let trimmed = query.trim().to_string();
            if trimmed.is_empty() {
                return;
            }
            match action.as_str() {
                "apply" => {
                    let _ = apply_jql(&trimmed);
                }
                "search" => {
                    let _ = apply_and_search(&trimmed);
                }
                _ => {}
            }
        }));
    if let Ok(Some(actions_el)) = panel.query_selector(".cv-jql-actions") {
        actions_el
            .add_event_listener_with_callback("click", action_handler.as_ref().unchecked_ref())
            .ok();
    }
    action_handler.forget();

    Ok(())
}

fn sync_panel_textarea_from_advanced(panel: &web_sys::HtmlElement) -> Result<(), WasmRuntimeError> {
    let current_jql = dom::element_value(ADVANCED_INPUT)?.unwrap_or_default();
    if let Ok(Some(ta)) = panel.query_selector(".cv-jql-textarea") {
        if let Ok(textarea) = ta.dyn_into::<web_sys::HtmlTextAreaElement>() {
            textarea.set_value(&current_jql);
            let _ = textarea.focus();
        }
    }
    Ok(())
}

fn ensure_builder_button(doc: &web_sys::Document) -> Result<bool, WasmRuntimeError> {
    if dom::query_selector(&format!("button.{BUTTON_CLASS}"))?.is_some() {
        return Ok(false);
    }
    let basic = find_toggle(doc, "basic");
    let advanced = find_toggle(doc, "advanced");
    let Some(anchor) = basic.or(advanced) else {
        return Ok(false);
    };
    let Some(parent) = anchor.parent_element() else {
        return Ok(false);
    };

    let btn = dom_inject::create_element_with_attrs("button", &[
        ("type", "button"),
        ("class", BUTTON_CLASS),
        ("style", "margin-left:8px;padding:4px 10px;border-radius:999px;border:1px solid #cbd5f5;background:#eef2ff;color:#3730a3;font-weight:600;font-size:12px;cursor:pointer;transition:.15s"),
    ])?;
    btn.set_inner_text("Builder");

    dom_inject::on_click(&btn, |e| {
        e.prevent_default();
        let _ = toggle_panel_visibility();
    })?;

    let reference = anchor.next_sibling();
    parent
        .insert_before(&btn, reference.as_ref())
        .map_err(|_| WasmRuntimeError::from("failed to insert builder button"))?;
    Ok(true)
}

pub fn install(doc: &web_sys::Document) -> Result<Value, WasmRuntimeError> {
    let window = web_sys::window().ok_or_else(|| WasmRuntimeError::from("window unavailable"))?;
    let body = doc
        .body()
        .ok_or_else(|| WasmRuntimeError::from("body unavailable"))?;

    ensure_advanced_mode(doc);
    let button_inserted = ensure_builder_button(doc)?;

    if body
        .get_attribute("data-cv-jql-builder-installed")
        .is_none()
    {
        body.set_attribute("data-cv-jql-builder-installed", "true")
            .ok();
    }

    if !Reflect::has(window.as_ref(), &JsValue::from_str(OBSERVER_KEY)).unwrap_or(false) {
        let observed_doc = doc.clone();
        let cb = Closure::<dyn FnMut(js_sys::Array, web_sys::MutationObserver)>::wrap(Box::new(
            move |_records: js_sys::Array, _obs: web_sys::MutationObserver| {
                let _ = ensure_builder_button(&observed_doc);
            },
        ));
        let observer = web_sys::MutationObserver::new(cb.as_ref().unchecked_ref())
            .map_err(|_| WasmRuntimeError::from("failed to create observer"))?;
        let opts = web_sys::MutationObserverInit::new();
        opts.set_child_list(true);
        opts.set_subtree(true);
        opts.set_attributes(true);
        observer.observe_with_options(&body, &opts).ok();
        Reflect::set(
            window.as_ref(),
            &JsValue::from_str(OBSERVER_KEY),
            observer.as_ref(),
        )
        .ok();
        cb.forget();
    }

    Ok(json!({
        "command": "jira.install_jql_builder",
        "installed": true,
        "buttonInstalled": button_inserted || dom::query_selector(&format!("button.{BUTTON_CLASS}")).ok().flatten().is_some(),
        "panelAvailable": true,
        "detail": "JQL builder panel + button installed"
    }))
}
