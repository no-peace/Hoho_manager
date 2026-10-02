// Prevent JSON.stringify crashes when serializing Discord snowflake BigInts
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { parseCustomId } from "@dmb/shared";
import type { DiscordInteraction } from "@dmb/shared";
import { getActionHandler } from "../actions/index.js";
import { actionFailed } from "../actions/responses.js";
import type { ActionContext, ActionResponse } from "../actions/types.js";
import { actionRepository, webhookProfileRepository } from "../repositories/index.js";
import { logger } from "../utils/logger.js";
import { hasBranches, selectBranch, type ExecutableStep } from "./branches.js";
import * as discord from "./discordService.js";
import { replaceVariables } from "./variableInterpolation.js";

const log = logger.child("actions");
const MAX_BRANCH_DEPTH = 10;

export interface ExecuteResult {
  response: ActionResponse | undefined;
  handled: boolean;
  type: string | null;
}

const snowflakeToUnix = (id: string): number => {
  try {
    const epoch = 1420070400000;
    const binary = BigInt(id).toString(2).padStart(64, "0");
    const timestamp = parseInt(binary.substring(0, 42), 2) + epoch;
    return Math.floor(timestamp / 1000);
  } catch {
    return Math.floor(Date.now() / 1000);
  }
};

export const executeCustomId = async (
  customId: string,
  interaction: DiscordInteraction,
): Promise<ExecuteResult> => {
  const parsed = parseCustomId(customId);
  if (!parsed) return { response: undefined, handled: false, type: null };

  const stored = await actionRepository.findByCustomId(customId, interaction.message?.id);
  const steps: ExecutableStep[] =
    stored.length > 0
      ? stored.map((definition) => ({
          id: definition.id,
          type: definition.action_type,
          config: (definition.config ?? {}) as Record<string, any>,
        }))
      : [{ id: null, type: parsed.type, config: parsed.params as Record<string, any> }];

  const user = interaction.member?.user ?? interaction.user;
  const member = interaction.member as any;
  const userId = user?.id ?? "unknown";

  const username = user?.username ?? "User";
  const displayname = member?.nick ?? user?.global_name ?? username;

  const unixNow = Math.floor(Date.now() / 1000);
  const userCreated = user?.id ? snowflakeToUnix(user.id) : unixNow;
  const joinedAt = member?.joined_at ? Math.floor(new Date(member.joined_at).getTime() / 1000) : unixNow;

  const variables: Record<string, unknown> = {
    // User
    "user.mention": `<@${userId}>`,
    "user.name": username,
    "user.displayname": displayname,
    "user.id": userId,
    "user.avatar": user?.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png` : "",
    "user.created": `<t:${userCreated}:d>`,
    "user.joined": `<t:${joinedAt}:R>`,

    // Server
    "server.id": interaction.guild_id ?? "unknown",

    // Channel & Bot
    "channel.id": interaction.channel_id ?? "unknown",
    "channel.mention": interaction.channel_id ? `<#${interaction.channel_id}>` : "unknown",
    "bot.id": interaction.application_id ?? "unknown",
    "bot.mention": interaction.application_id ? `<@${interaction.application_id}>` : "unknown",

    // Time
    now: `<t:${unixNow}:t>`,
    "now.relative": `<t:${unixNow}:R>`,
    "now.long": `<t:${unixNow}:F>`,
    "now.unix": unixNow,
  };

  const botToken = await discord
    .resolveBotTokenForApplication(interaction.application_id)
    .catch(() => null);
  const context: Omit<ActionContext, "config"> = {
    interaction,
    variables,
    botToken,
    discord,
    repositories: { webhookProfiles: webhookProfileRepository },
    logger: log,
  };

  const logStep = async (
    step: ExecutableStep,
    response: ActionResponse | undefined,
    startedAt: number,
  ): Promise<void> => {
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
      if (!handler) {
        log.warn(`No handler registered for action type: ${step.type}`);
        continue;
      }

      const started = Date.now();

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
        const reason = error instanceof Error ? error.message : String(error);
        log.error(`Action "${step.type}" threw: ${reason}`);
        response = actionFailed("Something went wrong running that action.");
      }

      await logStep(step, response, started);
      if (response) return response;
    }
    return undefined;
  };

  const response = await runSteps(steps, 0);
  return { response, handled: true, type: parsed.type };
};

export default { executeCustomId };