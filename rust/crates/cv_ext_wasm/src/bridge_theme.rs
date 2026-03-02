use cv_ext_contract::builtin_themes;
use wasm_bindgen::prelude::*;

fn to_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(|err| JsValue::from_str(&err.to_string()))
}

#[wasm_bindgen]
pub fn get_builtin_themes() -> Result<JsValue, JsValue> {
    let themes = builtin_themes();
    to_js(&themes)
}
