import { parseCustomId } from "@dmb/shared";
import type { DiscordInteraction } from "@dmb/shared";
import { getActionHandler } from "../actions/index.js";
import { actionFailed } from "../actions/responses.js";
import type { ActionContext, ActionResponse } from "../actions/types.js";
import { actionRepository, webhookProfileRepository } from "../repositories/index.js";
import { logger } from "../utils/logger.js";
import { hasBranches, selectBranch, type ExecutableStep } from "./branches.js";
import * as discord from "./discordService.js";

const log = logger.child("actions");
const MAX_BRANCH_DEPTH = 10;

export interface ExecuteResult {
  response: ActionResponse | undefined;
  handled: boolean;
  type: string | null;
}

const replaceVariables = (obj: any, vars: Record<string, any>): any => {
  if (typeof obj === "string") {
    return obj.replace(/\{\{\s*([^{}]+?)\s*\}\}|\{\s*([^{}]+?)\s*\}/g, (match, key) => {
      return vars[key] !== undefined ? String(vars[key]) : match;
    });
  }
  if (Array.isArray(obj)) return obj.map((v) => replaceVariables(v, vars));
  if (obj !== null && typeof obj === "object") {
    const newObj: any = {};
    for (const [k, v] of Object.entries(obj)) {
      newObj[k] = replaceVariables(v, vars);
    }
    return newObj;
  }
  return obj;
};

const snowflakeToUnix = (id: string) => {
  const epoch = 1420070400000;
  const binary = BigInt(id).toString(2).padStart(64, "0");
  const timestamp = parseInt(binary.substring(0, 42), 2) + epoch;
  return Math.floor(timestamp / 1000);
};

export const executeCustomId = async (
  customId: string,
  interaction: DiscordInteraction,
): Promise<ExecuteResult> => {
  // Support standard action IDs or stored modal IDs
  const parsed = parseCustomId(customId);
  const messageId = interaction.message?.id;
  const stored = await actionRepository.findByCustomId(customId,messageId);

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

  const user = interaction.member?.user ?? interaction.user;
  const member = interaction.member as any;
  const userId = user?.id ?? "unknown";

  const username = user?.username ?? "User";
  const displayname = member?.nick ?? user?.global_name ?? username;

  const clanTagMatch = displayname.match(/^\[(.*?)\]|^\((.*?)\)|^\{(.*?)\}/);
  const clantag = clanTagMatch ? (clanTagMatch[1] || clanTagMatch[2] || clanTagMatch[3]) : "";

  const unixNow = Math.floor(Date.now() / 1000);
  const userCreated = user?.id ? snowflakeToUnix(user.id) : unixNow;
  const joinedAt = member?.joined_at ? Math.floor(new Date(member.joined_at).getTime() / 1000) : unixNow;

  // Master variable dictionary
  const variables: Record<string, unknown> = {
    // User
    "user.mention": `<@${userId}>`,
    "user.name": username,
    "user.displayname": displayname,
    "user.id": userId,
    "user.avatar": user?.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png` : "",
    "user.created": `<t:${userCreated}:d>`,
    "user.joined": `<t:${joinedAt}:R>`,
    "user.clantag": clantag,

    // Server
    "server.id": interaction.guild_id ?? "unknown",
    "server.name": "Your Server",
    "server.icon": interaction.guild_id ? `https://cdn.discordapp.com/icons/${interaction.guild_id}/icon.png` : "",

    // Channel & Bot
    "channel.id": interaction.channel_id ?? "unknown",
    "channel.mention": interaction.channel_id ? `<#${interaction.channel_id}>` : "unknown",
    "bot.id": interaction.application_id ?? "unknown",
    "bot.mention": interaction.application_id ? `<@${interaction.application_id}>` : "unknown",

    // Time
    "now": `<t:${unixNow}:t>`,
    "now.relative": `<t:${unixNow}:R>`,
    "now.long": `<t:${unixNow}:F>`,
    "now.unix": unixNow,
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

  const botToken = await discord.resolveBotToken().catch(() => null);
  const context: Omit<ActionContext, "config"> = {
    interaction,
    variables,
    botToken,
    discord,
    repositories: { webhookProfiles: webhookProfileRepository },
    logger: log,
  };

  const logStep = async (step: ExecutableStep, response: ActionResponse | undefined, startedAt: number): Promise<void> => {
    await actionRepository.log({
      actionDefinitionId: step.id,
      interactionId: interaction.id,
      userId,
      guildId: interaction.guild_id ?? null,
      channelId: interaction.channel_id ?? null,
      status: response ? "success" : "pending",
      response: { type: step.type, ms: Date.now() - startedAt },
    });
  };

  const runSteps = async (list: ExecutableStep[], depth: number): Promise<ActionResponse | undefined> => {
    if (depth > MAX_BRANCH_DEPTH) return actionFailed("That flow nests too deeply to run.");

    for (const step of list) {
      const handler = getActionHandler(step.type);
      if (!handler) continue;

      const started = Date.now();

      // Conditional check step with branching
      if (step.type === "check" && hasBranches(step.config)) {
        const parsedConfig = replaceVariables(step.config, variables);
        const branch = selectBranch(parsedConfig, variables);
        const nested = await runSteps(branch, depth + 1);
        await logStep(step, nested, started);
        if (nested) return nested;
        continue;
      }

      let response: ActionResponse | undefined;
      try {
        const parsedConfig = replaceVariables(step.config, variables);
        response = await handler.run({ ...context, config: parsedConfig });
      } catch (error) {
        log.error(`Action "${step.type}" error:`, error);
        response = actionFailed("Something went wrong running that action.");
      }

      await logStep(step, response, started);
      if (response) return response;
    }
    return undefined;
  };

  const response = await runSteps(steps, 0);
  return { response, handled: true, type: actionType };
};

export default { executeCustomId };