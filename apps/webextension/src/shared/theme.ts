import { storageGet, storageSet } from './webext-async';
import { loadRuntime, RustThemeTokens } from './runtime';

interface ThemeVars {
  [key: string]: string;
}

let builtinThemeMap: Record<string, ThemeVars> = {};
let themesPromise: Promise<Record<string, ThemeVars>> | null = null;

function toCssVars(tokens: RustThemeTokens): ThemeVars {
  return {
    '--cv-bg-primary': tokens.bg_primary,
    '--cv-bg-secondary': tokens.bg_secondary,
    '--cv-bg-surface': tokens.bg_surface,
    '--cv-text-primary': tokens.text_primary,
    '--cv-text-secondary': tokens.text_secondary,
    '--cv-text-muted': tokens.text_muted,
    '--cv-accent': tokens.accent,
    '--cv-accent-hover': tokens.accent_hover,
    '--cv-border': tokens.border,
    '--cv-border-active': tokens.border_active,
    '--cv-success': tokens.success,
    '--cv-warning': tokens.warning,
    '--cv-error': tokens.error,
    '--cv-info': tokens.info,
  };
}

async function loadBuiltinThemes(): Promise<Record<string, ThemeVars>> {
  if (themesPromise) return themesPromise;

  themesPromise = (async () => {
    const wasm = await loadRuntime();
    const themes = wasm?.get_builtin_themes() ?? [];
    builtinThemeMap = themes.reduce<Record<string, ThemeVars>>((acc, theme) => {
      acc[theme.id] = toCssVars(theme.tokens);
      return acc;
    }, {});
    return builtinThemeMap;
  })();

  return themesPromise;
}

export async function applyTheme(themeId: string): Promise<void> {
  const themes = await loadBuiltinThemes();
  const vars = themes[themeId];
  if (!vars) return;
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
}

export async function loadAndApplyTheme(): Promise<void> {
  const themeId = await storageGet('cv_theme', 'midnight');
  await applyTheme(themeId as string);
}

export async function setTheme(themeId: string): Promise<void> {
  await applyTheme(themeId);
  await storageSet({ cv_theme: themeId });
}

export function listThemeIds(): string[] {
  return Object.keys(builtinThemeMap);
}
