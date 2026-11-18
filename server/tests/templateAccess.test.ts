import { describe, expect, it } from "vitest";
import { canAccessTemplate, canUseTrackedTemplate } from "../src/utils/templateAccess.js";

const privateTemplate = { user_id: 42, is_public: 0 };
const publicTemplate = { user_id: 42, is_public: 1 };

describe("template access checks", () => {
  it("allows the owner to use a private template", () => {
    expect(canAccessTemplate(privateTemplate, 42, false)).toBe(true);
  });

  it("allows public templates for other authenticated users", () => {
    expect(canAccessTemplate(publicTemplate, 99, false)).toBe(true);
  });

  it("allows Head Admin access to any template", () => {
    expect(canAccessTemplate(privateTemplate, 99, true)).toBe(true);
  });

  it("denies another user access to a private template", () => {
    expect(canAccessTemplate(privateTemplate, 99, false)).toBe(false);
    expect(canAccessTemplate(privateTemplate, undefined, false)).toBe(false);
  });
});

describe("tracked template access", () => {
  it("allows public templates without a stored verification flag", () => {
    expect(canUseTrackedTemplate(publicTemplate, 0)).toBe(true);
  });

  it("allows private templates only after server-side access verification", () => {
    expect(canUseTrackedTemplate(privateTemplate, 0)).toBe(false);
    expect(canUseTrackedTemplate(privateTemplate, 1)).toBe(true);
  });
});
