import { describe, expect, it } from "vitest";
import { extractVariablesFromInteraction } from "../src/services/actionExecutor.js";

describe("2026 Discord modal submission extraction", () => {
  it("maps legacy TextInput and Label-wrapped modal values into modal variables", () => {
    const interaction = {
      user: { id: "123456789012345678", username: "ModalTester" },
      type: 5,
      data: {
        resolved: {
          attachments: {
            "attachment-1": { url: "https://cdn.discordapp.com/attachments/file.png" },
          },
        },
        components: [
          { type: 1, components: [{ type: 4, custom_id: "legacy", value: "Legacy answer" }] },
          { type: 18, component: { type: 19, custom_id: "files", values: ["attachment-1"] } },
          { type: 18, component: { type: 21, custom_id: "radio", value: "option-a" } },
          { type: 18, component: { type: 22, custom_id: "checks", values: ["alpha", "beta"] } },
          { type: 18, component: { type: 3, custom_id: "select", values: ["one", "two"] } },
          { type: 18, component: { type: 23, custom_id: "confirmed", checked: true } },
        ],
      },
    } as any;

    const variables = extractVariablesFromInteraction(interaction);
    expect(variables["modal.legacy"]).toBe("Legacy answer");
    expect(variables["modal.files"]).toBe("https://cdn.discordapp.com/attachments/file.png");
    expect(variables["modal.radio"]).toBe("option-a");
    expect(variables["modal.checks"]).toBe("alpha, beta");
    expect(variables["modal.select"]).toBe("one, two");
    expect(variables["modal.confirmed"]).toBe("true");
    expect(variables["input.legacy"]).toBe("Legacy answer");
  });
});
