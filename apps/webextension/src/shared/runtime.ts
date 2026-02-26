import { browserApi } from './browser-api';

export interface RustRuleDefinition {
  id: string;
  label: string;
  description: string;
  site: string;
  enabled: boolean;
  url_pattern: string | null;
  trigger: unknown;
  priority: number;
  category: string;
  builtin: boolean;
}

export interface RustThemeTokens {
  bg_primary: string;
  bg_secondary: string;
  bg_surface: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  accent: string;
  accent_hover: string;
  border: string;
  border_active: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  radius_sm: string;
  radius_md: string;
  radius_lg: string;
  font_family: string;
  font_mono: string;
}

export interface RustThemeDefinition {
  id: string;
  label: string;
  tokens: RustThemeTokens;
}


export interface UiRuleSummary {
  id: string;
  label: string;
  site: string;
  site_label: string;
  site_accent: string;
  category: string;
  category_short: string;
  category_variant: string;
  priority: number;
  enabled: boolean;
  builtin: boolean;
  is_on_demand: boolean;
  is_auto_trigger: boolean;
  is_data_capture: boolean;
  is_validation: boolean;
  is_long_running: boolean;
}

export interface ClassifiedResult {
  ok: boolean;
  status: string;
  error?: string;
}

export interface RustRuntime {
  detect_site(href: string): string;
  list_rules(site: string): RustRuleDefinition[];
  run_rule(site: string, ruleId: string, inputJson?: string | null): Promise<unknown>;
  capture_jira_filter_table(): Promise<unknown>;
  get_builtin_themes(): RustThemeDefinition[];
  default_settings(): unknown;
  jql_init_state?(): unknown;
  jql_apply_action?(state: unknown, action: unknown): unknown;
  jql_format?(state: unknown, autoQuote?: boolean): string;
  jql_presets_list?(): unknown;
  jql_presets_save?(presets: unknown): unknown;
  ui_rules_for_site?(site: string): UiRuleSummary[];
  ui_all_rules?(): UiRuleSummary[];
  classify_rule_result?(resultJson: string): ClassifiedResult;
}

let runtimePromise: Promise<RustRuntime | null> | null = null;

export function loadRuntime(): Promise<RustRuntime | null> {
  if (runtimePromise) {
    return runtimePromise;
  }

  runtimePromise = (async () => {
    try {
      const ext = browserApi() as any;
      const wasmModuleUrl = ext.runtime.getURL('pkg/cv_ext_wasm.js');
      const wasmModule = await import(wasmModuleUrl);
      await wasmModule.default();

      const runtime: RustRuntime = {
        detect_site: wasmModule.detect_site,
        list_rules: wasmModule.list_rules,
        run_rule: wasmModule.run_rule ?? wasmModule.run_workflow,
        capture_jira_filter_table: wasmModule.capture_jira_filter_table,
        get_builtin_themes: wasmModule.get_builtin_themes,
        default_settings: wasmModule.default_settings,
        jql_init_state: wasmModule.jql_init_state,
        jql_apply_action: wasmModule.jql_apply_action,
        jql_format: wasmModule.jql_format,
        jql_presets_list: wasmModule.jql_presets_list,
        jql_presets_save: wasmModule.jql_presets_save,
        ui_rules_for_site: wasmModule.ui_rules_for_site,
        ui_all_rules: wasmModule.ui_all_rules,
        classify_rule_result: wasmModule.classify_rule_result,
      };

      (globalThis as any).__cv_wasm = runtime;
      return runtime;
    } catch (err) {
      console.error('[cv-ext] Failed to load WASM runtime:', err);
      return null;
    }
  })();

  return runtimePromise;
}
