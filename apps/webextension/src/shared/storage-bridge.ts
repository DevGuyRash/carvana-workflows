import { storageGet, storageSet } from './webext-async';

export interface StoredLogEntry {
  timestamp_ms: number;
  level: string;
  source: string;
  message: string;
  data?: unknown;
}

export interface StoredSettings {
  theme: string;
  log_level: string;
  log_retention_days: number;
  notifications_enabled: boolean;
  auto_run_rules: boolean;
}

const MAX_LOGS = 500;

export async function loadSettings(): Promise<StoredSettings> {
  return storageGet<StoredSettings>('cv_settings', {
    theme: 'midnight',
    log_level: 'info',
    log_retention_days: 7,
    notifications_enabled: true,
    auto_run_rules: true,
  });
}

export async function saveSettings(settings: StoredSettings): Promise<void> {
  await storageSet({ cv_settings: settings });
}

export async function loadLogs(): Promise<StoredLogEntry[]> {
  return storageGet<StoredLogEntry[]>('cv_logs', []);
}

export async function appendLog(entry: StoredLogEntry): Promise<void> {
  const logs = await loadLogs();
  logs.push(entry);
  const trimmed = logs.length > MAX_LOGS ? logs.slice(-MAX_LOGS) : logs;
  await storageSet({ cv_logs: trimmed });
}

export async function clearLogs(): Promise<void> {
  await storageSet({ cv_logs: [] });
}

export async function loadCapturedData(key: string): Promise<Record<string, string>[]> {
  return storageGet<Record<string, string>[]>(`cv_data_${key}`, []);
}

export async function saveCapturedData(key: string, data: Record<string, string>[]): Promise<void> {
  await storageSet({ [`cv_data_${key}`]: data });
}
