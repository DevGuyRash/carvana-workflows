import { storageGet, storageSet } from './webext-async';

interface ThemeVars {
  [key: string]: string;
}

const BUILTIN_THEMES: Record<string, ThemeVars> = {
  midnight: {
    '--cv-bg-primary': '#0f172a',
    '--cv-bg-secondary': '#1e293b',
    '--cv-bg-surface': '#334155',
    '--cv-text-primary': '#f1f5f9',
    '--cv-text-secondary': '#cbd5e1',
    '--cv-text-muted': '#94a3b8',
    '--cv-accent': '#3b82f6',
    '--cv-accent-hover': '#2563eb',
    '--cv-border': '#475569',
    '--cv-border-active': '#3b82f6',
    '--cv-success': '#22c55e',
    '--cv-warning': '#f59e0b',
    '--cv-error': '#ef4444',
    '--cv-info': '#06b6d4',
  },
  obsidian: {
    '--cv-bg-primary': '#09090b',
    '--cv-bg-secondary': '#18181b',
    '--cv-bg-surface': '#27272a',
    '--cv-text-primary': '#fafafa',
    '--cv-text-secondary': '#d4d4d8',
    '--cv-text-muted': '#a1a1aa',
    '--cv-accent': '#a78bfa',
    '--cv-accent-hover': '#8b5cf6',
    '--cv-border': '#3f3f46',
    '--cv-border-active': '#a78bfa',
    '--cv-success': '#22c55e',
    '--cv-warning': '#f59e0b',
    '--cv-error': '#ef4444',
    '--cv-info': '#06b6d4',
  },
  daylight: {
    '--cv-bg-primary': '#ffffff',
    '--cv-bg-secondary': '#f8fafc',
    '--cv-bg-surface': '#f1f5f9',
    '--cv-text-primary': '#0f172a',
    '--cv-text-secondary': '#475569',
    '--cv-text-muted': '#94a3b8',
    '--cv-accent': '#2563eb',
    '--cv-accent-hover': '#1d4ed8',
    '--cv-border': '#e2e8f0',
    '--cv-border-active': '#2563eb',
    '--cv-success': '#16a34a',
    '--cv-warning': '#d97706',
    '--cv-error': '#dc2626',
    '--cv-info': '#0891b2',
  },
  'carvana-blue': {
    '--cv-bg-primary': '#0c1929',
    '--cv-bg-secondary': '#142338',
    '--cv-bg-surface': '#1e3350',
    '--cv-text-primary': '#e0f2fe',
    '--cv-text-secondary': '#93c5fd',
    '--cv-text-muted': '#60a5fa',
    '--cv-accent': '#00b4d8',
    '--cv-accent-hover': '#0891b2',
    '--cv-border': '#1e3a5f',
    '--cv-border-active': '#00b4d8',
    '--cv-success': '#22c55e',
    '--cv-warning': '#f59e0b',
    '--cv-error': '#ef4444',
    '--cv-info': '#38bdf8',
  },
};

export function applyTheme(themeId: string): void {
  const vars = BUILTIN_THEMES[themeId];
  if (!vars) return;
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
}

export async function loadAndApplyTheme(): Promise<void> {
  const themeId = await storageGet('cv_theme', 'midnight');
  applyTheme(themeId as string);
}

export async function setTheme(themeId: string): Promise<void> {
  applyTheme(themeId);
  await storageSet({ cv_theme: themeId });
}

export function listThemeIds(): string[] {
  return Object.keys(BUILTIN_THEMES);
}
