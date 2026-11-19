import { describe, expect, it } from "vitest";
import { EDITOR_MODES } from "../constants";
import {
  fromQueryData,
  getEditorModeForDiscordMessage,
} from "../exportImport";

describe("exportImport editor mode preservation", () => {
  it("preserves an explicitly saved editor mode", () => {
    const document = fromQueryData({
      mode: EDITOR_MODES.V2,
      messages: [{ data: { content: "hello", flags: 0 } }],
    });

    expect(document.mode).toBe(EDITOR_MODES.V2);
  });

  it("preserves message flags so legacy templates can recover Components V2 mode", () => {
    const document = fromQueryData({
      messages: [{ data: { content: "hello", flags: 32768 } }],
    });

    expect(document.messages[0]?.flags).toBe(32768);
    expect(getEditorModeForDiscordMessage(document.messages[0])).toBe(EDITOR_MODES.V2);
  });
});
