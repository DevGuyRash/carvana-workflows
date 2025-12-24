import { DEFAULTS, LS_KEY } from './constants';
import type { Options } from './types';
import { safeJsonParse } from './utils';

export function loadOptions(): Options {
  const saved = safeJsonParse<Record<string, unknown>>(localStorage.getItem(LS_KEY), {});
  return { ...DEFAULTS, ...saved } as Options;
}

export function saveOptions(opts: Options): void {
  localStorage.setItem(LS_KEY, JSON.stringify(opts));
}
