import { describe, expect, it } from "vitest";
import {
  buildGuildScopedVariables,
  buildGuildVariables,
  extractReferencedGuildIds,
} from "../src/services/guildVariables.js";

describe("buildGuildVariables", () => {
  it("exposes scalar Guild fields and preserves the existing icon URL placeholder", () => {
    const variables = buildGuildVariables("guild123", {
      id: "guild123",
      name: "HoHo Hub",
      owner_id: "owner456",
      premium_tier: 3,
      approximate_member_count: 12000,
      features: ["COMMUNITY", "VERIFIED"],
      icon: "a_animatedHash",
      banner: "bannerHash",
    });

    expect(variables["server.id"]).toBe("guild123");
    expect(variables["server.name"]).toBe("HoHo Hub");
    expect(variables["server.owner_id"]).toBe("owner456");
    expect(variables["server.premium_tier"]).toBe("3");
    expect(variables["server.approximate_member_count"]).toBe("12000");
    expect(variables["server.features"]).toBe("COMMUNITY, VERIFIED");
    expect(variables["server.icon_hash"]).toBe("a_animatedHash");
    expect(variables["server.icon"]).toBe(
      "https://cdn.discordapp.com/icons/guild123/a_animatedHash.gif",
    );
    expect(variables["server.banner_url"]).toBe(
      "https://cdn.discordapp.com/banners/guild123/bannerHash.png",
    );
  });

  it("serializes arrays and exposes indexed nested fields", () => {
    const variables = buildGuildVariables("guild123", {
      roles: [{ id: "role1", name: "Admin", permissions: "8" }],
      emojis: [{ id: "emoji1", name: "hoho", animated: true }],
      incidents_data: { invites_disabled_until: "2026-11-18T00:00:00.000Z" },
    });

    expect(variables["server.roles"]).toContain('"name":"Admin"');
    expect(variables["server.roles.0.name"]).toBe("Admin");
    expect(variables["server.roles.0.permissions"]).toBe("8");
    expect(variables["server.emojis.0.name"]).toBe("hoho");
    expect(variables["server.incidents_data"]).toContain("invites_disabled_until");
    expect(variables["server.incidents_data.invites_disabled_until"]).toBe(
      "2026-11-18T00:00:00.000Z",
    );
  });

  it("turns null and missing optional resource fields into safe empty values", () => {
    const variables = buildGuildVariables("guild123", {
      description: null,
      icon: null,
      splash: null,
    });

    expect(variables["server.description"]).toBe("");
    expect(variables["server.icon"]).toBe("");
    expect(variables["server.icon_url"]).toBe("");
    expect(variables["server.splash_url"]).toBe("");
  });
});


describe("buildGuildScopedVariables", () => {
  it("namespaces fields by guild ID and exposes target icon/banner URLs", () => {
    const variables = buildGuildScopedVariables("123456789012345678", {
      id: "123456789012345678",
      name: "Other Server",
      icon: "a_iconHash",
      banner: "bannerHash",
    });

    expect(variables["server.123456789012345678.id"]).toBe("123456789012345678");
    expect(variables["server.123456789012345678.name"]).toBe("Other Server");
    expect(variables["server.123456789012345678.icon"]).toBe(
      "https://cdn.discordapp.com/icons/123456789012345678/a_iconHash.gif",
    );
    expect(variables["server.123456789012345678.banner"]).toBe(
      "https://cdn.discordapp.com/banners/123456789012345678/bannerHash.png",
    );
    expect(variables["server.123456789012345678.banner_url"]).toBe(
      variables["server.123456789012345678.banner"],
    );
    expect(variables["server.123456789012345678.banner_hash"]).toBe("bannerHash");
  });

  it("returns an empty banner URL when the target server has no banner", () => {
    const variables = buildGuildScopedVariables("123456789012345678", {
      id: "123456789012345678",
      icon: null,
      banner: null,
    });

    expect(variables["server.123456789012345678.icon"]).toBe("");
    expect(variables["server.123456789012345678.banner"]).toBe("");
  });
});

describe("Guild Preview compatibility", () => {
  it("exposes discoverable guild preview name, icon, banner, and preview metadata", () => {
    const variables = buildGuildScopedVariables("123456789012345678", {
      id: "123456789012345678",
      name: "Discoverable Community",
      description: "A public community",
      features: ["DISCOVERABLE", "COMMUNITY"],
      approximate_member_count: 2500,
      approximate_presence_count: 120,
      icon: "a_previewIcon",
      banner: "previewBanner",
    });

    expect(variables["server.123456789012345678.name"]).toBe("Discoverable Community");
    expect(variables["server.123456789012345678.description"]).toBe("A public community");
    expect(variables["server.123456789012345678.features"]).toBe("DISCOVERABLE, COMMUNITY");
    expect(variables["server.123456789012345678.approximate_member_count"]).toBe("2500");
    expect(variables["server.123456789012345678.icon"]).toBe(
      "https://cdn.discordapp.com/icons/123456789012345678/a_previewIcon.gif",
    );
    expect(variables["server.123456789012345678.banner"]).toBe(
      "https://cdn.discordapp.com/banners/123456789012345678/previewBanner.png",
    );
  });
});

describe("extractReferencedGuildIds", () => {
  it("finds unique explicit server IDs in nested action configuration", () => {
    expect(
      extractReferencedGuildIds({
        content: "{server.123456789012345678.icon}",
        embeds: [{ image: "{server.234567890123456789.banner_url}" }],
        duplicate: "{server.123456789012345678.name}",
      }),
    ).toEqual(["123456789012345678", "234567890123456789"]);
  });

  it("ignores malformed IDs and caps the lookup fan-out at ten guilds", () => {
    const placeholders = Array.from(
      { length: 12 },
      (_, index) => `{server.${String(10000000000000000n + BigInt(index))}.icon}`,
    ).join(" ");

    expect(extractReferencedGuildIds(`{server.not-a-snowflake.icon} ${placeholders}`)).toHaveLength(10);
  });
});
