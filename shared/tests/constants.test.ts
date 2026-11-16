import { describe, expect, it } from "vitest";
import {
  ACTION_PREFIX,
  ACTION_SEPARATOR,
  AdaptiveFields,
  ButtonStyle,
  CheckFunctions,
  ComponentType,
  DISCORD_API_BASE,
  InteractionResponseType,
  InteractionType,
  Limits,
  MessageFlags,
  SetVariableModes,
  SNOWFLAKE_REGEX,
  WEBHOOK_URL_REGEX,
} from "../src/constants.js";

describe("shared/constants: Protocol Constants & Schema Limits Suite", () => {
  describe("MessageFlags Bitfield Verification", () => {
    it("guarantees all message flags are distinct powers of two", () => {
      const values = Object.values(MessageFlags);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);

      for (const val of values) {
        expect(typeof val).toBe("number");
        expect(val).toBeGreaterThan(0);
        // Power of two check
        expect(val & (val - 1)).toBe(0);
      }
    });

    it("preserves exact Discord bit positions for critical flags", () => {
      expect(MessageFlags.Crossposted).toBe(1 << 0); // 1
      expect(MessageFlags.SuppressEmbeds).toBe(1 << 2); // 4
      expect(MessageFlags.Ephemeral).toBe(1 << 6); // 64
      expect(MessageFlags.Loading).toBe(1 << 7); // 128
      expect(MessageFlags.SuppressNotifications).toBe(1 << 12); // 4096
      expect(MessageFlags.IsComponentsV2).toBe(1 << 15); // 32768
    });

    it("computes bitwise combinations accurately", () => {
      const combined = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
      expect(combined).toBe(32832);
      expect(combined & MessageFlags.Ephemeral).toBe(MessageFlags.Ephemeral);
      expect(combined & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2);
      expect(combined & MessageFlags.SuppressEmbeds).toBe(0);
    });
  });

  describe("ComponentType & ButtonStyle Constants", () => {
    it("maintains unique component types matching Discord V1 and V2 specs", () => {
      const types = Object.values(ComponentType);
      const unique = new Set(types);
      expect(unique.size).toBe(types.length);

      // Components V1
      expect(ComponentType.ActionRow).toBe(1);
      expect(ComponentType.Button).toBe(2);
      expect(ComponentType.StringSelect).toBe(3);
      expect(ComponentType.TextInput).toBe(4);
      expect(ComponentType.UserSelect).toBe(5);
      expect(ComponentType.RoleSelect).toBe(6);
      expect(ComponentType.MentionableSelect).toBe(7);
      expect(ComponentType.ChannelSelect).toBe(8);

      // Components V2
      expect(ComponentType.Section).toBe(9);
      expect(ComponentType.TextDisplay).toBe(10);
      expect(ComponentType.Thumbnail).toBe(11);
      expect(ComponentType.MediaGallery).toBe(12);
      expect(ComponentType.File).toBe(13);
      expect(ComponentType.Separator).toBe(14);
      expect(ComponentType.Container).toBe(17);
    });

    it("verifies ButtonStyle values", () => {
      expect(ButtonStyle.Primary).toBe(1);
      expect(ButtonStyle.Secondary).toBe(2);
      expect(ButtonStyle.Success).toBe(3);
      expect(ButtonStyle.Danger).toBe(4);
      expect(ButtonStyle.Link).toBe(5);
      expect(ButtonStyle.Premium).toBe(6);
    });
  });

  describe("Interaction & Response Types", () => {
    it("verifies Discord interaction types", () => {
      expect(InteractionType.Ping).toBe(1);
      expect(InteractionType.ApplicationCommand).toBe(2);
      expect(InteractionType.MessageComponent).toBe(3);
      expect(InteractionType.ApplicationCommandAutocomplete).toBe(4);
      expect(InteractionType.ModalSubmit).toBe(5);
    });

    it("verifies Discord interaction response types", () => {
      expect(InteractionResponseType.Pong).toBe(1);
      expect(InteractionResponseType.ChannelMessageWithSource).toBe(4);
      expect(InteractionResponseType.DeferredChannelMessageWithSource).toBe(5);
      expect(InteractionResponseType.DeferredUpdateMessage).toBe(6);
      expect(InteractionResponseType.UpdateMessage).toBe(7);
      expect(InteractionResponseType.ApplicationCommandAutocompleteResult).toBe(8);
      expect(InteractionResponseType.Modal).toBe(9);
    });
  });

  describe("Limits Enforcement Constants", () => {
    it("enforces Discord documented content & embed constraints", () => {
      expect(Limits.content).toBe(2000);
      expect(Limits.embed.title).toBe(256);
      expect(Limits.embed.description).toBe(4096);
      expect(Limits.embed.fields).toBe(25);
      expect(Limits.embed.fieldName).toBe(256);
      expect(Limits.embed.fieldValue).toBe(1024);
      expect(Limits.embed.footerText).toBe(2048);
      expect(Limits.embed.authorName).toBe(256);
      expect(Limits.embed.total).toBe(6000);
      expect(Limits.embed.embedsPerMessage).toBe(10);
    });

    it("enforces component limit boundaries", () => {
      expect(Limits.components.total).toBe(40);
      expect(Limits.components.label).toBe(80);
      expect(Limits.components.customId).toBe(100);
      expect(Limits.components.placeholder).toBe(150);
      expect(Limits.components.options).toBe(25);
      expect(Limits.components.selectOptionLabel).toBe(100);
      expect(Limits.components.selectOptionDescription).toBe(100);
      expect(Limits.components.textDisplay).toBe(4000);
      expect(Limits.components.actionRowButtons).toBe(5);
    });
  });

  describe("Regex Specifications", () => {
    describe("SNOWFLAKE_REGEX", () => {
      it("matches valid Discord snowflake identifiers (17 to 20 digits)", () => {
        expect(SNOWFLAKE_REGEX.test("12345678901234567")).toBe(true); // 17
        expect(SNOWFLAKE_REGEX.test("123456789012345678")).toBe(true); // 18
        expect(SNOWFLAKE_REGEX.test("1234567890123456789")).toBe(true); // 19
        expect(SNOWFLAKE_REGEX.test("12345678901234567890")).toBe(true); // 20
      });

      it("rejects non-snowflake strings", () => {
        expect(SNOWFLAKE_REGEX.test("")).toBe(false);
        expect(SNOWFLAKE_REGEX.test("1234567890123456")).toBe(false); // 16 digits (too short)
        expect(SNOWFLAKE_REGEX.test("123456789012345678901")).toBe(false); // 21 digits (too long)
        expect(SNOWFLAKE_REGEX.test("12345678901234567a")).toBe(false); // alpha
        expect(SNOWFLAKE_REGEX.test("-12345678901234567")).toBe(false); // negative
        expect(SNOWFLAKE_REGEX.test(" 123456789012345678 ")).toBe(false); // whitespace
      });
    });

    describe("WEBHOOK_URL_REGEX", () => {
      it("matches and extracts id and token from valid Discord webhook URLs", () => {
        const url = "https://discord.com/api/webhooks/123456789012345678/aBcDeF-123_token";
        const match = url.match(WEBHOOK_URL_REGEX);
        expect(match).not.toBeNull();
        expect(match![1]).toBe("123456789012345678");
        expect(match![2]).toBe("aBcDeF-123_token");
      });

      it("supports discordapp.com legacy domain and API version prefixes", () => {
        const legacy = "https://discordapp.com/api/webhooks/99887766/tok123";
        const matchLegacy = legacy.match(WEBHOOK_URL_REGEX);
        expect(matchLegacy).not.toBeNull();
        expect(matchLegacy![1]).toBe("99887766");
        expect(matchLegacy![2]).toBe("tok123");

        const versioned = "https://discord.com/api/v10/webhooks/11223344/versioned-tok";
        const matchVersioned = versioned.match(WEBHOOK_URL_REGEX);
        expect(matchVersioned).not.toBeNull();
        expect(matchVersioned![1]).toBe("11223344");
        expect(matchVersioned![2]).toBe("versioned-tok");
      });

      it("supports canary and ptb subdomains", () => {
        expect(WEBHOOK_URL_REGEX.test("https://canary.discord.com/api/webhooks/123/abc")).toBe(true);
        expect(WEBHOOK_URL_REGEX.test("https://ptb.discord.com/api/webhooks/123/abc")).toBe(true);
      });

      it("rejects non-discord domains and malformed paths", () => {
        expect(WEBHOOK_URL_REGEX.test("https://attacker.com/api/webhooks/123/token")).toBe(false);
        expect(WEBHOOK_URL_REGEX.test("https://discord.com/api/channels/123/messages")).toBe(false);
        expect(WEBHOOK_URL_REGEX.test("https://discord.com/api/webhooks/not-numeric/token")).toBe(false);
        expect(WEBHOOK_URL_REGEX.test("https://discord.com/api/webhooks/123/")).toBe(false);
      });
    });
  });

  describe("Action & Variable Configuration Constants", () => {
    it("defines action wire protocol prefix and separator", () => {
      expect(ACTION_PREFIX).toBe("action");
      expect(ACTION_SEPARATOR).toBe(":");
      expect(DISCORD_API_BASE).toBe("https://discord.com/api/v10");
    });

    it("maintains the required adaptive fields array", () => {
      expect(AdaptiveFields).toEqual([
        "user.id",
        "user.name",
        "user.username",
        "channel.id",
        "guild.id",
        "message.id",
        "selected",
      ]);
    });

    it("maintains check functions with valid structure", () => {
      expect(CheckFunctions.map((c) => c.value)).toEqual(["equals", "in", "and", "or", "not"]);
    });

    it("maintains set variable modes with valid structure", () => {
      expect(SetVariableModes.map((m) => m.value)).toEqual(["static", "adaptive", "get"]);
    });
  });
});
