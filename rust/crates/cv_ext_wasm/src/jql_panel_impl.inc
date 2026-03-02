use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use wasm_bindgen::{closure::Closure, JsCast};

use cv_ext_ui_components::table_model::TableDataset;

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
#cv-jql-builder-panel{position:fixed;top:80px;right:24px;width:min(720px,calc(100vw - 48px));max-height:calc(100vh - 120px);z-index:2147483647}
#cv-jql-builder-panel *{box-sizing:border-box}
#cv-jql-builder-panel .cv-panel{--cv-primary:#6366f1;--cv-primary-light:#818cf8;--cv-primary-dark:#4f46e5;--cv-success:#10b981;--cv-danger:#ef4444;--cv-bg:#fff;--cv-bg-secondary:#f8fafc;--cv-border:#e2e8f0;--cv-text:#1e293b;--cv-text-muted:#64748b;--cv-text-light:#94a3b8;--cv-shadow:0 4px 6px -1px rgb(0 0 0 /.1),0 2px 4px -2px rgb(0 0 0 /.1);--cv-shadow-lg:0 10px 15px -3px rgb(0 0 0 /.1),0 4px 6px -4px rgb(0 0 0 /.1);--cv-radius:12px;--cv-radius-sm:8px;--cv-radius-md:10px;--cv-transition:150ms ease;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:14px;color:var(--cv-text);background:var(--cv-bg);border-radius:var(--cv-radius);box-shadow:var(--cv-shadow-lg);border:1px solid var(--cv-border);display:flex;flex-direction:column;overflow:hidden;max-height:calc(100vh - 120px)}
#cv-jql-builder-panel .cv-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--cv-border);background:linear-gradient(135deg,var(--cv-bg) 0%,var(--cv-bg-secondary) 100%);cursor:grab}
#cv-jql-builder-panel .cv-header:active{cursor:grabbing}
#cv-jql-builder-panel .cv-header-title{display:flex;align-items:center;gap:10px}
#cv-jql-builder-panel .cv-header-title h1{margin:0;font-size:18px;font-weight:600;color:var(--cv-text)}
#cv-jql-builder-panel .cv-badge{background:var(--cv-primary);color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500}
#cv-jql-builder-panel .cv-header-actions{display:flex;gap:8px}
#cv-jql-builder-panel .cv-mode-tabs{display:flex;gap:4px;padding:12px 20px;background:var(--cv-bg-secondary);border-bottom:1px solid var(--cv-border)}
#cv-jql-builder-panel .cv-mode-tab{padding:8px 16px;border:none;background:transparent;color:var(--cv-text-muted);font-size:13px;font-weight:500;border-radius:var(--cv-radius-sm);cursor:pointer;transition:all var(--cv-transition)}
#cv-jql-builder-panel .cv-mode-tab:hover{background:var(--cv-bg);color:var(--cv-text)}
#cv-jql-builder-panel .cv-mode-tab.active{background:var(--cv-bg);color:var(--cv-primary);box-shadow:var(--cv-shadow)}
#cv-jql-builder-panel .cv-body{flex:1;overflow-y:auto;padding:20px}
#cv-jql-builder-panel .cv-section{margin-bottom:24px}
#cv-jql-builder-panel .cv-section-title{display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;font-weight:600;color:var(--cv-text-muted);text-transform:uppercase;letter-spacing:.05em}
#cv-jql-builder-panel .cv-presets-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
#cv-jql-builder-panel .cv-preset-btn{display:flex;flex-direction:row;align-items:center;gap:4px;padding:12px;border:1px solid var(--cv-border);background:var(--cv-bg);border-radius:var(--cv-radius-sm);cursor:pointer;transition:all var(--cv-transition);text-align:left}
#cv-jql-builder-panel .cv-preset-btn:hover{border-color:var(--cv-primary-light);background:var(--cv-bg-secondary);transform:translateY(-1px);box-shadow:var(--cv-shadow)}
#cv-jql-builder-panel .cv-preset-btn.selected{border-color:var(--cv-primary);background:rgba(99,102,241,.05)}
#cv-jql-builder-panel .cv-preset-content{display:flex;flex-direction:column;gap:2px;flex:1}
#cv-jql-builder-panel .cv-preset-label{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:var(--cv-text)}
#cv-jql-builder-panel .cv-preset-emoji{font-size:16px}
#cv-jql-builder-panel .cv-preset-desc{font-size:11px;color:var(--cv-text-light)}
#cv-jql-builder-panel .cv-preset-check{display:none;width:18px;height:18px;align-items:center;justify-content:center;background:var(--cv-primary);color:#fff;border-radius:50%;font-size:10px;margin-left:auto}
#cv-jql-builder-panel .cv-preset-btn.selected .cv-preset-check{display:inline-flex}
#cv-jql-builder-panel .cv-quick-search-input{width:100%;padding:16px 20px;border:2px solid var(--cv-border);border-radius:var(--cv-radius);font-size:16px;color:var(--cv-text);transition:all var(--cv-transition)}
#cv-jql-builder-panel .cv-quick-search-input:focus{outline:none;border-color:var(--cv-primary);box-shadow:0 0 0 4px rgba(99,102,241,.1)}
#cv-jql-builder-panel .cv-quick-search-hint{margin-top:12px;font-size:13px;color:var(--cv-text-muted)}
#cv-jql-builder-panel .cv-quick-search-examples{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
#cv-jql-builder-panel .cv-quick-example{padding:8px 14px;border:1px solid var(--cv-border);background:var(--cv-bg);border-radius:999px;font-size:13px;color:var(--cv-text);cursor:pointer;transition:all var(--cv-transition)}
#cv-jql-builder-panel .cv-quick-example:hover{border-color:var(--cv-primary-light);background:var(--cv-bg-secondary)}
#cv-jql-builder-panel .cv-filters{display:flex;flex-direction:column;gap:16px}
#cv-jql-builder-panel .cv-filter-card{display:flex;flex-direction:column;background:var(--cv-bg-secondary);border:1px solid var(--cv-border);border-radius:var(--cv-radius-md);overflow:hidden;transition:all var(--cv-transition);box-shadow:0 1px 3px rgba(0,0,0,.04)}
#cv-jql-builder-panel .cv-filter-card:hover{border-color:var(--cv-primary-light);box-shadow:0 2px 8px rgba(99,102,241,.08)}
#cv-jql-builder-panel .cv-filter-header{display:flex;align-items:center;gap:12px;padding:14px 16px;background:linear-gradient(to right,rgba(99,102,241,.03),transparent);border-bottom:1px solid var(--cv-border)}
#cv-jql-builder-panel .cv-filter-field{display:flex;align-items:center;gap:10px;min-width:0;flex:0 0 auto}
#cv-jql-builder-panel .cv-filter-field-emoji{font-size:20px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:var(--cv-bg);border-radius:var(--cv-radius-sm);flex-shrink:0}
#cv-jql-builder-panel .cv-filter-field-btn{border:1px solid var(--cv-border);background:var(--cv-bg);font-size:14px;font-weight:600;color:var(--cv-text);cursor:pointer;padding:8px 12px;border-radius:var(--cv-radius-sm);display:inline-flex;align-items:center;gap:8px;max-width:200px}
#cv-jql-builder-panel .cv-filter-operator select,#cv-jql-builder-panel .cv-filter-value input,#cv-jql-builder-panel .cv-filter-value select,#cv-jql-builder-panel .cv-sort-section select,#cv-jql-builder-panel .cv-advanced-search{width:100%;border:1px solid var(--cv-border);background:var(--cv-bg);padding:10px 14px;border-radius:var(--cv-radius-sm);font-size:14px;color:var(--cv-text)}
#cv-jql-builder-panel .cv-filter-operator select{padding:8px 12px;min-width:100px;color:var(--cv-primary)}
#cv-jql-builder-panel .cv-filter-value{flex:1;display:flex;flex-direction:column;gap:10px;padding:14px 16px;min-width:0}
#cv-jql-builder-panel .cv-filter-actions{display:flex;gap:4px;margin-left:auto;flex-shrink:0}
#cv-jql-builder-panel .cv-icon-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid transparent;background:transparent;color:var(--cv-text-light);border-radius:var(--cv-radius-sm);cursor:pointer}
#cv-jql-builder-panel .cv-icon-btn:hover{background:var(--cv-bg);border-color:var(--cv-border);color:var(--cv-text)}
#cv-jql-builder-panel .cv-icon-btn.danger:hover{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3);color:var(--cv-danger)}
#cv-jql-builder-panel .cv-add-filter{display:flex;align-items:center;justify-content:center;gap:10px;padding:16px;border:2px dashed var(--cv-border);background:linear-gradient(135deg,rgba(99,102,241,.02),rgba(99,102,241,.04));border-radius:var(--cv-radius-md);color:var(--cv-text-muted);font-size:14px;font-weight:600;cursor:pointer}
#cv-jql-builder-panel .cv-add-filter:hover{border-color:var(--cv-primary);color:var(--cv-primary)}
#cv-jql-builder-panel .cv-empty-state{text-align:center;padding:40px 20px;color:var(--cv-text-muted)}
#cv-jql-builder-panel .cv-empty-state-icon{font-size:48px;margin-bottom:16px}
#cv-jql-builder-panel .cv-empty-state-title{font-size:16px;font-weight:600;margin-bottom:8px;color:var(--cv-text)}
#cv-jql-builder-panel .cv-sort-section{display:flex;flex-direction:column;gap:8px;padding:12px 16px;background:var(--cv-bg-secondary);border:1px solid var(--cv-border);border-radius:var(--cv-radius-sm)}
#cv-jql-builder-panel .cv-sort-row{display:flex;align-items:center;gap:8px}
#cv-jql-builder-panel .cv-sort-label{font-size:13px;color:var(--cv-text-muted);white-space:nowrap;min-width:55px}
#cv-jql-builder-panel .cv-secondary-btn,#cv-jql-builder-panel .cv-pill-btn,#cv-jql-builder-panel .cv-copy-btn,#cv-jql-builder-panel .cv-btn,#cv-jql-builder-panel .cv-ref-tab,#cv-jql-builder-panel .cv-ref-item{cursor:pointer;transition:all .15s ease}
#cv-jql-builder-panel .cv-secondary-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid var(--cv-border);background:var(--cv-bg);border-radius:8px;font-size:13px;font-weight:500;color:var(--cv-text-muted)}
#cv-jql-builder-panel .cv-pill-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid var(--cv-border);background:var(--cv-bg);border-radius:999px;font-size:12px;font-weight:500;color:var(--cv-text-muted)}
#cv-jql-builder-panel .cv-date-presets{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
#cv-jql-builder-panel .cv-date-preset{padding:4px 10px;border:1px solid var(--cv-border);background:var(--cv-bg);border-radius:999px;font-size:11px;color:var(--cv-text-muted);cursor:pointer}
#cv-jql-builder-panel .cv-suggestions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--cv-border)}
#cv-jql-builder-panel .cv-suggestion{padding:6px 12px;border:1px solid var(--cv-border);background:var(--cv-bg);border-radius:999px;font-size:12px;font-weight:500;color:var(--cv-text-muted);cursor:pointer}
#cv-jql-builder-panel .cv-advanced-ref{background:var(--cv-bg-secondary);border:1px solid var(--cv-border);border-radius:var(--cv-radius-md);overflow:hidden}
#cv-jql-builder-panel .cv-advanced-search-wrap{padding:12px;border-bottom:1px solid var(--cv-border);background:var(--cv-bg)}
#cv-jql-builder-panel .cv-ref-tabs{display:flex;border-bottom:1px solid var(--cv-border);padding:8px;gap:4px;flex-wrap:wrap}
#cv-jql-builder-panel .cv-ref-tab{padding:6px 12px;border:1px solid var(--cv-border);background:var(--cv-bg);border-radius:999px;font-size:12px}
#cv-jql-builder-panel .cv-ref-tab.active{background:var(--cv-primary);border-color:var(--cv-primary);color:#fff}
#cv-jql-builder-panel .cv-ref-content{padding:12px;max-height:260px;overflow-y:auto}
#cv-jql-builder-panel .cv-ref-items{display:flex;flex-wrap:wrap;gap:6px}
#cv-jql-builder-panel .cv-ref-item{padding:4px 10px;border:1px solid var(--cv-border);background:var(--cv-bg-secondary);border-radius:var(--cv-radius-sm);font-size:12px;font-family:"JetBrains Mono","Fira Code",monospace}
#cv-jql-builder-panel .cv-footer{padding:16px 20px;border-top:1px solid var(--cv-border);background:var(--cv-bg-secondary)}
#cv-jql-builder-panel .cv-preview-section{margin-bottom:12px}
#cv-jql-builder-panel .cv-preview-label{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
#cv-jql-builder-panel .cv-preview-label span{font-size:12px;font-weight:500;color:var(--cv-text-muted);text-transform:uppercase;letter-spacing:.05em}
#cv-jql-builder-panel .cv-preview{width:100%;min-height:60px;padding:12px;border:1px solid var(--cv-border);background:var(--cv-bg);border-radius:var(--cv-radius-sm);font-family:"JetBrains Mono","Fira Code",monospace;font-size:12px;color:var(--cv-text);resize:vertical}
#cv-jql-builder-panel .cv-copy-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--cv-border);background:var(--cv-bg);border-radius:6px;font-size:12px;font-weight:500;color:var(--cv-text-muted)}
#cv-jql-builder-panel .cv-copy-btn.copied{border-color:var(--cv-success);background:rgba(34,197,94,.1);color:var(--cv-success)}
#cv-jql-builder-panel .cv-footer-actions{display:flex;justify-content:flex-end;gap:8px}
#cv-jql-builder-panel .cv-btn{padding:10px 20px;border:1px solid var(--cv-border);background:var(--cv-bg);border-radius:var(--cv-radius-sm);font-size:14px;font-weight:500;color:var(--cv-text)}
#cv-jql-builder-panel .cv-btn.primary{background:var(--cv-primary);border-color:var(--cv-primary);color:#fff}
#cv-jql-builder-panel .cv-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(100px);padding:12px 24px;background:var(--cv-text);color:#fff;border-radius:var(--cv-radius-sm);font-size:14px;font-weight:500;box-shadow:var(--cv-shadow-lg);opacity:0;transition:all .3s ease;z-index:2147483647;pointer-events:none}
#cv-jql-builder-panel .cv-toast.show{transform:translateX(-50%) translateY(0);opacity:1}
#cv-jql-builder-panel .cv-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center}
#cv-jql-builder-panel .cv-modal{background:var(--cv-bg);border-radius:12px;padding:20px;max-width:500px;max-height:70vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.3)}
@media (max-width:768px){#cv-jql-builder-panel .cv-filter-header{flex-wrap:wrap;gap:10px}#cv-jql-builder-panel .cv-filter-field{flex:1 1 auto;min-width:140px}}
@media (max-width:640px){#cv-jql-builder-panel{top:0;right:0;left:0;width:100vw;max-height:100vh}#cv-jql-builder-panel .cv-panel{border-radius:0;max-height:100vh}#cv-jql-builder-panel .cv-presets-grid{grid-template-columns:1fr 1fr}}
"#;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Preset {
    id: String,
    label: String,
    emoji: String,
    description: String,
    jql: String,
    category: String,
    is_custom: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VisualFilter {
    id: String,
    field_id: String,
    operator_key: String,
    value: String,
    values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SortEntry {
    field: String,
    direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecentFilter {
    jql: String,
    label: String,
    used_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
struct JqlPanelState {
    mode: String,
    filters: Vec<VisualFilter>,
    sort_field: String,
    sort_direction: String,
    sort_entries: Vec<SortEntry>,
    search_text: String,
    selected_presets: Vec<String>,
    custom_presets: Vec<Preset>,
    pinned_presets: Vec<String>,
    recent_filters: Vec<RecentFilter>,
    advanced_text: String,
    query_text: String,
    run_search: bool,
    dragged_preset_id: Option<String>,
}

impl Default for JqlPanelState {
    fn default() -> Self {
        Self {
            mode: "visual".to_string(),
            filters: Vec::new(),
            sort_field: "updated".to_string(),
            sort_direction: "DESC".to_string(),
            sort_entries: vec![SortEntry {
                field: "updated".to_string(),
                direction: "DESC".to_string(),
            }],
            search_text: String::new(),
            selected_presets: Vec::new(),
            custom_presets: Vec::new(),
            pinned_presets: vec![
                "my-active-work".to_string(),
                "my-open".to_string(),
                "recently-updated".to_string(),
                "overdue".to_string(),
            ],
            recent_filters: Vec::new(),
            advanced_text: String::new(),
            query_text: String::new(),
            run_search: true,
            dragged_preset_id: None,
        }
    }
}

#[derive(Debug, Clone)]
struct FriendlyField {
    id: &'static str,
    label: &'static str,
    emoji: &'static str,
    jql_field: &'static str,
    value_type: &'static str,
    default_operator: &'static str,
}

fn friendly_fields() -> Vec<FriendlyField> {
    vec![
        FriendlyField {
            id: "assignee",
            label: "Assigned to",
            emoji: "👤",
            jql_field: "assignee",
            value_type: "user",
            default_operator: "equals",
        },
        FriendlyField {
            id: "reporter",
            label: "Created by",
            emoji: "✍️",
            jql_field: "reporter",
            value_type: "user",
            default_operator: "equals",
        },
        FriendlyField {
            id: "summary",
            label: "Title contains",
            emoji: "📝",
            jql_field: "summary",
            value_type: "text",
            default_operator: "contains",
        },
        FriendlyField {
            id: "text",
            label: "Anywhere (text)",
            emoji: "🔎",
            jql_field: "text",
            value_type: "text",
            default_operator: "contains",
        },
        FriendlyField {
            id: "status",
            label: "Status",
            emoji: "🚦",
            jql_field: "status",
            value_type: "status",
            default_operator: "equals",
        },
        FriendlyField {
            id: "resolution",
            label: "Resolution",
            emoji: "✅",
            jql_field: "resolution",
            value_type: "status",
            default_operator: "equals",
        },
        FriendlyField {
            id: "priority",
            label: "Priority",
            emoji: "🎯",
            jql_field: "priority",
            value_type: "priority",
            default_operator: "equals",
        },
        FriendlyField {
            id: "project",
            label: "Project",
            emoji: "📁",
            jql_field: "project",
            value_type: "project",
            default_operator: "equals",
        },
        FriendlyField {
            id: "issuetype",
            label: "Type",
            emoji: "📋",
            jql_field: "issuetype",
            value_type: "type",
            default_operator: "equals",
        },
        FriendlyField {
            id: "labels",
            label: "Labels",
            emoji: "🏷️",
            jql_field: "labels",
            value_type: "list",
            default_operator: "in",
        },
        FriendlyField {
            id: "created",
            label: "Created",
            emoji: "📅",
            jql_field: "created",
            value_type: "date",
            default_operator: "greater-than-equals",
        },
        FriendlyField {
            id: "updated",
            label: "Updated",
            emoji: "🔄",
            jql_field: "updated",
            value_type: "date",
            default_operator: "greater-than-equals",
        },
        FriendlyField {
            id: "due",
            label: "Due",
            emoji: "⏰",
            jql_field: "due",
            value_type: "date",
            default_operator: "less-than-equals",
        },
    ]
}

fn operator_defs() -> Vec<(&'static str, &'static str)> {
    vec![
        ("equals", "="),
        ("not-equals", "!="),
        ("greater-than", ">"),
        ("greater-than-equals", ">="),
        ("less-than", "<"),
        ("less-than-equals", "<="),
        ("contains", "~"),
        ("not-contains", "!~"),
        ("in", "IN"),
        ("not-in", "NOT IN"),
        ("is-empty", "IS EMPTY"),
        ("is-not-empty", "IS NOT EMPTY"),
    ]
}

fn sort_fields() -> Vec<(&'static str, &'static str)> {
    vec![
        ("updated", "Last Updated"),
        ("created", "Created Date"),
        ("priority", "Priority"),
        ("due", "Due Date"),
        ("status", "Status"),
        ("key", "Issue Key"),
        ("assignee", "Assignee"),
        ("reporter", "Reporter"),
        ("resolution", "Resolution"),
        ("resolved", "Resolved Date"),
    ]
}

fn quick_examples() -> Vec<&'static str> {
    vec![
        "my open issues",
        "high priority bugs",
        "updated today",
        "unassigned tasks",
        "created this week",
        "overdue issues",
        "blocked items",
        "epic stories",
    ]
}

fn time_items() -> Vec<(&'static str, &'static str)> {
    vec![
        ("-1d", "1 day ago"),
        ("-7d", "1 week ago"),
        ("-30d", "1 month ago"),
        ("+1d", "1 day from now"),
        ("startOfDay()", "Start of today"),
        ("endOfDay()", "End of today"),
        ("startOfWeek()", "Start of this week"),
        ("endOfWeek()", "End of this week"),
        ("startOfMonth()", "Start of this month"),
        ("endOfMonth()", "End of this month"),
        ("startOfYear()", "Start of this year"),
        ("endOfYear()", "End of this year"),
    ]
}

fn date_presets() -> Vec<(&'static str, &'static str)> {
    vec![
        ("Today", "startOfDay()"),
        ("Yesterday", "-1d"),
        ("This week", "startOfWeek()"),
        ("Last 7 days", "-7d"),
        ("This month", "startOfMonth()"),
        ("Last 30 days", "-30d"),
    ]
}

fn builtin_presets() -> Vec<Preset> {
    vec![
        Preset { id: "my-active-work".to_string(), label: "My Active Work".to_string(), emoji: "🚀".to_string(), description: "All issues actively being worked on by you".to_string(), jql: r#"assignee = currentUser() AND status in ("In Progress", "Work in progress", "Waiting for support", "Waiting for customer", "Approved", "AP In Progress", "In Development", "In Review") ORDER BY updated DESC, priority DESC"#.to_string(), category: "personal".to_string(), is_custom: false },
        Preset { id: "my-open".to_string(), label: "My Open Issues".to_string(), emoji: "📋".to_string(), description: "Issues assigned to you that are not done".to_string(), jql: "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC".to_string(), category: "personal".to_string(), is_custom: false },
        Preset { id: "overdue".to_string(), label: "Overdue".to_string(), emoji: "⚠️".to_string(), description: "Past due date and not resolved".to_string(), jql: "due < now() AND resolution = Unresolved ORDER BY due ASC".to_string(), category: "time".to_string(), is_custom: false },
        Preset { id: "due-soon".to_string(), label: "Due in 7 Days".to_string(), emoji: "⏰".to_string(), description: "Issues due in the next 7 days".to_string(), jql: "due >= now() AND due <= 7d ORDER BY due ASC".to_string(), category: "time".to_string(), is_custom: false },
        Preset { id: "high-priority".to_string(), label: "High Priority".to_string(), emoji: "🔥".to_string(), description: "Highest and High priority issues".to_string(), jql: "priority in (Highest, High) AND resolution = Unresolved ORDER BY priority DESC".to_string(), category: "priority".to_string(), is_custom: false },
        Preset { id: "recently-updated".to_string(), label: "Recently Updated".to_string(), emoji: "🔄".to_string(), description: "Updated in the last 24 hours".to_string(), jql: "updated >= -1d ORDER BY updated DESC".to_string(), category: "time".to_string(), is_custom: false },
        Preset { id: "created-by-me".to_string(), label: "Created by Me".to_string(), emoji: "✍️".to_string(), description: "Issues you created".to_string(), jql: "reporter = currentUser() ORDER BY created DESC".to_string(), category: "personal".to_string(), is_custom: false },
        Preset { id: "watching".to_string(), label: "Watching".to_string(), emoji: "👀".to_string(), description: "Issues you are watching".to_string(), jql: "watcher = currentUser() ORDER BY updated DESC".to_string(), category: "personal".to_string(), is_custom: false },
        Preset { id: "unassigned".to_string(), label: "Unassigned".to_string(), emoji: "❓".to_string(), description: "Issues without an assignee".to_string(), jql: "assignee IS EMPTY AND resolution = Unresolved ORDER BY created DESC".to_string(), category: "priority".to_string(), is_custom: false },
        Preset { id: "current-sprint".to_string(), label: "Current Sprint".to_string(), emoji: "🏃".to_string(), description: "Issues in active sprint".to_string(), jql: "sprint in openSprints() ORDER BY priority DESC".to_string(), category: "team".to_string(), is_custom: false },
    ]
}

fn defaults_from_legacy(
    custom: Option<Value>,
    pinned: Option<Value>,
    recent: Option<Value>,
    builder_state: Option<Value>,
) -> JqlPanelState {
    let mut state = JqlPanelState::default();

    if let Some(list) = custom.and_then(|v| serde_json::from_value::<Vec<Value>>(v).ok()) {
        state.custom_presets = list
            .into_iter()
            .map(|raw| Preset {
                id: raw
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                label: raw
                    .get("label")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                emoji: raw
                    .get("emoji")
                    .and_then(Value::as_str)
                    .unwrap_or("✨")
                    .to_string(),
                description: raw
                    .get("description")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                jql: raw
                    .get("jql")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                category: raw
                    .get("category")
                    .and_then(Value::as_str)
                    .unwrap_or("custom")
                    .to_string(),
                is_custom: true,
            })
            .filter(|p| !p.id.trim().is_empty() && !p.jql.trim().is_empty())
            .collect();
    }

    if let Some(items) = pinned.and_then(|v| serde_json::from_value::<Vec<String>>(v).ok()) {
        state.pinned_presets = items;
    }

    if let Some(list) = recent.and_then(|v| serde_json::from_value::<Vec<Value>>(v).ok()) {
        state.recent_filters = list
            .into_iter()
            .filter_map(|raw| {
                let jql = raw
                    .get("jql")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .trim()
                    .to_string();
                if jql.is_empty() {
                    return None;
                }
                Some(RecentFilter {
                    label: raw
                        .get("label")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    used_at: raw.get("usedAt").and_then(Value::as_u64).unwrap_or(0),
                    jql,
                })
            })
            .take(4)
            .collect();
    }

    if let Some(stored) = builder_state {
        if let Some(mode) = stored.get("mode").and_then(Value::as_str) {
            state.mode = mode.to_string();
        }
        if let Some(text) = stored.get("searchText").and_then(Value::as_str) {
            state.search_text = text.to_string();
        }
        if let Some(items) = stored
            .get("selectedPresets")
            .and_then(|v| serde_json::from_value::<Vec<String>>(v.clone()).ok())
        {
            state.selected_presets = items;
        }
        if let Some(text) = stored.get("advancedText").and_then(Value::as_str) {
            state.advanced_text = text.to_string();
            state.query_text = text.to_string();
        }
        if let Some(field) = stored.get("sortField").and_then(Value::as_str) {
            state.sort_field = field.to_string();
        }
        if let Some(direction) = stored.get("sortDirection").and_then(Value::as_str) {
            state.sort_direction = direction.to_string();
        }
        if let Some(entries) = stored
            .get("sortEntries")
            .and_then(|v| serde_json::from_value::<Vec<SortEntry>>(v.clone()).ok())
        {
            if !entries.is_empty() {
                state.sort_entries = entries;
            }
        }
        if state.sort_entries.is_empty() {
            state.sort_entries.push(SortEntry {
                field: state.sort_field.clone(),
                direction: state.sort_direction.clone(),
            });
        }
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

    Ok(StateEnvelope::new(1, JqlPanelState::default()))
}

fn save_state(
    envelope: StateEnvelope<JqlPanelState>,
) -> Result<StateEnvelope<JqlPanelState>, WasmRuntimeError> {
    set_envelope(JIRA_STATE_KEY, "jira", envelope)
}

fn ensure_advanced_mode(doc: &web_sys::Document) {
    if dom::query_selector(ADVANCED_INPUT).ok().flatten().is_some() {
        return;
    }
    let Ok(nodes) = doc.query_selector_all("a.switcher-item, button.switcher-item, a, button")
    else {
        return;
    };
    for i in 0..nodes.length() {
        let Some(node) = nodes.item(i) else { continue };
        let Ok(el) = node.dyn_into::<web_sys::Element>() else {
            continue;
        };
        let text = el
            .text_content()
            .unwrap_or_default()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase();
        if text == "advanced" {
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

fn normalize_mode(mode: &str) -> String {
    match mode {
        "quick" | "visual" | "advanced" => mode.to_string(),
        _ => "visual".to_string(),
    }
}

fn parse_quick_search_to_filters(text: &str) -> Vec<VisualFilter> {
    let lower = text.to_lowercase();
    let has = |needle: &str| lower.contains(needle);
    let mut filters = Vec::new();
    let mk = |id: &str, field: &str, op: &str, value: &str, values: Vec<String>| VisualFilter {
        id: id.to_string(),
        field_id: field.to_string(),
        operator_key: op.to_string(),
        value: value.to_string(),
        values,
    };

    if has("my") || has("assigned to me") {
        filters.push(mk(
            "q-assignee",
            "assignee",
            "equals",
            "currentUser()",
            Vec::new(),
        ));
    }
    if has("unassigned") {
        filters.retain(|f| f.field_id != "assignee");
        filters.push(mk("q-unassigned", "assignee", "is-empty", "", Vec::new()));
    }
    if has("open") || has("unresolved") || has("active") {
        filters.push(mk("q-open", "resolution", "is-empty", "", Vec::new()));
    }
    if has("high priority") || has("urgent") || has("critical") {
        filters.push(mk(
            "q-priority",
            "priority",
            "in",
            "",
            vec!["Highest".to_string(), "High".to_string()],
        ));
    }
    if has("overdue") || has("past due") {
        filters.push(mk("q-overdue", "due", "less-than", "now()", Vec::new()));
    }
    if has("blocked") {
        filters.push(mk("q-blocked", "status", "equals", "Blocked", Vec::new()));
    }
    if has("in progress") || has("wip") {
        filters.push(mk(
            "q-in-progress",
            "status",
            "equals",
            "In Progress",
            Vec::new(),
        ));
    }
    if has("bug") {
        filters.push(mk("q-bug", "issuetype", "equals", "Bug", Vec::new()));
    }
    if has("story") {
        filters.push(mk("q-story", "issuetype", "equals", "Story", Vec::new()));
    }
    if has("task") {
        filters.push(mk("q-task", "issuetype", "equals", "Task", Vec::new()));
    }
    if has("today") {
        filters.push(mk(
            "q-updated-today",
            "updated",
            "greater-than-equals",
            "startOfDay()",
            Vec::new(),
        ));
    }
    if has("this week") {
        filters.push(mk(
            "q-week",
            "updated",
            "greater-than-equals",
            "startOfWeek()",
            Vec::new(),
        ));
    }

    filters
}

fn format_value_for_jql(value: &str, value_type: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::from("\"\"");
    }
    let lower = trimmed.to_lowercase();
    if value_type == "user" {
        if lower == "me" || lower == "current user" || lower == "currentuser()" {
            return "currentUser()".to_string();
        }
        if lower == "unassigned" || lower == "empty" {
            return "EMPTY".to_string();
        }
    }
    if trimmed.contains('(') && trimmed.ends_with(')') {
        return trimmed.to_string();
    }
    if value_type == "date"
        && (trimmed.starts_with('-') || trimmed.starts_with('+') || trimmed.contains('('))
    {
        return trimmed.to_string();
    }
    if trimmed
        .chars()
        .any(|c| c.is_whitespace() || matches!(c, ',' | '(' | ')' | '"'))
    {
        return format!("\"{}\"", trimmed.replace('"', "\\\""));
    }
    trimmed.to_string()
}

fn filter_by_id(id: &str) -> Option<FriendlyField> {
    friendly_fields().into_iter().find(|f| f.id == id)
}

fn operator_symbol(key: &str) -> &'static str {
    for (k, op) in operator_defs() {
        if k == key {
            return op;
        }
    }
    "="
}

fn build_jql_from_filters(state: &JqlPanelState) -> String {
    let mut clauses = Vec::new();
    for filter in &state.filters {
        let Some(field) = filter_by_id(&filter.field_id) else {
            continue;
        };

        let op_key = filter.operator_key.as_str();
        let operator = operator_symbol(op_key);
        let clause = if op_key == "is-empty" {
            format!("{} IS EMPTY", field.jql_field)
        } else if op_key == "is-not-empty" {
            format!("{} IS NOT EMPTY", field.jql_field)
        } else if op_key == "in" || op_key == "not-in" {
            let values = if filter.values.is_empty() {
                vec![filter.value.clone()]
            } else {
                filter.values.clone()
            };
            let formatted = values
                .iter()
                .filter(|v| !v.trim().is_empty())
                .map(|v| format_value_for_jql(v, field.value_type))
                .collect::<Vec<_>>();
            if formatted.is_empty() {
                continue;
            }
            format!(
                "{} {} ({})",
                field.jql_field,
                operator,
                formatted.join(", ")
            )
        } else {
            let value = format_value_for_jql(&filter.value, field.value_type);
            format!("{} {} {}", field.jql_field, operator, value)
        };
        clauses.push(clause);
    }

    let mut jql = clauses.join(" AND ");

    let mut sorts = state
        .sort_entries
        .iter()
        .filter(|s| !s.field.trim().is_empty())
        .map(|s| format!("{} {}", s.field.trim(), s.direction.trim()))
        .collect::<Vec<_>>();
    if sorts.is_empty() && !state.sort_field.trim().is_empty() {
        sorts.push(format!(
            "{} {}",
            state.sort_field.trim(),
            state.sort_direction.trim()
        ));
    }
    if !sorts.is_empty() {
        let order_by = format!("ORDER BY {}", sorts.join(", "));
        jql = if jql.trim().is_empty() {
            order_by
        } else {
            format!("{jql} {order_by}")
        };
    }

    jql
}

fn add_recent_filter(state: &mut JqlPanelState, jql: &str, label: &str) {
    if jql.trim().is_empty() {
        return;
    }
    state.recent_filters.retain(|item| item.jql != jql.trim());
    state.recent_filters.insert(
        0,
        RecentFilter {
            jql: jql.trim().to_string(),
            label: label.trim().to_string(),
            used_at: js_sys::Date::now() as u64,
        },
    );
    state.recent_filters.truncate(4);
}

fn combine_selected_presets(state: &JqlPanelState) -> String {
    let mut all = builtin_presets();
    all.extend(state.custom_presets.clone());
    let selected = state
        .selected_presets
        .iter()
        .filter_map(|id| all.iter().find(|p| &p.id == id))
        .map(|p| p.jql.to_string())
        .collect::<Vec<_>>();

    if selected.is_empty() {
        return String::new();
    }

    let mut clauses = Vec::new();
    let mut order_by = String::new();

    for jql in selected {
        let parts = jql.splitn(2, "ORDER BY").collect::<Vec<_>>();
        let main = parts.first().map(|s| s.trim()).unwrap_or_default();
        if !main.is_empty() {
            clauses.push(format!("({main})"));
        }
        if order_by.is_empty() && parts.len() > 1 {
            order_by = parts[1].trim().to_string();
        }
    }

    let mut result = clauses.join(" AND ");
    result = simplify_jql(&result);
    if !order_by.is_empty() {
        result.push_str(" ORDER BY ");
        result.push_str(&order_by);
    }
    result
}

fn simplify_jql(jql: &str) -> String {
    let mut result = jql.to_string();
    // Preserve first standalone unresolved clause; this mirrors legacy simplification intent.
    let needle = "(resolution = Unresolved)";
    let mut seen = false;
    while let Some(idx) = result.find(needle) {
        if !seen {
            seen = true;
            let next = idx + needle.len();
            let head = &result[..next];
            let tail = &result[next..];
            if tail.contains(needle) {
                result = format!("{}{}", head, tail.replacen(needle, "", 1));
            } else {
                break;
            }
        } else {
            result = result.replacen(needle, "", 1);
        }
    }
    result = result.replace("AND  AND", "AND");
    result
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .trim_start_matches("AND ")
        .trim_end_matches(" AND")
        .to_string()
}

fn panel_html(state: &JqlPanelState) -> String {
    let mode = normalize_mode(&state.mode);
    let mut all_presets = builtin_presets();
    all_presets.extend(state.custom_presets.clone());

    let preset_grid = all_presets
        .iter()
        .map(|preset| {
            let selected = if state.selected_presets.contains(&preset.id) {
                " selected"
            } else {
                ""
            };
            format!(
                r#"<button class="cv-preset-btn{selected}" data-cv-preset-id="{}" title="{}">
<div class="cv-preset-content">
  <span class="cv-preset-label"><span class="cv-preset-emoji">{}</span>{}</span>
  <span class="cv-preset-desc">{}</span>
</div>
<span class="cv-preset-check">✓</span>
</button>"#,
                html_escape(&preset.id),
                html_escape(&preset.jql),
                html_escape(&preset.emoji),
                html_escape(&preset.label),
                html_escape(&preset.description),
            )
        })
        .collect::<Vec<_>>()
        .join("");

    let quick_examples_html = quick_examples()
        .into_iter()
        .map(|text| {
            format!(
                r#"<button class="cv-quick-example" data-cv-example="{}">{}</button>"#,
                html_escape(text),
                html_escape(text)
            )
        })
        .collect::<Vec<_>>()
        .join("");

    let visual_cards = if state.filters.is_empty() {
        r#"<div class="cv-empty-state">
<div class="cv-empty-state-icon">🔍</div>
<div class="cv-empty-state-title">No filters yet</div>
<div class="cv-empty-state-text">Add filters to build your search query, or use a quick filter above.</div>
</div>"#
            .to_string()
    } else {
        state
            .filters
            .iter()
            .enumerate()
            .map(|(index, filter)| {
                let field = filter_by_id(&filter.field_id)
                    .or_else(|| friendly_fields().into_iter().next())
                    .unwrap_or(FriendlyField {
                        id: "summary",
                        label: "Title contains",
                        emoji: "📝",
                        jql_field: "summary",
                        value_type: "text",
                        default_operator: "contains",
                    });

                let operator_opts = operator_defs()
                    .iter()
                    .map(|(key, symbol)| {
                        let selected = if filter.operator_key == *key { "selected" } else { "" };
                        format!(
                            r#"<option value="{}" {}>{}</option>"#,
                            html_escape(key),
                            selected,
                            html_escape(symbol)
                        )
                    })
                    .collect::<Vec<_>>()
                    .join("");

                let value = if !filter.values.is_empty() {
                    filter.values.join(", ")
                } else {
                    filter.value.clone()
                };

                let date_chips = if field.value_type == "date" {
                    date_presets()
                        .into_iter()
                        .map(|(label, value)| {
                            format!(
                                r#"<button class="cv-date-preset" data-cv-date-preset="{}" data-cv-filter-index="{}">{}</button>"#,
                                html_escape(value),
                                index,
                                html_escape(label)
                            )
                        })
                        .collect::<Vec<_>>()
                        .join("")
                } else {
                    String::new()
                };

                format!(
                    r#"<div class="cv-filter-card" data-cv-filter-index="{}">
<div class="cv-filter-header">
  <div class="cv-filter-field">
    <span class="cv-filter-field-emoji">{}</span>
    <button class="cv-filter-field-btn" data-cv-filter-field-open="{}"><span class="cv-filter-field-label">{}</span><span>▾</span></button>
  </div>
  <div class="cv-filter-operator"><select data-cv-filter-operator="{}">{}</select></div>
  <div class="cv-filter-actions"><button class="cv-icon-btn danger" data-cv-remove-filter="{}">×</button></div>
</div>
<div class="cv-filter-value">
  <input data-cv-filter-value="{}" value="{}" placeholder="Enter value..." />
  <div class="cv-date-presets">{}</div>
</div>
</div>"#,
                    index,
                    html_escape(field.emoji),
                    index,
                    html_escape(field.label),
                    index,
                    operator_opts,
                    index,
                    index,
                    html_escape(&value),
                    date_chips,
                )
            })
            .collect::<Vec<_>>()
            .join("")
    };

    let recent_buttons = state
        .recent_filters
        .iter()
        .take(4)
        .enumerate()
        .map(|(index, recent)| {
            let title = if recent.label.trim().is_empty() {
                recent.jql.clone()
            } else {
                recent.label.clone()
            };
            format!(
                r#"<button class="cv-preset-btn cv-recent-btn" data-cv-recent-index="{}" title="{}"><span class="cv-preset-label">{}</span></button>"#,
                index,
                html_escape(&recent.jql),
                html_escape(&title)
            )
        })
        .collect::<Vec<_>>()
        .join("");

    let pinned = state
        .pinned_presets
        .iter()
        .take(4)
        .filter_map(|id| all_presets.iter().find(|p| &p.id == id))
        .map(|preset| {
            format!(
                r#"<button class="cv-preset-btn" data-cv-pinned-preset="{}" title="{}"><span class="cv-preset-label"><span class="cv-preset-emoji">{}</span>{}</span></button>"#,
                html_escape(&preset.id),
                html_escape(&preset.description),
                html_escape(&preset.emoji),
                html_escape(&preset.label)
            )
        })
        .collect::<Vec<_>>()
        .join("");

    let sort_rows = state
        .sort_entries
        .iter()
        .enumerate()
        .map(|(idx, entry)| {
            let field_opts = sort_fields()
                .into_iter()
                .map(|(value, label)| {
                    let selected = if entry.field == value { "selected" } else { "" };
                    format!(
                        r#"<option value="{}" {}>{}</option>"#,
                        html_escape(value),
                        selected,
                        html_escape(label)
                    )
                })
                .collect::<Vec<_>>()
                .join("");

            let desc_selected = if entry.direction.eq_ignore_ascii_case("DESC") {
                "selected"
            } else {
                ""
            };
            let asc_selected = if entry.direction.eq_ignore_ascii_case("ASC") {
                "selected"
            } else {
                ""
            };

            let remove = if idx > 0 {
                format!(
                    r#"<button class="cv-icon-btn danger" data-cv-remove-sort="{}">✕</button>"#,
                    idx
                )
            } else {
                String::new()
            };

            format!(
                r#"<div class="cv-sort-row">
<span class="cv-sort-label">{}</span>
<select data-cv-sort-field="{}">{}</select>
<select data-cv-sort-direction="{}"><option value="DESC" {}>↓ DESC</option><option value="ASC" {}>↑ ASC</option></select>
{}
</div>"#,
                if idx == 0 { "Sort by" } else { "then by" },
                idx,
                field_opts,
                idx,
                desc_selected,
                asc_selected,
                remove,
            )
        })
        .collect::<Vec<_>>()
        .join("");

    let advanced_field_items = friendly_fields()
        .iter()
        .map(|field| {
            format!(
                r#"<button class="cv-ref-item" data-cv-insert="{}">{} {}</button>"#,
                html_escape(field.jql_field),
                html_escape(field.emoji),
                html_escape(field.label)
            )
        })
        .collect::<Vec<_>>()
        .join("");

    let advanced_operator_items = operator_defs()
        .iter()
        .map(|(_, op)| {
            format!(
                r#"<button class="cv-ref-item" data-cv-insert=" {} ">{}</button>"#,
                html_escape(op),
                html_escape(op)
            )
        })
        .collect::<Vec<_>>()
        .join("");

    let advanced_function_items = vec![
        "currentUser()",
        "now()",
        "startOfDay()",
        "startOfWeek()",
        "startOfMonth()",
        "endOfWeek()",
        "openSprints()",
        "issueHistory()",
    ]
    .iter()
    .map(|f| {
        format!(
            r#"<button class="cv-ref-item" data-cv-insert="{}">{}</button>"#,
            html_escape(f),
            html_escape(f)
        )
    })
    .collect::<Vec<_>>()
    .join("");

    let advanced_time_items = time_items()
        .into_iter()
        .map(|(value, label)| {
            format!(
                r#"<button class="cv-ref-item" data-cv-insert="{}" title="{}">{}</button>"#,
                html_escape(value),
                html_escape(label),
                html_escape(value)
            )
        })
        .collect::<Vec<_>>()
        .join("");

    let advanced_keyword_items = vec![
        "AND", "OR", "NOT", "ORDER BY", "ASC", "DESC", "EMPTY", "NULL", "FROM", "TO", "BY",
        "AFTER", "BEFORE", "ON", "DURING",
    ]
    .iter()
    .map(|kw| {
        let insert = if *kw == "ORDER BY" {
            " ORDER BY ".to_string()
        } else if ["ASC", "DESC"].contains(kw) {
            format!(" {kw}")
        } else {
            format!(" {kw} ")
        };
        format!(
            r#"<button class="cv-ref-item" data-cv-insert="{}">{}</button>"#,
            html_escape(&insert),
            html_escape(kw)
        )
    })
    .collect::<Vec<_>>()
    .join("");

    let quick_active = if mode == "quick" { "active" } else { "" };
    let visual_active = if mode == "visual" { "active" } else { "" };
    let advanced_active = if mode == "advanced" { "active" } else { "" };

    let preview = if mode == "advanced" {
        state.advanced_text.clone()
    } else if !state.selected_presets.is_empty() {
        combine_selected_presets(state)
    } else {
        build_jql_from_filters(state)
    };

    format!(
        r#"<div class="cv-panel" data-cv-jql-panel>
<div class="cv-header" data-cv-drag-handle>
  <div class="cv-header-title"><h1>Search Builder</h1><span class="cv-badge">v2</span></div>
  <div class="cv-header-actions"><button class="cv-icon-btn" title="Close" data-cv-close>x</button></div>
</div>
<div class="cv-mode-tabs">
  <button class="cv-mode-tab {quick_active}" data-cv-mode="quick">⚡ Quick</button>
  <button class="cv-mode-tab {visual_active}" data-cv-mode="visual">🎨 Visual</button>
  <button class="cv-mode-tab {advanced_active}" data-cv-mode="advanced">🔧 Advanced</button>
</div>
<div class="cv-body">
  <section data-cv-mode-body="quick" style="display:{}">
    <div class="cv-section">
      <div class="cv-section-title">⚡ Quick Filters <span style="font-weight:normal;text-transform:none;font-size:11px;">(select any combination)</span></div>
      <div class="cv-presets-grid">{}</div>
    </div>
    <div class="cv-section" style="margin-top:16px;">
      <button class="cv-btn" style="width:100%;border-style:dashed;opacity:.8;" data-cv-open-custom-modal>➕ Create Custom Filter</button>
    </div>
    <div class="cv-section" style="margin-top:20px;">
      <div class="cv-section-title">🔍 Natural Language Search</div>
      <input class="cv-quick-search-input" data-cv-quick-search value="{}" placeholder="Describe what you're looking for..." />
      <div class="cv-quick-search-hint"><strong>Examples:</strong> "my open bugs", "high priority created this week", "unassigned tasks due soon", "status in progress project MYPROJ"</div>
      <div class="cv-quick-search-examples">{}</div>
    </div>
  </section>
  <section data-cv-mode-body="visual" style="display:{}">
    <div class="cv-section">
      <div class="cv-section-title" style="display:flex;justify-content:space-between;align-items:center;"><span>⚡ Quick Filters</span><button class="cv-pill-btn" data-cv-open-preset-picker><span>⚙️</span> Customize</button></div>
      <div class="cv-presets-grid">{}</div>
    </div>
    <div class="cv-section" style="display:{}">
      <div class="cv-section-title">🕐 Recent Filters</div>
      <div class="cv-presets-grid">{}</div>
    </div>
    <div class="cv-section">
      <div class="cv-section-title">📝 Your Filters</div>
      <div class="cv-filters">{}<button class="cv-add-filter" data-cv-add-filter>+ Add a filter</button></div>
    </div>
    <div class="cv-section">
      <div class="cv-section-title">↕️ Sort Results</div>
      <div class="cv-sort-section">{}{}{}</div>
    </div>
  </section>
  <section data-cv-mode-body="advanced" style="display:{}">
    <div class="cv-section">
      <div class="cv-section-title">🔧 Advanced JQL Editor</div>
      <p style="color:var(--cv-text-muted);font-size:13px;margin:0;">Edit JQL directly. Click items below to insert at cursor position.</p>
      <div style="margin-top:12px;"><textarea class="cv-preview" data-cv-advanced-textarea placeholder="Enter your JQL query..." style="min-height:160px;">{}</textarea></div>
    </div>
    <div class="cv-section cv-advanced-ref" style="margin-top:16px;">
      <div class="cv-advanced-search-wrap"><input class="cv-advanced-search" data-cv-advanced-search type="text" placeholder="Search fields, operators, functions..." /></div>
      <div class="cv-ref-tabs">
        <button class="cv-ref-tab active" data-cv-ref-tab="fields">📋 Fields</button>
        <button class="cv-ref-tab" data-cv-ref-tab="operators">⚙️ Operators</button>
        <button class="cv-ref-tab" data-cv-ref-tab="functions">ƒ Functions</button>
        <button class="cv-ref-tab" data-cv-ref-tab="time">🕐 Time</button>
        <button class="cv-ref-tab" data-cv-ref-tab="keywords">🔤 Keywords</button>
      </div>
      <div class="cv-ref-content">
        <div class="cv-ref-items" data-cv-ref-items="fields">{}</div>
        <div class="cv-ref-items" data-cv-ref-items="operators" style="display:none;">{}</div>
        <div class="cv-ref-items" data-cv-ref-items="functions" style="display:none;">{}</div>
        <div class="cv-ref-items" data-cv-ref-items="time" style="display:none;">{}</div>
        <div class="cv-ref-items" data-cv-ref-items="keywords" style="display:none;">{}</div>
      </div>
    </div>
  </section>
</div>
<div class="cv-footer">
  <div class="cv-preview-section">
    <div class="cv-preview-label"><span>Generated JQL</span><div class="cv-preview-actions"><button class="cv-copy-btn" data-cv-copy><span>📋</span> Copy</button></div></div>
    <textarea class="cv-preview" data-cv-preview readonly>{}</textarea>
  </div>
  <div class="cv-footer-actions">
    <button class="cv-btn" data-cv-clear>Clear All</button>
    <button class="cv-btn primary" data-cv-search>Search in Jira</button>
  </div>
</div>
<div class="cv-toast" data-cv-toast></div>
</div>"#,
        if mode == "quick" { "block" } else { "none" },
        preset_grid,
        html_escape(&state.search_text),
        quick_examples_html,
        if mode == "visual" { "block" } else { "none" },
        pinned,
        if recent_buttons.is_empty() {
            "none"
        } else {
            "block"
        },
        recent_buttons,
        visual_cards,
        sort_rows,
        if state.sort_entries.len() < 3 {
            r#"<button class="cv-secondary-btn" data-cv-add-sort><span>➕</span> Add secondary sort</button>"#
        } else {
            ""
        },
        if state.run_search {
            r#"<label style="font-size:12px;color:var(--cv-text-muted);"><input type="checkbox" data-cv-run-search checked /> Run search after apply</label>"#
        } else {
            r#"<label style="font-size:12px;color:var(--cv-text-muted);"><input type="checkbox" data-cv-run-search /> Run search after apply</label>"#
        },
        if mode == "advanced" { "block" } else { "none" },
        html_escape(&state.advanced_text),
        advanced_field_items,
        advanced_operator_items,
        advanced_function_items,
        advanced_time_items,
        advanced_keyword_items,
        html_escape(&preview),
    )
}

fn show_toast(panel: &web_sys::HtmlElement, message: &str) {
    let Ok(Some(toast_el)) = panel.query_selector("[data-cv-toast]") else {
        return;
    };
    let Ok(toast) = toast_el.dyn_into::<web_sys::HtmlElement>() else {
        return;
    };
    toast.set_text_content(Some(message));
    let _ = toast.class_list().add_1("show");

    let toast_clone = toast.clone();
    let closure = Closure::<dyn FnMut()>::wrap(Box::new(move || {
        let _ = toast_clone.class_list().remove_1("show");
    }));

    if let Some(window) = web_sys::window() {
        let _ = window.set_timeout_with_callback_and_timeout_and_arguments_0(
            closure.as_ref().unchecked_ref(),
            2000,
        );
    }
    closure.forget();
}

fn active_preview_text(panel: &web_sys::HtmlElement) -> String {
    panel
        .query_selector("[data-cv-preview]")
        .ok()
        .flatten()
        .and_then(|el| el.dyn_into::<web_sys::HtmlTextAreaElement>().ok())
        .map(|ta| ta.value())
        .unwrap_or_default()
}

fn click_element_from_event(event: &web_sys::Event) -> Option<web_sys::Element> {
    let target = event.target()?;
    if let Some(el) = target.dyn_ref::<web_sys::Element>() {
        return Some(el.clone());
    }
    target
        .dyn_ref::<web_sys::Node>()
        .and_then(web_sys::Node::parent_element)
}

fn closest_actionable(element: &web_sys::Element, selector: &str) -> Option<web_sys::Element> {
    element.closest(selector).ok().flatten()
}

fn sync_state_from_dom(envelope: &mut StateEnvelope<JqlPanelState>, panel: &web_sys::HtmlElement) {
    if let Ok(Some(search)) = panel.query_selector("[data-cv-quick-search]") {
        if let Ok(input) = search.dyn_into::<web_sys::HtmlInputElement>() {
            envelope.payload.search_text = input.value();
        }
    }

    if let Ok(Some(adv)) = panel.query_selector("[data-cv-advanced-textarea]") {
        if let Ok(textarea) = adv.dyn_into::<web_sys::HtmlTextAreaElement>() {
            envelope.payload.advanced_text = textarea.value();
        }
    }

    if let Ok(Some(run)) = panel.query_selector("[data-cv-run-search]") {
        if let Ok(input) = run.dyn_into::<web_sys::HtmlInputElement>() {
            envelope.payload.run_search = input.checked();
        }
    }
}

fn rerender(panel: &web_sys::HtmlElement, envelope: StateEnvelope<JqlPanelState>) {
    if let Ok(saved) = save_state(envelope) {
        panel.set_inner_html(&panel_html(&saved.payload));
        let _ = bind_events(panel);
    }
}

fn open_custom_modal(panel: &web_sys::HtmlElement) {
    let Some(doc) = web_sys::window().and_then(|w| w.document()) else {
        return;
    };

    if doc.get_element_by_id("cv-jql-custom-modal").is_some() {
        return;
    }

    let Ok(overlay) = doc.create_element("div") else {
        return;
    };
    let Ok(overlay) = overlay.dyn_into::<web_sys::HtmlElement>() else {
        return;
    };
    overlay.set_id("cv-jql-custom-modal");
    overlay.set_class_name("cv-modal-overlay");
    overlay.set_inner_html(
        r#"<div class="cv-modal" style="max-width:450px;width:90%;">
<h3 style="margin:0 0 16px 0;">➕ Create Custom Filter</h3>
<label style="display:block;margin-bottom:4px;font-weight:500;">Icon</label>
<input data-cv-custom-emoji style="width:100%;padding:8px;margin-bottom:12px;border:1px solid #e2e8f0;border-radius:6px;" value="✨" />
<label style="display:block;margin-bottom:4px;font-weight:500;">Title</label>
<input data-cv-custom-title style="width:100%;padding:8px;margin-bottom:12px;border:1px solid #e2e8f0;border-radius:6px;" placeholder="My Custom Filter" />
<label style="display:block;margin-bottom:4px;font-weight:500;">Description</label>
<input data-cv-custom-desc style="width:100%;padding:8px;margin-bottom:12px;border:1px solid #e2e8f0;border-radius:6px;" placeholder="What this filter finds" />
<label style="display:block;margin-bottom:4px;font-weight:500;">JQL Query</label>
<textarea data-cv-custom-jql style="width:100%;padding:8px;margin-bottom:12px;border:1px solid #e2e8f0;border-radius:6px;font-family:monospace;font-size:12px;" rows="3"></textarea>
<div style="display:flex;gap:8px;"><button data-cv-custom-cancel class="cv-btn" style="flex:1;">Cancel</button><button data-cv-custom-save class="cv-btn primary" style="flex:1;">Save Filter</button></div>
</div>"#,
    );

    if let Some(body) = doc.body() {
        let _ = body.append_child(&overlay);
    }

    let preview = active_preview_text(panel);
    if !preview.trim().is_empty() {
        if let Ok(Some(el)) = overlay.query_selector("[data-cv-custom-jql]") {
            if let Ok(area) = el.dyn_into::<web_sys::HtmlTextAreaElement>() {
                area.set_value(&preview);
            }
        }
    }

    let overlay_click = overlay.clone();
    let panel_ref = panel.clone();
    let handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |event: web_sys::Event| {
            let Some(target) = click_element_from_event(&event) else {
                return;
            };
            if closest_actionable(&target, "[data-cv-custom-cancel]").is_some() {
                overlay_click.remove();
                return;
            }
            if closest_actionable(&target, "[data-cv-custom-save]").is_none() {
                if let Ok(el) = overlay_click.clone().dyn_into::<web_sys::Element>() {
                    if target == el {
                        overlay_click.remove();
                    }
                }
                return;
            }

            let title = overlay_click
                .query_selector("[data-cv-custom-title]")
                .ok()
                .flatten()
                .and_then(|el| el.dyn_into::<web_sys::HtmlInputElement>().ok())
                .map(|input| input.value())
                .unwrap_or_default();
            let desc = overlay_click
                .query_selector("[data-cv-custom-desc]")
                .ok()
                .flatten()
                .and_then(|el| el.dyn_into::<web_sys::HtmlInputElement>().ok())
                .map(|input| input.value())
                .unwrap_or_default();
            let emoji = overlay_click
                .query_selector("[data-cv-custom-emoji]")
                .ok()
                .flatten()
                .and_then(|el| el.dyn_into::<web_sys::HtmlInputElement>().ok())
                .map(|input| input.value())
                .unwrap_or_else(|| "✨".to_string());
            let jql = overlay_click
                .query_selector("[data-cv-custom-jql]")
                .ok()
                .flatten()
                .and_then(|el| el.dyn_into::<web_sys::HtmlTextAreaElement>().ok())
                .map(|ta| ta.value())
                .unwrap_or_default();

            if title.trim().is_empty() || jql.trim().is_empty() {
                show_toast(&panel_ref, "Please fill in title and JQL query");
                return;
            }

            let mut envelope = match load_state() {
                Ok(envelope) => envelope,
                Err(_) => StateEnvelope::new(1, JqlPanelState::default()),
            };
            let id = format!("custom-{}", js_sys::Date::now() as u64);
            envelope.payload.custom_presets.push(Preset {
                id: id.clone(),
                label: title.trim().to_string(),
                emoji: if emoji.trim().is_empty() {
                    "✨".to_string()
                } else {
                    emoji
                },
                description: if desc.trim().is_empty() {
                    title.trim().to_string()
                } else {
                    desc.trim().to_string()
                },
                jql: jql.trim().to_string(),
                category: "custom".to_string(),
                is_custom: true,
            });
            if envelope.payload.pinned_presets.len() < 4 {
                envelope.payload.pinned_presets.push(id);
            }

            rerender(&panel_ref, envelope);
            overlay_click.remove();
            show_toast(&panel_ref, "Custom filter created!");
        }));

    overlay
        .add_event_listener_with_callback("click", handler.as_ref().unchecked_ref())
        .ok();
    handler.forget();
}

fn open_preset_picker(panel: &web_sys::HtmlElement) {
    let Some(doc) = web_sys::window().and_then(|w| w.document()) else {
        return;
    };

    if doc.get_element_by_id("cv-jql-preset-picker").is_some() {
        return;
    }

    let envelope = match load_state() {
        Ok(envelope) => envelope,
        Err(_) => StateEnvelope::new(1, JqlPanelState::default()),
    };

    let mut all = builtin_presets();
    all.extend(envelope.payload.custom_presets.clone());

    let mut rows = String::new();
    for preset in all {
        let checked = envelope.payload.pinned_presets.contains(&preset.id);
        rows.push_str(&format!(
            r#"<label style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:8px;background:#f1f5f9;"><input type="checkbox" data-cv-preset-pin="{}" {} /><span style="flex:1;">{} {}</span></label>"#,
            html_escape(&preset.id),
            if checked { "checked" } else { "" },
            html_escape(&preset.emoji),
            html_escape(&preset.label)
        ));
    }

    let Ok(overlay) = doc.create_element("div") else {
        return;
    };
    let Ok(overlay) = overlay.dyn_into::<web_sys::HtmlElement>() else {
        return;
    };
    overlay.set_id("cv-jql-preset-picker");
    overlay.set_class_name("cv-modal-overlay");
    overlay.set_inner_html(&format!(
        r#"<div class="cv-modal"><h3 style="margin:0 0 16px 0;">⚙️ Customize Quick Filters</h3><p style="color:#64748b;font-size:12px;">Pick up to 4 pinned quick filters shown in Visual mode.</p><div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow:auto;">{}</div><button class="cv-btn primary" style="width:100%;margin-top:16px;" data-cv-preset-done>Done</button></div>"#,
        rows
    ));

    if let Some(body) = doc.body() {
        let _ = body.append_child(&overlay);
    }

    let overlay_click = overlay.clone();
    let panel_ref = panel.clone();
    let handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |event: web_sys::Event| {
            let Some(target) = click_element_from_event(&event) else {
                return;
            };

            if closest_actionable(&target, "[data-cv-preset-done]").is_some() {
                overlay_click.remove();
                return;
            }

            let Some(input_el) = closest_actionable(&target, "[data-cv-preset-pin]") else {
                return;
            };

            let Ok(input) = input_el.dyn_into::<web_sys::HtmlInputElement>() else {
                return;
            };

            let Some(id) = input.get_attribute("data-cv-preset-pin") else {
                return;
            };

            let mut envelope = match load_state() {
                Ok(envelope) => envelope,
                Err(_) => StateEnvelope::new(1, JqlPanelState::default()),
            };

            let checked = input.checked();
            if checked {
                if envelope.payload.pinned_presets.contains(&id) {
                    return;
                }
                if envelope.payload.pinned_presets.len() >= 4 {
                    input.set_checked(false);
                    show_toast(&panel_ref, "Maximum 4 quick filters allowed");
                    return;
                }
                envelope.payload.pinned_presets.push(id);
            } else {
                envelope.payload.pinned_presets.retain(|item| item != &id);
            }

            rerender(&panel_ref, envelope);
        }));

    overlay
        .add_event_listener_with_callback("click", handler.as_ref().unchecked_ref())
        .ok();
    handler.forget();
}

fn open_field_picker(panel: &web_sys::HtmlElement, filter_index: usize) {
    let Some(doc) = web_sys::window().and_then(|w| w.document()) else {
        return;
    };

    if doc.get_element_by_id("cv-jql-field-picker").is_some() {
        return;
    }

    let fields = friendly_fields();
    let mut groups = String::new();
    for field in fields {
        groups.push_str(&format!(
            r#"<button class="cv-field-picker-item" data-cv-field-pick="{}" data-cv-filter-index="{}" title="{}">{}</button>"#,
            html_escape(field.id),
            filter_index,
            html_escape(field.jql_field),
            html_escape(&format!("{} {}", field.emoji, field.label))
        ));
    }

    let Ok(overlay) = doc.create_element("div") else {
        return;
    };
    let Ok(overlay) = overlay.dyn_into::<web_sys::HtmlElement>() else {
        return;
    };
    overlay.set_id("cv-jql-field-picker");
    overlay.set_class_name("cv-modal-overlay cv-field-picker-overlay");
    overlay.set_inner_html(&format!(
        r#"<div class="cv-modal cv-field-picker" style="width:min(640px,calc(100vw - 32px));max-height:calc(100vh - 160px);display:flex;flex-direction:column;padding:0;">
<input class="cv-field-picker-search" data-cv-field-picker-search placeholder="Search fields... (supports fuzzy matching)" style="padding:12px 14px;border:0;border-bottom:1px solid #e2e8f0;"/>
<div class="cv-field-picker-list" data-cv-field-picker-list style="padding:14px;overflow-y:auto;display:flex;flex-wrap:wrap;gap:8px;">{}</div>
</div>"#,
        groups
    ));
    if let Some(body) = doc.body() {
        let _ = body.append_child(&overlay);
    }

    let overlay_click = overlay.clone();
    let panel_ref = panel.clone();
    let handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |event: web_sys::Event| {
            let Some(target) = click_element_from_event(&event) else {
                return;
            };
            if let Ok(el) = overlay_click.clone().dyn_into::<web_sys::Element>() {
                if target == el {
                    overlay_click.remove();
                    return;
                }
            }

            if let Some(search_el) = closest_actionable(&target, "[data-cv-field-picker-search]") {
                let Ok(input) = search_el.dyn_into::<web_sys::HtmlInputElement>() else {
                    return;
                };
                let q = input.value().to_lowercase();
                if let Ok(items) = overlay_click.query_selector_all("[data-cv-field-pick]") {
                    for i in 0..items.length() {
                        if let Some(node) = items.item(i) {
                            if let Ok(btn) = node.dyn_into::<web_sys::HtmlElement>() {
                                let text = btn.text_content().unwrap_or_default().to_lowercase();
                                let show = q.trim().is_empty() || text.contains(q.trim());
                                let _ = btn.style().set_property(
                                    "display",
                                    if show { "inline-flex" } else { "none" },
                                );
                            }
                        }
                    }
                }
                return;
            }

            let Some(field_btn) = closest_actionable(&target, "[data-cv-field-pick]") else {
                return;
            };
            let Some(field_id) = field_btn.get_attribute("data-cv-field-pick") else {
                return;
            };
            let Some(index_text) = field_btn.get_attribute("data-cv-filter-index") else {
                return;
            };
            let Ok(index) = index_text.parse::<usize>() else {
                return;
            };

            let mut envelope = match load_state() {
                Ok(envelope) => envelope,
                Err(_) => StateEnvelope::new(1, JqlPanelState::default()),
            };
            if let Some(filter) = envelope.payload.filters.get_mut(index) {
                filter.field_id = field_id.clone();
                if let Some(field) = filter_by_id(&field_id) {
                    filter.operator_key = field.default_operator.to_string();
                }
                filter.value.clear();
                filter.values.clear();
            }
            envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
            rerender(&panel_ref, envelope);
            overlay_click.remove();
        }));

    overlay
        .add_event_listener_with_callback("click", handler.as_ref().unchecked_ref())
        .ok();
    overlay
        .add_event_listener_with_callback("input", handler.as_ref().unchecked_ref())
        .ok();
    handler.forget();
}

fn bind_drag(panel: &web_sys::HtmlElement) {
    if panel
        .get_attribute("data-cv-drag-bound")
        .map(|v| v == "1")
        .unwrap_or(false)
    {
        return;
    }
    let _ = panel.set_attribute("data-cv-drag-bound", "1");

    let Ok(Some(handle_el)) = panel.query_selector("[data-cv-drag-handle]") else {
        return;
    };
    let Ok(handle) = handle_el.dyn_into::<web_sys::HtmlElement>() else {
        return;
    };

    let dragging = std::rc::Rc::new(std::cell::Cell::new(false));
    let start_x = std::rc::Rc::new(std::cell::Cell::new(0.0));
    let start_y = std::rc::Rc::new(std::cell::Cell::new(0.0));
    let start_left = std::rc::Rc::new(std::cell::Cell::new(0.0));
    let start_top = std::rc::Rc::new(std::cell::Cell::new(0.0));

    let panel_move = panel.clone();
    let dragging_move = dragging.clone();
    let start_x_move = start_x.clone();
    let start_y_move = start_y.clone();
    let start_left_move = start_left.clone();
    let start_top_move = start_top.clone();

    let on_move =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |event: web_sys::Event| {
            if !dragging_move.get() {
                return;
            }
            let Ok(pointer) = event.dyn_into::<web_sys::PointerEvent>() else {
                return;
            };
            let dx = pointer.client_x() as f64 - start_x_move.get();
            let dy = pointer.client_y() as f64 - start_y_move.get();
            let _ = panel_move
                .style()
                .set_property("left", &format!("{}px", start_left_move.get() + dx));
            let _ = panel_move
                .style()
                .set_property("top", &format!("{}px", start_top_move.get() + dy));
            let _ = panel_move.style().set_property("right", "auto");
        }));

    let dragging_up = dragging.clone();
    let on_up =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |_event: web_sys::Event| {
            dragging_up.set(false);
        }));

    if let Some(window) = web_sys::window() {
        let _ = window
            .add_event_listener_with_callback("pointermove", on_move.as_ref().unchecked_ref());
        let _ =
            window.add_event_listener_with_callback("pointerup", on_up.as_ref().unchecked_ref());
    }

    let panel_down = panel.clone();
    let dragging_down = dragging.clone();
    let start_x_down = start_x.clone();
    let start_y_down = start_y.clone();
    let start_left_down = start_left.clone();
    let start_top_down = start_top.clone();
    let on_down =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |event: web_sys::Event| {
            let Ok(pointer) = event.dyn_into::<web_sys::PointerEvent>() else {
                return;
            };
            let target = pointer
                .target()
                .and_then(|t| t.dyn_into::<web_sys::Element>().ok());
            if let Some(el) = target {
                if el
                    .closest("button,input,select,textarea")
                    .ok()
                    .flatten()
                    .is_some()
                {
                    return;
                }
            }

            dragging_down.set(true);
            start_x_down.set(pointer.client_x() as f64);
            start_y_down.set(pointer.client_y() as f64);
            let rect = panel_down.get_bounding_client_rect();
            start_left_down.set(rect.left());
            start_top_down.set(rect.top());
        }));

    let _ =
        handle.add_event_listener_with_callback("pointerdown", on_down.as_ref().unchecked_ref());

    on_move.forget();
    on_up.forget();
    on_down.forget();
}

