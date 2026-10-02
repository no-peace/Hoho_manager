import type { WebhookProfileRecord } from "@dmb/shared";
import {
  botProfileRepository,
  webhookProfileRepository,
  type PublicBotProfile,
} from "../repositories/profileRepository.js";
import * as discord from "./discordService.js";
import { ApiError } from "../utils/errors.js";
import { isSnowflake, parseWebhookUrl } from "../utils/validation.js";

/**
 * Profile management for both send modes.
 *
 * A webhook profile stores a URL; a bot profile stores an encrypted token. Both
 * are validated against Discord before we persist them, so a typo surfaces
 * immediately rather than at send time.
 */

export interface CreateWebhookProfileInput {
  name: string;
  url: string;
  avatarUrl?: string | null;
  isDefault?: number;
}

export interface CreateBotProfileInput {
  name: string;
  token: string;
  applicationId: string;
  publicKey: string;
  defaultGuildId?: string | null;
}

export const validateBotProfileIdentity = (
  botId: string,
  applicationId: string,
  publicKey: string,
): void => {
  if (!isSnowflake(applicationId) || botId !== applicationId) {
    throw ApiError.badRequest("The application ID must match the bot token's Discord identity");
  }
  if (!/^[\da-fA-F]{64}$/.test(publicKey)) {
    throw ApiError.badRequest("The Discord public key must be 64 hexadecimal characters");
  }
};

/**
 * Pull the ids Discord knows about out of a webhook response.
 * The endpoint returns them untyped, so this narrows before we persist.
 */
const readWebhookIds = (
  info: unknown,
): { guildId: string | null; channelId: string | null } => {
  if (info === null || typeof info !== "object") return { guildId: null, channelId: null };
  const record = info as Record<string, unknown>;
  return {
    guildId: typeof record.guild_id === "string" ? record.guild_id : null,
    channelId:
      typeof record.channel_id === "string"
        ? record.channel_id
        : typeof record.channel_id === "number"
          ? String(record.channel_id)
          : null,
  };
};

export const webhookProfileService = {
  async list(userId: number): Promise<WebhookProfileRecord[]> {
    return webhookProfileRepository.listByUser(userId);
  },

  /**
   * Validate a webhook URL and create a profile from it.
   * We call Discord so the user finds out about a dead webhook right away.
   */
  async create(
    userId: number,
    { name, url, avatarUrl = null, isDefault = 0 }: CreateWebhookProfileInput,
  ): Promise<WebhookProfileRecord> {
    if (!parseWebhookUrl(url)) {
      throw ApiError.badRequest("That isn't a valid Discord webhook URL");
    }

    const info = await discord.getWebhookInfo(url).catch(() => null);
    if (!info) {
      throw ApiError.badRequest("Discord rejected that webhook URL — check it is active");
    }

    const { guildId, channelId } = readWebhookIds(info);

    const profile = await webhookProfileRepository.create({
      userId,
      name,
      url,
      guildId,
      channelId,
      avatarUrl,
      isDefault,
    });
    if (!profile) throw ApiError.upstream("Webhook profile could not be created");

    if (isDefault) {
      const promoted = await webhookProfileRepository.setDefault(profile.id, userId);
      if (promoted) return promoted;
    }
    return profile;
  },

  async update(
    id: number,
    userId: number,
    patch: Parameters<typeof webhookProfileRepository.update>[1],
  ): Promise<WebhookProfileRecord> {
    const existing = await webhookProfileRepository.findById(id);
    if (!existing) throw ApiError.notFound("Webhook profile not found");
    if (existing.user_id !== userId) {
      throw ApiError.forbidden("That profile belongs to someone else");
    }

    if (patch.url && !parseWebhookUrl(patch.url)) {
      throw ApiError.badRequest("That isn't a valid Discord webhook URL");
    }

    const updated = await webhookProfileRepository.update(id, patch);
    if (!updated) throw ApiError.notFound("Webhook profile not found");

    if (patch.is_default === 1) {
      const promoted = await webhookProfileRepository.setDefault(id, userId);
      if (promoted) return promoted;
    }
    return updated;
  },

  async setDefault(id: number, userId: number): Promise<WebhookProfileRecord> {
    const existing = await webhookProfileRepository.findById(id);
    if (!existing || existing.user_id !== userId) {
      throw ApiError.notFound("Webhook profile not found");
    }

    const promoted = await webhookProfileRepository.setDefault(id, userId);
    if (!promoted) throw ApiError.notFound("Webhook profile not found");
    return promoted;
  },

  async remove(id: number, userId: number): Promise<boolean> {
    const existing = await webhookProfileRepository.findById(id);
    if (!existing) throw ApiError.notFound("Webhook profile not found");
    if (existing.user_id !== userId) {
      throw ApiError.forbidden("That profile belongs to someone else");
    }
    return webhookProfileRepository.delete(id);
  },
};

export const botProfileService = {
  /** Never returns the token — only metadata plus `has_token`. */
  async list(userId: number): Promise<PublicBotProfile[]> {
    return botProfileRepository.listByUser(userId);
  },

  /**
   * Validate the token by asking Discord who it belongs to, then store it
   * encrypted. `applicationId` and `publicKey` are required so interactions can
   * be verified against the same bot.
   */
  async create(
    userId: number,
    { name, token, applicationId, publicKey, defaultGuildId = null }: CreateBotProfileInput,
  ): Promise<PublicBotProfile> {
    const identity = await discord.getBotIdentity(token).catch(() => null);
    if (!identity) throw ApiError.badRequest("Discord rejected that bot token");
    validateBotProfileIdentity(identity.id, applicationId, publicKey);

    const profile = await botProfileRepository.create({
      userId,
      name,
      token,
      applicationId,
      publicKey,
      defaultGuildId,
    });
    if (!profile) throw ApiError.upstream("Bot profile could not be created");
    return profile;
  },

  async update(
    id: number,
    userId: number,
    patch: Parameters<typeof botProfileRepository.update>[1],
  ): Promise<PublicBotProfile> {
    const existing = await botProfileRepository.findById(id);
    if (!existing) throw ApiError.notFound("Bot profile not found");
    if (existing.user_id !== userId) {
      throw ApiError.forbidden("That profile belongs to someone else");
    }

    // Re-validate whenever the token changes.
    const nextApplicationId = patch.application_id ?? existing.application_id;
    const nextPublicKey = patch.public_key ?? existing.public_key;
    if (!/^[\da-fA-F]{64}$/.test(nextPublicKey)) {
      throw ApiError.badRequest("The Discord public key must be 64 hexadecimal characters");
    }
    if (patch.token || patch.application_id) {
      const token = patch.token ?? await botProfileRepository.revealToken(id);
      if (!token) throw ApiError.badRequest("The stored bot token is unavailable");
      const identity = await discord.getBotIdentity(token).catch(() => null);
      if (!identity) throw ApiError.badRequest("Discord rejected that bot token");
      validateBotProfileIdentity(identity.id, nextApplicationId, nextPublicKey);
    }

    const updated = await botProfileRepository.update(id, patch);
    if (!updated) throw ApiError.notFound("Bot profile not found");
    return updated;
  },

  async remove(id: number, userId: number): Promise<boolean> {
    const existing = await botProfileRepository.findById(id);
    if (!existing) throw ApiError.notFound("Bot profile not found");
    if (existing.user_id !== userId) {
      throw ApiError.forbidden("That profile belongs to someone else");
    }
    return botProfileRepository.delete(id);
  },
};

export default { webhookProfileService, botProfileService };
