import type { AppState } from './types';

export function createInitialState(): AppState {
  return {
    running: false,
    abort: false,
    rows: [],
    lastCsv: '',
    lastJson: '',
  };
}
