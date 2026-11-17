import { initialDesignData } from "../config/puck/designConfig";

const STORAGE_PREFIX = "hoho-manager:puck-design:v1:";

export const getDesignStorageKey = (userId?: string | null): string =>
  `${STORAGE_PREFIX}${userId || "local"}`;

export const loadDesign = (key: string): any => {
  if (typeof window === "undefined") return initialDesignData;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return initialDesignData;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.content) || typeof parsed.root !== "object") {
      return initialDesignData;
    }
    return parsed;
  } catch {
    return initialDesignData;
  }
};

export const saveDesign = (key: string, data: unknown): boolean => {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
};

export const downloadDesign = (data: unknown, filename = "hoho-design.json"): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const parseDesignFile = (value: unknown): any => {
  if (!value || typeof value !== "object") throw new Error("The selected file does not contain a valid Puck design.");
  const candidate = value as { content?: unknown; root?: unknown };
  if (!Array.isArray(candidate.content) || !candidate.root || typeof candidate.root !== "object") {
    throw new Error("Invalid Puck JSON. A design must include a content array and root object.");
  }
  return candidate;
};
