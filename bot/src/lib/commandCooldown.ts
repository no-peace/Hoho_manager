const cooldownMap = new Map<string, number>();

/**
 * Checks whether a user is on cooldown for a specific slash command.
 * Returns remaining seconds (> 0) if rate-limited, or 0 if allowed.
 */
export const checkCommandCooldown = (
  commandName: string,
  userId: string,
  cooldownSeconds = 5,
): number => {
  const key = `${commandName}:${userId}`;
  const now = Date.now();
  const expiresAt = cooldownMap.get(key) ?? 0;
  if (expiresAt > now) {
    return Math.ceil((expiresAt - now) / 1000);
  }
  cooldownMap.set(key, now + cooldownSeconds * 1000);
  if (cooldownMap.size > 2000) {
    for (const [k, exp] of cooldownMap.entries()) {
      if (exp <= now) cooldownMap.delete(k);
    }
  }
  return 0;
};