fn bind_events(panel: &web_sys::HtmlElement) -> Result<(), WasmRuntimeError> {
    if panel
        .get_attribute("data-cv-bound")
        .map(|value| value == "1")
        .unwrap_or(false)
    {
        return Ok(());
    }
    panel.set_attribute("data-cv-bound", "1").ok();

    bind_drag(panel);
    if panel
        .get_attribute("data-cv-outside-bound")
        .map(|value| value == "1")
        .unwrap_or(false)
    {
        // already bound
    } else {
        panel.set_attribute("data-cv-outside-bound", "1").ok();
        if let Some(document) = web_sys::window().and_then(|w| w.document()) {
            let outside_panel = panel.clone();
            let outside = Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(
                move |event: web_sys::Event| {
                    let Some(target) = click_element_from_event(&event) else {
                        return;
                    };
                    if target
                        .closest(&format!("#{PANEL_ID}"))
                        .ok()
                        .flatten()
                        .is_some()
                    {
                        return;
                    }
                    let _ = dom_inject::remove_element(PANEL_ID);
                    let _ = outside_panel.remove_attribute("data-cv-outside-bound");
                },
            ));
            let _ = document
                .add_event_listener_with_callback("pointerdown", outside.as_ref().unchecked_ref());
            outside.forget();
        }
    }

    let click_panel = panel.clone();
    let click_handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |event: web_sys::Event| {
            let Some(target) = click_element_from_event(&event) else {
                return;
            };

            if closest_actionable(&target, "[data-cv-close]").is_some() {
                let _ = dom_inject::remove_element(PANEL_ID);
                return;
            }

            if closest_actionable(&target, "[data-cv-open-custom-modal]").is_some() {
                open_custom_modal(&click_panel);
                return;
            }

            if closest_actionable(&target, "[data-cv-open-preset-picker]").is_some() {
                open_preset_picker(&click_panel);
                return;
            }

            let mut envelope = match load_state() {
                Ok(envelope) => envelope,
                Err(_) => StateEnvelope::new(1, JqlPanelState::default()),
            };
            sync_state_from_dom(&mut envelope, &click_panel);

            if let Some(tab_el) = closest_actionable(&target, "[data-cv-mode]") {
                if let Some(mode) = tab_el.get_attribute("data-cv-mode") {
                    envelope.payload.mode = normalize_mode(&mode);
                    if envelope.payload.mode == "advanced"
                        && envelope.payload.advanced_text.trim().is_empty()
                    {
                        envelope.payload.advanced_text = active_preview_text(&click_panel);
                    }
                    rerender(&click_panel, envelope);
                }
                return;
            }

            if let Some(example_el) = closest_actionable(&target, "[data-cv-example]") {
                let Some(text) = example_el.get_attribute("data-cv-example") else {
                    return;
                };
                envelope.payload.mode = "quick".to_string();
                envelope.payload.search_text = text.clone();
                envelope.payload.selected_presets.clear();
                envelope.payload.filters = parse_quick_search_to_filters(&text);
                envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
                rerender(&click_panel, envelope);
                return;
            }

            if let Some(preset_el) = closest_actionable(&target, "[data-cv-preset-id]") {
                let Some(preset_id) = preset_el.get_attribute("data-cv-preset-id") else {
                    return;
                };
                if envelope.payload.selected_presets.contains(&preset_id) {
                    envelope
                        .payload
                        .selected_presets
                        .retain(|id| id != &preset_id);
                } else {
                    envelope.payload.selected_presets.push(preset_id);
                }
                envelope.payload.mode = "quick".to_string();
                envelope.payload.query_text = combine_selected_presets(&envelope.payload);
                rerender(&click_panel, envelope);
                return;
            }

            if let Some(pinned_el) = closest_actionable(&target, "[data-cv-pinned-preset]") {
                let Some(preset_id) = pinned_el.get_attribute("data-cv-pinned-preset") else {
                    return;
                };
                envelope.payload.selected_presets.clear();
                envelope.payload.selected_presets.push(preset_id.clone());
                envelope.payload.mode = "visual".to_string();
                envelope.payload.query_text = combine_selected_presets(&envelope.payload);
                let mut all = builtin_presets();
                all.extend(envelope.payload.custom_presets.clone());
                if let Some(preset) = all.iter().find(|p| p.id == preset_id) {
                    add_recent_filter(&mut envelope.payload, &preset.jql, &preset.label);
                }
                rerender(&click_panel, envelope);
                return;
            }

            if let Some(recent_el) = closest_actionable(&target, "[data-cv-recent-index]") {
                let Some(index_text) = recent_el.get_attribute("data-cv-recent-index") else {
                    return;
                };
                if let Ok(index) = index_text.parse::<usize>() {
                    if let Some(recent) = envelope.payload.recent_filters.get(index) {
                        envelope.payload.mode = "advanced".to_string();
                        envelope.payload.advanced_text = recent.jql.clone();
                        envelope.payload.query_text = recent.jql.clone();
                        rerender(&click_panel, envelope);
                    }
                }
                return;
            }

            if closest_actionable(&target, "[data-cv-add-filter]").is_some() {
                let default_field = friendly_fields()
                    .into_iter()
                    .next()
                    .unwrap_or(FriendlyField {
                        id: "summary",
                        label: "Title contains",
                        emoji: "📝",
                        jql_field: "summary",
                        value_type: "text",
                        default_operator: "contains",
                    });

                envelope.payload.filters.push(VisualFilter {
                    id: format!("filter-{}", js_sys::Date::now() as u64),
                    field_id: default_field.id.to_string(),
                    operator_key: default_field.default_operator.to_string(),
                    value: String::new(),
                    values: Vec::new(),
                });
                envelope.payload.mode = "visual".to_string();
                envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
                rerender(&click_panel, envelope);
                return;
            }

            if let Some(remove_el) = closest_actionable(&target, "[data-cv-remove-filter]") {
                let Some(index_text) = remove_el.get_attribute("data-cv-remove-filter") else {
                    return;
                };
                if let Ok(index) = index_text.parse::<usize>() {
                    if index < envelope.payload.filters.len() {
                        envelope.payload.filters.remove(index);
                        envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
                        rerender(&click_panel, envelope);
                    }
                }
                return;
            }

            if let Some(field_open) = closest_actionable(&target, "[data-cv-filter-field-open]") {
                let Some(index_text) = field_open.get_attribute("data-cv-filter-field-open") else {
                    return;
                };
                if let Ok(index) = index_text.parse::<usize>() {
                    open_field_picker(&click_panel, index);
                }
                return;
            }

            if let Some(sort_remove_el) = closest_actionable(&target, "[data-cv-remove-sort]") {
                let Some(index_text) = sort_remove_el.get_attribute("data-cv-remove-sort") else {
                    return;
                };
                if let Ok(index) = index_text.parse::<usize>() {
                    if index < envelope.payload.sort_entries.len() {
                        envelope.payload.sort_entries.remove(index);
                        if envelope.payload.sort_entries.is_empty() {
                            envelope.payload.sort_entries.push(SortEntry {
                                field: "updated".to_string(),
                                direction: "DESC".to_string(),
                            });
                        }
                        envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
                        rerender(&click_panel, envelope);
                    }
                }
                return;
            }

            if closest_actionable(&target, "[data-cv-add-sort]").is_some() {
                if envelope.payload.sort_entries.len() < 3 {
                    envelope.payload.sort_entries.push(SortEntry {
                        field: "priority".to_string(),
                        direction: "DESC".to_string(),
                    });
                    envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
                    rerender(&click_panel, envelope);
                }
                return;
            }

            if let Some(copy_btn) = closest_actionable(&target, "[data-cv-copy]") {
                let text = active_preview_text(&click_panel);
                let Some(window) = web_sys::window() else {
                    return;
                };
                let navigator = window.navigator();
                let clipboard = navigator.clipboard();
                let _ = clipboard.write_text(&text);
                if let Ok(btn) = copy_btn.dyn_into::<web_sys::HtmlElement>() {
                    let _ = btn.class_list().add_1("copied");
                    btn.set_inner_html("<span>✓</span> Copied!");
                    let btn_clone = btn.clone();
                    let closure = Closure::<dyn FnMut()>::wrap(Box::new(move || {
                        btn_clone.set_inner_html("<span>📋</span> Copy");
                        let _ = btn_clone.class_list().remove_1("copied");
                    }));
                    let _ = window.set_timeout_with_callback_and_timeout_and_arguments_0(
                        closure.as_ref().unchecked_ref(),
                        2000,
                    );
                    closure.forget();
                }
                return;
            }

            if closest_actionable(&target, "[data-cv-clear]").is_some() {
                envelope.payload.filters.clear();
                envelope.payload.selected_presets.clear();
                envelope.payload.search_text.clear();
                envelope.payload.sort_entries = vec![SortEntry {
                    field: "updated".to_string(),
                    direction: "DESC".to_string(),
                }];
                envelope.payload.sort_field = "updated".to_string();
                envelope.payload.sort_direction = "DESC".to_string();
                envelope.payload.advanced_text.clear();
                envelope.payload.query_text.clear();
                rerender(&click_panel, envelope);
                return;
            }

            if closest_actionable(&target, "[data-cv-search]").is_some() {
                let mut preview = active_preview_text(&click_panel);
                if envelope.payload.mode == "quick" {
                    let preset = combine_selected_presets(&envelope.payload);
                    let quick_filters =
                        parse_quick_search_to_filters(&envelope.payload.search_text);
                    let mut quick_state = envelope.payload.clone();
                    quick_state.filters = quick_filters;
                    let quick_query = build_jql_from_filters(&quick_state);

                    let mut parts = Vec::new();
                    if !preset.trim().is_empty() {
                        parts.push(format!("({})", preset.trim()));
                    }
                    if !quick_query.trim().is_empty() {
                        parts.push(format!("({})", quick_query.trim()));
                    }
                    preview = parts.join(" AND ");
                }

                if preview.trim().is_empty() {
                    show_toast(&click_panel, "No JQL to apply. Add filters or presets.");
                    return;
                }

                envelope.payload.query_text = preview.clone();
                envelope.payload.advanced_text = preview.clone();
                add_recent_filter(&mut envelope.payload, &preview, "");

                let _ = save_state(envelope.clone());
                if envelope.payload.run_search {
                    let _ = apply_and_search(&preview);
                } else {
                    let _ = apply_jql(&preview);
                }
                show_toast(&click_panel, "Applied query to Jira");
                return;
            }

            if let Some(ref_tab) = closest_actionable(&target, "[data-cv-ref-tab]") {
                let Some(tab) = ref_tab.get_attribute("data-cv-ref-tab") else {
                    return;
                };

                if let Ok(tabs) = click_panel.query_selector_all("[data-cv-ref-tab]") {
                    for i in 0..tabs.length() {
                        if let Some(node) = tabs.item(i) {
                            if let Ok(el) = node.dyn_into::<web_sys::HtmlElement>() {
                                let _ = el.class_list().remove_1("active");
                            }
                        }
                    }
                }
                if let Ok(el) = ref_tab.dyn_into::<web_sys::HtmlElement>() {
                    let _ = el.class_list().add_1("active");
                }

                if let Ok(groups) = click_panel.query_selector_all("[data-cv-ref-items]") {
                    for i in 0..groups.length() {
                        if let Some(node) = groups.item(i) {
                            if let Ok(el) = node.dyn_into::<web_sys::HtmlElement>() {
                                let group_tab =
                                    el.get_attribute("data-cv-ref-items").unwrap_or_default();
                                let _ = el.style().set_property(
                                    "display",
                                    if group_tab == tab { "flex" } else { "none" },
                                );
                            }
                        }
                    }
                }
                return;
            }

            if let Some(insert_el) = closest_actionable(&target, "[data-cv-insert]") {
                let Some(insert_text) = insert_el.get_attribute("data-cv-insert") else {
                    return;
                };
                if let Ok(Some(textarea_el)) =
                    click_panel.query_selector("[data-cv-advanced-textarea]")
                {
                    if let Ok(textarea) = textarea_el.dyn_into::<web_sys::HtmlTextAreaElement>() {
                        let start = textarea
                            .selection_start()
                            .ok()
                            .flatten()
                            .unwrap_or(textarea.value().len() as u32)
                            as usize;
                        let end = textarea
                            .selection_end()
                            .ok()
                            .flatten()
                            .unwrap_or(start as u32) as usize;
                        let current = textarea.value();
                        let mut next = String::new();
                        let before = &current[..start.min(current.len())];
                        let after = &current[end.min(current.len())..];
                        next.push_str(before);
                        next.push_str(&insert_text);
                        next.push_str(after);
                        textarea.set_value(&next);

                        let mut cursor = start + insert_text.len();
                        if let Some(pos) = insert_text.find("()") {
                            cursor = start + pos + 1;
                        } else if let Some(pos) = insert_text.find("\"\"") {
                            cursor = start + pos + 1;
                        }
                        let _ = textarea.set_selection_range(cursor as u32, cursor as u32);
                        envelope.payload.advanced_text = next.clone();
                        envelope.payload.query_text = next;
                        let _ = save_state(envelope);
                        show_toast(&click_panel, "Inserted snippet");
                    }
                }
                return;
            }
        }));

    panel
        .add_event_listener_with_callback("click", click_handler.as_ref().unchecked_ref())
        .ok();
    click_handler.forget();

    let input_panel = panel.clone();
    let input_handler =
        Closure::<dyn FnMut(web_sys::Event)>::wrap(Box::new(move |event: web_sys::Event| {
            let Some(target) = click_element_from_event(&event) else {
                return;
            };

            let mut envelope = match load_state() {
                Ok(envelope) => envelope,
                Err(_) => StateEnvelope::new(1, JqlPanelState::default()),
            };
            sync_state_from_dom(&mut envelope, &input_panel);

            if let Some(field_select) = closest_actionable(&target, "[data-cv-filter-operator]") {
                let Some(index_text) = field_select.get_attribute("data-cv-filter-operator") else {
                    return;
                };
                let Ok(index) = index_text.parse::<usize>() else {
                    return;
                };
                let Ok(select) = field_select.dyn_into::<web_sys::HtmlSelectElement>() else {
                    return;
                };
                if let Some(filter) = envelope.payload.filters.get_mut(index) {
                    filter.operator_key = select.value();
                    if filter.operator_key == "is-empty" || filter.operator_key == "is-not-empty" {
                        filter.value.clear();
                        filter.values.clear();
                    }
                }
                envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
                let _ = save_state(envelope);
                return;
            }

            if let Some(value_input) = closest_actionable(&target, "[data-cv-filter-value]") {
                let Some(index_text) = value_input.get_attribute("data-cv-filter-value") else {
                    return;
                };
                let Ok(index) = index_text.parse::<usize>() else {
                    return;
                };
                let Ok(input) = value_input.dyn_into::<web_sys::HtmlInputElement>() else {
                    return;
                };
                if let Some(filter) = envelope.payload.filters.get_mut(index) {
                    filter.value = input.value();
                    filter.values = input
                        .value()
                        .split(',')
                        .map(|v| v.trim().to_string())
                        .filter(|v| !v.is_empty())
                        .collect();
                }
                envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
                let _ = save_state(envelope);
                return;
            }

            if let Some(sort_select) = closest_actionable(&target, "[data-cv-sort-field]") {
                let Some(index_text) = sort_select.get_attribute("data-cv-sort-field") else {
                    return;
                };
                let Ok(index) = index_text.parse::<usize>() else {
                    return;
                };
                let Ok(select) = sort_select.dyn_into::<web_sys::HtmlSelectElement>() else {
                    return;
                };
                if let Some(entry) = envelope.payload.sort_entries.get_mut(index) {
                    entry.field = select.value();
                }
                if let Some(first) = envelope.payload.sort_entries.first() {
                    envelope.payload.sort_field = first.field.clone();
                }
                envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
                let _ = save_state(envelope);
                return;
            }

            if let Some(sort_select) = closest_actionable(&target, "[data-cv-sort-direction]") {
                let Some(index_text) = sort_select.get_attribute("data-cv-sort-direction") else {
                    return;
                };
                let Ok(index) = index_text.parse::<usize>() else {
                    return;
                };
                let Ok(select) = sort_select.dyn_into::<web_sys::HtmlSelectElement>() else {
                    return;
                };
                if let Some(entry) = envelope.payload.sort_entries.get_mut(index) {
                    entry.direction = select.value();
                }
                if let Some(first) = envelope.payload.sort_entries.first() {
                    envelope.payload.sort_direction = first.direction.clone();
                }
                envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
                let _ = save_state(envelope);
                return;
            }

            if let Some(quick_input) = closest_actionable(&target, "[data-cv-quick-search]") {
                let Ok(input) = quick_input.dyn_into::<web_sys::HtmlInputElement>() else {
                    return;
                };
                envelope.payload.search_text = input.value();
                envelope.payload.selected_presets.clear();
                envelope.payload.filters =
                    parse_quick_search_to_filters(&envelope.payload.search_text);
                envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
                let _ = save_state(envelope);
                return;
            }

            if let Some(adv_input) = closest_actionable(&target, "[data-cv-advanced-textarea]") {
                let Ok(input) = adv_input.dyn_into::<web_sys::HtmlTextAreaElement>() else {
                    return;
                };
                envelope.payload.advanced_text = input.value();
                envelope.payload.query_text = envelope.payload.advanced_text.clone();
                let _ = save_state(envelope);
                return;
            }

            if let Some(search_el) = closest_actionable(&target, "[data-cv-advanced-search]") {
                let Ok(input) = search_el.dyn_into::<web_sys::HtmlInputElement>() else {
                    return;
                };
                let query = input.value().to_lowercase();
                if let Ok(items) = input_panel.query_selector_all(".cv-ref-item") {
                    for i in 0..items.length() {
                        if let Some(node) = items.item(i) {
                            if let Ok(el) = node.dyn_into::<web_sys::HtmlElement>() {
                                let hay = el.text_content().unwrap_or_default().to_lowercase();
                                let display =
                                    if query.trim().is_empty() || hay.contains(query.trim()) {
                                        "inline-flex"
                                    } else {
                                        "none"
                                    };
                                let _ = el.style().set_property("display", display);
                            }
                        }
                    }
                }
                return;
            }

            if let Some(date_btn) = closest_actionable(&target, "[data-cv-date-preset]") {
                let Some(index_text) = date_btn.get_attribute("data-cv-filter-index") else {
                    return;
                };
                let Some(value) = date_btn.get_attribute("data-cv-date-preset") else {
                    return;
                };
                let Ok(index) = index_text.parse::<usize>() else {
                    return;
                };
                if let Some(filter) = envelope.payload.filters.get_mut(index) {
                    filter.value = value;
                    filter.values.clear();
                }
                envelope.payload.query_text = build_jql_from_filters(&envelope.payload);
                rerender(&input_panel, envelope);
            }
        }));

    panel
        .add_event_listener_with_callback("input", input_handler.as_ref().unchecked_ref())
        .ok();
    panel
        .add_event_listener_with_callback("change", input_handler.as_ref().unchecked_ref())
        .ok();
    input_handler.forget();

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
    if envelope.payload.advanced_text.trim().is_empty() {
        envelope.payload.advanced_text = dom::element_value(ADVANCED_INPUT)?.unwrap_or_default();
    }
    if envelope.payload.query_text.trim().is_empty() {
        envelope.payload.query_text = envelope.payload.advanced_text.clone();
    }
    envelope.payload.mode = normalize_mode(&envelope.payload.mode);

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
