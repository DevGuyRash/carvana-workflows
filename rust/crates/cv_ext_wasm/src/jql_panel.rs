use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use wasm_bindgen::{closure::Closure, JsCast};

use cv_ext_ui_components::{table_model::TableDataset, PanelTabs};

use crate::{
    dom, dom_inject,
    errors::WasmRuntimeError,
    menu_state::{migrate_legacy_jira, set_envelope, StateEnvelope, JIRA_STATE_KEY},
};

const PANEL_ID: &str = "cv-jql-builder-panel";
const STYLE_ID: &str = "cv-jql-builder-styles";
const LAST_CAPTURE_TABLE_KEY: &str = "cv.menu.jira.last_capture_table.v1";
const ADVANCED_INPUT: &str =
    "textarea#advanced-search, textarea[name='jql'], textarea[aria-label='Advanced Query'], input[aria-label='Advanced Query']";
const SEARCH_BTN: &str =
    "button.search-button, button[title='Search for issues'], button[aria-label='Search for issues']";

const PANEL_CSS: &str = r#"
#cv-jql-builder-panel{position:fixed;right:16px;bottom:16px;width:min(1160px,96vw);max-height:94vh;z-index:2147483646;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:14px;box-shadow:0 18px 50px rgba(2,6,23,.55);display:flex;flex-direction:column;overflow:hidden}
#cv-jql-builder-panel *{box-sizing:border-box}
#cv-jql-builder-panel .cv-jql-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #334155;background:linear-gradient(180deg,#111b31,#0f172a)}
#cv-jql-builder-panel .cv-jql-title{font-weight:800;font-size:14px;color:#dbeafe}
#cv-jql-builder-panel .cv-jql-sub{font-size:12px;color:#93c5fd;margin-top:2px}
#cv-jql-builder-panel .cv-jql-close{border:1px solid #334155;background:#111827;color:#cbd5e1;border-radius:8px;padding:2px 8px;font-size:18px;cursor:pointer}
#cv-jql-builder-panel .cv-jql-tabs{display:flex;gap:8px;padding:10px 16px;background:#0b1324;border-bottom:1px solid #223046}
#cv-jql-builder-panel .cv-jql-tab{border:1px solid #2b3a52;background:#101a2e;color:#bcd2ff;border-radius:999px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:700}
#cv-jql-builder-panel .cv-jql-tab.active{background:#1d4ed8;border-color:#2563eb;color:#eff6ff}
#cv-jql-builder-panel .cv-jql-body{display:flex;gap:12px;padding:12px 16px;min-height:380px;overflow:hidden}
#cv-jql-builder-panel .cv-jql-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:10px}
#cv-jql-builder-panel .cv-jql-panel{display:none;flex-direction:column;gap:10px;min-height:0}
#cv-jql-builder-panel .cv-jql-panel.active{display:flex}
#cv-jql-builder-panel .cv-jql-note{font-size:12px;color:#94a3b8}
#cv-jql-builder-panel .cv-jql-presets{display:flex;flex-wrap:wrap;gap:6px}
#cv-jql-builder-panel .cv-jql-preset{border:1px solid #31435f;background:#122038;color:#dbeafe;padding:5px 9px;border-radius:999px;font-size:12px;cursor:pointer}
#cv-jql-builder-panel .cv-jql-preset.selected{background:#2563eb;border-color:#3b82f6}
#cv-jql-builder-panel .cv-jql-row{display:flex;gap:8px;align-items:center}
#cv-jql-builder-panel .cv-jql-input,#cv-jql-builder-panel .cv-jql-select{width:100%;border:1px solid #334155;background:#0b1220;color:#e2e8f0;border-radius:8px;padding:7px 10px;font-size:12px}
#cv-jql-builder-panel .cv-jql-btn{border:1px solid #334155;background:#111827;color:#e2e8f0;border-radius:8px;padding:7px 11px;font-size:12px;font-weight:700;cursor:pointer}
#cv-jql-builder-panel .cv-jql-btn.primary{background:#1d4ed8;border-color:#2563eb}
#cv-jql-builder-panel .cv-jql-clause-list{display:flex;flex-direction:column;gap:6px;max-height:170px;overflow:auto;padding-right:2px}
#cv-jql-builder-panel .cv-jql-clause{display:flex;justify-content:space-between;gap:8px;padding:8px;border:1px solid #334155;background:#0b1220;border-radius:8px;font-size:12px}
#cv-jql-builder-panel .cv-jql-reference{flex:0 0 360px;min-width:280px;border:1px solid #334155;background:#0b1220;border-radius:10px;padding:10px;overflow:auto}
#cv-jql-builder-panel .cv-jql-ref-title{font-size:12px;font-weight:800;color:#c7d2fe;margin:2px 0 6px}
#cv-jql-builder-panel .cv-jql-ref-items{display:flex;flex-wrap:wrap;gap:6px}
#cv-jql-builder-panel .cv-jql-ref-chip{border:1px solid #334155;background:#111827;color:#e2e8f0;border-radius:999px;padding:4px 8px;font-size:11px;cursor:pointer}
#cv-jql-builder-panel .cv-jql-textarea{min-height:170px;resize:vertical;border:1px solid #334155;background:#020617;color:#e2e8f0;border-radius:8px;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
#cv-jql-builder-panel .cv-jql-footer{display:flex;justify-content:space-between;gap:8px;padding:10px 16px;border-top:1px solid #334155;background:#0b1324}
#cv-jql-builder-panel .cv-jql-inline{display:flex;gap:8px;align-items:center}
@media (max-width:980px){
  #cv-jql-builder-panel{right:8px;left:8px;bottom:8px;width:auto;max-height:96vh}
  #cv-jql-builder-panel .cv-jql-body{flex-direction:column}
  #cv-jql-builder-panel .cv-jql-reference{flex:0 0 auto;width:100%}
}
"#;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Preset {
    id: String,
    label: String,
    jql: String,
    builtin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VisualClause {
    field: String,
    operator: String,
    value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JqlPanelState {
    active_tab: String,
    selected_preset_ids: Vec<String>,
    custom_presets: Vec<Preset>,
    recent_queries: Vec<String>,
    visual_clauses: Vec<VisualClause>,
    run_search: bool,
    query_text: String,
}

impl Default for JqlPanelState {
    fn default() -> Self {
        Self {
            active_tab: "quick".to_string(),
            selected_preset_ids: Vec::new(),
            custom_presets: Vec::new(),
            recent_queries: Vec::new(),
            visual_clauses: Vec::new(),
            run_search: true,
            query_text: String::new(),
        }
    }
}

fn builtin_presets() -> Vec<Preset> {
    vec![
        Preset { id: "my-active-work".to_string(), label: "My Active Work".to_string(), jql: r#"assignee = currentUser() AND status in ("In Progress", "Work in progress", "Waiting for support", "Waiting for customer", "Approved", "AP In Progress", "In Development", "In Review") ORDER BY updated DESC, priority DESC"#.to_string(), builtin: true },
        Preset { id: "my-open".to_string(), label: "My Open Issues".to_string(), jql: "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC".to_string(), builtin: true },
        Preset { id: "overdue".to_string(), label: "Overdue".to_string(), jql: "due < now() AND resolution = Unresolved ORDER BY due ASC".to_string(), builtin: true },
        Preset { id: "high-priority".to_string(), label: "High Priority".to_string(), jql: "priority in (Highest, High) AND resolution = Unresolved ORDER BY priority DESC".to_string(), builtin: true },
        Preset { id: "recently-updated".to_string(), label: "Recently Updated".to_string(), jql: "updated >= -1d ORDER BY updated DESC".to_string(), builtin: true },
        Preset { id: "created-by-me".to_string(), label: "Created by Me".to_string(), jql: "reporter = currentUser() ORDER BY created DESC".to_string(), builtin: true },
        Preset { id: "unassigned".to_string(), label: "Unassigned".to_string(), jql: "assignee IS EMPTY AND resolution = Unresolved ORDER BY created DESC".to_string(), builtin: true },
        Preset { id: "current-sprint".to_string(), label: "Current Sprint".to_string(), jql: "sprint in openSprints() ORDER BY priority DESC".to_string(), builtin: true },
    ]
}

fn defaults_from_legacy(
    custom: Option<Value>,
    _pinned: Option<Value>,
    recent: Option<Value>,
    builder_state: Option<Value>,
) -> JqlPanelState {
    let mut state = JqlPanelState::default();
    if let Some(list) = custom.and_then(|v| serde_json::from_value::<Vec<Preset>>(v).ok()) {
        state.custom_presets = list
            .into_iter()
            .map(|mut preset| {
                preset.builtin = false;
                preset
            })
            .collect();
    }
    if let Some(items) = recent.and_then(|v| serde_json::from_value::<Vec<String>>(v).ok()) {
        state.recent_queries = items;
    }
    if let Some(query) = builder_state
        .as_ref()
        .and_then(|state| state.get("advancedQuery"))
        .and_then(Value::as_str)
    {
        state.query_text = query.to_string();
        state.active_tab = "advanced".to_string();
    }
    state
}

fn load_state() -> Result<StateEnvelope<JqlPanelState>, WasmRuntimeError> {
    if let Some(state) =
        crate::menu_state::get_json::<StateEnvelope<JqlPanelState>>(JIRA_STATE_KEY)?
    {
        return Ok(state);
    }
    if let Some(migrated) = migrate_legacy_jira(defaults_from_legacy)? {
        let saved = set_envelope(JIRA_STATE_KEY, "jira", migrated)?;
        return Ok(saved);
    }
    let mut envelope = StateEnvelope::new(1, JqlPanelState::default());
    normalize_tabs(&mut envelope.payload);
    Ok(envelope)
}

fn save_state(
    envelope: StateEnvelope<JqlPanelState>,
) -> Result<StateEnvelope<JqlPanelState>, WasmRuntimeError> {
    let mut envelope = envelope;
    normalize_tabs(&mut envelope.payload);
    set_envelope(JIRA_STATE_KEY, "jira", envelope)
}

fn normalize_tabs(state: &mut JqlPanelState) {
    let mut tabs = PanelTabs::new(vec!["quick", "visual", "advanced"], "quick");
    tabs.set_active(&state.active_tab);
    state.active_tab = tabs.active().to_string();
}

fn ensure_advanced_mode(doc: &web_sys::Document) {
    if dom::query_selector(ADVANCED_INPUT).ok().flatten().is_some() {
        return;
    }
    let candidates = doc.query_selector_all("a,button");
    let Ok(nodes) = candidates else { return };
    for i in 0..nodes.length() {
        let Some(node) = nodes.item(i) else { continue };
        let Ok(el) = node.dyn_into::<web_sys::Element>() else {
            continue;
        };
        let text = el.text_content().unwrap_or_default().to_lowercase();
        if text.split_whitespace().collect::<Vec<_>>().join(" ") == "advanced" {
            if let Ok(html) = el.dyn_into::<web_sys::HtmlElement>() {
                html.click();
                break;
            }
        }
    }
}

fn apply_jql(query: &str) -> Result<(), WasmRuntimeError> {
    dom::type_selector(ADVANCED_INPUT, query)
}

fn apply_and_search(query: &str) -> Result<(), WasmRuntimeError> {
    apply_jql(query)?;
    if dom::query_selector(SEARCH_BTN)?.is_some() {
        dom::click_selector(SEARCH_BTN)?;
    }
    Ok(())
}

fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn references_html() -> String {
    let fields = [
        "assignee",
        "status",
        "priority",
        "project",
        "issuetype",
        "created",
        "updated",
        "due",
        "resolution",
        "labels",
        "text",
    ];
    let operators = [
        "=",
        "!=",
        ">",
        ">=",
        "<",
        "<=",
        "~",
        "!~",
        "IN ()",
        "NOT IN ()",
        "IS EMPTY",
        "IS NOT EMPTY",
    ];
    let functions = [
        "currentUser()",
        "now()",
        "startOfDay()",
        "startOfWeek()",
        "startOfMonth()",
        "endOfWeek()",
        "openSprints()",
        "issueHistory()",
    ];
    let keywords = [
        "AND", "OR", "NOT", "ORDER BY", "ASC", "DESC", "FROM", "TO", "BY", "AFTER", "BEFORE", "ON",
        "DURING",
    ];
    let to_chips = |items: &[&str]| -> String {
        items
            .iter()
            .map(|item| {
                format!(
                    r#"<button class="cv-jql-ref-chip" data-cv-ref="{}">{}</button>"#,
                    html_escape(item),
                    html_escape(item)
                )
            })
            .collect::<Vec<_>>()
            .join("")
    };
    format!(
        r#"<div class="cv-jql-ref-title">Fields</div><div class="cv-jql-ref-items">{}</div>
<div class="cv-jql-ref-title">Operators</div><div class="cv-jql-ref-items">{}</div>
<div class="cv-jql-ref-title">Functions</div><div class="cv-jql-ref-items">{}</div>
<div class="cv-jql-ref-title">Keywords</div><div class="cv-jql-ref-items">{}</div>"#,
        to_chips(&fields),
        to_chips(&operators),
        to_chips(&functions),
        to_chips(&keywords)
    )
}

fn panel_html(state: &JqlPanelState) -> String {
    let mut presets = builtin_presets();
    presets.extend(state.custom_presets.clone());
    let presets_html = presets
        .iter()
        .map(|preset| {
            let selected = if state.selected_preset_ids.contains(&preset.id) {
                " selected"
            } else {
                ""
            };
            format!(
                r#"<button class="cv-jql-preset{}" data-cv-preset-id="{}" title="{}">{}</button>"#,
                selected,
                html_escape(&preset.id),
                html_escape(&preset.jql),
                html_escape(&preset.label)
            )
        })
        .collect::<Vec<_>>()
        .join("");

    let clauses_html = state
        .visual_clauses
        .iter()
        .enumerate()
        .map(|(index, clause)| {
            format!(
                r#"<div class="cv-jql-clause">
<span>{} {} {}</span>
<button class="cv-jql-btn" data-cv-remove-clause="{}">Remove</button>
</div>"#,
                html_escape(&clause.field),
                html_escape(&clause.operator),
                html_escape(&clause.value),
                index
            )
        })
        .collect::<Vec<_>>()
        .join("");

    let quick_active = if state.active_tab == "quick" {
        " active"
    } else {
        ""
    };
    let visual_active = if state.active_tab == "visual" {
        " active"
    } else {
        ""
    };
    let advanced_active = if state.active_tab == "advanced" {
        " active"
    } else {
        ""
    };

    format!(
        r#"<div class="cv-jql-header">
  <div><div class="cv-jql-title">JQL Builder V2</div><div class="cv-jql-sub">Quick, Visual, and Advanced query workflows</div></div>
  <button class="cv-jql-close" title="Close">✕</button>
</div>
<div class="cv-jql-tabs">
  <button class="cv-jql-tab{quick_active}" data-cv-tab="quick">Quick</button>
  <button class="cv-jql-tab{visual_active}" data-cv-tab="visual">Visual</button>
  <button class="cv-jql-tab{advanced_active}" data-cv-tab="advanced">Advanced</button>
</div>
<div class="cv-jql-body">
  <div class="cv-jql-main">
    <section class="cv-jql-panel{quick_active}" data-cv-panel="quick">
      <div class="cv-jql-note">Preset combinations: select one or more and they are combined with <code>AND</code>.</div>
      <div class="cv-jql-presets">{presets_html}</div>
      <div class="cv-jql-row">
        <input class="cv-jql-input" placeholder="Custom preset label" data-cv-custom-label />
        <button class="cv-jql-btn" data-cv-action="save-preset">Save Current as Preset</button>
      </div>
      <div class="cv-jql-note">Recent queries are kept locally and synced through extension storage mirror.</div>
    </section>
    <section class="cv-jql-panel{visual_active}" data-cv-panel="visual">
      <div class="cv-jql-row">
        <select class="cv-jql-select" data-cv-field>
          <option value="assignee">Assignee</option><option value="status">Status</option><option value="priority">Priority</option>
          <option value="project">Project</option><option value="issuetype">Issue Type</option><option value="created">Created</option>
          <option value="updated">Updated</option><option value="due">Due</option><option value="resolution">Resolution</option>
          <option value="labels">Labels</option><option value="text">Text</option>
        </select>
        <select class="cv-jql-select" data-cv-operator>
          <option value="=">=</option><option value="!=">!=</option><option value="~">~</option><option value="!~">!~</option>
          <option value="IN">IN</option><option value="NOT IN">NOT IN</option><option value=">">></option><option value="<"><</option>
          <option value=">=">>=</option><option value="<="><=</option>
        </select>
        <input class="cv-jql-input" placeholder="Value" data-cv-value />
        <button class="cv-jql-btn" data-cv-action="add-clause">Add Clause</button>
      </div>
      <div class="cv-jql-clause-list">{clauses_html}</div>
    </section>
    <section class="cv-jql-panel{advanced_active}" data-cv-panel="advanced">
      <textarea class="cv-jql-textarea" spellcheck="false" data-cv-textarea placeholder="Write raw JQL here...">{}</textarea>
    </section>
  </div>
  <aside class="cv-jql-reference">{}</aside>
</div>
<div class="cv-jql-footer">
  <div class="cv-jql-inline">
    <label class="cv-jql-note"><input type="checkbox" data-cv-run-search {} /> Run search after apply</label>
  </div>
  <div class="cv-jql-inline">
    <button class="cv-jql-btn" data-cv-action="sync-from-page">Load From Jira</button>
    <button class="cv-jql-btn primary" data-cv-action="apply">Apply Query</button>
  </div>
</div>"#,
        html_escape(&state.query_text),
        references_html(),
        if state.run_search { "checked" } else { "" },
    )
}

fn compose_query_from_presets(selected_ids: &[String], custom: &[Preset]) -> String {
    let mut pool = builtin_presets();
    pool.extend(custom.to_vec());
    let selected = pool
        .iter()
        .filter(|preset| selected_ids.contains(&preset.id))
        .map(|preset| format!("({})", preset.jql.trim()))
        .collect::<Vec<_>>();
    selected.join(" AND ")
}

fn compose_query_from_visual(clauses: &[VisualClause]) -> String {
    clauses
        .iter()
        .filter(|clause| !clause.field.trim().is_empty() && !clause.value.trim().is_empty())
        .map(|clause| {
            let value = if clause.operator.contains("IN") {
                format!("({})", clause.value)
            } else {
                clause.value.clone()
            };
            format!("{} {} {}", clause.field, clause.operator, value)
        })
        .collect::<Vec<_>>()
        .join(" AND ")
}

fn bind_events(panel: &web_sys::HtmlElement) -> Result<(), WasmRuntimeError> {
    let click_panel = panel.clone();
    let click_handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |event: web_sys::Event| {
            let Some(target) = event.target() else { return };
            let Ok(target) = target.dyn_into::<web_sys::Element>() else {
                return;
            };

            if target
                .get_attribute("class")
                .map(|class| class.split_whitespace().any(|item| item == "cv-jql-close"))
                .unwrap_or(false)
            {
                let _ = dom_inject::remove_element(PANEL_ID);
                return;
            }

            let mut envelope = match load_state() {
                Ok(envelope) => envelope,
                Err(_) => StateEnvelope::new(1, JqlPanelState::default()),
            };

            if let Some(tab) = target.get_attribute("data-cv-tab") {
                envelope.payload.active_tab = tab;
                if let Ok(saved) = save_state(envelope) {
                    click_panel.set_inner_html(&panel_html(&saved.payload));
                    let _ = bind_events(&click_panel);
                }
                return;
            }

            if let Some(preset_id) = target.get_attribute("data-cv-preset-id") {
                if envelope.payload.selected_preset_ids.contains(&preset_id) {
                    envelope
                        .payload
                        .selected_preset_ids
                        .retain(|id| id != &preset_id);
                } else {
                    envelope.payload.selected_preset_ids.push(preset_id);
                }
                envelope.payload.active_tab = "quick".to_string();
                envelope.payload.query_text = compose_query_from_presets(
                    &envelope.payload.selected_preset_ids,
                    &envelope.payload.custom_presets,
                );
                if let Ok(saved) = save_state(envelope) {
                    click_panel.set_inner_html(&panel_html(&saved.payload));
                    let _ = bind_events(&click_panel);
                }
                return;
            }

            if let Some(index_text) = target.get_attribute("data-cv-remove-clause") {
                if let Ok(index) = index_text.parse::<usize>() {
                    if index < envelope.payload.visual_clauses.len() {
                        envelope.payload.visual_clauses.remove(index);
                        envelope.payload.query_text =
                            compose_query_from_visual(&envelope.payload.visual_clauses);
                        if let Ok(saved) = save_state(envelope) {
                            click_panel.set_inner_html(&panel_html(&saved.payload));
                            let _ = bind_events(&click_panel);
                        }
                    }
                }
                return;
            }

            if let Some(reference) = target.get_attribute("data-cv-ref") {
                if let Ok(Some(textarea_el)) = click_panel.query_selector("[data-cv-textarea]") {
                    if let Ok(textarea) = textarea_el.dyn_into::<web_sys::HtmlTextAreaElement>() {
                        let cursor = textarea
                            .selection_start()
                            .ok()
                            .flatten()
                            .unwrap_or(textarea.value().len() as u32)
                            as usize;
                        let mut value = textarea.value();
                        let insert = if reference.ends_with("()") || reference.ends_with(')') {
                            format!("{reference} ")
                        } else {
                            format!(" {reference} ")
                        };
                        if cursor <= value.len() {
                            value.insert_str(cursor, &insert);
                            textarea.set_value(&value);
                        }
                    }
                }
                return;
            }

            let Some(action) = target.get_attribute("data-cv-action") else {
                return;
            };
            match action.as_str() {
                "add-clause" => {
                    let field = click_panel
                        .query_selector("[data-cv-field]")
                        .ok()
                        .flatten()
                        .and_then(|el| el.dyn_into::<web_sys::HtmlSelectElement>().ok())
                        .map(|el| el.value())
                        .unwrap_or_else(|| "assignee".to_string());
                    let operator = click_panel
                        .query_selector("[data-cv-operator]")
                        .ok()
                        .flatten()
                        .and_then(|el| el.dyn_into::<web_sys::HtmlSelectElement>().ok())
                        .map(|el| el.value())
                        .unwrap_or_else(|| "=".to_string());
                    let value = click_panel
                        .query_selector("[data-cv-value]")
                        .ok()
                        .flatten()
                        .and_then(|el| el.dyn_into::<web_sys::HtmlInputElement>().ok())
                        .map(|el| el.value())
                        .unwrap_or_default();
                    if !value.trim().is_empty() {
                        envelope.payload.visual_clauses.push(VisualClause {
                            field,
                            operator,
                            value,
                        });
                        envelope.payload.active_tab = "visual".to_string();
                        envelope.payload.query_text =
                            compose_query_from_visual(&envelope.payload.visual_clauses);
                        if let Ok(saved) = save_state(envelope) {
                            click_panel.set_inner_html(&panel_html(&saved.payload));
                            let _ = bind_events(&click_panel);
                        }
                    }
                }
                "save-preset" => {
                    let label = click_panel
                        .query_selector("[data-cv-custom-label]")
                        .ok()
                        .flatten()
                        .and_then(|el| el.dyn_into::<web_sys::HtmlInputElement>().ok())
                        .map(|el| el.value())
                        .unwrap_or_default();
                    if !label.trim().is_empty() {
                        let query = click_panel
                            .query_selector("[data-cv-textarea]")
                            .ok()
                            .flatten()
                            .and_then(|el| el.dyn_into::<web_sys::HtmlTextAreaElement>().ok())
                            .map(|el| el.value())
                            .unwrap_or_else(|| envelope.payload.query_text.clone());
                        if !query.trim().is_empty() {
                            envelope.payload.custom_presets.push(Preset {
                                id: format!("custom-{}", js_sys::Date::now() as u64),
                                label,
                                jql: query,
                                builtin: false,
                            });
                            if let Ok(saved) = save_state(envelope) {
                                click_panel.set_inner_html(&panel_html(&saved.payload));
                                let _ = bind_events(&click_panel);
                            }
                        }
                    }
                }
                "sync-from-page" => {
                    let current = dom::element_value(ADVANCED_INPUT)
                        .ok()
                        .flatten()
                        .unwrap_or_default();
                    envelope.payload.query_text = current;
                    envelope.payload.active_tab = "advanced".to_string();
                    if let Ok(saved) = save_state(envelope) {
                        click_panel.set_inner_html(&panel_html(&saved.payload));
                        let _ = bind_events(&click_panel);
                    }
                }
                "apply" => {
                    let query = click_panel
                        .query_selector("[data-cv-textarea]")
                        .ok()
                        .flatten()
                        .and_then(|el| el.dyn_into::<web_sys::HtmlTextAreaElement>().ok())
                        .map(|el| el.value())
                        .unwrap_or_else(|| envelope.payload.query_text.clone());
                    if query.trim().is_empty() {
                        return;
                    }
                    envelope.payload.query_text = query.trim().to_string();
                    envelope.payload.run_search = click_panel
                        .query_selector("[data-cv-run-search]")
                        .ok()
                        .flatten()
                        .and_then(|el| el.dyn_into::<web_sys::HtmlInputElement>().ok())
                        .map(|el| el.checked())
                        .unwrap_or(true);
                    if !envelope
                        .payload
                        .recent_queries
                        .contains(&envelope.payload.query_text)
                    {
                        envelope
                            .payload
                            .recent_queries
                            .insert(0, envelope.payload.query_text.clone());
                        envelope.payload.recent_queries.truncate(20);
                    }
                    let _ = save_state(envelope.clone());
                    if envelope.payload.run_search {
                        let _ = apply_and_search(&envelope.payload.query_text);
                    } else {
                        let _ = apply_jql(&envelope.payload.query_text);
                    }
                }
                _ => {}
            }
        }));

    panel
        .add_event_listener_with_callback("click", click_handler.as_ref().unchecked_ref())
        .ok();
    click_handler.forget();

    Ok(())
}

