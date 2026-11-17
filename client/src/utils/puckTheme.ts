export interface UiThemeTokens {
  background: string; panel: string; surface: string; text: string; muted: string;
  border: string; accent: string; accentHover: string; radius: string; fontFamily: string;
}
export const DEFAULT_UI_THEME: UiThemeTokens = {
  background: "#0b0d12", panel: "#161a23", surface: "#1d2230", text: "#f1f3f9",
  muted: "#a1a8b8", border: "#272d3a", accent: "#818cf8", accentHover: "#6366f1",
  radius: "10px", fontFamily: "Inter",
};
const safeColor = (value: unknown, fallback: string): string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
const safeRadius = (value: unknown): string =>
  typeof value === "string" && /^(0|[1-2]?[0-9](\.[0-9]+)?px)$/.test(value) ? value : DEFAULT_UI_THEME.radius;
const safeFont = (value: unknown): string =>
  value === "Inter" || value === "system-ui" || value === "Roboto" || value === "Arial"
    ? value : DEFAULT_UI_THEME.fontFamily;
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
    radius: safeRadius(input.radius), fontFamily: safeFont(input.fontFamily),
  };
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
