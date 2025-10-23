/**
 * Shared types for selector specs, waits, actions, workflows, and settings.
 */

export type TextMatcher =
  | { equals: string; caseInsensitive?: boolean; trim?: boolean }
  | { includes: string; caseInsensitive?: boolean; trim?: boolean }
  | { regex: string; flags?: string; trim?: boolean };

export type AttributeMatcher =
  | string
  | { equals?: string; includes?: string; regex?: string; flags?: string };

export interface SelectorSpec {
  selector?: string;
  id?: string;
  text?: TextMatcher;
  attribute?: Record<string, AttributeMatcher>;
  role?: string;
  tag?: string;
  type?: string;
  visible?: boolean;
  within?: SelectorSpec;
  and?: SelectorSpec[];
  or?: SelectorSpec[];
  not?: SelectorSpec;
  nth?: number;
}

/** Read globals safely (no DOM selection). */
export type GlobalKey =
  | 'document.title'
  | 'location.href'
  | 'location.host'
  | 'location.pathname'
  | 'navigator.userAgent'
  | 'timestamp';

export interface GlobalSource {
  global: GlobalKey;
}

export type SourceSpec = SelectorSpec | GlobalSource;

export interface WaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  visibleOnly?: boolean;
  minStabilityMs?: number;
}

export type ConditionSpec =
  | { exists: SelectorSpec }
  | { notExists: SelectorSpec }
  | { textPresent: { where: SelectorSpec; matcher: TextMatcher } }
  | { any: ConditionSpec[] }
  | { all: ConditionSpec[] }
  | { not: ConditionSpec };

export type ActionResult =
  | { ok: true; data?: any }
  | { ok: false; error: string; details?: any };

/** Options (params) a workflow can expose and persist. */
export type WorkflowOption =
  | { key: string; label: string; type: 'string'; default?: string }
  | { key: string; label: string; type: 'number'; default?: number }
  | { key: string; label: string; type: 'boolean'; default?: boolean }
  | { key: string; label: string; type: 'select'; default?: string; choices: { value: string; label: string }[] }
  | { key: string; label: string; type: 'multi'; default?: string[]; hint?: string }  // newline-separated textarea
  | { key: string; label: string; type: 'json'; default?: any };

export type TakeSpec = 'text'|'html'|'value'|'href'|{attribute: string}|'raw';

export type Action =
  | { kind: 'waitFor'; target: SelectorSpec; wait?: WaitOptions; comment?: string }
  | { kind: 'delay'; ms: number; comment?: string }
  | { kind: 'click'; target: SelectorSpec; preWait?: WaitOptions; postWaitFor?: SelectorSpec; comment?: string }
  | { kind: 'type'; target: SelectorSpec; text: string; clearFirst?: boolean; perKeystrokeDelayMs?: number; postEnter?: boolean; comment?: string }
  | { kind: 'selectFromList'; list: SelectorSpec; item: SelectorSpec; comment?: string }
  | { kind: 'extract'; items: { from: SourceSpec; take?: TakeSpec; intoKey: string }[]; copyToClipboard?: boolean; present?: boolean; comment?: string }
  | { kind: 'extractList';
      list: SelectorSpec;
      fields: { key: string; take: TakeSpec; from?: SelectorSpec }[];
      intoKey: string;
      limit?: number|string; // allow templating -> string
      visibleOnly?: boolean;
      copyToClipboard?: boolean;
      present?: boolean;
      comment?: string;
    }
  | { kind: 'branch'; condition: ConditionSpec; thenWorkflow: string; elseWorkflow?: string; comment?: string }
  | { kind: 'error'; message: string; comment?: string };

export interface WorkflowDefinition {
  id: string;
  label: string;
  description?: string;
  enabledWhen?: ConditionSpec;
  steps: Action[];
  /** Persisted options available as {{opt.KEY}} */
  options?: WorkflowOption[];
}

export interface PageDefinition {
  id: string;
  label: string;
  detector: ConditionSpec;
  workflows: WorkflowDefinition[];
}

export interface ThemeConfig {
  primary: string;
  background: string;
  text: string;
  accent: string;
}

export interface Settings {
  theme: ThemeConfig;
  interActionDelayMs: number;
  loadingIndicator?: SelectorSpec;
}

export interface Registry {
  pages: PageDefinition[];
}
