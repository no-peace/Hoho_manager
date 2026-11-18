import { describe, expect, it } from "vitest";
import { canAccessTemplate } from "../src/utils/templateAccess.js";

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
