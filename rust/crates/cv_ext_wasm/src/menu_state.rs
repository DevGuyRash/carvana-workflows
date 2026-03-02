use crate::errors::WasmRuntimeError;
use js_sys::Date;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;

pub const MENU_STATE_EVENT: &str = "cv:menu-state-change";
pub const JIRA_STATE_KEY: &str = "cv.menu.jira.jql.state.v1";
pub const CARMA_STATE_KEY: &str = "cv.menu.carma.state.v1";

const JIRA_LEGACY_CUSTOM_PRESETS_KEY: &str = "jira.jql.builder:customPresets";
const JIRA_LEGACY_PINNED_PRESETS_KEY: &str = "jira.jql.builder:pinnedPresets";
const JIRA_LEGACY_RECENT_KEY: &str = "jira.jql.builder:recentFilters";
const JIRA_LEGACY_STATE_V2_KEY: &str = "jira.jql.builder:v2state";
const CARMA_LEGACY_STATE_V2_KEY: &str = "carmaBulkSearchScraper.state.v2";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateEnvelope<T> {
    pub version: u32,
    pub updated_at_ms: u64,
    pub payload: T,
}

impl<T> StateEnvelope<T> {
    pub fn new(version: u32, payload: T) -> Self {
        Self {
            version,
            updated_at_ms: Date::now() as u64,
            payload,
        }
    }
}

fn storage() -> Result<web_sys::Storage, WasmRuntimeError> {
    web_sys::window()
        .ok_or_else(|| WasmRuntimeError::from("window unavailable"))?
        .local_storage()
        .map_err(|_| WasmRuntimeError::from("localStorage access failed"))?
        .ok_or_else(|| WasmRuntimeError::from("localStorage unavailable"))
}

pub fn get_json<T: DeserializeOwned>(key: &str) -> Result<Option<T>, WasmRuntimeError> {
    let raw = storage()?
        .get_item(key)
        .map_err(|_| WasmRuntimeError::from(format!("read localStorage key failed: {key}")))?;
    let Some(text) = raw else {
        return Ok(None);
    };
    let parsed = serde_json::from_str::<T>(&text).ok();
    Ok(parsed)
}

pub fn set_json<T: Serialize>(key: &str, value: &T) -> Result<(), WasmRuntimeError> {
    let raw = serde_json::to_string(value)
        .map_err(|err| WasmRuntimeError::from(format!("serialize local state failed: {err}")))?;
    storage()?
        .set_item(key, &raw)
        .map_err(|_| WasmRuntimeError::from(format!("write localStorage key failed: {key}")))?;
    Ok(())
}

pub fn set_envelope<T: Serialize>(
    key: &str,
    menu_id: &str,
    mut envelope: StateEnvelope<T>,
) -> Result<StateEnvelope<T>, WasmRuntimeError> {
    envelope.updated_at_ms = Date::now() as u64;
    set_json(key, &envelope)?;
    emit_menu_state_change(menu_id, key, envelope.updated_at_ms)?;
    Ok(envelope)
}

pub fn emit_menu_state_change(
    menu_id: &str,
    storage_key: &str,
    updated_at_ms: u64,
) -> Result<(), WasmRuntimeError> {
    let Some(window) = web_sys::window() else {
        return Ok(());
    };
    let Some(document) = window.document() else {
        return Ok(());
    };

    let detail = serde_json::json!({
        "menuId": menu_id,
        "storageKey": storage_key,
        "updatedAtMs": updated_at_ms,
    });
    let detail_js = serde_wasm_bindgen::to_value(&detail)
        .map_err(|err| WasmRuntimeError::from(err.to_string()))?;

    let init = web_sys::CustomEventInit::new();
    init.set_bubbles(true);
    init.set_cancelable(false);
    init.set_detail(&detail_js);

    let event = web_sys::CustomEvent::new_with_event_init_dict(MENU_STATE_EVENT, &init)
        .map_err(|_| WasmRuntimeError::from("failed to create state-change custom event"))?;
    document
        .dispatch_event(&event)
        .map_err(|_| WasmRuntimeError::from("failed to dispatch state-change event"))?;
    Ok(())
}

pub fn migrate_legacy_jira<T, F>(
    build_payload: F,
) -> Result<Option<StateEnvelope<T>>, WasmRuntimeError>
where
    T: Serialize + DeserializeOwned,
    F: Fn(Option<Value>, Option<Value>, Option<Value>, Option<Value>) -> T,
{
    let custom = get_json::<Value>(JIRA_LEGACY_CUSTOM_PRESETS_KEY)?;
    let pinned = get_json::<Value>(JIRA_LEGACY_PINNED_PRESETS_KEY)?;
    let recent = get_json::<Value>(JIRA_LEGACY_RECENT_KEY)?;
    let builder_state = get_json::<Value>(JIRA_LEGACY_STATE_V2_KEY)?;
    if custom.is_none() && pinned.is_none() && recent.is_none() && builder_state.is_none() {
        return Ok(None);
    }
    let payload = build_payload(custom, pinned, recent, builder_state);
    Ok(Some(StateEnvelope::new(1, payload)))
}

pub fn migrate_legacy_carma<T, F>(
    build_payload: F,
) -> Result<Option<StateEnvelope<T>>, WasmRuntimeError>
where
    T: Serialize + DeserializeOwned,
    F: Fn(Option<Value>) -> T,
{
    let saved = get_json::<Value>(CARMA_LEGACY_STATE_V2_KEY)?;
    if saved.is_none() {
        return Ok(None);
    }
    Ok(Some(StateEnvelope::new(2, build_payload(saved))))
}
