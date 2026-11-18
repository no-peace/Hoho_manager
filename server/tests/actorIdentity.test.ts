import { describe, expect, it } from "vitest";
import { ApiError } from "../src/utils/errors.js";
import {
  assertNoAuthorUserIdOverride,
  resolveAuthenticatedActorDiscordId,
} from "../src/utils/actorIdentity.js";

describe("authenticated actor identity", () => {
  it("prefers the verified staff context ID", () => {
    expect(resolveAuthenticatedActorDiscordId("123456789012345678", "223456789012345678"))
      .toBe("123456789012345678");
  });

  it("uses a verified session Discord ID when no staff ID is present", () => {
    expect(resolveAuthenticatedActorDiscordId(null, "223456789012345678"))
      .toBe("223456789012345678");
  });

  it("does not invent an actor for machine admin-key requests", () => {
    expect(resolveAuthenticatedActorDiscordId(null, undefined)).toBe("");
  });

  it("rejects caller-supplied author identity overrides", () => {
    expect(() => assertNoAuthorUserIdOverride("123456789012345678"))
      .toThrow(ApiError);
    expect(() => assertNoAuthorUserIdOverride(null)).not.toThrow();
    expect(() => assertNoAuthorUserIdOverride(undefined)).not.toThrow();
  });
});
