use cv_ext_contract::Site;
use cv_ext_core::rules_for_site;
use wasm_bindgen::prelude::*;

fn to_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(|err| JsValue::from_str(&err.to_string()))
}

#[wasm_bindgen]
pub fn list_rules(site: String) -> Result<JsValue, JsValue> {
    let parsed = Site::try_from(site.as_str()).map_err(|err| JsValue::from_str(&err))?;
    let rules = rules_for_site(parsed);
    to_js(&rules)
}
