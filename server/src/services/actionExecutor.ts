import { parseCustomId } from "@dmb/shared";
import type { DiscordInteraction } from "@dmb/shared";
import { interpolateWeaoPlaceholders } from "./weaoService.js";
import { buildTimestampVariables, replaceVariables } from "./variableInterpolation.js";
export { replaceVariables } from "./variableInterpolation.js";
import { getActionHandler } from "../actions/index.js";
import { actionFailed } from "../actions/responses.js";
import type { ActionContext, ActionResponse } from "../actions/types.js";
import { actionRepository, webhookProfileRepository } from "../repositories/index.js";
import { logger } from "../utils/logger.js";
import { hasBranches, selectBranch, type ExecutableStep } from "./branches.js";
import * as discord from "./discordService.js";
import {
  buildGuildScopedVariables,
  buildGuildVariables,
  extractReferencedGuildIds,
} from "./guildVariables.js";

const log = logger.child("actions");
const MAX_BRANCH_DEPTH = 10;

export interface ExecuteResult {
  response: ActionResponse | undefined;
  handled: boolean;
  type: string | null;
}


const snowflakeToUnix = (id: string): number =>
  Math.floor(Number((BigInt(id) >> 22n) + 1420070400000n) / 1000);

export const extractVariablesFromInteraction = (interaction: DiscordInteraction): Record<string, unknown> => {
  const user = interaction.member?.user ?? interaction.user;
  const member = interaction.member as any;
  const userId = user?.id ?? "unknown";

  const username = user?.username ?? "User";
  const nickname = typeof member?.nick === "string" && member.nick.trim() ? member.nick.trim() : username;
  const displayname = user?.global_name ?? username;
  const primaryGuild = (user as any)?.primary_guild;
  const officialClanTag =
    (typeof member?.clan?.tag === "string" && member.clan.tag.trim()) ||
    (primaryGuild?.identity_enabled === true &&
      typeof primaryGuild?.tag === "string" &&
      primaryGuild.tag.trim()) ||
    "";
  const parsedClanTag = [nickname, username].map((value) =>
    value.match(/(?:\[([^\[\]]{1,16})\]|\(([^()]{1,16})\)|\{([^{}]{1,16})\})/),
  ).map((match) => match?.slice(1).find(Boolean)?.trim() || "").find(Boolean) || "";
  const clantag = officialClanTag || parsedClanTag;

  const timestampVariables = buildTimestampVariables();
  const unixNow = Number(timestampVariables["now.unix"]);
  const userCreated = user?.id ? snowflakeToUnix(user.id) : unixNow;
  const joinedAt = member?.joined_at ? Math.floor(new Date(member.joined_at).getTime() / 1000) : unixNow;

  const memberRoles: string[] = Array.isArray(member?.roles) ? member.roles : [];
  const selectedValues: string[] = Array.isArray(interaction.data?.values)
    ? interaction.data.values.map(String)
    : [];

  const messageId = interaction.message?.id;

  // Master variable dictionary
  const variables: Record<string, unknown> = {
    // User
    "user.mention": `<@${userId}>`,
    "user.name": nickname,
    "user.username": username,
    "user.displayname": displayname,
    "user.id": userId,
    "user.avatar": user?.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`
      : "",
    "user.roles":
      memberRoles.length > 0 ? memberRoles.map((r) => `<@&${r}>`).join(" ") : "None",
    "user.created": `<t:${userCreated}:d>`,
    "user.created.relative": `<t:${userCreated}:R>`,
    "user.joined": `<t:${joinedAt}:R>`,
    "user.joined.date": `<t:${joinedAt}:d>`,
    "user.clantag": clantag,

    // Role arrays for Check -> "Member has role"
    "member.role_ids": memberRoles,
    "member.roles": memberRoles,

    // Server
    "server.id": interaction.guild_id ?? "unknown",
    "server.name": (interaction as any).guild?.name ?? "Server",
    "server.icon":
      interaction.guild_id && (interaction as any).guild?.icon
        ? `https://cdn.discordapp.com/icons/${interaction.guild_id}/${(interaction as any).guild.icon}.png`
        : "",

    // Channel, Bot & Message
    "channel.id": interaction.channel_id ?? "unknown",
    "channel.mention": interaction.channel_id ? `<#${interaction.channel_id}>` : "unknown",
    "bot.id": interaction.application_id ?? "unknown",
    "bot.mention": interaction.application_id ? `<@${interaction.application_id}>` : "unknown",
    "message.id": messageId ?? "unknown",
    "message.url":
      interaction.guild_id && interaction.channel_id && messageId
        ? `https://discord.com/channels/${interaction.guild_id}/${interaction.channel_id}/${messageId}`
        : "",

    // Select Menu values
    selected: selectedValues.join(", "),
    ...Object.fromEntries(selectedValues.map((val, idx) => [`selected.${idx}`, val])),

    // Time (All 7 Discord Timestamp Styles + Unix)
    now: `<t:${unixNow}:t>`,
    "now.t": `<t:${unixNow}:t>`,
    "now.T": `<t:${unixNow}:T>`,
    "now.time": `<t:${unixNow}:T>`,
    "now.d": `<t:${unixNow}:d>`,
    "now.date": `<t:${unixNow}:d>`,
    "now.D": `<t:${unixNow}:D>`,
    "now.longdate": `<t:${unixNow}:D>`,
    "now.f": `<t:${unixNow}:f>`,
    "now.short": `<t:${unixNow}:f>`,
    "now.F": `<t:${unixNow}:F>`,
    "now.long": `<t:${unixNow}:F>`,
    "now.R": `<t:${unixNow}:R>`,
    "now.relative": `<t:${unixNow}:R>`,
    "now.unix": unixNow,
    ...timestampVariables,
  };

  // ── Modal Input Extraction ────────────────────────────────────────────────
  // Extracts submitted values into variables: {input_id}, {input.input_id}, {modal.input_id}
  if (interaction.data?.components && Array.isArray(interaction.data.components)) {
    for (const row of interaction.data.components as any[]) {
      if (Array.isArray(row.components)) {
        for (const comp of row.components) {
          if (comp.custom_id && comp.value !== undefined) {
            const val = String(comp.value);
            variables[comp.custom_id] = val;
            variables[`input.${comp.custom_id}`] = val;
            variables[`modal.${comp.custom_id}`] = val;
          }
        }
      }
    }
  }

  return variables;
};

