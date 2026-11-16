import { describe, expect, it } from "vitest";
import { buildGuildVariables } from "../src/services/guildVariables.js";

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
