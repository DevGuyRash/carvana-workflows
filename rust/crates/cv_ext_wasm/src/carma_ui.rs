use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use wasm_bindgen::{closure::Closure, JsCast};
use wasm_bindgen_futures::spawn_local;

use cv_ext_ui_components::{
    panel_model::PanelTabs,
    site_profile::{CarmaTableProfile, SiteTableProfile},
};

use crate::{
    dom_inject,
    errors::WasmRuntimeError,
    menu_state::{migrate_legacy_carma, set_envelope, StateEnvelope, CARMA_STATE_KEY},
    ui_runtime::table_dom::{self, PopoutOptions as TablePopoutOptions},
};

const PANEL_ID: &str = "cv-carma-scrape-panel";
const STYLE_ID: &str = "cv-carma-scrape-styles";
const LAST_RUN_KEY: &str = "cv.menu.carma.last_run.v1";
const POPOUT_WINDOW_NAME: &str = "cv-carma-results-popout";

const PANEL_CSS: &str = r#"
#cv-carma-scrape-panel{position:fixed;right:16px;bottom:16px;width:min(1120px,95vw);max-height:94vh;z-index:2147483646;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:14px;box-shadow:0 18px 50px rgba(2,6,23,.55);display:flex;flex-direction:column;overflow:hidden}
#cv-carma-scrape-panel *{box-sizing:border-box}
#cv-carma-scrape-panel .cbss-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #334155;background:linear-gradient(180deg,#0f2017,#0f172a)}
#cv-carma-scrape-panel .cbss-title{font-size:15px;font-weight:800;color:#86efac}
#cv-carma-scrape-panel .cbss-sub{font-size:12px;color:#bbf7d0;margin-top:2px}
#cv-carma-scrape-panel .cbss-close{border:1px solid #334155;background:#111827;color:#cbd5e1;border-radius:8px;padding:2px 8px;font-size:18px;cursor:pointer}
#cv-carma-scrape-panel .cbss-body{display:flex;gap:12px;padding:12px 16px;min-height:380px;overflow:hidden}
#cv-carma-scrape-panel .cbss-left{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:10px}
#cv-carma-scrape-panel .cbss-right{flex:0 0 380px;display:flex;flex-direction:column;gap:10px;min-width:260px}
#cv-carma-scrape-panel .cbss-tabs{display:flex;gap:8px}
#cv-carma-scrape-panel .cbss-tab{border:1px solid #2b3a52;background:#101a2e;color:#bcd2ff;border-radius:999px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:700}
#cv-carma-scrape-panel .cbss-tab.active{background:#15803d;border-color:#16a34a;color:#f0fdf4}
#cv-carma-scrape-panel .cbss-panel{display:none;flex-direction:column;gap:10px}
#cv-carma-scrape-panel .cbss-panel.active{display:flex}
#cv-carma-scrape-panel .cbss-actions-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
#cv-carma-scrape-panel .cbss-btn{border:1px solid #334155;background:#111827;color:#e2e8f0;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer}
#cv-carma-scrape-panel .cbss-btn.primary{background:#16a34a;border-color:#22c55e;color:#03240f}
#cv-carma-scrape-panel .cbss-row{display:flex;align-items:center;gap:8px}
#cv-carma-scrape-panel .cbss-input,#cv-carma-scrape-panel .cbss-select{width:100%;border:1px solid #334155;background:#0b1220;color:#e2e8f0;border-radius:8px;padding:7px 10px;font-size:12px}
#cv-carma-scrape-panel .cbss-card{border:1px solid #334155;background:#0b1220;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px}
#cv-carma-scrape-panel .cbss-card-title{font-size:12px;font-weight:800;color:#bbf7d0}
#cv-carma-scrape-panel .cbss-label{font-size:12px;color:#cbd5e1}
#cv-carma-scrape-panel .cbss-textarea{width:100%;min-height:120px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;border-radius:8px;padding:8px;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;resize:vertical}
#cv-carma-scrape-panel .cbss-status{background:#020617;border:1px solid #334155;color:#d1fae5;border-radius:10px;padding:10px;height:220px;overflow:auto;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap}
#cv-carma-scrape-panel .cbss-progress{height:6px;border-radius:999px;background:#12211d;overflow:hidden}
#cv-carma-scrape-panel .cbss-bar{height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#34d399)}
#cv-carma-scrape-panel .cbss-stats{display:flex;gap:12px;font-size:12px;color:#94a3b8}
#cv-carma-scrape-panel .cbss-small{font-size:11px;color:#94a3b8}
#cv-carma-scrape-panel .cbss-iframe-host{display:none}
@media (max-width:980px){
  #cv-carma-scrape-panel{right:8px;left:8px;bottom:8px;width:auto;max-height:96vh}
  #cv-carma-scrape-panel .cbss-body{flex-direction:column}
  #cv-carma-scrape-panel .cbss-right{flex:0 0 auto;width:100%}
  #cv-carma-scrape-panel .cbss-actions-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
"#;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrapeOptions {
    pub paginate_all_pages: bool,
    pub set_show_to_100: bool,
    pub column_mode: String,
    pub require_purchase_id: bool,
    pub require_vin: bool,
    pub require_stock_number: bool,
    pub max_pages: u32,
    pub max_concurrency: u8,
    pub debug: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UniquenessOptions {
    pub enabled: bool,
    pub key_vin: bool,
    pub key_stock: bool,
    pub key_pid: bool,
    #[serde(default = "default_uniqueness_strategy")]
    pub strategy: String,
    pub date_mode: String,
    pub date_header: String,
}

fn default_uniqueness_strategy() -> String {
    "latest_by_date".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PopoutOptions {
    pub copy_include_headers: bool,
    pub persist_selected_columns: bool,
    pub selected_columns_by_name: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeOptions {
    pub primary: String,
    pub accent: String,
    pub tab_bg: String,
    pub tab_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiOptions {
    pub main_tab: String,
    pub settings_tab: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CarmaPanelState {
    pub scrape: ScrapeOptions,
    pub uniqueness: UniquenessOptions,
    pub popout: PopoutOptions,
    pub theme: ThemeOptions,
    pub ui: UiOptions,
}

impl Default for CarmaPanelState {
    fn default() -> Self {
        Self {
            scrape: ScrapeOptions {
                paginate_all_pages: true,
                set_show_to_100: true,
                column_mode: "all".to_string(),
                require_purchase_id: false,
                require_vin: false,
                require_stock_number: false,
                max_pages: 25,
                max_concurrency: 1,
                debug: false,
            },
            uniqueness: UniquenessOptions {
                enabled: false,
                key_vin: true,
                key_stock: true,
                key_pid: true,
                strategy: "latest_by_date".to_string(),
                date_mode: "auto".to_string(),
                date_header: String::new(),
            },
            popout: PopoutOptions {
                copy_include_headers: false,
                persist_selected_columns: true,
                selected_columns_by_name: Vec::new(),
            },
            theme: ThemeOptions {
                primary: "#16a34a".to_string(),
                accent: "#183558".to_string(),
                tab_bg: "#f1f5f9".to_string(),
                tab_text: "#183558".to_string(),
            },
            ui: UiOptions {
                main_tab: "actions".to_string(),
                settings_tab: "scrape".to_string(),
            },
        }
    }
}

fn migrate_from_legacy(saved: Option<Value>) -> CarmaPanelState {
    let mut state = CarmaPanelState::default();
    let Some(saved) = saved else {
        return state;
    };
    if let Some(scrape) = saved.get("scrape") {
        if let Ok(parsed) = serde_json::from_value::<ScrapeOptions>(scrape.clone()) {
            state.scrape = parsed;
        } else {
            state.scrape.paginate_all_pages = scrape
                .get("paginateAllPages")
                .and_then(Value::as_bool)
                .unwrap_or(true);
            state.scrape.set_show_to_100 = scrape
                .get("setShowTo100")
                .and_then(Value::as_bool)
                .unwrap_or(true);
            state.scrape.column_mode = scrape
                .get("columnMode")
                .and_then(Value::as_str)
                .unwrap_or("all")
                .to_string();
            state.scrape.require_purchase_id = scrape
                .get("requirePurchaseId")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            state.scrape.require_vin = scrape
                .get("requireVin")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            state.scrape.require_stock_number = scrape
                .get("requireStockNumber")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            state.scrape.max_pages = scrape
                .get("maxPages")
                .and_then(Value::as_u64)
                .unwrap_or(25) as u32;
            state.scrape.max_concurrency = scrape
                .get("maxConcurrency")
                .and_then(Value::as_u64)
                .unwrap_or(1)
                .clamp(1, 8) as u8;
            state.scrape.debug = scrape.get("debug").and_then(Value::as_bool).unwrap_or(false);
        }
    }
    if let Some(unique) = saved.get("uniqueness") {
        let enabled = unique
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let key_fields = unique.get("keyFields");
        state.uniqueness.enabled = enabled;
        state.uniqueness.key_vin = key_fields
            .and_then(|v| v.get("vin"))
            .and_then(Value::as_bool)
            .unwrap_or(true);
        state.uniqueness.key_stock = key_fields
            .and_then(|v| v.get("stock"))
            .and_then(Value::as_bool)
            .unwrap_or(true);
        state.uniqueness.key_pid = key_fields
            .and_then(|v| v.get("pid"))
            .and_then(Value::as_bool)
            .unwrap_or(true);
        state.uniqueness.strategy = unique
            .get("strategy")
            .and_then(Value::as_str)
            .filter(|value| matches!(*value, "latest_by_date" | "first_seen" | "last_seen"))
            .unwrap_or("latest_by_date")
            .to_string();
        let date_column = unique.get("dateColumn");
        state.uniqueness.date_mode = date_column
            .and_then(|v| v.get("mode"))
            .and_then(Value::as_str)
            .unwrap_or("auto")
            .to_string();
        state.uniqueness.date_header = date_column
            .and_then(|v| v.get("header"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
    }
    if let Some(popout) = saved.get("popout") {
        state.popout.copy_include_headers = popout
            .get("copyIncludeHeaders")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        state.popout.persist_selected_columns = popout
            .get("persistSelectedColumns")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        state.popout.selected_columns_by_name = popout
            .get("selectedColumnsByName")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
    }
    if let Some(theme) = saved.get("theme") {
        state.theme.primary = theme
            .get("primary")
            .and_then(Value::as_str)
            .unwrap_or("#16a34a")
            .to_string();
        state.theme.accent = theme
            .get("accent")
            .and_then(Value::as_str)
            .unwrap_or("#183558")
            .to_string();
        state.theme.tab_bg = theme
            .get("tabBg")
            .and_then(Value::as_str)
            .unwrap_or("#f1f5f9")
            .to_string();
        state.theme.tab_text = theme
            .get("tabText")
            .and_then(Value::as_str)
            .unwrap_or("#183558")
            .to_string();
    }
    if let Some(ui) = saved.get("ui") {
        state.ui.main_tab = ui
            .get("mainTab")
            .and_then(Value::as_str)
            .unwrap_or("actions")
            .to_string();
        state.ui.settings_tab = ui
            .get("settingsTab")
            .and_then(Value::as_str)
            .unwrap_or("scrape")
            .to_string();
    }
    state
}

fn load_state() -> Result<StateEnvelope<CarmaPanelState>, WasmRuntimeError> {
    if let Some(state) =
        crate::menu_state::get_json::<StateEnvelope<CarmaPanelState>>(CARMA_STATE_KEY)?
    {
        let mut state = state;
        normalize_tabs(&mut state.payload);
        return Ok(state);
    }
    if let Some(migrated) = migrate_legacy_carma(migrate_from_legacy)? {
        let mut migrated = migrated;
        normalize_tabs(&mut migrated.payload);
        let saved = set_envelope(CARMA_STATE_KEY, "carma", migrated)?;
        return Ok(saved);
    }
    let mut envelope = StateEnvelope::new(2, CarmaPanelState::default());
    normalize_tabs(&mut envelope.payload);
    Ok(envelope)
}

fn save_state(
    envelope: StateEnvelope<CarmaPanelState>,
) -> Result<StateEnvelope<CarmaPanelState>, WasmRuntimeError> {
    let mut envelope = envelope;
    normalize_tabs(&mut envelope.payload);
    set_envelope(CARMA_STATE_KEY, "carma", envelope)
}

fn normalize_tabs(state: &mut CarmaPanelState) {
    let mut main_tabs = PanelTabs::new(vec!["actions", "settings"], "actions");
    main_tabs.set_active(&state.ui.main_tab);
    state.ui.main_tab = main_tabs.active().to_string();

    let mut settings_tabs =
        PanelTabs::new(vec!["scrape", "uniqueness", "popout", "theme"], "scrape");
    settings_tabs.set_active(&state.ui.settings_tab);
    state.ui.settings_tab = settings_tabs.active().to_string();
}

fn checked(value: bool) -> &'static str {
    if value {
        "checked"
    } else {
        ""
    }
}

fn panel_html(state: &CarmaPanelState) -> String {
    let actions_active = if state.ui.main_tab == "actions" {
        " active"
    } else {
        ""
    };
    let settings_active = if state.ui.main_tab == "settings" {
        " active"
    } else {
        ""
    };
    let scrape_tab = if state.ui.settings_tab == "scrape" {
        " active"
    } else {
        ""
    };
    let unique_tab = if state.ui.settings_tab == "uniqueness" {
        " active"
    } else {
        ""
    };
    let popout_tab = if state.ui.settings_tab == "popout" {
        " active"
    } else {
        ""
    };
    let theme_tab = if state.ui.settings_tab == "theme" {
        " active"
    } else {
        ""
    };

    format!(
        r#"<div class="cbss-header">
  <div><div class="cbss-title">Carma Bulk Search Scraper</div><div class="cbss-sub">Actions + Settings tabs with legacy state parity</div></div>
  <button class="cbss-close" title="Close">✕</button>
</div>
<div class="cbss-body">
  <div class="cbss-left">
    <div class="cbss-tabs">
      <button class="cbss-tab{actions_active}" data-main-tab="actions">Actions</button>
      <button class="cbss-tab{settings_active}" data-main-tab="settings">Settings</button>
    </div>
    <section class="cbss-panel{actions_active}" data-panel="actions">
      <div class="cbss-card">
        <div class="cbss-card-title">Search Terms</div>
        <textarea class="cbss-textarea" data-setting="termsText" placeholder="STOCK_NUMBER&#10;VIN&#10;PID&#10;CUSTOMER_NAME&#10;EMAIL&#10;PHONE"></textarea>
        <div class="cbss-small">Line/comma/semicolon/pipe/tab separated. Terms are not persisted.</div>
      </div>
      <div class="cbss-actions-grid">
        <button class="cbss-btn primary" data-action="start">Run Scrape</button>
        <button class="cbss-btn" data-action="cancel">Cancel</button>
        <button class="cbss-btn" data-action="copy-csv">Copy CSV</button>
        <button class="cbss-btn" data-action="copy-json">Copy JSON</button>
        <button class="cbss-btn" data-action="download-csv">Download CSV</button>
        <button class="cbss-btn" data-action="download-json">Download JSON</button>
        <button class="cbss-btn" data-action="copy-stock">Copy Stock</button>
        <button class="cbss-btn" data-action="copy-vin">Copy VIN</button>
        <button class="cbss-btn" data-action="copy-pid">Copy PID</button>
        <button class="cbss-btn" data-action="copy-reference">Copy Reference</button>
        <button class="cbss-btn" data-action="popout">Open Popout</button>
      </div>
      <div class="cbss-small">Export/copy actions apply to the most recent scrape result artifact.</div>
    </section>
    <section class="cbss-panel{settings_active}" data-panel="settings">
      <div class="cbss-tabs">
        <button class="cbss-tab{scrape_tab}" data-settings-tab="scrape">Scrape</button>
        <button class="cbss-tab{unique_tab}" data-settings-tab="uniqueness">Uniqueness</button>
        <button class="cbss-tab{popout_tab}" data-settings-tab="popout">Popout</button>
        <button class="cbss-tab{theme_tab}" data-settings-tab="theme">Theme</button>
      </div>
      <div class="cbss-panel{scrape_tab}" data-settings-panel="scrape">
        <div class="cbss-card">
          <div class="cbss-card-title">Scrape Options</div>
          <label class="cbss-label"><input type="checkbox" data-setting="paginateAllPages" {} /> Paginate all pages</label>
          <label class="cbss-label"><input type="checkbox" data-setting="setShowTo100" {} /> Set rows/page to 100 when possible</label>
          <label class="cbss-label"><input type="checkbox" data-setting="requirePurchaseId" {} /> Require Purchase ID</label>
          <label class="cbss-label"><input type="checkbox" data-setting="requireVin" {} /> Require VIN</label>
          <label class="cbss-label"><input type="checkbox" data-setting="requireStockNumber" {} /> Require Stock Number</label>
          <div class="cbss-row">
            <label class="cbss-label">Column mode</label>
            <select class="cbss-select" data-setting="columnMode">
              <option value="all" {}>Enable ALL columns</option>
              <option value="key" {}>Enable key columns</option>
              <option value="none" {}>Leave columns unchanged</option>
            </select>
          </div>
          <div class="cbss-row">
            <label class="cbss-label">Max pages</label>
            <input class="cbss-input" type="number" min="1" max="250" value="{}" data-setting="maxPages" />
          </div>
          <div class="cbss-row">
            <label class="cbss-label">Parallel workers</label>
            <input class="cbss-input" type="number" min="1" max="8" value="{}" data-setting="maxConcurrency" />
          </div>
          <label class="cbss-label"><input type="checkbox" data-setting="debug" {} /> Debug mode</label>
        </div>
      </div>
      <div class="cbss-panel{unique_tab}" data-settings-panel="uniqueness">
        <div class="cbss-card">
          <div class="cbss-card-title">Uniqueness</div>
          <label class="cbss-label"><input type="checkbox" data-setting="uniqueEnabled" {} /> Keep one row per unique key</label>
          <label class="cbss-label"><input type="checkbox" data-setting="keyVin" {} /> VIN key</label>
          <label class="cbss-label"><input type="checkbox" data-setting="keyStock" {} /> Stock key</label>
          <label class="cbss-label"><input type="checkbox" data-setting="keyPid" {} /> Purchase ID key</label>
          <div class="cbss-row">
            <label class="cbss-label">Strategy</label>
            <select class="cbss-select" data-setting="strategy">
              <option value="latest_by_date" {}>Latest by date</option>
              <option value="first_seen" {}>First seen</option>
              <option value="last_seen" {}>Last seen</option>
            </select>
          </div>
          <div class="cbss-row">
            <label class="cbss-label">Date column mode</label>
            <select class="cbss-select" data-setting="dateMode">
              <option value="auto" {}>Auto-detect</option>
              <option value="manual" {}>Manual header</option>
            </select>
          </div>
          <div class="cbss-row">
            <label class="cbss-label">Date header</label>
            <input class="cbss-input" data-setting="dateHeader" value="{}" placeholder="e.g. Date" />
          </div>
        </div>
      </div>
      <div class="cbss-panel{popout_tab}" data-settings-panel="popout">
        <div class="cbss-card">
          <div class="cbss-card-title">Popout</div>
          <label class="cbss-label"><input type="checkbox" data-setting="copyHeaders" {} /> Include headers when copying</label>
          <label class="cbss-label"><input type="checkbox" data-setting="persistColumns" {} /> Persist selected columns</label>
        </div>
      </div>
      <div class="cbss-panel{theme_tab}" data-settings-panel="theme">
        <div class="cbss-card">
          <div class="cbss-card-title">Theme Tokens</div>
          <div class="cbss-row"><label class="cbss-label">Primary</label><input class="cbss-input" data-setting="themePrimary" value="{}" /></div>
          <div class="cbss-row"><label class="cbss-label">Accent</label><input class="cbss-input" data-setting="themeAccent" value="{}" /></div>
          <div class="cbss-row"><label class="cbss-label">Tab Background</label><input class="cbss-input" data-setting="themeTabBg" value="{}" /></div>
          <div class="cbss-row"><label class="cbss-label">Tab Text</label><input class="cbss-input" data-setting="themeTabText" value="{}" /></div>
        </div>
      </div>
    </section>
  </div>
  <div class="cbss-right">
    <div class="cbss-card">
      <div class="cbss-card-title">Status</div>
      <div class="cbss-progress"><div class="cbss-bar"></div></div>
      <div class="cbss-stats"><span>Pages: <span data-stat="pages">0</span></span><span>Rows: <span data-stat="rows">0</span></span><span>Dupes: <span data-stat="dupes">0</span></span></div>
      <div class="cbss-status">Ready.</div>
    </div>
  </div>
  <div class="cbss-iframe-host" data-role="iframeHost"></div>
</div>"#,
        checked(state.scrape.paginate_all_pages),
        checked(state.scrape.set_show_to_100),
        checked(state.scrape.require_purchase_id),
        checked(state.scrape.require_vin),
        checked(state.scrape.require_stock_number),
        if state.scrape.column_mode == "all" {
            "selected"
        } else {
            ""
        },
        if state.scrape.column_mode == "key" {
            "selected"
        } else {
            ""
        },
        if state.scrape.column_mode == "none" {
            "selected"
        } else {
            ""
        },
        state.scrape.max_pages,
        state.scrape.max_concurrency,
        checked(state.scrape.debug),
        checked(state.uniqueness.enabled),
        checked(state.uniqueness.key_vin),
        checked(state.uniqueness.key_stock),
        checked(state.uniqueness.key_pid),
        if state.uniqueness.strategy == "latest_by_date" {
            "selected"
        } else {
            ""
        },
        if state.uniqueness.strategy == "first_seen" {
            "selected"
        } else {
            ""
        },
        if state.uniqueness.strategy == "last_seen" {
            "selected"
        } else {
            ""
        },
        if state.uniqueness.date_mode == "auto" {
            "selected"
        } else {
            ""
        },
        if state.uniqueness.date_mode == "manual" {
            "selected"
        } else {
            ""
        },
        state.uniqueness.date_header,
        checked(state.popout.copy_include_headers),
        checked(state.popout.persist_selected_columns),
        state.theme.primary,
        state.theme.accent,
        state.theme.tab_bg,
        state.theme.tab_text,
    )
}

fn bind_events(panel: &web_sys::HtmlElement) -> Result<(), WasmRuntimeError> {
    if panel
        .get_attribute("data-cbss-bound")
        .map(|value| value == "1")
        .unwrap_or(false)
    {
        return Ok(());
    }
    panel.set_attribute("data-cbss-bound", "1").ok();

    let click_panel = panel.clone();
    let click_handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |event: web_sys::Event| {
            let Some(target) = event.target() else { return };
            let Ok(target) = target.dyn_into::<web_sys::Element>() else {
                return;
            };

            if target
                .get_attribute("class")
                .map(|class| class.split_whitespace().any(|item| item == "cbss-close"))
                .unwrap_or(false)
            {
                let _ = dom_inject::remove_element(PANEL_ID);
                return;
            }

            let mut envelope = match load_state() {
                Ok(state) => state,
                Err(_) => StateEnvelope::new(2, CarmaPanelState::default()),
            };

            if let Some(tab) = target.get_attribute("data-main-tab") {
                let mut tabs = PanelTabs::new(vec!["actions", "settings"], "actions");
                tabs.set_active(&tab);
                envelope.payload.ui.main_tab = tabs.active().to_string();
                if let Ok(saved) = save_state(envelope) {
                    apply_tabs_to_dom(&click_panel, &saved.payload);
                }
                return;
            }
            if let Some(tab) = target.get_attribute("data-settings-tab") {
                envelope.payload.ui.main_tab = "settings".to_string();
                let mut tabs =
                    PanelTabs::new(vec!["scrape", "uniqueness", "popout", "theme"], "scrape");
                tabs.set_active(&tab);
                envelope.payload.ui.settings_tab = tabs.active().to_string();
                if let Ok(saved) = save_state(envelope) {
                    apply_tabs_to_dom(&click_panel, &saved.payload);
                }
                return;
            }

            let Some(action) = target.get_attribute("data-action") else {
                return;
            };
            match action.as_str() {
                "start" => {
                    let _ = persist_state_from_form(&click_panel);
                    let terms_text = read_textarea(&click_panel, r#"[data-setting="termsText"]"#);
                    spawn_local(async move {
                        let result = crate::commands::execute_command(
                            "carma.bulk.search.scrape",
                            &json!({ "termsText": terms_text }),
                        )
                        .await;
                        if let Err(error) = result {
                            let _ = update_progress(&format!("ERROR: {error}"), 0, 0, 0, 0);
                        }
                    });
                }
                "cancel" => {
                    spawn_local(async {
                        let _ =
                            crate::commands::execute_command("carma.bulk.search.cancel", &Value::Null)
                                .await;
                    });
                    let _ = update_progress("Cancellation requested.", 0, 0, 0, 0);
                }
                "copy-csv" => match table_dom::load_last_run(LAST_RUN_KEY) {
                    Ok(data) => {
                        let include = envelope.payload.popout.copy_include_headers;
                        let _ = table_dom::copy_dataset_csv(&data.dataset, include);
                        let _ = update_progress(
                            "Copied CSV to clipboard.",
                            0,
                            data.dataset.rows.len() as u32,
                            0,
                            100,
                        );
                    }
                    Err(err) => {
                        let _ = update_progress(&format!("Copy CSV failed: {err}"), 0, 0, 0, 0);
                    }
                },
                "copy-json" => match table_dom::load_last_run(LAST_RUN_KEY) {
                    Ok(data) => {
                        let _ = table_dom::copy_dataset_json(&data.dataset);
                        let _ = update_progress(
                            "Copied JSON to clipboard.",
                            0,
                            data.dataset.rows.len() as u32,
                            0,
                            100,
                        );
                    }
                    Err(err) => {
                        let _ = update_progress(&format!("Copy JSON failed: {err}"), 0, 0, 0, 0);
                    }
                },
                "download-csv" => match table_dom::load_last_run(LAST_RUN_KEY) {
                    Ok(data) => {
                        let include = envelope.payload.popout.copy_include_headers;
                        let filename =
                            format!("carma-search-export_{}.csv", js_sys::Date::now() as u64);
                        let _ = table_dom::download_dataset_csv(&data.dataset, include, &filename);
                        let _ = update_progress(
                            "CSV download started.",
                            0,
                            data.dataset.rows.len() as u32,
                            0,
                            100,
                        );
                    }
                    Err(err) => {
                        let _ = update_progress(&format!("Download CSV failed: {err}"), 0, 0, 0, 0);
                    }
                },
                "download-json" => match table_dom::load_last_run(LAST_RUN_KEY) {
                    Ok(data) => {
                        let filename =
                            format!("carma-search-export_{}.json", js_sys::Date::now() as u64);
                        let _ = table_dom::download_dataset_json(&data.dataset, &filename);
                        let _ = update_progress(
                            "JSON download started.",
                            0,
                            data.dataset.rows.len() as u32,
                            0,
                            100,
                        );
                    }
                    Err(err) => {
                        let _ =
                            update_progress(&format!("Download JSON failed: {err}"), 0, 0, 0, 0);
                    }
                },
                "copy-stock" => match table_dom::load_last_run(LAST_RUN_KEY) {
                    Ok(data) => {
                        let count = table_dom::copy_matching_columns(
                            &data.dataset,
                            &["stocknumber", "latestpurchasestocknumber"],
                        )
                        .unwrap_or(0);
                        let _ = update_progress(
                            &format!("Copied {} stock values.", count),
                            0,
                            data.dataset.rows.len() as u32,
                            0,
                            100,
                        );
                    }
                    Err(err) => {
                        let _ = update_progress(&format!("Copy stock failed: {err}"), 0, 0, 0, 0);
                    }
                },
                "copy-vin" => match table_dom::load_last_run(LAST_RUN_KEY) {
                    Ok(data) => {
                        let count = table_dom::copy_matching_columns(
                            &data.dataset,
                            &["vin", "latestpurchasevin"],
                        )
                        .unwrap_or(0);
                        let _ = update_progress(
                            &format!("Copied {} VIN values.", count),
                            0,
                            data.dataset.rows.len() as u32,
                            0,
                            100,
                        );
                    }
                    Err(err) => {
                        let _ = update_progress(&format!("Copy VIN failed: {err}"), 0, 0, 0, 0);
                    }
                },
                "copy-pid" => match table_dom::load_last_run(LAST_RUN_KEY) {
                    Ok(data) => {
                        let count = table_dom::copy_matching_columns(
                            &data.dataset,
                            &["purchaseid", "latestpurchasepurchaseid"],
                        )
                        .unwrap_or(0);
                        let _ = update_progress(
                            &format!("Copied {} PID values.", count),
                            0,
                            data.dataset.rows.len() as u32,
                            0,
                            100,
                        );
                    }
                    Err(err) => {
                        let _ = update_progress(&format!("Copy PID failed: {err}"), 0, 0, 0, 0);
                    }
                },
                "copy-reference" => match table_dom::load_last_run(LAST_RUN_KEY) {
                    Ok(data) => {
                        let count = table_dom::copy_matching_columns(&data.dataset, &["reference"])
                            .unwrap_or(0);
                        let _ = update_progress(
                            &format!("Copied {} reference values.", count),
                            0,
                            data.dataset.rows.len() as u32,
                            0,
                            100,
                        );
                    }
                    Err(err) => {
                        let _ =
                            update_progress(&format!("Copy reference failed: {err}"), 0, 0, 0, 0);
                    }
                },
                "popout" => match table_dom::load_last_run(LAST_RUN_KEY) {
                    Ok(data) => {
                        let profile = CarmaTableProfile;
                        let selected_columns =
                            if envelope.payload.popout.selected_columns_by_name.is_empty() {
                                let defaults = profile.default_selected_columns();
                                data.dataset
                                    .columns
                                    .iter()
                                    .filter(|column| {
                                        let normalized = column
                                            .to_lowercase()
                                            .chars()
                                            .filter(|ch| ch.is_ascii_alphanumeric())
                                            .collect::<String>();
                                        defaults.iter().any(|wanted| normalized.contains(wanted))
                                    })
                                    .cloned()
                                    .collect::<Vec<String>>()
                            } else {
                                envelope.payload.popout.selected_columns_by_name.clone()
                            };
                        match table_dom::open_popout_with_dataset(
                            &data.dataset,
                            &TablePopoutOptions {
                                title: "Carma Bulk Search Scraper - Results",
                                window_name: POPOUT_WINDOW_NAME,
                                include_headers: envelope.payload.popout.copy_include_headers,
                                selected_columns,
                            },
                        ) {
                            Ok(_) => {
                                let _ = update_progress(
                                    "Popout opened.",
                                    0,
                                    data.dataset.rows.len() as u32,
                                    0,
                                    100,
                                );
                            }
                            Err(err) => {
                                let _ =
                                    update_progress(&format!("Popout failed: {err}"), 0, 0, 0, 0);
                            }
                        }
                    }
                    Err(err) => {
                        let _ = update_progress(&format!("Popout unavailable: {err}"), 0, 0, 0, 0);
                    }
                },
                _ => {}
            }
        }));
    panel
        .add_event_listener_with_callback("click", click_handler.as_ref().unchecked_ref())
        .ok();
    click_handler.forget();

    let change_panel = panel.clone();
    let change_handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |_event: web_sys::Event| {
            let _ = persist_state_from_form(&change_panel);
        }));
    panel
        .add_event_listener_with_callback("change", change_handler.as_ref().unchecked_ref())
        .ok();
    change_handler.forget();

    Ok(())
}

fn read_checkbox(panel: &web_sys::HtmlElement, selector: &str, fallback: bool) -> bool {
    panel
        .query_selector(selector)
        .ok()
        .flatten()
        .and_then(|el| el.dyn_into::<web_sys::HtmlInputElement>().ok())
        .map(|el| el.checked())
        .unwrap_or(fallback)
}

fn read_text(panel: &web_sys::HtmlElement, selector: &str, fallback: &str) -> String {
    panel
        .query_selector(selector)
        .ok()
        .flatten()
        .and_then(|el| el.dyn_into::<web_sys::HtmlInputElement>().ok())
        .map(|el| el.value())
        .unwrap_or_else(|| fallback.to_string())
}

fn read_textarea(panel: &web_sys::HtmlElement, selector: &str) -> String {
    panel
        .query_selector(selector)
        .ok()
        .flatten()
        .and_then(|el| el.dyn_into::<web_sys::HtmlTextAreaElement>().ok())
        .map(|el| el.value())
        .unwrap_or_default()
}

fn apply_tabs_to_dom(panel: &web_sys::HtmlElement, state: &CarmaPanelState) {
    let toggle_active = |el: &web_sys::Element, active: bool| {
        let current = el.get_attribute("class").unwrap_or_default();
        let mut classes = current
            .split_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>();
        let has_active = classes.iter().any(|c| c == "active");
        if active && !has_active {
            classes.push("active".to_string());
        } else if !active && has_active {
            classes.retain(|c| c != "active");
        }
        let _ = el.set_attribute("class", &classes.join(" "));
    };
    let _ = panel
        .query_selector_all("[data-main-tab]")
        .map(|nodes| {
            for i in 0..nodes.length() {
                let Some(node) = nodes.item(i) else { continue };
                let Ok(el) = node.dyn_into::<web_sys::Element>() else {
                    continue;
                };
                let active = el
                    .get_attribute("data-main-tab")
                    .map(|v| v == state.ui.main_tab)
                    .unwrap_or(false);
                toggle_active(&el, active);
            }
        });
    let _ = panel
        .query_selector_all("[data-panel]")
        .map(|nodes| {
            for i in 0..nodes.length() {
                let Some(node) = nodes.item(i) else { continue };
                let Ok(el) = node.dyn_into::<web_sys::Element>() else {
                    continue;
                };
                let active = el
                    .get_attribute("data-panel")
                    .map(|v| v == state.ui.main_tab)
                    .unwrap_or(false);
                toggle_active(&el, active);
            }
        });
    let _ = panel
        .query_selector_all("[data-settings-tab]")
        .map(|nodes| {
            for i in 0..nodes.length() {
                let Some(node) = nodes.item(i) else { continue };
                let Ok(el) = node.dyn_into::<web_sys::Element>() else {
                    continue;
                };
                let active = el
                    .get_attribute("data-settings-tab")
                    .map(|v| v == state.ui.settings_tab)
                    .unwrap_or(false);
                toggle_active(&el, active);
            }
        });
    let _ = panel
        .query_selector_all("[data-settings-panel]")
        .map(|nodes| {
            for i in 0..nodes.length() {
                let Some(node) = nodes.item(i) else { continue };
                let Ok(el) = node.dyn_into::<web_sys::Element>() else {
                    continue;
                };
                let active = el
                    .get_attribute("data-settings-panel")
                    .map(|v| v == state.ui.settings_tab)
                    .unwrap_or(false);
                toggle_active(&el, active);
            }
        });
}

fn read_select(panel: &web_sys::HtmlElement, selector: &str, fallback: &str) -> String {
    panel
        .query_selector(selector)
        .ok()
        .flatten()
        .and_then(|el| el.dyn_into::<web_sys::HtmlSelectElement>().ok())
        .map(|el| el.value())
        .unwrap_or_else(|| fallback.to_string())
}

fn persist_state_from_form(panel: &web_sys::HtmlElement) -> Result<(), WasmRuntimeError> {
    let mut envelope = load_state()?;
    envelope.payload.scrape.paginate_all_pages =
        read_checkbox(panel, r#"[data-setting="paginateAllPages"]"#, true);
    envelope.payload.scrape.set_show_to_100 =
        read_checkbox(panel, r#"[data-setting="setShowTo100"]"#, true);
    envelope.payload.scrape.require_purchase_id =
        read_checkbox(panel, r#"[data-setting="requirePurchaseId"]"#, false);
    envelope.payload.scrape.require_vin =
        read_checkbox(panel, r#"[data-setting="requireVin"]"#, false);
    envelope.payload.scrape.require_stock_number =
        read_checkbox(panel, r#"[data-setting="requireStockNumber"]"#, false);
    envelope.payload.scrape.column_mode =
        read_select(panel, r#"[data-setting="columnMode"]"#, "all");
    envelope.payload.scrape.max_pages = read_text(panel, r#"[data-setting="maxPages"]"#, "25")
        .parse::<u32>()
        .unwrap_or(25)
        .clamp(1, 250);
    envelope.payload.scrape.max_concurrency = read_text(panel, r#"[data-setting="maxConcurrency"]"#, "1")
        .parse::<u8>()
        .unwrap_or(1)
        .clamp(1, 8);
    envelope.payload.scrape.debug = read_checkbox(panel, r#"[data-setting="debug"]"#, false);

    envelope.payload.uniqueness.enabled =
        read_checkbox(panel, r#"[data-setting="uniqueEnabled"]"#, false);
    envelope.payload.uniqueness.key_vin = read_checkbox(panel, r#"[data-setting="keyVin"]"#, true);
    envelope.payload.uniqueness.key_stock =
        read_checkbox(panel, r#"[data-setting="keyStock"]"#, true);
    envelope.payload.uniqueness.key_pid = read_checkbox(panel, r#"[data-setting="keyPid"]"#, true);
    envelope.payload.uniqueness.strategy =
        read_select(panel, r#"[data-setting="strategy"]"#, "latest_by_date");
    envelope.payload.uniqueness.date_mode =
        read_select(panel, r#"[data-setting="dateMode"]"#, "auto");
    envelope.payload.uniqueness.date_header =
        read_text(panel, r#"[data-setting="dateHeader"]"#, "");

    envelope.payload.popout.copy_include_headers =
        read_checkbox(panel, r#"[data-setting="copyHeaders"]"#, false);
    envelope.payload.popout.persist_selected_columns =
        read_checkbox(panel, r#"[data-setting="persistColumns"]"#, true);

    envelope.payload.theme.primary =
        read_text(panel, r#"[data-setting="themePrimary"]"#, "#16a34a");
    envelope.payload.theme.accent = read_text(panel, r#"[data-setting="themeAccent"]"#, "#183558");
    envelope.payload.theme.tab_bg = read_text(panel, r#"[data-setting="themeTabBg"]"#, "#f1f5f9");
    envelope.payload.theme.tab_text =
        read_text(panel, r#"[data-setting="themeTabText"]"#, "#183558");

    let _ = save_state(envelope)?;
    Ok(())
}

pub fn show_control_panel() -> Result<Value, WasmRuntimeError> {
    dom_inject::inject_style(STYLE_ID, PANEL_CSS)?;
    let envelope = load_state()?;
    let panel = dom_inject::inject_or_update_banner(PANEL_ID, "", &panel_html(&envelope.payload))?;
    bind_events(&panel)?;
    Ok(json!({
        "command": "carma.show_panel",
        "panelVisible": true
    }))
}

pub fn load_panel_state() -> Result<Value, WasmRuntimeError> {
    let envelope = load_state()?;
    Ok(serde_json::to_value(envelope).unwrap_or_else(|_| json!({})))
}

pub fn store_last_run(columns: &[String], rows: &[Vec<Value>]) -> Result<(), WasmRuntimeError> {
    table_dom::store_last_run(LAST_RUN_KEY, columns, rows)
}

pub fn show_progress_panel() -> Result<(), WasmRuntimeError> {
    if web_sys::window()
        .and_then(|w| w.document())
        .and_then(|d| d.get_element_by_id(PANEL_ID))
        .is_none()
    {
        let _ = show_control_panel()?;
    }
    Ok(())
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
    if let Ok(Some(el)) = panel.query_selector(".cbss-status") {
        let previous = el.text_content().unwrap_or_default();
        let next = if previous.trim().is_empty() {
            status.to_string()
        } else {
            format!("{previous}\n{status}")
        };
        el.set_text_content(Some(&next));
    }
    if let Ok(Some(bar)) = panel.query_selector(".cbss-bar") {
        if let Ok(html) = bar.dyn_into::<web_sys::HtmlElement>() {
            html.style().set_property("width", &format!("{pct}%")).ok();
        }
    }
    for (attr, value) in [("pages", pages), ("rows", rows), ("dupes", dupes)] {
        if let Ok(Some(el)) = panel.query_selector(&format!("[data-stat='{attr}']")) {
            el.set_text_content(Some(&value.to_string()));
        }
    }
    Ok(())
}

pub fn clear_progress_log() -> Result<(), WasmRuntimeError> {
    let doc = web_sys::window()
        .and_then(|w| w.document())
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;
    let Some(panel) = doc.get_element_by_id(PANEL_ID) else {
        return Ok(());
    };
    if let Ok(Some(el)) = panel.query_selector(".cbss-status") {
        el.set_text_content(Some("Ready."));
    }
    if let Ok(Some(bar)) = panel.query_selector(".cbss-bar") {
        if let Ok(html) = bar.dyn_into::<web_sys::HtmlElement>() {
            html.style().set_property("width", "0%").ok();
        }
    }
    for attr in ["pages", "rows", "dupes"] {
        if let Ok(Some(el)) = panel.query_selector(&format!("[data-stat='{attr}']")) {
            el.set_text_content(Some("0"));
        }
    }
    Ok(())
}

pub fn show_complete(rows: u32, dupes: u32, pages: u32) -> Result<(), WasmRuntimeError> {
    update_progress(
        &format!("DONE: {rows} rows from {pages} pages ({dupes} duplicates skipped)"),
        pages,
        rows,
        dupes,
        100,
    )
}
