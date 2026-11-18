import { describe, expect, it } from "vitest";
import { ACTION_PREFIX, ACTION_SEPARATOR, ComponentType, MessageFlags } from "@dmb/shared";
import {
  isHttpUrl,
  isSnowflake,
  parseStoredActionDefinitions,
  parseWebhookUrl,
  requireId,
  validateMessagePayload,
} from "../src/utils/validation.js";

describe("validation utils", () => {
  describe("isSnowflake", () => {
    it("accepts valid Discord snowflake IDs", () => {
      expect(isSnowflake("12345678901234567")).toBe(true);
      expect(isSnowflake("1234567890123456789")).toBe(true);
    });

    it("rejects non-numeric or invalid snowflakes", () => {
      expect(isSnowflake("abc")).toBe(false);
      expect(isSnowflake("12345")).toBe(false);
      expect(isSnowflake(null)).toBe(false);
      expect(isSnowflake(undefined)).toBe(false);
      expect(isSnowflake(123456789012345678)).toBe(false);
    });
  });

  describe("isHttpUrl", () => {
    it("validates http and https URLs", () => {
      expect(isHttpUrl("https://discord.com")).toBe(true);
      expect(isHttpUrl("http://localhost:3000")).toBe(true);
      expect(isHttpUrl("ftp://discord.com")).toBe(false);
      expect(isHttpUrl("javascript:alert(1)")).toBe(false);
      expect(isHttpUrl("not a url")).toBe(false);
    });
  });

  describe("requireId", () => {
    it("accepts positive safe integer IDs", () => {
      expect(requireId("42")).toBe(42);
      expect(requireId(42)).toBe(42);
    });

    it.each(["42junk", "1.5", "-1", "0", "9007199254740992", "", " 42 "])(
      "rejects malformed or unsafe IDs: %s",
      (value) => {
        expect(() => requireId(value)).toThrow(/positive integer/i);
      },
    );
  });

  describe("parseStoredActionDefinitions", () => {
    const customId = `${ACTION_PREFIX}${ACTION_SEPARATOR}template-action`;

    it("normalizes valid steps and assigns per-flow execution order", () => {
      expect(parseStoredActionDefinitions([
        { customId, actionType: "send_message", config: { channelId: "123" } },
        { customId, actionType: "wait", config: { milliseconds: 10 } },
      ])).toEqual([
        { customId, actionType: "send_message", config: { channelId: "123" }, executionOrder: 0 },
        { customId, actionType: "wait", config: { milliseconds: 10 }, executionOrder: 1 },
      ]);
    });

    it("rejects non-array action collections and malformed entries", () => {
      expect(() => parseStoredActionDefinitions({})).toThrow(/must be an array/i);
      expect(() => parseStoredActionDefinitions([null])).toThrow(/must be an object/i);
      expect(() => parseStoredActionDefinitions([{ customId: "bad", actionType: "wait" }])).toThrow(/customId is invalid/i);
      expect(() => parseStoredActionDefinitions([{ customId, actionType: "wait", config: [] }])).toThrow(/config must be an object/i);
    });

    it("limits the number of flows and steps per flow", () => {
      const flows = Array.from({ length: 26 }, (_, index) => ({
        customId: `${ACTION_PREFIX}${ACTION_SEPARATOR}flow-${index}`,
        actionType: "wait",
      }));
      expect(() => parseStoredActionDefinitions(flows)).toThrow(/25 action flows/i);

      const steps = Array.from({ length: 21 }, () => ({ customId, actionType: "wait" }));
      expect(() => parseStoredActionDefinitions(steps)).toThrow(/20 steps/i);
    });

    it("limits aggregate action configuration size and execution order", () => {
      expect(() => parseStoredActionDefinitions([
        { customId, actionType: "wait", config: { value: "x".repeat(128 * 1024 + 1) } },
      ])).toThrow(/128 KiB/i);
      expect(() => parseStoredActionDefinitions([
        { customId, actionType: "wait", executionOrder: 20 },
      ])).toThrow(/integer from 0 to 19/i);
    });
  });

  describe("parseWebhookUrl", () => {
    it("extracts ID and token from valid Discord webhook URLs", () => {
      const parsed = parseWebhookUrl(
        "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_123456789",
      );
      expect(parsed).toEqual({
        id: "123456789012345678",
        token: "abcdefghijklmnopqrstuvwxyz_123456789",
      });
    });

    it("accepts discordapp.com domain", () => {
      const parsed = parseWebhookUrl(
        "https://discordapp.com/api/webhooks/123456789012345678/token123",
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.id).toBe("123456789012345678");
    });

    it("returns null for non-webhook URLs", () => {
      expect(parseWebhookUrl("https://example.com")).toBeNull();
      expect(parseWebhookUrl("")).toBeNull();
      expect(parseWebhookUrl(null)).toBeNull();
    });
  });

  describe("validateMessagePayload", () => {
    it("passes a valid message payload", () => {
      expect(() =>
        validateMessagePayload({
          content: "Hello world",
          embeds: [
            {
              title: "Test Embed",
              description: "Test Description",
            },
          ],
        }),
      ).not.toThrow();
    });

    it("rejects non-object payloads", () => {
      expect(() => validateMessagePayload("invalid")).toThrow(/must be a message object/i);
      expect(() => validateMessagePayload(null)).toThrow(/must be a message object/i);
    });

    it("rejects malformed component entries instead of silently skipping them", () => {
      try {
        validateMessagePayload({
          flags: MessageFlags.IsComponentsV2,
          components: [null],
        });
        expect.unreachable("Should have thrown");
      } catch (err: any) {
        expect(err.message).toBe("Message payload failed validation");
        expect(err.details).toEqual(
          expect.arrayContaining([expect.stringMatching(/must be a component object/i)]),
        );
      }
    });

    it("rejects component trees deeper than the supported validation limit", () => {
      let node: Record<string, unknown> = {
        type: ComponentType.TextDisplay,
        content: "Nested text",
      };
      for (let depth = 0; depth < 26; depth += 1) {
        node = { type: ComponentType.Container, components: [node] };
      }

      try {
        validateMessagePayload({
          flags: MessageFlags.IsComponentsV2,
          components: [node],
        });
        expect.unreachable("Should have thrown");
      } catch (err: any) {
        expect(err.message).toBe("Message payload failed validation");
        expect(err.details).toEqual(
          expect.arrayContaining([expect.stringMatching(/nesting depth exceeds 25 levels/i)]),
        );
      }
    });

    it("rejects content exceeding 2000 characters", () => {
      const longContent = "a".repeat(2001);
      try {
        validateMessagePayload({ content: longContent });
        expect.unreachable("Should have thrown");
      } catch (err: any) {
        expect(err.message).toBe("Message payload failed validation");
        expect(err.details).toEqual(
          expect.arrayContaining([expect.stringMatching(/2000 characters/i)]),
        );
      }
    });

    it("rejects payloads with more than 10 embeds", () => {
      const embeds = Array.from({ length: 11 }, (_, i) => ({ title: `Embed ${i}` }));
      try {
        validateMessagePayload({ embeds });
        expect.unreachable("Should have thrown");
      } catch (err: any) {
        expect(err.message).toBe("Message payload failed validation");
        expect(err.details).toEqual(
          expect.arrayContaining([expect.stringMatching(/at most 10 embeds/i)]),
        );
      }
    });
  });
});
