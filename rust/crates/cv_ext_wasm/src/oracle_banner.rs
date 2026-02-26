use wasm_bindgen::{closure::Closure, JsCast, JsValue};

use crate::{dom, dom_inject, errors::WasmRuntimeError};

const BANNER_ID: &str = "cv-oracle-validation-banner";
const STYLE_ID: &str = "cv-oracle-validation-styles";
const OBSERVER_KEY: &str = "__cvOracleValidationObserver";

const BANNER_CSS: &str = r#"
#cv-oracle-validation-banner{position:fixed;top:12px;right:12px;z-index:2147483646;
min-width:280px;max-width:400px;padding:12px 16px;border-radius:10px;
font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;
box-shadow:0 8px 24px rgba(0,0,0,.3);backdrop-filter:blur(12px);transition:all .3s ease;
animation:cv-banner-in .25s ease}
@keyframes cv-banner-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
#cv-oracle-validation-banner.cv-validated{background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.4);color:#34d399}
#cv-oracle-validation-banner.cv-needs-revalidated{background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.4);color:#fbbf24}
#cv-oracle-validation-banner.cv-unknown{background:rgba(148,163,184,.12);border:1px solid rgba(148,163,184,.3);color:#94a3b8}
#cv-oracle-validation-banner.cv-checking{background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);color:#60a5fa}
#cv-oracle-validation-banner .cv-banner-row{display:flex;align-items:center;gap:8px}
#cv-oracle-validation-banner .cv-banner-icon{font-size:18px;flex-shrink:0}
#cv-oracle-validation-banner .cv-banner-text{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
#cv-oracle-validation-banner .cv-banner-title{font-weight:700;font-size:13px}
#cv-oracle-validation-banner .cv-banner-detail{font-size:11px;opacity:.8}
#cv-oracle-validation-banner .cv-banner-close{background:none;border:none;color:inherit;opacity:.6;cursor:pointer;font-size:14px;padding:2px 4px}
#cv-oracle-validation-banner .cv-banner-close:hover{opacity:1}
"#;

fn status_icon(status: &str) -> &'static str {
    match status {
        "validated" => "✅",
        "needs-revalidated" => "⚠️",
        "checking" => "🔄",
        _ => "❓",
    }
}

fn status_title(status: &str) -> &'static str {
    match status {
        "validated" => "Validated",
        "needs-revalidated" => "Needs Revalidation",
        "checking" => "Checking...",
        _ => "Status Unknown",
    }
}

fn status_css_class(status: &str) -> &'static str {
    match status {
        "validated" => "cv-validated",
        "needs-revalidated" => "cv-needs-revalidated",
        "checking" => "cv-checking",
        _ => "cv-unknown",
    }
}

fn build_banner_html(status: &str, detail: &str) -> String {
    let icon = status_icon(status);
    let title = status_title(status);
    format!(
        r#"<div class="cv-banner-row">
  <span class="cv-banner-icon">{icon}</span>
  <div class="cv-banner-text">
    <span class="cv-banner-title">{title}</span>
    <span class="cv-banner-detail">{detail}</span>
  </div>
  <button class="cv-banner-close" title="Dismiss">✕</button>
</div>"#
    )
}

pub fn show_banner(status: &str, detail: &str) -> Result<(), WasmRuntimeError> {
    dom_inject::inject_style(STYLE_ID, BANNER_CSS)?;
    let css_class = status_css_class(status);
    let html = build_banner_html(status, detail);
    let banner = dom_inject::inject_or_update_banner(BANNER_ID, css_class, &html)?;

    let close_handler = Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(|_e: web_sys::Event| {
        let _ = dom_inject::remove_element(BANNER_ID);
    }));
    if let Ok(Some(btn)) = banner.query_selector(".cv-banner-close") {
        btn.add_event_listener_with_callback("click", close_handler.as_ref().unchecked_ref())
            .ok();
    }
    close_handler.forget();

    if let Some(body) = web_sys::window()
        .and_then(|w| w.document())
        .and_then(|d| d.body())
    {
        body.set_attribute("data-cv-oracle-validation-status", status).ok();
    }

    Ok(())
}

pub fn setup_spa_persistence(status_value: String) -> Result<(), WasmRuntimeError> {
    let window = web_sys::window().ok_or_else(|| WasmRuntimeError::from("window unavailable"))?;

    if js_sys::Reflect::has(window.as_ref(), &JsValue::from_str(OBSERVER_KEY)).unwrap_or(false) {
        return Ok(());
    }

    let doc = window
        .document()
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;
    let body = doc
        .body()
        .ok_or_else(|| WasmRuntimeError::from("body unavailable"))?;

    let status_for_cb = status_value.clone();
    let cb = Closure::<dyn FnMut(js_sys::Array, web_sys::MutationObserver)>::wrap(
        Box::new(move |_records: js_sys::Array, _obs: web_sys::MutationObserver| {
            if web_sys::window()
                .and_then(|w| w.document())
                .and_then(|d| d.get_element_by_id(BANNER_ID))
                .is_none()
            {
                let _ = show_banner(&status_for_cb, "Restored after navigation");
            }
        }),
    );

    let observer = web_sys::MutationObserver::new(cb.as_ref().unchecked_ref())
        .map_err(|_| WasmRuntimeError::from("failed to create validation observer"))?;
    let opts = web_sys::MutationObserverInit::new();
    opts.set_child_list(true);
    opts.set_subtree(false);
    observer.observe_with_options(&body, &opts).ok();

    js_sys::Reflect::set(window.as_ref(), &JsValue::from_str(OBSERVER_KEY), observer.as_ref()).ok();
    cb.forget();

    Ok(())
}
