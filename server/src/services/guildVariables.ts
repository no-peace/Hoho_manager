/**
 * Converts the Discord Guild resource into flat string placeholders.
 *
 * Scalar fields become {server.<field>}; nested objects are also flattened
 * (for example {server.incidents_data.invites_disabled_until}). Arrays are
 * available as JSON and their object entries are addressable by numeric index.
 */
export const buildGuildVariables = (
  guildId: string,
  guild: object,
): Record<string, string> => {
  // Accept typed Discord guild summaries as well as the complete REST payload.
  // Interfaces without an index signature are still valid object inputs.
  const guildRecord = guild as Record<string, unknown>;
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

  for (const [key, value] of Object.entries(guildRecord)) {
    visit(`server.${key}`, value);
  }

  // Keep the established {server.icon} behavior (CDN URL), while exposing
  // the raw Discord hash separately for callers that need it.
  const assetUrl = (asset: unknown, route: string): string => {
    if (typeof asset !== "string" || !asset) return "";
    const extension = asset.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/${route}/${guildId}/${asset}.${extension}`;
  };

  const iconHash = guildRecord.icon;
  variables["server.icon_hash"] = typeof iconHash === "string" ? iconHash : "";
  variables["server.icon"] = assetUrl(iconHash, "icons");
  variables["server.icon_url"] = variables["server.icon"];

  for (const asset of ["banner", "splash", "discovery_splash"] as const) {
    const hash = guildRecord[asset];
    variables[`server.${asset}_url`] = assetUrl(
      hash,
      asset === "banner" ? "banners" : asset === "splash" ? "splashes" : "discovery-splashes",
    );
  }

  return variables;
};

/**
 * Re-map a Guild resource under an explicit server ID namespace:
 * {server.<guildId>.name}, {server.<guildId>.icon}, etc.
 *
 * For target-server assets, both .icon and .banner resolve to CDN URLs.
 * Raw hashes remain available through .icon_hash and .banner_hash.
 */
export const buildGuildScopedVariables = (
  guildId: string,
  guild: object,
): Record<string, string> => {
  const guildRecord = guild as Record<string, unknown>;
  const base = buildGuildVariables(guildId, guildRecord);
  const scoped = Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      `server.${guildId}.${key.slice("server.".length)}`,
      value,
    ]),
  );

  const bannerHash = guildRecord.banner;
  const bannerUrl = base["server.banner_url"] ?? "";
  scoped[`server.${guildId}.banner_hash`] =
    typeof bannerHash === "string" ? bannerHash : "";
  scoped[`server.${guildId}.banner`] = bannerUrl;
  scoped[`server.${guildId}.banner_url`] = bannerUrl;

  return scoped;
};

/**
 * Find explicitly-addressed Guild placeholders in action configuration.
 * A small cap prevents one action from fanning out into unbounded REST calls.
 */
export const extractReferencedGuildIds = (value: unknown): string[] => {
  let serialized: string;
  try {
    serialized = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return [];
  }
  if (!serialized) return [];

  const ids = new Set<string>();
  const pattern = /server\.(\d{17,20})\.[A-Za-z0-9_.]+/g;
  for (const match of serialized.matchAll(pattern)) {
    ids.add(match[1]);
    if (ids.size >= 10) break;
  }
  return [...ids];
};
