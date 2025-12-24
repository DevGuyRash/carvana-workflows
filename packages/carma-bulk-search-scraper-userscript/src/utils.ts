export function safeJsonParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function cleanText(value: unknown): string {
  return (value ?? '')
    .toString()
    .replace(/\u00A0/g, ' ')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor<T>(
  fn: () => T | null | undefined,
  options: { timeoutMs?: number; intervalMs?: number; debugLabel?: string } = {},
): Promise<T> {
  const { timeoutMs = 15000, intervalMs = 100, debugLabel = '' } = options;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const val = fn();
      if (val) return val;
    } catch {
      // ignore
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting${debugLabel ? `: ${debugLabel}` : ''}`);
    }
    await sleep(intervalMs);
  }
}
