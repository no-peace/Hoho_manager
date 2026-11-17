import { describe, expect, it } from "vitest";
import { isProductionLikeEnvironment } from "../src/config/env.js";

describe("deployment environment security mode", () => {
  it("keeps local development and automated tests non-production", () => {
    expect(isProductionLikeEnvironment("development")).toBe(false);
    expect(isProductionLikeEnvironment("test")).toBe(false);
  });

  it("applies production security defaults to every other deployment mode", () => {
    for (const mode of ["production", "staging", "preview", "qa", "ci"]) {
      expect(isProductionLikeEnvironment(mode)).toBe(true);
    }
  });
});
