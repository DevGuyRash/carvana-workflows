import type { SelectorSpec } from '@cv/core';
import { findAll, normalizeWhitespace, sleep, now } from '@cv/core';

export type InvoiceValidationStatus = 'validated' | 'needs-revalidated' | 'unknown';

export interface InvoiceStatusDetectionAttempt {
  attempt: number;
  timestamp: string;
  elapsedMs: number;
  foundCandidate: boolean;
  classifiedStatus?: InvoiceValidationStatus;
  statusText?: string;
  delayBeforeNextMs?: number;
}

export interface ManualVerificationOptions {
  expectedStatus?: InvoiceValidationStatus;
  expectedSnippet?: string;
}

export interface ManualVerificationDiagnostics {
  enabled: boolean;
  expectedStatus?: InvoiceValidationStatus;
  statusMatches?: boolean;
  snippetMatches?: boolean;
  baselineSnippetPreview?: string;
  mismatchSummary?: string;
}

export interface InvoiceStatusDetectionDiagnostics {
  attemptLog: InvoiceStatusDetectionAttempt[];
  totalDurationMs: number;
  manualVerification: ManualVerificationDiagnostics;
  bannerToken: string;
  statusText: string;
  snippet: string;
  elementPath: string;
  exhaustedRetries: boolean;
}

export interface DetectionResult {
  status: InvoiceValidationStatus;
  statusText: string;
  snippet: string;
  elementPath: string;
  attempts: number;
  verified: boolean;
  bannerToken: string;
  diagnostics: InvoiceStatusDetectionDiagnostics;
}

export interface DetectInvoiceValidationStatusOptions {
  root?: Document | Element;
  manualVerification?: boolean | ManualVerificationOptions;
  maxDurationMs?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onAttempt?: (attempt: InvoiceStatusDetectionAttempt) => void;
}

type ManualVerificationState = {
  enabled: boolean;
  expectedStatus?: InvoiceValidationStatus;
  expectedSnippet?: string;
};

type CandidateDetection = {
  status: InvoiceValidationStatus;
  statusText: string;
  container: HTMLElement;
  anchor?: HTMLElement;
};

const STATUS_CELL_SPEC: SelectorSpec = {
  tag: 'td',
  attribute: {
    headers: { regex: 'ValidationStatus', flags: 'i' }
  },
  visible: true
};

const DEFAULT_MAX_DURATION_MS = 12_000;
const DEFAULT_INITIAL_DELAY_MS = 200;
const DEFAULT_MAX_DELAY_MS = 1_200;
const DEFAULT_BACKOFF_MULTIPLIER = 1.6;
const SNIPPET_MAX_LENGTH = 600;
const SNIPPET_PREVIEW_LENGTH = 200;

const BANNER_TOKEN_MAP: Record<InvoiceValidationStatus, string> = {
  validated: 'hud.validation-banner.validated',
  'needs-revalidated': 'hud.validation-banner.needs-revalidated',
  unknown: 'hud.validation-banner.unknown'
};

export async function detectInvoiceValidationStatus(
  options: DetectInvoiceValidationStatusOptions = {}
): Promise<DetectionResult> {
  const root = options.root ?? document;
  const doc = resolveDocument(root);
  const manualState = resolveManualState(options.manualVerification);
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const backoffMultiplier = options.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER;

  const attemptLog: InvoiceStatusDetectionAttempt[] = [];
  let delayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  let attempt = 0;
  let lastCandidate: CandidateDetection | null = null;
  const start = now();

  while (true) {
    attempt += 1;
    const elapsedMs = now() - start;
    if (elapsedMs > maxDurationMs && attempt > 1) {
      break;
    }

    const candidate = detectOnce(root);
    if (candidate) {
      lastCandidate = candidate;
    }

    const logEntry: InvoiceStatusDetectionAttempt = {
      attempt,
      timestamp: new Date().toISOString(),
      elapsedMs: Math.round(elapsedMs),
      foundCandidate: !!candidate,
      classifiedStatus: candidate?.status,
      statusText: candidate?.statusText
    };
    attemptLog.push(logEntry);
    options.onAttempt?.(logEntry);

    if (candidate && candidate.status !== 'unknown') {
      return buildDetectionResult({
        detection: candidate,
        attemptLog,
        manualState,
        durationMs: Math.round(now() - start),
        exhausted: false,
        doc
      });
    }

    const elapsedAfterCheck = now() - start;
    if (elapsedAfterCheck >= maxDurationMs) {
      break;
    }

    const remaining = maxDurationMs - elapsedAfterCheck;
    const waitFor = Math.min(delayMs, remaining);
    if (waitFor > 0) {
      logEntry.delayBeforeNextMs = Math.round(waitFor);
      await sleep(waitFor);
    }

    delayMs = Math.min(Math.ceil(delayMs * backoffMultiplier), maxDelayMs);
  }

  return buildDetectionResult({
    detection: lastCandidate ?? null,
    attemptLog,
    manualState,
    durationMs: Math.round(now() - start),
    exhausted: true,
    doc
  });
}

