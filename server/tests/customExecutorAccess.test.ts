import { describe, expect, it } from "vitest";
import { isCustomExecutorEnabled } from "../src/utils/customExecutorAccess.js";

describe("custom executor enablement", () => {
  it("allows only explicitly enabled executors", () => {
    expect(isCustomExecutorEnabled({ enabled: 1 })).toBe(true);
    expect(isCustomExecutorEnabled({ enabled: true })).toBe(true);
    expect(isCustomExecutorEnabled({ enabled: 0 })).toBe(false);
    expect(isCustomExecutorEnabled({ enabled: false })).toBe(false);
    expect(isCustomExecutorEnabled(undefined)).toBe(false);
  });
});
