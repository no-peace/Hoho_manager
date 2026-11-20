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


    it("omits empty explicit ID arrays when broad parser types are selected", () => {
      const message: MessageData = {
        content: "@everyone notice",
        username: "",
        avatar_url: "",
        thread_name: "",
        embeds: [],
        components: [],
        allowed_mentions: {
          parse: ["everyone", "roles"],
          users: [],
          roles: [],
        },
      };

      expect(toDiscordPayload(message, "classic").allowed_mentions).toEqual({
        parse: ["everyone", "roles"],
      });
    });

    it("uses explicit mention IDs instead of conflicting parser types", () => {
      const message: MessageData = {
        content: "<@123456789012345678> <@&223456789012345678>",
        username: "",
        avatar_url: "",
        thread_name: "",
        embeds: [],
        components: [],
        allowed_mentions: {
          parse: ["everyone", "roles"],
          users: ["123456789012345678"],
          roles: ["223456789012345678"],
        },
      };

      expect(toDiscordPayload(message, "classic").allowed_mentions).toEqual({
        users: ["123456789012345678"],
        roles: ["223456789012345678"],
      });
    });

    it("keeps forum thread creation separate from an existing thread destination", () => {
      const existingThreadMessage = {
        content: "Send into an existing thread",
        username: "",
        avatar_url: "",
        thread_name: "Do not create another thread",
        thread_id: "123456789012345678",
        embeds: [],
        components: [],
      } as MessageData & { thread_id: string };

      const payload = toDiscordPayload(existingThreadMessage, "classic");
      expect(payload.thread_name).toBeUndefined();
      expect(payload).not.toHaveProperty("thread_id");
    });

    it("preserves forum thread names when no existing thread ID is set", () => {
      const forumMessage: MessageData = {
        content: "Create a forum post",
        username: "",
        avatar_url: "",
        thread_name: "New forum post",
        embeds: [],
        components: [],
      };

      expect(toDiscordPayload(forumMessage, "classic").thread_name).toBe("New forum post");
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

  describe("native Discord polls", () => {
    const poll = {
      question: { text: "What should we build?" },
      answers: [
        { poll_media: { text: "Poll editor", emoji: { name: "📊" } } },
        { poll_media: { text: "Scheduler" } },
      ],
      duration: 24,
      allow_multiselect: false,
      layout_type: 1 as const,
    };

    it("serializes polls in Classic mode and treats them as non-empty", () => {
      const message: MessageData = {
        content: "", username: "", avatar_url: "", thread_name: "",
        embeds: [], components: [], poll,
      };
      const payload = toDiscordPayload(message, "classic");
      expect(payload.poll).toEqual(poll);
      expect(isPayloadEmpty(payload)).toBe(false);
    });

    it("validates poll answer counts and duration bounds", () => {
      const invalid: MessageData = {
        content: "", username: "", avatar_url: "", thread_name: "",
        embeds: [], components: [],
        poll: {
          ...poll,
          answers: [],
          duration: 169,
        },
      };
      const errors = validateMessage(invalid, "classic");
      expect(errors.some((error) => error.includes("between 1 and 10 answers"))).toBe(true);
      expect(errors.some((error) => error.includes("1 and 168 hours"))).toBe(true);
    });

    it("omits polls from Components V2 payloads", () => {
      const message: MessageData = {
        content: "", username: "", avatar_url: "", thread_name: "",
        embeds: [], components: [], poll,
      };
      expect(toDiscordPayload(message, "v2").poll).toBeUndefined();
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
