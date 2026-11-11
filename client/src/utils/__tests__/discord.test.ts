import { describe, expect, it } from "vitest";
import {
  decimalToHex,
  embedCharCount,
  hexToDecimal,
  isPayloadEmpty,
  parseDiscordMessageLink,
  parseHexColor,
  toDiscordPayload,
  validateMessage,
} from "../discord.js";
import type { MessageData } from "@dmb/shared";

describe("client discord utils", () => {
  describe("color conversions", () => {
    it("converts decimal colors to hex", () => {
      expect(decimalToHex(0xff0000)).toBe("#ff0000");
      expect(decimalToHex(16711680)).toBe("#ff0000");
      expect(decimalToHex(null)).toBe("#000000");
      expect(decimalToHex(undefined)).toBe("#000000");
    });

    it("converts hex colors to decimal", () => {
      expect(hexToDecimal("#ff0000")).toBe(16711680);
      expect(hexToDecimal("ff0000")).toBe(16711680);
      expect(hexToDecimal("#000000")).toBe(0);
    });

    it("parses valid hex strings", () => {
      expect(parseHexColor("#5865F2")).toBe(0x5865f2);
      expect(parseHexColor("5865F2")).toBe(0x5865f2);
      expect(parseHexColor("invalid")).toBeNull();
      expect(parseHexColor("#123")).toBeNull();
    });
  });

  describe("parseDiscordMessageLink", () => {
    it("extracts IDs from standard discord message link", () => {
      const link = "https://discord.com/channels/123456789/987654321/1122334455";
      const parsed = parseDiscordMessageLink(link);
      expect(parsed).toEqual({
        guildId: "123456789",
        channelId: "987654321",
        messageId: "1122334455",
      });
    });

    it("returns null for non-message links", () => {
      expect(parseDiscordMessageLink("https://discord.com")).toBeNull();
      expect(parseDiscordMessageLink("")).toBeNull();
    });
  });

  describe("toDiscordPayload", () => {
    it("does not transmit legacy username or avatar_url sender overrides", () => {
      const msgData: MessageData = {
        content: "Hello from the configured bot!",
        username: "Legacy Name",
        avatar_url: "https://example.com/avatar.png",
        thread_name: "",
        embeds: [],
        components: [],
      };

      const payload = toDiscordPayload(msgData, "classic");
      expect(payload.content).toBe("Hello from the configured bot!");
      expect(payload.username).toBeUndefined();
      expect(payload.avatar_url).toBeUndefined();
    });


    it("sanitizes empty embeds and components", () => {
      const msgData: MessageData = {
        content: "Simple text",
        username: "",
        avatar_url: "",
        thread_name: "",
        embeds: [],
        components: [],
      };

      const payload = toDiscordPayload(msgData, "classic");
      expect(payload.content).toBe("Simple text");
      expect(payload.embeds).toBeUndefined();
      expect(payload.components).toBeUndefined();
      expect(isPayloadEmpty(payload)).toBe(false);
      expect(isPayloadEmpty({})).toBe(true);
    });
  });

  describe("embedCharCount & validateMessage", () => {
    it("calculates embed character count accurately", () => {
      const count = embedCharCount({
        title: "Title", // 5
        description: "Desc", // 4
        footer: { text: "Foot" }, // 4
        author: { name: "Auth" }, // 4
        fields: [{ name: "F1", value: "V1" }], // 2 + 2 = 4
      });
      expect(count).toBe(21);
    });

    it("flags validation errors for over-limit messages", () => {
      const longMessage: MessageData = {
        content: "x".repeat(2001),
        username: "",
        avatar_url: "",
        thread_name: "",
        embeds: [],
        components: [],
      };
      const errors = validateMessage(longMessage, "classic");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toMatch(/characters/i);
    });
  });
});
