export interface ExtMessage {
  kind: string;
  payload?: unknown;
  tabId?: number;
  requestId?: string;
}

export interface ExtResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
  requestId?: string;
}

export type RuntimeCommand =
  | { kind: 'detect-site'; payload: { url: string } }
  | { kind: 'run-rule'; payload: { ruleId: string; site: string; context?: string } }
  | { kind: 'run-rule-with-result-mode'; payload: { ruleId: string; site: string; context?: string; resultMode: 'return' | 'store' } }
  | { kind: 'run-auto-rules'; payload: { url: string } }
  | { kind: 'get-rules'; payload: { site: string } }
  | { kind: 'toggle-rule'; payload: { ruleId: string; enabled: boolean } }
  | { kind: 'get-settings' }
  | { kind: 'save-settings'; payload: unknown }
  | { kind: 'theme-changed'; payload: { themeId: string } }
  | { kind: 'open-extension-page' }
  | { kind: 'open-control-center'; tabId?: number; windowId?: number }
  | { kind: 'data-captured'; payload: { site: string; data: unknown } }
  | { kind: 'result-ready'; payload: { site: string; report: unknown } }
  | { kind: 'download-result'; payload: { filename: string; mime: string; data: string } }
  | { kind: 'copy-result'; payload: { data: string } }
  | { kind: 'capture-table' };

export type RuntimeResponse = ExtResponse;
