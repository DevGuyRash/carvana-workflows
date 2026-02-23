export type RuntimeCommand =
  | { kind: 'detect-site' }
  | { kind: 'list-workflows'; site: string }
  | { kind: 'run-workflow'; site: string; workflowId: string }
  | { kind: 'capture-jira-table' };

export interface RuntimeResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}
