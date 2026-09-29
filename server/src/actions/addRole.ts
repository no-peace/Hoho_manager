import type { ActionType } from "@dmb/shared";
import { actionFailed, ephemeral } from "./responses.js";
import { configString, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "add_role";
export const description = "Give the member who clicked a role";

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
    await discord.addGuildMemberRole(guildId, userId, roleId, botToken);
    return ephemeral(`\u2705 Gave you <@&${roleId}>.`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`add_role failed for ${userId}: ${reason}`);
    return actionFailed(
      "I couldn't add that role — check my permissions and that my role sits above it.",
    );
  }
};

export default run;
