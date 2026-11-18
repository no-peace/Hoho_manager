import { ApiError } from "./errors.js";

const DISCORD_USER_ID = /^\d{17,20}$/;

/** Resolve the actor only from server-authenticated identity, never request payload fields. */
export const resolveAuthenticatedActorDiscordId = (
  staffId: unknown,
  sessionDiscordId: unknown,
): string => {
  if (typeof staffId === "string" && DISCORD_USER_ID.test(staffId)) return staffId;
  if (typeof sessionDiscordId === "string" && DISCORD_USER_ID.test(sessionDiscordId)) return sessionDiscordId;
  return "";
};

/** Explicit author identity overrides are unsupported; actor identity comes from the session. */
export const assertNoAuthorUserIdOverride = (value: unknown): void => {
  if (value !== undefined && value !== null) {
    throw ApiError.badRequest("`authorUserId` is derived from your authenticated session and cannot be overridden.");
  }
};
