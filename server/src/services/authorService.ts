import type { DiscordMessagePayload } from "@dmb/shared";
import {
  getDiscordUser,
  getDiscordUserAvatarUrl,
  getGuildMember,
  resolveBotToken,
  type DiscordMemberSummary,
} from "./discordService.js";
import { logger } from "../utils/logger.js";

const log = logger.child("authorService");

const DISCORD_USER_ID_REGEX = /^\d{17,20}$/;
const USER_PLACEHOLDER_REGEX = /\{user\.(\d{17,20})\.([a-zA-Z0-9_.]+)\}/g;
const MAX_USER_LOOKUPS_PER_PAYLOAD = 10;
const MEMBER_CACHE_TTL_MS = 60_000;
const memberCache = new Map<string, { member: any; expiresAt: number }>();

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
    case "avatarurl":
    case "icon":
    case "pfp":
      return getDiscordUserAvatarUrl(user);
    case "url":
    case "profile":
      return `https://discord.com/users/${user.id}`;
    case "mention":
      return `<@${user.id}>`;
    case "created":
      return `<t:${snowflakeToUnix(user.id)}:d>`;
    case "created.relative":
      return `<t:${snowflakeToUnix(user.id)}:R>`;
    default:
      return null;
  }
};

const snowflakeToUnix = (id: string): number =>
  Math.floor(Number((BigInt(id) >> 22n) + 1420070400000n) / 1000);

const getClanTag = (member: any, user: DiscordMemberSummary): string => {
  const official =
    (typeof member?.clan === "string" ? member.clan : member?.clan?.tag) ??
    (typeof member?.user?.clan === "string" ? member.user.clan : member?.user?.clan?.tag) ??
    (typeof (user as any)?.clan === "string" ? (user as any).clan : (user as any)?.clan?.tag) ??
    member?.primary_guild?.tag ?? member?.user?.primary_guild?.tag ?? member?.clan_tag;
  if (typeof official === "string" && official.trim()) return official.trim();

  const displayName = member?.nick || user.global_name || user.username;
  const text = String(displayName) + " " + user.username;
  const bracket = text.match(/\[([A-Za-z0-9_.-]{1,16})\]|\(([A-Za-z0-9_.-]{1,16})\)|\{([A-Za-z0-9_.-]{1,16})\}/);
  if (bracket) return bracket[1] || bracket[2] || bracket[3];
  const separator = text.match(/(?:^([A-Za-z0-9_.-]{2,8})\s*[|•:-]|[|•:-]\s*([A-Za-z0-9_.-]{2,8})$)/);
  return separator ? (separator[1] || separator[2]).trim() : "";
};

/**
 * Resolves author profiles and {user.<userId>.<field>} placeholders.
 * User lookups are performed server-side using the configured bot token.
 */
export const resolveAuthorPlaceholders = async (
  payload: DiscordMessagePayload,
  fallbackAuthorId?: string | null,
  profileId?: number | null,
  guildId?: string | null,
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
  const memberMap = new Map<string, any>();

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

  if (guildId && allowedIds.length > 0) {
    let token: string | null = null;
    try {
      token = await resolveBotToken(profileId ?? null);
    } catch (error) {
      log.warn(`Could not resolve bot token for guild user placeholders: ${error instanceof Error ? error.name : "unknown error"}`);
    }
    if (token) {
      for (const id of allowedIds) {
        const cacheKey = `${guildId}:${id}`;
        const cached = memberCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          memberMap.set(id, cached.member);
          continue;
        }
        try {
          const member = await getGuildMember(guildId, id, token);
          if (member) {
            memberMap.set(id, member);
            memberCache.set(cacheKey, { member, expiresAt: Date.now() + MEMBER_CACHE_TTL_MS });
          }
        } catch (error) {
          const status = error && typeof error === "object" && "status" in error
            ? String((error as { status: unknown }).status)
            : "unknown";
          if (status !== "404") log.warn(`Could not resolve guild member ${id} in ${guildId} (HTTP ${status})`);
        }
      }
    }
  }

  const interpolateString = (value: string): string =>
    value.replace(USER_PLACEHOLDER_REGEX, (fullMatch, id: string, field: string) => {
      const user = userMap.get(id);
      if (!user) return fullMatch;
      const normalized = field.toLowerCase();
      const member = memberMap.get(id);
      if (normalized === "roles") {
        return Array.isArray(member?.roles) && member.roles.length
          ? member.roles.map((roleId: string) => `<@&${roleId}>`).join(" ")
          : member ? "None" : fullMatch;
      }
      if (normalized === "clantag") return member ? getClanTag(member, user) : fullMatch;
      if (normalized === "joined" || normalized === "joined.date") {
        const joinedAt = typeof member?.joined_at === "string" ? Math.floor(Date.parse(member.joined_at) / 1000) : NaN;
        if (!Number.isFinite(joinedAt)) return fullMatch;
        return `<t:${joinedAt}:${normalized === "joined" ? "R" : "d"}>`;
      }
      if (normalized === "displayname") {
        return (typeof member?.nick === "string" && member.nick) || user.global_name || user.username;
      }
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