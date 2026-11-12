import type { DiscordMessagePayload } from "@dmb/shared";
import {
  getDiscordUser,
  getDiscordUserAvatarUrl,
  type DiscordMemberSummary,
} from "./discordService.js";
import { logger } from "../utils/logger.js";

const log = logger.child("authorService");

const DISCORD_USER_ID_REGEX = /^\d{17,20}$/;
const USER_PLACEHOLDER_REGEX = /\{user\.(\d{17,20})\.([a-zA-Z0-9_]+)\}/g;
const MAX_USER_LOOKUPS_PER_PAYLOAD = 10;

type AuthorObject = Record<string, unknown>;

export interface AuthorResolutionResult {
  payload: DiscordMessagePayload;
  authorUserId: string | null;
  authorUser: DiscordMemberSummary | null;
}

/** Accept only a real HTTPS Discord profile URL, not a lookalike hostname. */
const getUserIdFromProfileUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "discord.com" && url.hostname !== "www.discord.com") {
      return null;
    }
    if (url.search || url.hash) return null;

    const match = url.pathname.match(/^\/users\/(\d{17,20})\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

const getAuthorUserId = (author: AuthorObject): string | null => {
  for (const key of ["user_id", "author_id"] as const) {
    const value = author[key];
    if (typeof value === "string" && DISCORD_USER_ID_REGEX.test(value.trim())) {
      return value.trim();
    }
  }

  if (typeof author.url === "string") {
    const id = getUserIdFromProfileUrl(author.url);
    if (id) return id;
  }

  if (typeof author.name === "string" && DISCORD_USER_ID_REGEX.test(author.name.trim())) {
    return author.name.trim();
  }

  return null;
};

const collectAuthorObjects = (node: unknown, output: AuthorObject[] = []): AuthorObject[] => {
  if (Array.isArray(node)) {
    for (const item of node) collectAuthorObjects(item, output);
    return output;
  }

  if (node === null || typeof node !== "object") return output;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "author" && value !== null && typeof value === "object" && !Array.isArray(value)) {
      output.push(value as AuthorObject);
    }
    collectAuthorObjects(value, output);
  }

  return output;
};

const getUserField = (
  user: DiscordMemberSummary,
  field: string,
): string | null => {
  switch (field.toLowerCase()) {
    case "name":
    case "displayname":
    case "globalname":
      return user.global_name || user.username;
    case "username":
    case "tag":
      return user.username;
    case "id":
      return user.id;
    case "avatar":
    case "icon":
    case "pfp":
      return getDiscordUserAvatarUrl(user);
    case "url":
    case "profile":
      return `https://discord.com/users/${user.id}`;
    case "mention":
      return `<@${user.id}>`;
    default:
      return null;
  }
};

/**
 * Resolves author profiles and {user.<userId>.<field>} placeholders.
 * User lookups are performed server-side using the configured bot token.
 */
export const resolveAuthorPlaceholders = async (
  payload: DiscordMessagePayload,
  fallbackAuthorId?: string | null,
  profileId?: number | null,
): Promise<AuthorResolutionResult> => {
  const authorObjects = collectAuthorObjects(payload);
  const authorIds = authorObjects.map(getAuthorUserId);
  const hasSingleAuthor = authorObjects.length === 1;

  // A legacy fallback ID is safe only when this payload has exactly one author.
  if (
    hasSingleAuthor &&
    !authorIds[0] &&
    typeof fallbackAuthorId === "string" &&
    DISCORD_USER_ID_REGEX.test(fallbackAuthorId.trim())
  ) {
    authorIds[0] = fallbackAuthorId.trim();
  }

  const serialized = JSON.stringify(payload);
  const placeholderMatches = Array.from(serialized.matchAll(USER_PLACEHOLDER_REGEX));
  const requestedIds = new Set<string>();

  for (const id of authorIds) {
    if (id) requestedIds.add(id);
  }
  for (const match of placeholderMatches) {
    if (match[1]) requestedIds.add(match[1]);
  }

  const allowedIds = Array.from(requestedIds).slice(0, MAX_USER_LOOKUPS_PER_PAYLOAD);
  if (requestedIds.size > MAX_USER_LOOKUPS_PER_PAYLOAD) {
    log.warn(
      `Author resolution skipped ${requestedIds.size - MAX_USER_LOOKUPS_PER_PAYLOAD} user lookup(s); payload limit is ${MAX_USER_LOOKUPS_PER_PAYLOAD}`,
    );
  }

  const userMap = new Map<string, DiscordMemberSummary>();

  // Sequential lookup keeps a single payload's outbound API traffic bounded.
  for (const id of allowedIds) {
    try {
      const user = await getDiscordUser(id, profileId ?? null);
      if (user && user.id === id && typeof user.username === "string") {
        userMap.set(id, user);
      }
    } catch (error) {
      const category =
        error && typeof error === "object" && "status" in error
          ? `HTTP ${String((error as { status: unknown }).status)}`
          : error instanceof Error
            ? error.name
            : "unknown error";
      log.warn(`Could not resolve Discord user ${id} (${category}); preserving original value`);
    }
  }

  const interpolateString = (value: string): string =>
    value.replace(USER_PLACEHOLDER_REGEX, (fullMatch, id: string, field: string) => {
      const user = userMap.get(id);
      if (!user) return fullMatch;
      return getUserField(user, field) ?? fullMatch;
    });

  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return interpolateString(node);
    if (Array.isArray(node)) return node.map(walk);

    if (node !== null && typeof node === "object") {
      const output: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (
          key === "author" &&
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {
          const author = { ...(value as AuthorObject) };
          const id = getAuthorUserId(author);
          const user = id ? userMap.get(id) : undefined;

          if (user) {
            // Preserve manually entered values. Auto-fill blank fields and ID-only names.
            if (
              typeof author.name !== "string" ||
              author.name.trim() === "" ||
              author.name.trim() === id
            ) {
              author.name = user.global_name || user.username;
            }
            if (typeof author.url !== "string" || getUserIdFromProfileUrl(author.url) === id) {
              author.url = `https://discord.com/users/${user.id}`;
            }
            if (typeof author.icon_url !== "string" || author.icon_url.trim() === "") {
              author.icon_url = getDiscordUserAvatarUrl(user);
            }
          }

          output[key] = walk(author);
        } else {
          output[key] = walk(value);
        }
      }

      return output;
    }

    return node;
  };

  const resolvedPayload = walk(payload) as DiscordMessagePayload;
  const primaryUserId =
    (hasSingleAuthor ? authorIds[0] : null) ??
    authorIds.find((id) => Boolean(id)) ??
    null;

  return {
    payload: resolvedPayload,
    authorUserId: primaryUserId,
    authorUser: primaryUserId ? userMap.get(primaryUserId) ?? null : null,
  };
};