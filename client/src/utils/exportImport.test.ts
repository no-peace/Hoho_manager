import { describe, expect, it } from "vitest";
import { fromQueryData, getEditorModeForDiscordMessage, toQueryData } from "./exportImport";
import { EDITOR_MODES } from "./constants";
import { MessageFlags } from "@dmb/shared";

const message = {
  content: "Saved message",
  username: "",
  avatar_url: "",
  thread_name: "",
  embeds: [],
  components: [],
};

describe("template document import/export", () => {
  it("keeps the message in the standard export envelope", () => {
    const document = toQueryData(message);

    expect(fromQueryData(document)).toMatchObject(message);
  });

  it("loads message data from older nested template documents", () => {
    const document = {
      messages: [{ data: { data: message, targets: [{ url: "https://example.com" }] } }],
    };

    expect(fromQueryData(document)).toMatchObject(message);
  });

  it("falls back safely for valid JSON values that are not objects", () => {
    expect(fromQueryData(null)).toMatchObject({
      content: "",
      embeds: [],
      components: [],
    });
    expect(fromQueryData(42)).toMatchObject({ content: "", embeds: [], components: [] });
    expect(fromQueryData("invalid shape")).toMatchObject({
      content: "",
      embeds: [],
      components: [],
    });
    expect(fromQueryData({ messages: [{ data: null }] })).toMatchObject({
      content: "",
      embeds: [],
      components: [],
    });
    expect(
      fromQueryData({ backups: [{ messages: [{ data: null }] }] }),
    ).toMatchObject({ content: "", embeds: [], components: [] });
  });
});

describe("Discord message editor mode", () => {
  it("uses the V2 flag instead of treating classic action rows as Components V2", () => {
    expect(
      getEditorModeForDiscordMessage({ components: [{ type: 1, components: [{ type: 2 }] }] }),
    ).toBe(EDITOR_MODES.CLASSIC);
    expect(
      getEditorModeForDiscordMessage({
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 10, content: "V2" }],
      }),
    ).toBe(EDITOR_MODES.V2);
  });
});