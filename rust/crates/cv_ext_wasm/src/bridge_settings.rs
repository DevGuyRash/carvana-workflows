use cv_ext_contract::ExtensionSettings;
use wasm_bindgen::prelude::*;

fn to_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(|err| JsValue::from_str(&err.to_string()))
}

#[wasm_bindgen]
pub fn default_settings() -> Result<JsValue, JsValue> {
    let settings = ExtensionSettings::default();
    to_js(&settings)
}
