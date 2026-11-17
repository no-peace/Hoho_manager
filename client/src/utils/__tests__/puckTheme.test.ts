import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_UI_THEME,
  applyUiTheme,
  clearUserThemeCache,
  loadUserThemeCache,
  saveUserThemeCache,
  validateUiTheme,
} from "../puckTheme";

describe("personal theme application", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
    delete document.documentElement.dataset.hohoTheme;
  });

  it("validates the built-in theme and applies its CSS tokens", () => {
    expect(validateUiTheme(DEFAULT_UI_THEME).valid).toBe(true);
    applyUiTheme(DEFAULT_UI_THEME);
    expect(document.documentElement.style.getPropertyValue("--hoho-theme-bg")).toBe(DEFAULT_UI_THEME.background);
    expect(document.documentElement.style.getPropertyValue("--hoho-theme-accent")).toBe(DEFAULT_UI_THEME.accent);
    expect(document.documentElement.dataset.hohoTheme).toBe("custom");
  });

  it("persists and restores a guest theme independently from authenticated users", () => {
    const guestTheme = { ...DEFAULT_UI_THEME, accent: "#2563EB", accentHover: "#1D4ED8" };
    expect(saveUserThemeCache("guest", guestTheme, null)).toBe(true);
    expect(loadUserThemeCache("guest", false)?.theme.accent).toBe("#2563EB");
    expect(loadUserThemeCache("another-user", false)).toBeNull();
    clearUserThemeCache("guest");
    expect(loadUserThemeCache("guest", false)).toBeNull();
  });

  it("does not cache invalid contrast combinations", () => {
    const invalid = { ...DEFAULT_UI_THEME, text: "#111111" };
    expect(validateUiTheme(invalid).valid).toBe(false);
    expect(saveUserThemeCache("guest", invalid, null)).toBe(false);
    expect(loadUserThemeCache("guest", false)).toBeNull();
  });
});
