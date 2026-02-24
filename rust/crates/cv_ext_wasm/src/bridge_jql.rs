use cv_ext_sites_jira::{
    apply_jql_action, build_jql_query, default_jql_state, JqlAction, JqlBuildOptions, JqlBuilderState,
};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

fn to_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(|err| JsValue::from_str(&err.to_string()))
}

fn from_js<T: serde::de::DeserializeOwned>(value: JsValue) -> Result<T, JsValue> {
    serde_wasm_bindgen::from_value(value).map_err(|err| JsValue::from_str(&err.to_string()))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JqlPreset {
    pub id: String,
    pub label: String,
    pub description: String,
    pub jql: String,
    pub builtin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JqlPresetList {
    pub builtin: Vec<JqlPreset>,
    pub custom: Vec<JqlPreset>,
}

const CUSTOM_PRESETS_KEY: &str = "cv.jql.custom_presets";

fn builtin_presets() -> Vec<JqlPreset> {
    vec![
        JqlPreset {
            id: "my-active-work".to_string(),
            label: "My Active Work".to_string(),
            description: "Issues actively being worked on by you.".to_string(),
            jql: r#"assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC, priority DESC"#.to_string(),
            builtin: true,
        },
        JqlPreset {
            id: "my-open".to_string(),
            label: "My Open Issues".to_string(),
            description: "Issues assigned to you that are not done.".to_string(),
            jql: r#"assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC"#.to_string(),
            builtin: true,
        },
        JqlPreset {
            id: "overdue".to_string(),
            label: "Overdue".to_string(),
            description: "Past due date and not resolved.".to_string(),
            jql: r#"due < now() AND resolution = Unresolved ORDER BY due ASC"#.to_string(),
            builtin: true,
        },
        JqlPreset {
            id: "unassigned".to_string(),
            label: "Unassigned".to_string(),
            description: "Issues without an assignee.".to_string(),
            jql: r#"assignee IS EMPTY AND resolution = Unresolved ORDER BY created DESC"#.to_string(),
            builtin: true,
        },
    ]
}

fn load_custom_presets() -> Vec<JqlPreset> {
    let storage = web_sys::window()
        .and_then(|w| w.local_storage().ok().flatten());
    let Some(storage) = storage else {
        return Vec::new();
    };
    let Ok(Some(raw)) = storage.get_item(CUSTOM_PRESETS_KEY) else {
        return Vec::new();
    };
    let Ok(mut presets) = serde_json::from_str::<Vec<JqlPreset>>(&raw) else {
        return Vec::new();
    };
    for preset in presets.iter_mut() {
        preset.builtin = false;
    }
    presets
}

fn save_custom_presets(presets: &[JqlPreset]) -> Result<(), JsValue> {
    let storage = web_sys::window()
        .and_then(|w| w.local_storage().ok().flatten())
        .ok_or_else(|| JsValue::from_str("localStorage unavailable"))?;

    let mut cleaned: Vec<JqlPreset> = Vec::new();
    for preset in presets {
        cleaned.push(JqlPreset {
            id: preset.id.clone(),
            label: preset.label.clone(),
            description: preset.description.clone(),
            jql: preset.jql.clone(),
            builtin: false,
        });
    }

    let raw = serde_json::to_string(&cleaned).map_err(|err| JsValue::from_str(&err.to_string()))?;
    storage
        .set_item(CUSTOM_PRESETS_KEY, &raw)
        .map_err(|_| JsValue::from_str("failed to write localStorage"))?;
    Ok(())
}

#[wasm_bindgen]
pub fn jql_init_state() -> Result<JsValue, JsValue> {
    to_js(&default_jql_state())
}

#[wasm_bindgen]
pub fn jql_apply_action(state: JsValue, action: JsValue) -> Result<JsValue, JsValue> {
    let mut state: JqlBuilderState = from_js(state)?;
    let action: JqlAction = from_js(action)?;
    apply_jql_action(&mut state, action).map_err(|err| JsValue::from_str(&err))?;
    to_js(&state)
}

#[wasm_bindgen]
pub fn jql_format(state: JsValue, auto_quote: Option<bool>) -> Result<String, JsValue> {
    let state: JqlBuilderState = from_js(state)?;
    let opts = JqlBuildOptions {
        auto_quote: auto_quote.unwrap_or(true),
    };
    Ok(build_jql_query(&state, opts))
}

#[wasm_bindgen]
pub fn jql_presets_list() -> Result<JsValue, JsValue> {
    let list = JqlPresetList {
        builtin: builtin_presets(),
        custom: load_custom_presets(),
    };
    to_js(&list)
}

#[wasm_bindgen]
pub fn jql_presets_save(presets: JsValue) -> Result<JsValue, JsValue> {
    let presets: Vec<JqlPreset> = from_js(presets)?;
    save_custom_presets(&presets)?;
    to_js(&JqlPresetList {
        builtin: builtin_presets(),
        custom: load_custom_presets(),
    })
}

