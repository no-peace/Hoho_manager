import { describe, expect, it } from "vitest";
import type { DiscordInteraction } from "@dmb/shared";
import { extractVariablesFromInteraction } from "../src/services/actionExecutor.js";

describe("modal submission variable extraction", () => {
  it("reads values nested under Discord Label components", () => {
    const interaction = {
      type: 5,
      id: "interaction",
      application_id: "application",
      token: "token",
      data: {
        components: [
          { type: 18, component: { type: 4, custom_id: "reason", value: "Need support" } },
          { type: 18, component: { type: 23, custom_id: "consent", value: true } },
        ],
      },
    } as unknown as DiscordInteraction;

    const variables = extractVariablesFromInteraction(interaction);
    expect(variables["modal.reason"]).toBe("Need support");
    expect(variables["input.reason"]).toBe("Need support");
    expect(variables["modal.consent"]).toBe("true");
  });

  it("resolves File Upload IDs to attachment URLs and joins multi-select values", () => {
    const interaction = {
      type: 5,
      id: "interaction",
      application_id: "application",
      token: "token",
      data: {
        resolved: { attachments: { upload1: { url: "https://cdn.discordapp.com/files/example.png" } } },
        components: [
          { type: 18, component: { type: 19, custom_id: "uploads", values: ["upload1"] } },
          { type: 18, component: { type: 22, custom_id: "choices", values: ["one", "two"] } },
        ],
      },
    } as unknown as DiscordInteraction;

    const variables = extractVariablesFromInteraction(interaction);
    expect(variables["modal.uploads"]).toBe("https://cdn.discordapp.com/files/example.png");
    expect(variables["modal.choices"]).toBe("one, two");
  });
});