export const resolveActionVariables = (textOrObj: any, interaction: DiscordInteraction): any => {
  const vars = extractVariablesFromInteraction(interaction);
  return replaceVariables(textOrObj, vars);
};

export const executeCustomId = async (
  customId: string,
  interaction: DiscordInteraction,
): Promise<ExecuteResult> => {
  // Support standard action IDs or stored modal IDs
  const parsed = parseCustomId(customId);
  const messageId = interaction.message?.id;
  const stored = await actionRepository.findByCustomId(customId, messageId);

  if (!parsed && stored.length === 0) {
    return { response: undefined, handled: false, type: null };
  }

  const actionType = parsed?.type ?? stored[0]?.action_type ?? "modal_submit";

  const steps: ExecutableStep[] =
    stored.length > 0
      ? stored.map((definition) => ({
          id: definition.id,
          type: definition.action_type,
          config: definition.config ?? {},
        }))
      : [{ id: null, type: actionType, config: parsed?.params ?? {} }];

  const variables = extractVariablesFromInteraction(interaction);
  const user = interaction.member?.user ?? interaction.user;
  const userId = user?.id ?? "unknown";

  const botToken =
    (await discord
      .resolveBotTokenForApplication?.(interaction.application_id)
      .catch(() => null)) || (await discord.resolveBotToken().catch(() => null));

  const guildId = interaction.guild_id;
  if (botToken) {
    if (guildId) {
      // Fetch the full Guild resource so the unqualified {server.*} placeholders
      // continue to describe the server where this interaction happened.
      const guild = await discord.getGuild(guildId, botToken).catch(() => null);
      if (guild) {
        Object.assign(variables, buildGuildVariables(guildId, guild));
      } else if (variables["server.name"] === "Server") {
        // Retain the previous lightweight fallback if the full Guild endpoint
        // is unavailable, so the established name/icon placeholders still work.
        const guilds = await discord.getBotGuilds().catch(() => []);
        const matchedGuild = guilds.find((entry) => entry.id === guildId);
        if (matchedGuild) Object.assign(variables, buildGuildVariables(guildId, matchedGuild));
      }
    }

    // Explicitly-addressed placeholders can read any other server the bot
    // can access, even when the interaction itself is not in a guild.
    const referencedGuildIds = extractReferencedGuildIds(steps);
    await Promise.all(
      referencedGuildIds.map(async (referencedGuildId) => {
        const referencedGuild = await discord
          .getGuild(referencedGuildId, botToken)
          .catch(() => null);
        if (referencedGuild) {
          Object.assign(
            variables,
            buildGuildScopedVariables(referencedGuildId, referencedGuild),
          );
        }
      }),
    );
  }

  const context: Omit<ActionContext, "config"> = {
    interaction,
    variables,
    botToken,
    discord,
    repositories: { webhookProfiles: webhookProfileRepository },
    logger: log,
  };

  const isErrorResponse = (res: ActionResponse | undefined): boolean =>
    typeof (res?.data as any)?.content === "string" &&
    ((res?.data as any).content as string).startsWith("\u26a0\ufe0f");

  const logStep = async (
    step: ExecutableStep,
    response: ActionResponse | undefined,
    startedAt: number,
    failed = false,
  ): Promise<void> => {
    await actionRepository.log({
      actionDefinitionId: step.id,
      interactionId: interaction.id,
      userId,
      guildId: interaction.guild_id ?? null,
      channelId: interaction.channel_id ?? null,
      status: failed || isErrorResponse(response) ? "failed" : "success",
      response: { type: step.type, ms: Date.now() - startedAt },
    });
  };

  const resolveStepConfig = async (raw: Record<string, any>): Promise<Record<string, any>> => {
    const replaced = replaceVariables(raw, variables);
    if (!JSON.stringify(replaced).includes("{exploit")) return replaced;
    const { payload: weaoResolved } = await interpolateWeaoPlaceholders(replaced as any);
    return weaoResolved as Record<string, any>;
  };

  let halted = false;

  const runSteps = async (
    list: ExecutableStep[],
    depth: number,
  ): Promise<ActionResponse | undefined> => {
    if (depth > MAX_BRANCH_DEPTH) {
      halted = true;
      return actionFailed("That flow nests too deeply to run.");
    }

    let lastResponse: ActionResponse | undefined;

    for (const step of list) {
      const handler = getActionHandler(step.type);
      if (!handler) continue;

      const started = Date.now();

      if (step.type === "check" && hasBranches(step.config)) {
        const { pass, fail, then: thenBranch, else: elseBranch, ...condOnly } = step.config;
        const resolvedCond = await resolveStepConfig(condOnly);
        const branch = selectBranch(
          { ...resolvedCond, pass, fail, then: thenBranch, else: elseBranch },
          variables,
        );
        const nested = await runSteps(branch, depth + 1);
        await logStep(step, nested, started, isErrorResponse(nested));
        if (nested) lastResponse = nested;
        if (halted) return lastResponse;
        continue;
      }

      let response: ActionResponse | undefined;
      let threw = false;
      try {
        const parsedConfig = await resolveStepConfig(step.config);
        response = await handler.run({
          ...context,
          botToken,
          config: parsedConfig,
        });
      } catch (err) {
        threw = true;
        const reason = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        log.error(`Action "${step.type}" threw: ${reason}`, stack);
        response = actionFailed("Something went wrong running that action.");
      }

      const failed = threw || isErrorResponse(response);
      await logStep(step, response, started, failed);

      if (step.type === "stop") {
        halted = true;
        const hasStopMessage = Boolean(
          typeof step.config?.content === "string" && step.config.content.trim(),
        );
        return hasStopMessage ? response : (lastResponse ?? response);
      }

      if (response) lastResponse = response;

      if (failed || step.type === "open_modal") {
        halted = true;
        return lastResponse;
      }
    }
    return lastResponse;
  };

  const response = await runSteps(steps, 0);
  return { response, handled: true, type: actionType };
};

export default { executeCustomId };