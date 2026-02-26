use cv_ext_contract::{RuleCategory, RuleTrigger, Site};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

fn to_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(|err| JsValue::from_str(&err.to_string()))
}

#[derive(Serialize, Deserialize)]
pub struct UiRuleSummary {
    pub id: String,
    pub label: String,
    pub site: String,
    pub site_label: String,
    pub site_accent: String,
    pub category: String,
    pub category_short: String,
    pub category_variant: String,
    pub priority: u16,
    pub enabled: bool,
    pub builtin: bool,
    pub is_on_demand: bool,
    pub is_auto_trigger: bool,
    pub is_data_capture: bool,
    pub is_validation: bool,
    pub is_long_running: bool,
}

fn site_label(site: Site) -> &'static str {
    match site {
        Site::Jira => "Jira",
        Site::Oracle => "Oracle",
        Site::Carma => "Carma",
    }
}

fn site_accent(site: Site) -> &'static str {
    match site {
        Site::Jira => "#22d3ee",
        Site::Oracle => "#fbbf24",
        Site::Carma => "#34d399",
    }
}

fn category_display(cat: &RuleCategory) -> &'static str {
    match cat {
        RuleCategory::UiEnhancement => "UI Enhancement",
        RuleCategory::DataCapture => "Data Capture",
        RuleCategory::FormAutomation => "Form Automation",
        RuleCategory::Navigation => "Navigation",
        RuleCategory::Validation => "Validation",
    }
}

fn category_short(cat: &RuleCategory) -> &'static str {
    match cat {
        RuleCategory::UiEnhancement => "UI",
        RuleCategory::DataCapture => "Data",
        RuleCategory::FormAutomation => "Form",
        RuleCategory::Navigation => "Nav",
        RuleCategory::Validation => "Check",
    }
}

fn category_variant(cat: &RuleCategory) -> &'static str {
    match cat {
        RuleCategory::UiEnhancement => "info",
        RuleCategory::DataCapture => "success",
        RuleCategory::FormAutomation => "info",
        RuleCategory::Navigation => "neutral",
        RuleCategory::Validation => "warning",
    }
}

const DATA_CAPTURE_RULES: &[&str] = &["jira.issue.capture.table", "carma.bulk.search.scrape"];
const VALIDATION_RULES: &[&str] = &["oracle.invoice.validation.alert"];
const LONG_RUNNING_RULES: &[&str] = &[
    "jira.jql.builder",
    "carma.bulk.search.scrape",
    "oracle.invoice.create",
];

fn to_ui_summary(r: cv_ext_contract::RuleDefinition) -> UiRuleSummary {
    let is_auto = !matches!(r.trigger, RuleTrigger::OnDemand);
    UiRuleSummary {
        id: r.id.clone(),
        label: r.label,
        site: r.site.as_str().to_string(),
        site_label: site_label(r.site).to_string(),
        site_accent: site_accent(r.site).to_string(),
        category: category_display(&r.category).to_string(),
        category_short: category_short(&r.category).to_string(),
        category_variant: category_variant(&r.category).to_string(),
        priority: r.priority,
        enabled: r.enabled,
        builtin: r.builtin,
        is_on_demand: matches!(r.trigger, RuleTrigger::OnDemand),
        is_auto_trigger: is_auto,
        is_data_capture: DATA_CAPTURE_RULES.contains(&r.id.as_str()),
        is_validation: VALIDATION_RULES.contains(&r.id.as_str()),
        is_long_running: LONG_RUNNING_RULES.contains(&r.id.as_str()),
    }
}

#[wasm_bindgen]
pub fn ui_rules_for_site(site_str: String) -> Result<JsValue, JsValue> {
    let site = Site::try_from(site_str.as_str()).map_err(|e| JsValue::from_str(&e))?;
    let rules = cv_ext_core::rules_for_site(site);
    let summaries: Vec<UiRuleSummary> = rules
        .into_iter()
        .filter(|r| r.priority < 200)
        .map(to_ui_summary)
        .collect();
    to_js(&summaries)
}

#[wasm_bindgen]
pub fn ui_all_rules() -> Result<JsValue, JsValue> {
    let mut all = Vec::new();
    for site in &[Site::Jira, Site::Oracle, Site::Carma] {
        let rules = cv_ext_core::rules_for_site(*site);
        for r in rules {
            if r.priority >= 200 {
                continue;
            }
            all.push(to_ui_summary(r));
        }
    }
    all.sort_by(|a, b| a.label.cmp(&b.label));
    to_js(&all)
}

#[derive(Serialize)]
pub struct ClassifiedResult {
    pub ok: bool,
    pub status: String,
    pub error: Option<String>,
}

#[wasm_bindgen]
pub fn classify_rule_result(result_json: String) -> Result<JsValue, JsValue> {
    let value: serde_json::Value = serde_json::from_str(&result_json)
        .map_err(|e| JsValue::from_str(&format!("JSON parse error: {e}")))?;
    let classified = classify_value(&value);
    to_js(&classified)
}

fn classify_value(value: &serde_json::Value) -> ClassifiedResult {
    if let Some(obj) = value.as_object() {
        if let Some(ok) = obj.get("ok").and_then(|v| v.as_bool()) {
            if !ok {
                let error = obj
                    .get("error")
                    .or_else(|| obj.get("message"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Rule execution failed")
                    .to_string();
                return ClassifiedResult {
                    ok: false,
                    status: "failed".to_string(),
                    error: Some(error),
                };
            }
        }
        if let Some(status) = obj.get("status").and_then(|v| v.as_str()) {
            let lower = status.to_lowercase();
            if lower == "failed" || lower == "error" || lower == "partial" {
                let error = obj
                    .get("error")
                    .or_else(|| obj.get("message"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| format!("Rule execution ended with status: {lower}"));
                return ClassifiedResult {
                    ok: false,
                    status: lower,
                    error: Some(error),
                };
            }
        }
    }
    ClassifiedResult {
        ok: true,
        status: "success".to_string(),
        error: None,
    }
}
