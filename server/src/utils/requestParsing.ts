import { ApiError } from "./errors.js";

export interface ParseProfileIdOptions {
  strict?: boolean;
}

export const parseAllowedIds = (raw: string | null | undefined): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

export const parseProfileId = (
  value: unknown,
  options: ParseProfileIdOptions = {},
): number | null => {
  if (value === undefined || value === null || value === "" || value === "null") return null;
  if (typeof value !== "string" && typeof value !== "number") {
    if (options.strict) throw ApiError.badRequest("`profileId` must be a positive integer");
    return null;
  }
  const profileId = Number(value);
  if (!Number.isSafeInteger(profileId) || profileId <= 0) {
    if (options.strict) throw ApiError.badRequest("`profileId` must be a positive integer");
    return null;
  }
  return profileId;
};
