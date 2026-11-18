import type { ActionContext } from "./types.js";

const BLOCKED_SELF_ASSIGN_PERMISSIONS = [
  1n << 1n,  // KICK_MEMBERS
  1n << 2n,  // BAN_MEMBERS
  1n << 3n,  // ADMINISTRATOR
  1n << 4n,  // MANAGE_CHANNELS
  1n << 5n,  // MANAGE_GUILD
  1n << 7n,  // VIEW_AUDIT_LOG
  1n << 13n, // MANAGE_MESSAGES
  1n << 22n, // MUTE_MEMBERS
  1n << 23n, // DEAFEN_MEMBERS
  1n << 24n, // MOVE_MEMBERS
  1n << 27n, // MANAGE_NICKNAMES
  1n << 28n, // MANAGE_ROLES
  1n << 29n, // MANAGE_WEBHOOKS
  1n << 30n, // MANAGE_GUILD_EXPRESSIONS
  1n << 33n, // MANAGE_EVENTS
  1n << 34n, // MANAGE_THREADS
  1n << 40n, // MODERATE_MEMBERS
  1n << 43n, // CREATE_GUILD_EXPRESSIONS
  1n << 44n, // CREATE_EVENTS
];

const BLOCKED_PERMISSION_MASK = BLOCKED_SELF_ASSIGN_PERMISSIONS.reduce(
  (mask, bit) => mask | bit,
  0n,
);

export const getSelfAssignableRoleError = async (
  context: Pick<ActionContext, "discord" | "botToken">,
  guildId: string,
  roleId: string,
): Promise<string | null> => {
  if (!context.botToken) return "The bot isn't configured on the server.";
  try {
    const roles = await context.discord.getGuildRolesWithToken(guildId, context.botToken);
    const role = roles.find((candidate) => candidate.id === roleId);
    if (!role) return "That role no longer exists in this server.";
    if (role.managed) return "That role is managed by an integration and cannot be self-assigned.";
    if (typeof role.permissions !== "string") {
      return "I couldn't verify that role's permissions, so it cannot be self-assigned.";
    }
    const permissions = BigInt(role.permissions);
    if ((permissions & BLOCKED_PERMISSION_MASK) !== 0n) {
      return "That role has moderation or administration permissions and cannot be self-assigned.";
    }
    return null;
  } catch {
    return "I couldn't verify that role's permissions, so it cannot be self-assigned.";
  }
};
