import { describe, expect, it } from "vitest";
import { buildCustomId, describeCustomId, parseCustomId } from "../src/customId.js";
import { Limits } from "../src/constants.js";

describe("shared/customId: Wire Codec & Enforcement Suite", () => {
  describe("buildCustomId()", () => {
    it("builds a bare custom ID when params are omitted", () => {
      expect(buildCustomId("dud")).toBe("action:dud");
    });

    it("builds a bare custom ID when params are null or undefined", () => {
      expect(buildCustomId("ping", null)).toBe("action:ping");
      expect(buildCustomId("ping", undefined)).toBe("action:ping");
    });

    it("builds a bare custom ID when params is an empty object", () => {
      expect(buildCustomId("status", {})).toBe("action:status");
    });

    it("encodes valid JSON parameters when provided", () => {
      const result = buildCustomId("add_role", { roleId: "123456789012345678" });
      expect(result).toBe('action:add_role:{"roleId":"123456789012345678"}');
    });

    it("encodes multiple parameters including primitives and nested values", () => {
      const params = { page: 2, active: true, tag: "admin" };
      const result = buildCustomId("paginate", params);
      expect(result).toBe('action:paginate:{"page":2,"active":true,"tag":"admin"}');
    });

    it("encodes parameters with special characters, colons, and unicode", () => {
      const params = { url: "https://example.com:8080/path", label: "🔥 Fire" };
      const result = buildCustomId("notify", params);
      expect(result).toContain('"url":"https://example.com:8080/path"');
      expect(result).toContain('"label":"🔥 Fire"');
    });

    it("succeeds when total custom ID length is exactly 100 characters", () => {
      // Prefix 'action:test:' is 12 chars.
      // Need JSON payload of exactly 88 chars -> total 100 chars.
      // {"pad":"..."} -> 10 chars fixed overhead ('{"pad":""}'). Value needs 78 chars.
      const padding = "a".repeat(78);
      const customId = buildCustomId("test", { pad: padding });
      expect(customId.length).toBe(100);
      expect(customId.length).toBe(Limits.components.customId);
    });

    it("throws an error when custom ID exceeds 100 characters", () => {
      const padding = "a".repeat(79); // 101 chars total
      expect(() => buildCustomId("test", { pad: padding })).toThrowError(
        /custom_id is 101 chars, over Discord's 100 limit/,
      );
    });

    it("includes developer remediation guidance in overflow error message", () => {
      const padding = "x".repeat(120);
      expect(() => buildCustomId("overflow", { p: padding })).toThrowError(
        "Store large payloads server-side and reference them by id.",
      );
    });
  });

  describe("parseCustomId()", () => {
    it("returns null for non-string inputs", () => {
      expect(parseCustomId(null)).toBeNull();
      expect(parseCustomId(undefined)).toBeNull();
      expect(parseCustomId(12345)).toBeNull();
      expect(parseCustomId(true)).toBeNull();
      expect(parseCustomId({})).toBeNull();
      expect(parseCustomId([])).toBeNull();
      expect(parseCustomId(() => {})).toBeNull();
    });

    it("returns null for strings without the 'action:' prefix", () => {
      expect(parseCustomId("")).toBeNull();
      expect(parseCustomId("button_1")).toBeNull();
      expect(parseCustomId("custom:foo:bar")).toBeNull();
      expect(parseCustomId("action")).toBeNull();
      expect(parseCustomId(" action:dud")).toBeNull();
      expect(parseCustomId("ACTION:dud")).toBeNull();
    });

    it("returns null for bare prefix or empty action type", () => {
      expect(parseCustomId("action:")).toBeNull();
      expect(parseCustomId("action::payload")).toBeNull();
    });

    it("parses bare action with no parameters", () => {
      const parsed = parseCustomId("action:dud");
      expect(parsed).toEqual({ type: "dud", params: {} });
    });

    it("parses action with trailing colon and empty parameters", () => {
      const parsed = parseCustomId("action:dud:");
      expect(parsed).toEqual({ type: "dud", params: {} });
    });

    it("parses action with valid JSON parameters", () => {
      const parsed = parseCustomId('action:add_role:{"roleId":"999"}');
      expect(parsed).toEqual({
        type: "add_role",
        params: { roleId: "999" },
      });
    });

    it("preserves colons inside the JSON parameter string", () => {
      const raw = 'action:send_message:{"channelId":"123456789012345678"}';
      const parsed = parseCustomId(raw);
      expect(parsed).toEqual({
        type: "send_message",
        params: { channelId: "123456789012345678" },
      });
    });

    it("sanitizes non-object JSON payloads to empty params object", () => {
      expect(parseCustomId("action:foo:123")).toEqual({ type: "foo", params: {} });
      expect(parseCustomId('action:foo:"hello"')).toEqual({ type: "foo", params: {} });
      expect(parseCustomId("action:foo:true")).toEqual({ type: "foo", params: {} });
      expect(parseCustomId("action:foo:null")).toEqual({ type: "foo", params: {} });
      expect(parseCustomId("action:foo:[1,2,3]")).toEqual({ type: "foo", params: {} });
    });

    it("returns null on malformed JSON payload without throwing", () => {
      expect(parseCustomId("action:broken:{not-json")).toBeNull();
      expect(parseCustomId("action:broken:undefined")).toBeNull();
      expect(parseCustomId("action:broken:NaN")).toBeNull();
      expect(parseCustomId('action:broken:{"unclosed"')).toBeNull();
    });
  });

  describe("Round-Trip Serialization Fidelity", () => {
    it("round-trips bare actions cleanly", () => {
      const id = buildCustomId("dud");
      const parsed = parseCustomId(id);
      expect(parsed).toEqual({ type: "dud", params: {} });
    });

    it("round-trips parameterized actions cleanly", () => {
      const originalParams = { roleId: "12345", silent: true };
      const id = buildCustomId("toggle_role", originalParams);
      const parsed = parseCustomId(id);
      expect(parsed).toEqual({ type: "toggle_role", params: originalParams });
    });
  });

  describe("describeCustomId()", () => {
    it("returns 'No action' for invalid or foreign custom IDs", () => {
      expect(describeCustomId(null)).toBe("No action");
      expect(describeCustomId("")).toBe("No action");
      expect(describeCustomId("external_button")).toBe("No action");
      expect(describeCustomId("action:")).toBe("No action");
    });

    it("formats single-word action type into Title Case", () => {
      expect(describeCustomId("action:dud")).toBe("Dud");
      expect(describeCustomId("action:ping")).toBe("Ping");
    });

    it("formats snake_case action types into spaced Title Case words", () => {
      expect(describeCustomId("action:add_role")).toBe("Add role");
      expect(describeCustomId('action:remove_role:{"roleId":"1"}')).toBe("Remove role");
      expect(describeCustomId("action:send_ephemeral_reply")).toBe("Send ephemeral reply");
      expect(describeCustomId("action:set_variable")).toBe("Set variable");
    });
  });
});
