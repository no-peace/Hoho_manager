export interface UiThemeTokens {
  background: string; panel: string; surface: string; text: string; muted: string;
  border: string; accent: string; accentHover: string; radius: string; fontFamily: string;
}
export const DEFAULT_UI_THEME: UiThemeTokens = {
  background: "#0b0d12", panel: "#161a23", surface: "#1d2230", text: "#f1f3f9",
  muted: "#a1a8b8", border: "#272d3a", accent: "#818cf8", accentHover: "#6366f1",
  radius: "10px", fontFamily: "Inter",
};
const THEME_CACHE_PREFIX = "hoho:user-theme:v2:";
export const USER_THEME_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const safeColor = (value: unknown, fallback: string): string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
const radii = ["4px", "8px", "10px", "14px", "18px"];
const fonts = ["Inter", "system-ui", "Roboto", "Arial"];
export const normalizeUiTheme = (value: unknown): UiThemeTokens => {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    background: safeColor(input.background, DEFAULT_UI_THEME.background),
    panel: safeColor(input.panel, DEFAULT_UI_THEME.panel),
    surface: safeColor(input.surface, DEFAULT_UI_THEME.surface),
    text: safeColor(input.text, DEFAULT_UI_THEME.text),
    muted: safeColor(input.muted, DEFAULT_UI_THEME.muted),
    border: safeColor(input.border, DEFAULT_UI_THEME.border),
    accent: safeColor(input.accent, DEFAULT_UI_THEME.accent),
    accentHover: safeColor(input.accentHover, DEFAULT_UI_THEME.accentHover),
    radius: radii.includes(String(input.radius)) ? String(input.radius) : DEFAULT_UI_THEME.radius,
    fontFamily: fonts.includes(String(input.fontFamily)) ? String(input.fontFamily) : DEFAULT_UI_THEME.fontFamily,
  };
};
const luminance = (hex: string): number => {
  const rgb = hex.slice(1).match(/.{2}/g)!.map((v) => parseInt(v, 16) / 255).map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
};
const contrast = (a: string, b: string): number => {
  const x = luminance(a); const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
export const validateUiTheme = (value: unknown): { valid: boolean; errors: string[]; theme: UiThemeTokens } => {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const errors: string[] = [];
  const colorKeys = ["background", "panel", "surface", "text", "muted", "border", "accent", "accentHover"] as const;
  for (const key of colorKeys) if (!/^#[0-9a-fA-F]{6}$/.test(String(input[key] ?? ""))) errors.push(key + " must be a six-digit HEX color.");
  if (!radii.includes(String(input.radius))) errors.push("Choose a supported corner radius.");
  if (!fonts.includes(String(input.fontFamily))) errors.push("Choose a supported font family.");
  const theme = normalizeUiTheme(value);
  if (contrast(theme.text, theme.background) < 4.5 || contrast(theme.text, theme.panel) < 4.5 || contrast(theme.text, theme.surface) < 4.5) errors.push("Primary text must meet WCAG AA contrast (4.5:1) on the background, panels, and surfaces.");
  if (contrast(theme.muted, theme.background) < 3 || contrast(theme.muted, theme.panel) < 3 || contrast(theme.muted, theme.surface) < 3) errors.push("Muted text must meet 3:1 contrast on the background and panels.");
  return { valid: errors.length === 0, errors, theme };
};
export const applyUiTheme = (value: unknown): void => {
  if (typeof document === "undefined") return;
  const theme = normalizeUiTheme(value);
  const root = document.documentElement;
  root.dataset.hohoTheme = "custom";
  root.style.setProperty("--hoho-theme-bg", theme.background);
  root.style.setProperty("--hoho-theme-panel", theme.panel);
  root.style.setProperty("--hoho-theme-surface", theme.surface);
  root.style.setProperty("--hoho-theme-text", theme.text);
  root.style.setProperty("--hoho-theme-muted", theme.muted);
  root.style.setProperty("--hoho-theme-border", theme.border);
  root.style.setProperty("--hoho-theme-accent", theme.accent);
  root.style.setProperty("--hoho-theme-accent-hover", theme.accentHover);
  root.style.setProperty("--hoho-theme-radius", theme.radius);
  root.style.setProperty("--hoho-theme-font", theme.fontFamily);
};
interface CachedUserTheme { theme: UiThemeTokens; themeId: string | null; updatedAt: number; expiresAt: number; }
const cacheKey = (userId: string) => THEME_CACHE_PREFIX + userId;
export const loadUserThemeCache = (userId: string, refreshExpiry = true): CachedUserTheme | null => {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUserTheme;
    if (!parsed || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(cacheKey(userId));
      return null;
    }
    const cached = { ...parsed, theme: normalizeUiTheme(parsed.theme) };
    if (refreshExpiry) {
      cached.expiresAt = Date.now() + USER_THEME_CACHE_TTL_MS;
      localStorage.setItem(cacheKey(userId), JSON.stringify(cached));
    }
    return cached;
  } catch { return null; }
};
export const saveUserThemeCache = (userId: string, theme: unknown, themeId: string | null = null): boolean => {
  try {
    const result = validateUiTheme(theme);
    if (!result.valid) return false;
    localStorage.setItem(cacheKey(userId), JSON.stringify({
      theme: result.theme, themeId, updatedAt: Date.now(), expiresAt: Date.now() + USER_THEME_CACHE_TTL_MS,
    } satisfies CachedUserTheme));
    return true;
  } catch { return false; }
};
export const clearUserThemeCache = (userId: string): void => {
  try { localStorage.removeItem(cacheKey(userId)); } catch { /* storage unavailable */ }
};

export interface LocalUserTheme { id: string; name: string; description: string; theme: UiThemeTokens; createdAt: number; }
const libraryKey = (userId: string) => "hoho:user-theme-library:v1:" + userId;
export const loadUserThemeLibrary = (userId: string): LocalUserTheme[] => {
  try {
    const raw = localStorage.getItem(libraryKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now() || !Array.isArray(parsed.themes)) {
      localStorage.removeItem(libraryKey(userId));
      return [];
    }
    return parsed.themes.flatMap((item: any) => {
      if (!item || typeof item !== "object" || typeof item.name !== "string") return [];
      const checked = validateUiTheme(item.theme);
      return checked.valid ? [{
        id: String(item.id || ""), name: item.name.slice(0, 60),
        description: typeof item.description === "string" ? item.description.slice(0, 180) : "",
        theme: checked.theme, createdAt: Number(item.createdAt) || Date.now(),
      }] : [];
    });
  } catch { return []; }
};
export const refreshUserThemeLibraryExpiry = (userId: string): void => {
  try {
    const themes = loadUserThemeLibrary(userId);
    if (themes.length) localStorage.setItem(libraryKey(userId), JSON.stringify({
      themes, expiresAt: Date.now() + USER_THEME_CACHE_TTL_MS,
    }));
  } catch { /* storage unavailable */ }
};
export const saveUserThemeToLibrary = (userId: string, name: string, description: string, value: unknown): LocalUserTheme | null => {
  try {
    const checked = validateUiTheme(value);
    if (!checked.valid || !name.trim()) return null;
    const themes = loadUserThemeLibrary(userId);
    const theme: LocalUserTheme = {
      id: "local-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      name: name.trim().slice(0, 60), description: description.trim().slice(0, 180),
      theme: checked.theme, createdAt: Date.now(),
    };
    localStorage.setItem(libraryKey(userId), JSON.stringify({
      themes: [theme, ...themes].slice(0, 50), expiresAt: Date.now() + USER_THEME_CACHE_TTL_MS,
    }));
    return theme;
  } catch { return null; }
};
export const deleteUserThemeFromLibrary = (userId: string, id: string): void => {
  try {
    const themes = loadUserThemeLibrary(userId).filter((theme) => theme.id !== id);
    if (themes.length) localStorage.setItem(libraryKey(userId), JSON.stringify({
      themes, expiresAt: Date.now() + USER_THEME_CACHE_TTL_MS,
    }));
    else localStorage.removeItem(libraryKey(userId));
  } catch { /* storage unavailable */ }
};
