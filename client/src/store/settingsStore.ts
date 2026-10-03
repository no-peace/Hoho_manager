import { create } from "zustand";

export interface DiscohookSettings {
  theme: "dark" | "light";
  messageDisplay: "cozy" | "compact";
  fontSize: number;
  compactAvatars: boolean;
  confirmExit: boolean;
}

interface SettingsState {
  settings: DiscohookSettings;
  updateSettings: (partial: Partial<DiscohookSettings>) => void;
}

const STORAGE_KEY = "discohook_settings";

const defaultSettings: DiscohookSettings = {
  theme: "dark",
  messageDisplay: "cozy",
  fontSize: 16,
  compactAvatars: false,
  confirmExit: false,
};

const loadInitialSettings = (): DiscohookSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    // Ignore storage parse errors
  }
  return defaultSettings;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: loadInitialSettings(),
  updateSettings: (partial) =>
    set((state) => {
      const updated = { ...state.settings, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }
      return { settings: updated };
    }),
}));