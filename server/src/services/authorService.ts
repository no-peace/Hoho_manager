import type { DiscordMessagePayload } from "@dmb/shared";
import { getDiscordUser, getDiscordUserAvatarUrl, type DiscordMemberSummary } from "./discordService.js";
import { logger } from "../utils/logger.js";

const log = logger.child("authorService");

const DISCORD_USER_URL_REGEX = /discord\.com\/users\/(\d{17,20})/;
const DISCORD_USER_ID_REGEX = /^\d{17,20}$/;
const USER_PLACEHOLDER_REGEX = /\{user\.(\d{17,20})\.([a-zA-Z0-9_]+)\}/g;

export interface AuthorResolutionResult {
  payload: DiscordMessagePayload;
  authorUserId: string | null;
  authorUser: DiscordMemberSummary | null;
}

/**
 * Automatically detects and resolves Discord author information from User IDs.
 * - Auto-populates author name, Discord profile URL, and avatar/PFP icon URL.
 * - Interpolates `{user.<userId>.<field>}` variables in text.
 */
export const resolveAuthorPlaceholders = async (
  payload: DiscordMessagePayload,
  fallbackAuthorId?: string | null,
  profileId?: number | null,
): Promise<AuthorResolutionResult> => {
  let detectedUserId: string | null = fallbackAuthorId?.trim() || null;
  const userMap = new Map<string, DiscordMemberSummary>();

  const resolveUser = async (id: string): Promise<DiscordMemberSummary | null> => {
    if (userMap.has(id)) return userMap.get(id)!;
    try {
      const user = await getDiscordUser(id, profileId);
      userMap.set(id, user);
      return user;
    } catch (err) {
      log.warn(`Failed to resolve Discord user ${id}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  };

  // 1. Detect user ID from embed author
  if (Array.isArray(payload.embeds)) {
    for (const embed of payload.embeds) {
      if (!embed || typeof embed !== "object") continue;
      const author = embed.author as Record<string, unknown> | undefined;
      if (!author) continue;

      let uid: string | null = null;
      if (typeof author.user_id === "string" && DISCORD_USER_ID_REGEX.test(author.user_id.trim())) {
        uid = author.user_id.trim();
      } else if (typeof author.author_id === "string" && DISCORD_USER_ID_REGEX.test(author.author_id.trim())) {
        uid = author.author_id.trim();
      } else if (typeof author.url === "string") {
        const match = author.url.match(DISCORD_USER_URL_REGEX);
        if (match?.[1]) uid = match[1];
      } else if (typeof author.name === "string" && DISCORD_USER_ID_REGEX.test(author.name.trim())) {
        uid = author.name.trim();
      }

      if (uid && !detectedUserId) {
        detectedUserId = uid;
      }
      if (uid) {
        await resolveUser(uid);
      }
    }
  }

  // 2. Detect any `{user.<userId>.*}` tokens across the payload
  const serialized = JSON.stringify(payload);
  const tokenMatches = Array.from(serialized.matchAll(USER_PLACEHOLDER_REGEX));
  for (const match of tokenMatches) {
    const uid = match[1];
    if (uid && !userMap.has(uid)) {
      await resolveUser(uid);
    }
  }

  if (detectedUserId && !userMap.has(detectedUserId)) {
    await resolveUser(detectedUserId);
  }

  // 3. Walk and mutate author objects & replace `{user.<userId>.*}` tokens
  const interpolateString = (text: string): string => {
    return text.replace(USER_PLACEHOLDER_REGEX, (fullMatch, uid: string, field: string) => {
      const user = userMap.get(uid);
      if (!user) return fullMatch;
      const f = field.toLowerCase();
      switch (f) {
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
          return fullMatch;
      }
    });
  };

  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return interpolateString(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node !== null && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "author" && v !== null && typeof v === "object") {
          const authorObj = { ...(v as Record<string, unknown>) };
          let uid: string | null = null;
          if (typeof authorObj.user_id === "string" && DISCORD_USER_ID_REGEX.test(authorObj.user_id.trim())) {
            uid = authorObj.user_id.trim();
          } else if (typeof authorObj.url === "string") {
            const match = authorObj.url.match(DISCORD_USER_URL_REGEX);
            if (match?.[1]) uid = match[1];
          } else if (typeof authorObj.name === "string" && DISCORD_USER_ID_REGEX.test(authorObj.name.trim())) {
            uid = authorObj.name.trim();
          } else if (detectedUserId) {
            uid = detectedUserId;
          }

          if (uid && userMap.has(uid)) {
            const user = userMap.get(uid)!;
            authorObj.name = user.global_name || user.username;
            authorObj.url = `https://discord.com/users/${user.id}`;
            authorObj.icon_url = getDiscordUserAvatarUrl(user);
          }
          out[k] = walk(authorObj);
        } else {
          out[k] = walk(v);
        }
      }
      return out;
    }
    return node;
  };

  const mutated = walk(payload) as DiscordMessagePayload;
  const primaryUser = detectedUserId ? userMap.get(detectedUserId) ?? null : null;

  return {
    payload: mutated,
    authorUserId: detectedUserId,
    authorUser: primaryUser,
  };
};