function detectOnce(root: Document | Element): CandidateDetection | null {
  const candidates = findAll(STATUS_CELL_SPEC, { root, visibleOnly: false });
  let fallback: CandidateDetection | null = null;

  for (const cell of candidates) {
    if (!(cell instanceof HTMLElement)) continue;
    if (!cell.isConnected) continue;

    const anchor = cell.querySelector<HTMLElement>('a[role], a, span, div');
    const textSource = anchor ?? cell;
    const rawText = normalizeWhitespace(textSource.textContent ?? '');
    if (!rawText) continue;

    const status = classifyStatus(rawText);
    const detection: CandidateDetection = {
      status,
      statusText: rawText,
      container: cell,
      anchor: anchor ?? undefined
    };

    if (status !== 'unknown') {
      return detection;
    }

    if (!fallback) {
      fallback = detection;
    }
  }

  return fallback;
}

function classifyStatus(text: string): InvoiceValidationStatus {
  const normalized = normalizeForMatch(text);
  if (!normalized) return 'unknown';

  const tokens = normalized.split(' ');
  const hasNeeds = tokens.includes('needs');
  const hasValidatedToken = tokens.includes('validated');
  const hasValidationToken =
    tokens.includes('validation') || tokens.includes('revalidation') || tokens.includes('reverification');
  const hasReValidationFamily = tokens.some(token => token.startsWith('revalid') || token.startsWith('reverif'));
  const hasReToken = tokens.includes('re') || hasReValidationFamily;
  const hasNegation = tokens.includes('not') || tokens.includes('unvalidated');

  if (hasNeeds && (hasValidatedToken || hasValidationToken || hasReValidationFamily) && hasReToken) {
    return 'needs-revalidated';
  }

  if (hasValidatedToken && !hasNegation && !(hasNeeds && hasReToken)) {
    return 'validated';
  }

  if (tokens.length === 1 && tokens[0] === 'validated') {
    return 'validated';
  }

  return 'unknown';
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveDocument(root: Document | Element): Document {
  if (root instanceof Document) return root;
  return root.ownerDocument ?? document;
}

function resolveManualState(input?: boolean | ManualVerificationOptions): ManualVerificationState {
  if (!input) return { enabled: false };
  if (input === true) return { enabled: true };
  return {
    enabled: true,
    expectedStatus: input.expectedStatus,
    expectedSnippet: input.expectedSnippet
  };
}

function buildDetectionResult(args: {
  detection: CandidateDetection | null;
  attemptLog: InvoiceStatusDetectionAttempt[];
  manualState: ManualVerificationState;
  durationMs: number;
  exhausted: boolean;
  doc: Document;
}): DetectionResult {
  const { detection, attemptLog, manualState, durationMs, exhausted, doc } = args;

  const status = detection?.status ?? 'unknown';
  const statusText = detection?.statusText ?? '';
  const snippet = detection ? captureSnippet(detection.container) : '';
  const elementPath = detection ? buildElementPath(detection.container, detection.anchor, doc) : 'ValidationStatus (not located)';
  const manualDiagnostics = computeManualDiagnostics(manualState, status, snippet);
  const diagnostics: InvoiceStatusDetectionDiagnostics = {
    attemptLog,
    totalDurationMs: durationMs,
    manualVerification: manualDiagnostics,
    bannerToken: BANNER_TOKEN_MAP[status],
    statusText,
    snippet,
    elementPath,
    exhaustedRetries: exhausted || status === 'unknown'
  };

  return {
    status,
    statusText,
    snippet,
    elementPath,
    attempts: attemptLog.length,
    verified: manualState.enabled,
    bannerToken: diagnostics.bannerToken,
    diagnostics
  };
}

function computeManualDiagnostics(
  state: ManualVerificationState,
  detectedStatus: InvoiceValidationStatus,
  snippet: string
): ManualVerificationDiagnostics {
  if (!state.enabled) {
    return { enabled: false };
  }

  const sanitizedSnippet = sanitizeSnippet(snippet);
  const sanitizedBaseline = state.expectedSnippet ? sanitizeSnippet(state.expectedSnippet) : undefined;
  const snippetMatches = sanitizedBaseline != null ? sanitizedBaseline === sanitizedSnippet : undefined;
  const statusMatches = state.expectedStatus != null ? state.expectedStatus === detectedStatus : undefined;
  const baselinePreview = sanitizedBaseline ? truncate(sanitizedBaseline, SNIPPET_PREVIEW_LENGTH) : undefined;

  const mismatchSummary: string[] = [];
  if (statusMatches === false) {
    mismatchSummary.push(`expected status ${state.expectedStatus ?? 'unknown'}, received ${detectedStatus}`);
  }
  if (snippetMatches === false) {
    mismatchSummary.push('captured snippet differs from baseline');
  }

  return {
    enabled: true,
    expectedStatus: state.expectedStatus,
    statusMatches,
    snippetMatches,
    baselineSnippetPreview: baselinePreview,
    mismatchSummary: mismatchSummary.length ? mismatchSummary.join('; ') : undefined
  };
}

function captureSnippet(source: HTMLElement): string {
  const target = (source.closest('td') ?? source) as HTMLElement;
  const clone = target.cloneNode(true) as HTMLElement;
  sanitizeNode(clone);
  const html = clone.outerHTML || '';
  return truncate(html.replace(/\s+/g, ' ').trim(), SNIPPET_MAX_LENGTH);
}

function sanitizeNode(node: HTMLElement): void {
  node.querySelectorAll('script, style').forEach(el => el.remove());
  stripDisallowedAttributes(node);
  node.querySelectorAll('*').forEach(el => {
    stripDisallowedAttributes(el);
  });
}

const ALLOWED_ATTRIBUTE_NAMES = new Set([
  'class',
  'headers',
  'role',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'data-afr-title',
  'data-afr-label'
]);

function stripDisallowedAttributes(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('aria-')) continue;
    if (ALLOWED_ATTRIBUTE_NAMES.has(name)) continue;
    el.removeAttribute(attr.name);
  }
}