fn create_or_refresh_panel() -> Result<(), WasmRuntimeError> {
    let doc = web_sys::window()
        .ok_or_else(|| WasmRuntimeError::from("window unavailable"))?
        .document()
        .ok_or_else(|| WasmRuntimeError::from("document unavailable"))?;
    ensure_advanced_mode(&doc);
    dom_inject::inject_style(STYLE_ID, PANEL_CSS)?;

    let mut envelope = load_state()?;
    if envelope.payload.query_text.trim().is_empty() {
        envelope.payload.query_text = dom::element_value(ADVANCED_INPUT)?.unwrap_or_default();
    }
    let saved = save_state(envelope)?;
    let html = panel_html(&saved.payload);
    let panel = dom_inject::inject_or_update_banner(PANEL_ID, "", &html)?;
    bind_events(&panel)?;
    Ok(())
}

pub fn open_panel(_doc: &web_sys::Document) -> Result<Value, WasmRuntimeError> {
    create_or_refresh_panel()?;
    Ok(json!({
        "command": "jira.open_jql_builder",
        "installed": true,
        "panelVisible": true,
        "detail": "JQL builder panel opened"
    }))
}

pub fn install(_doc: &web_sys::Document) -> Result<Value, WasmRuntimeError> {
    // Extension-launch only: no in-page floating launchers or switcher button injection.
    Ok(json!({
        "command": "jira.install_jql_builder",
        "installed": true,
        "buttonInstalled": false,
        "panelAvailable": true,
        "detail": "JQL builder hooks ready (extension launch only)"
    }))
}

pub fn store_capture_table(
    columns: &[String],
    rows: &[Vec<String>],
) -> Result<(), WasmRuntimeError> {
    let Some(window) = web_sys::window() else {
        return Ok(());
    };
    let Some(storage) = window
        .local_storage()
        .map_err(|_| WasmRuntimeError::from("localStorage access failed"))?
    else {
        return Ok(());
    };

    let dataset = TableDataset::new(columns.to_vec(), rows.to_vec());
    let payload = json!({
        "generatedAtMs": js_sys::Date::now() as u64,
        "dataset": dataset,
    });
    let raw = serde_json::to_string(&payload).map_err(|err| {
        WasmRuntimeError::from(format!("serialize jira capture table failed: {err}"))
    })?;
    storage
        .set_item(LAST_CAPTURE_TABLE_KEY, &raw)
        .map_err(|_| WasmRuntimeError::from("failed to persist jira capture table"))?;
    Ok(())
}
