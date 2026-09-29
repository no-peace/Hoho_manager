import type { ActionType } from "@dmb/shared";
import { actionFailed, ephemeral } from "./responses.js";
import { configString, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "toggle_role";
export const description = "Add the role if absent, remove it if present";

export const run = async ({
  interaction,
  config,
  botToken,
  discord,
  logger,
}: ActionContext): Promise<ActionResponse | undefined> => {
  const roleId = configString(config, "roleId", "role_id");
  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  if (!roleId) return actionFailed("This button has no role configured.");
  if (!guildId) return actionFailed("This action only works inside a server.");
  if (!userId) return actionFailed("I couldn't work out who clicked.");
  if (!botToken) return actionFailed("The bot isn't configured on the server.");

  try {
    const alreadyHas = await discord.hasRole(guildId, userId, roleId, botToken);

    if (alreadyHas) {
      await discord.removeGuildMemberRole(guildId, userId, roleId, botToken);
      return ephemeral(`\u2705 Removed <@&${roleId}>.`);
    }

    await discord.addGuildMemberRole(guildId, userId, roleId, botToken);
    return ephemeral(`\u2705 Gave you <@&${roleId}>.`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`toggle_role failed for ${userId}: ${reason}`);
    return actionFailed("I couldn't update that role — check my permissions.");
  }
};

export default run;
