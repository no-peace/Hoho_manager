/**
 * Converts the Discord Guild resource into flat string placeholders.
 *
 * Scalar fields become {server.<field>}; nested objects are also flattened
 * (for example {server.incidents_data.invites_disabled_until}). Arrays are
 * available as JSON and their object entries are addressable by numeric index.
 */
export const buildGuildVariables = (
  guildId: string,
  guild: Record<string, unknown>,
): Record<string, string> => {
  const variables: Record<string, string> = {};

  const visit = (key: string, value: unknown): void => {
    if (value === undefined || value === null) {
      variables[key] = "";
      return;
    }

    if (Array.isArray(value)) {
      variables[key] = value.every(
        (entry) => entry === null || ["string", "number", "boolean"].includes(typeof entry),
      )
        ? value.map((entry) => (entry == null ? "" : String(entry))).join(", ")
        : JSON.stringify(value);

      value.forEach((entry, index) => {
        if (entry !== null && typeof entry === "object") {
          visit(`${key}.${index}`, entry);
        }
      });
      return;
    }

    if (typeof value === "object") {
      variables[key] = JSON.stringify(value);
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        visit(`${key}.${childKey}`, childValue);
      }
      return;
    }

    variables[key] = String(value);
  };

  for (const [key, value] of Object.entries(guild)) {
    visit(`server.${key}`, value);
  }

  // Keep the established {server.icon} behavior (CDN URL), while exposing
  // the raw Discord hash separately for callers that need it.
  const assetUrl = (asset: unknown, route: string): string => {
    if (typeof asset !== "string" || !asset) return "";
    const extension = asset.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/${route}/${guildId}/${asset}.${extension}`;
  };

  const iconHash = guild.icon;
  variables["server.icon_hash"] = typeof iconHash === "string" ? iconHash : "";
  variables["server.icon"] = assetUrl(iconHash, "icons");
  variables["server.icon_url"] = variables["server.icon"];

  for (const asset of ["banner", "splash", "discovery_splash"] as const) {
    const hash = guild[asset];
    variables[`server.${asset}_url`] = assetUrl(
      hash,
      asset === "banner" ? "banners" : asset === "splash" ? "splashes" : "discovery-splashes",
    );
  }

  return variables;
};
