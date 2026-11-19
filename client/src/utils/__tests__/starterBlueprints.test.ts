import { describe, expect, it } from "vitest";
import { STARTER_BLUEPRINTS } from "../starterBlueprints";

describe("V2 starter blueprints", () => {
  it("provides five independent Components V2 message blueprints", () => {
    expect(STARTER_BLUEPRINTS).toHaveLength(5);
    for (const blueprint of STARTER_BLUEPRINTS) {
      const created = blueprint.create();
      expect(created.message.flags).toBe(32768);
      expect(Array.isArray(created.message.components)).toBe(true);
    }
  });

  it("registers a Then flow for the support modal", () => {
    const support = STARTER_BLUEPRINTS.find((blueprint) => blueprint.id === "support-launcher");
    const created = support?.create();
    expect(created?.flows).toHaveLength(1);
    expect(created?.flows[0]?.customId.startsWith("action:")).toBe(true);
    expect(created?.flows[0]?.steps[0]?.type).toBe("open_modal");
  });
});