function buildElementPath(
  container: HTMLElement,
  anchor: HTMLElement | undefined,
  doc: Document
): string {
  const pieces = new Set<string>();

  collectTextsFromIds(container.getAttribute('headers'), doc, pieces);
  collectTextsFromIds(container.getAttribute('aria-labelledby'), doc, pieces);

  if (anchor) {
    const ariaLabel = anchor.getAttribute('aria-label');
    if (ariaLabel) {
      pieces.add(normalizeWhitespace(ariaLabel));
    }
    collectTextsFromIds(anchor.getAttribute('aria-labelledby'), doc, pieces);
    collectTextsFromIds(anchor.getAttribute('aria-describedby'), doc, pieces);
  }

  const textSource = anchor ?? container;
  const text = normalizeWhitespace(textSource.textContent ?? '');
  if (text) {
    pieces.add(text);
  }

  const summary = Array.from(pieces).filter(Boolean).join(' > ') || 'ValidationStatus';
  return truncate(summary, 280);
}

function collectTextsFromIds(ids: string | null | undefined, doc: Document, set: Set<string>): void {
  if (!ids) return;
  for (const token of ids.split(/\s+/)) {
    if (!token) continue;
    const el = doc.getElementById(token);
    if (!el) continue;
    const text = normalizeWhitespace(el.textContent ?? '');
    if (text) {
      set.add(text);
    }
  }
}

function sanitizeSnippet(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
