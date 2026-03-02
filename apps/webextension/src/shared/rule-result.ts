import type { ResultArtifact } from '../ui/components/result-viewer';

export interface NormalizedTableArtifact {
  name: string;
  columns: string[];
  rows: string[][];
}

export interface NormalizedRuleExecution {
  transportOk: boolean;
  workflowStatus: 'success' | 'partial' | 'failed' | 'unknown';
  errorMessage: string | null;
  tableArtifacts: NormalizedTableArtifact[];
}

function toStringCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeStatus(rawStatus: unknown): NormalizedRuleExecution['workflowStatus'] {
  if (typeof rawStatus !== 'string') return 'unknown';
  const status = rawStatus.toLowerCase();
  if (status === 'success') return 'success';
  if (status === 'partial') return 'partial';
  if (status === 'failed' || status === 'error') return 'failed';
  return 'unknown';
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function parseTableArtifacts(fromObject: Record<string, unknown> | null): NormalizedTableArtifact[] {
  if (!fromObject || !Array.isArray(fromObject.artifacts)) return [];
  const out: NormalizedTableArtifact[] = [];

  for (const item of fromObject.artifacts) {
    const artifact = asObject(item);
    if (!artifact) continue;
    const kind = typeof artifact.kind === 'string' ? artifact.kind.toLowerCase() : '';
    if (kind !== 'table') continue;
    if (!Array.isArray(artifact.columns) || !Array.isArray(artifact.rows)) continue;

    const columns = artifact.columns.map((col) => toStringCell(col));
    const rows = artifact.rows
      .filter((row) => Array.isArray(row))
      .map((row) => (row as unknown[]).map((cell) => toStringCell(cell)));
    const name = typeof artifact.name === 'string' ? artifact.name : 'table';
    out.push({ name, columns, rows });
  }

  return out;
}

function parseDirectTableRows(value: unknown): NormalizedTableArtifact[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  if (!value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) return [];

  const objects = value as Record<string, unknown>[];
  const columns: string[] = [];
  for (const row of objects) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }

  const rows = objects.map((row) => columns.map((column) => toStringCell(row[column])));
  return [{ name: 'table', columns, rows }];
}

export function normalizeRuleExecution(raw: unknown): NormalizedRuleExecution {
  const envelope = asObject(raw);
  const hasTransportEnvelope = !!envelope && typeof envelope.ok === 'boolean';
  const transportOk = hasTransportEnvelope ? (envelope.ok as boolean) : false;

  const data = envelope && 'data' in envelope ? envelope.data : raw;
  const payload = asObject(data);
  const workflowStatus = normalizeStatus(payload?.status);

  const envelopeError = envelope
    ? toStringCell(envelope.error ?? envelope.message ?? '')
    : '';
  const payloadError = payload
    ? toStringCell(payload.error ?? payload.message ?? '')
    : '';

  const tableArtifacts = parseTableArtifacts(payload);
  if (tableArtifacts.length === 0) {
    tableArtifacts.push(...parseDirectTableRows(data));
  }

  const errorMessage = !transportOk
    ? (envelopeError || payloadError || 'Rule execution failed')
    : (payloadError || null);

  return {
    transportOk,
    workflowStatus,
    errorMessage,
    tableArtifacts,
  };
}

export function executionFailureMessage(
  normalized: NormalizedRuleExecution,
  opts?: { treatPartialAsFailure?: boolean },
): string | null {
  const treatPartialAsFailure = opts?.treatPartialAsFailure ?? true;
  if (!normalized.transportOk) {
    return normalized.errorMessage ?? 'Rule execution failed';
  }
  if (normalized.workflowStatus === 'failed') {
    return normalized.errorMessage ?? 'Rule execution failed';
  }
  if (normalized.workflowStatus === 'partial' && treatPartialAsFailure) {
    return normalized.errorMessage ?? 'Rule execution partially completed';
  }
  return null;
}

export function extractCaptureRows(normalized: NormalizedRuleExecution): Record<string, string>[] {
  const table = normalized.tableArtifacts[0];
  if (!table) return [];
  return table.rows.map((row) => {
    const out: Record<string, string> = {};
    for (let i = 0; i < table.columns.length; i += 1) {
      out[table.columns[i]] = row[i] ?? '';
    }
    return out;
  });
}

export function toPrimaryResultArtifact(
  normalized: NormalizedRuleExecution,
  ruleId: string,
  ruleLabel: string,
): ResultArtifact | null {
  const table = normalized.tableArtifacts[0];
  if (table) {
    const rows = extractCaptureRows(normalized);
    return {
      type: 'table',
      title: ruleLabel,
      columns: table.columns.map((key) => ({ key, label: key, sortable: true })),
      rows,
      meta: {
        Rule: ruleId,
        Rows: String(rows.length),
        Captured: new Date().toLocaleTimeString(),
      },
    };
  }
  return null;
}
