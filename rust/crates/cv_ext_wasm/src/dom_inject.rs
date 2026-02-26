use wasm_bindgen::{closure::Closure, JsCast, JsValue};

use crate::errors::WasmRuntimeError;

fn window() -> Result<web_sys::Window, WasmRuntimeError> {
    web_sys::window().ok_or("window unavailable".into())
}

fn document() -> Result<web_sys::Document, WasmRuntimeError> {
    window()?.document().ok_or("document unavailable".into())
}

pub fn inject_style(id: &str, css: &str) -> Result<(), WasmRuntimeError> {
    let doc = document()?;
    if doc.get_element_by_id(id).is_some() {
        return Ok(());
    }
    let style = doc
        .create_element("style")
        .map_err(|_| WasmRuntimeError::from("failed to create style element"))?;
    style
        .set_attribute("id", id)
        .map_err(|_| WasmRuntimeError::from("failed to set style id"))?;
    style.set_text_content(Some(css));
    let head = doc
        .head()
        .ok_or_else(|| WasmRuntimeError::from("head unavailable"))?;
    head.append_child(&style)
        .map_err(|_| WasmRuntimeError::from("failed to append style"))?;
    Ok(())
}

pub fn inject_or_update_banner(
    banner_id: &str,
    css_class: &str,
    inner_html: &str,
) -> Result<web_sys::HtmlElement, WasmRuntimeError> {
    let doc = document()?;
    if let Some(existing) = doc.get_element_by_id(banner_id) {
        let html = existing
            .dyn_into::<web_sys::HtmlElement>()
            .map_err(|_| WasmRuntimeError::from("banner is not an HtmlElement"))?;
        html.set_inner_html(inner_html);
        html.set_class_name(css_class);
        return Ok(html);
    }

    let body = doc
        .body()
        .ok_or_else(|| WasmRuntimeError::from("body unavailable"))?;

    let el = doc
        .create_element("div")
        .map_err(|_| WasmRuntimeError::from("failed to create banner element"))?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| WasmRuntimeError::from("banner cast failed"))?;
    el.set_id(banner_id);
    el.set_class_name(css_class);
    el.set_inner_html(inner_html);

    body.append_child(&el)
        .map_err(|_| WasmRuntimeError::from("failed to append banner"))?;
    Ok(el)
}

pub fn remove_element(id: &str) -> Result<(), WasmRuntimeError> {
    let doc = document()?;
    if let Some(el) = doc.get_element_by_id(id) {
        if let Some(parent) = el.parent_element() {
            parent
                .remove_child(&el)
                .map_err(|_| WasmRuntimeError::from("failed to remove element"))?;
        }
    }
    Ok(())
}

pub fn create_element_with_attrs(
    tag: &str,
    attrs: &[(&str, &str)],
) -> Result<web_sys::HtmlElement, WasmRuntimeError> {
    let doc = document()?;
    let el = doc
        .create_element(tag)
        .map_err(|_| WasmRuntimeError::from(format!("failed to create <{tag}>")))?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| WasmRuntimeError::from("element cast failed"))?;
    for (k, v) in attrs {
        el.set_attribute(k, v)
            .map_err(|_| WasmRuntimeError::from(format!("failed to set attr {k}")))?;
    }
    Ok(el)
}

pub fn on_click(
    el: &web_sys::HtmlElement,
    handler: impl FnMut(web_sys::Event) + 'static,
) -> Result<(), WasmRuntimeError> {
    let closure = Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(handler));
    el.add_event_listener_with_callback("click", closure.as_ref().unchecked_ref())
        .map_err(|_| WasmRuntimeError::from("failed to add click listener"))?;
    closure.forget();
    Ok(())
}
