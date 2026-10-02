import { describe, expect, it } from "vitest";
import { ApiError } from "../utils/errors.js";
import { validateBotProfileIdentity } from "./profileService.js";

describe("validateBotProfileIdentity", () => {
  it("accepts a matching Discord application ID and 32-byte public key", () => {
    expect(() =>
      validateBotProfileIdentity("123456789012345678", "123456789012345678", "a".repeat(64)),
    ).not.toThrow();
  });

  it("rejects application IDs that do not match the bot token identity", () => {
    expect(() =>
      validateBotProfileIdentity("123456789012345678", "223456789012345678", "a".repeat(64)),
    ).toThrow(ApiError);
  });

  it("rejects malformed application IDs and public keys", () => {
    expect(() => validateBotProfileIdentity("not-a-snowflake", "not-a-snowflake", "a".repeat(64))).toThrow(
      ApiError,
    );
    expect(() =>
      validateBotProfileIdentity("123456789012345678", "123456789012345678", "not-a-key"),
    ).toThrow(ApiError);
  });
});