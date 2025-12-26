import type { WorkflowAutoRunConfig, WorkflowDefinition } from './types';
import type { WorkflowRunPrefs } from './autorun';

export type TriggerSource = 'default' | 'definition' | 'prefs';

export type TriggerState = {
  available: boolean;
  enabled: boolean;
  source: TriggerSource;
};

export type WorkflowTriggerState = {
  manual: TriggerState;
  auto: TriggerState & { config?: WorkflowAutoRunConfig };
  repeat: TriggerState;
};

export function resolveAutoRunConfig(wf: WorkflowDefinition): WorkflowAutoRunConfig | undefined {
  return wf.triggers?.auto?.config ?? wf.autoRun;
}

export function isManualTriggerAvailable(wf: WorkflowDefinition): boolean {
  return wf.triggers?.manual?.enabled !== false;
}

export function isAutoTriggerAvailable(wf: WorkflowDefinition): boolean {
  return wf.triggers?.auto?.enabled !== false;
}

export function isRepeatTriggerAvailable(wf: WorkflowDefinition): boolean {
  return wf.triggers?.repeat?.enabled !== false;
}

export function resolveTriggerState(wf: WorkflowDefinition, prefs: WorkflowRunPrefs): WorkflowTriggerState {
  const manualAvailable = isManualTriggerAvailable(wf);
  const autoAvailable = isAutoTriggerAvailable(wf);
  const repeatAvailable = autoAvailable && isRepeatTriggerAvailable(wf);
  const autoEnabled = autoAvailable && prefs.auto;
  const repeatEnabled = repeatAvailable && prefs.repeat && autoEnabled;

  return {
    manual: {
      available: manualAvailable,
      enabled: manualAvailable,
      source: wf.triggers?.manual ? 'definition' : 'default'
    },
    auto: {
      available: autoAvailable,
      enabled: autoEnabled,
      source: 'prefs',
      config: resolveAutoRunConfig(wf)
    },
    repeat: {
      available: repeatAvailable,
      enabled: repeatEnabled,
      source: 'prefs'
    }
  };
}
