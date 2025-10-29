import type { Store } from './storage';

/**
 * Shared types for selector specs, waits, actions, workflows, and settings.
 */

export type TextMatcher =
  | { equals: string; caseInsensitive?: boolean; trim?: boolean }
  | { includes: string; caseInsensitive?: boolean; trim?: boolean }
  | { regex: string; flags?: string; trim?: boolean };

export type AttributeMatcher =
  | string
  | {
      equals?: string;
      includes?: string;
      regex?: string;
      flags?: string;
      caseInsensitive?: boolean;
    };

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

export type CapturePattern =
  | { type?: 'regex'; into: string; pattern: string; flags?: string; group?: number; matchIndex?: number; multiple?: boolean; trim?: boolean }
  | { type: 'selector'; into: string; selector: string; attribute?: string; take?: TakeSpec; index?: number; all?: boolean; trim?: boolean }
  | { type: 'split'; into: string; delimiter: string; index?: number; trim?: boolean };

export type WorkflowLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WorkflowExecuteContext {
  workflowId: string;
  vars: Record<string, any>;
  options: Record<string, any>;
  profile: { id: string; label: string };
  log: (message: string, level?: WorkflowLogLevel) => void;
  runWorkflow: (workflowId: string, options?: { silent?: boolean }) => Promise<boolean>;
  setVar: (key: string, value: any) => void;
  getVar: <T = any>(key: string) => T | undefined;
  store: Store;
}

export type WorkflowExecuteFn = (context: WorkflowExecuteContext) => any | Promise<any>;

export type Action =
  | { kind: 'waitFor'; target: SelectorSpec; wait?: WaitOptions; comment?: string }
  | { kind: 'delay'; ms: number; comment?: string }
  | { kind: 'click'; target: SelectorSpec; preWait?: WaitOptions; postWaitFor?: SelectorSpec; postWaitTimeoutMs?: number; postWaitPollMs?: number; comment?: string }
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
  | { kind: 'captureData';
      id: string;
      prompt: string;
      patterns?: CapturePattern[];
      optionKey?: string; // optional workflow option containing array/object patterns
      required?: boolean;
      present?: boolean;
      copyToClipboard?: boolean;
      rememberKey?: string; // optional key to cache last input
      comment?: string;
    }
  | { kind: 'branch'; condition: ConditionSpec; thenWorkflow: string; elseWorkflow?: string; comment?: string }
  | { kind: 'error'; message: string; comment?: string }
  | { kind: 'execute'; run: WorkflowExecuteFn; assign?: string; comment?: string };

export interface WorkflowMutationWatchConfig {
  /** Selector describing the DOM subtree to observe for changes. When omitted we derive from auto-run selectors. */
  root?: SelectorSpec;
  /** Debounce window before forcing an auto-run retry */
  debounceMs?: number;
  /** Observe attribute changes in addition to child mutations (default: true) */
  observeAttributes?: boolean;
  /** Observe text mutations (default: false) */
  observeCharacterData?: boolean;
  /** Observe child list mutations (default: true) */
  observeChildList?: boolean;
  /** Optional attribute filter when observeAttributes is true */
  attributeFilter?: string[];
  /** Defaults to true; set false to respect cooldown/context checks for mutation-triggered retries. */
  forceAutoRun?: boolean;
}

export interface WorkflowAutoRunConfig {
  /** Optional timeout when waiting for auto-run conditions to become true */
  waitForMs?: number;
  /** Optional poll interval while waiting for auto-run conditions */
  pollIntervalMs?: number;
  /** Override timeout for auto-run condition evaluation */
  waitForConditionMs?: number;
  /** Override timeout for readiness checks after conditions are met */
  waitForReadyMs?: number;
  /** Require a selector to be present before starting */
  waitForSelector?: SelectorSpec;
  /** Require a selector to disappear before starting */
  waitForHiddenSelector?: SelectorSpec;
  /** Require an element to become interactable (visible, sized, enabled) */
  waitForInteractableSelector?: SelectorSpec;
  /** When false, skip waiting on global loading indicator */
  respectLoadingIndicator?: boolean;
  /** If the workflow fails to run, retry after this delay (ms). Requires repeat=true. */
  retryDelayMs?: number;
  /** When true, skip readiness polling and rely on workflow steps to wait */
  skipReadiness?: boolean;
  /** Watch for DOM mutations and trigger forced auto-runs when conditions reset */
  watchMutations?: boolean | WorkflowMutationWatchConfig;
  /** Derive a context token to decide whether to rerun when URL stays the same */
  context?: WorkflowAutoRunContext;
}

export type WorkflowAutoRunContext =
  | string
  | (() => string | null | undefined)
  | {
      /** Element to inspect for context (optional when using resolver) */
      selector?: SelectorSpec;
      /** Attribute name to read; when omitted falls back to textContent if textContent=true */
      attribute?: string;
      /** When true, use textContent from the selector (trimmed when trim=true) */
      textContent?: boolean;
      /** Trim whitespace when pulling textContent */
      trim?: boolean;
      /** Fallback token when selector lookup fails */
      fallback?: string;
      /** Custom resolver overrides selector/attribute/text handling */
      resolve?: () => string | null | undefined;
    };

export interface WorkflowProfilesConfig {
  /** Disable profile switching UI when set to false */
  enabled?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  label: string;
  description?: string;
  enabledWhen?: ConditionSpec;
  steps: Action[];
  /** Persisted options available as {{opt.KEY}} */
  options?: WorkflowOption[];
  /** Controls auto-run behaviour (e.g., wait for conditions) */
  autoRun?: WorkflowAutoRunConfig;
  /** Controls profile selector behaviour */
  profiles?: WorkflowProfilesConfig;
  /** Marks helper workflows that should stay hidden from UI/autorun */
  internal?: boolean;
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
  panelOpacity: number;
}

export interface Settings {
  theme: ThemeConfig;
  interActionDelayMs: number;
  loadingIndicator?: SelectorSpec;
}

export interface Registry {
  pages: PageDefinition[];
}
