import { describe, it, expect, beforeEach } from "vitest";
import { toDiscordPayload } from "../discord";
import { fromQueryData, toQueryData } from "../exportImport";
import useMessageStore from "../../store/messageStore";
import { MessageFlags, ComponentType } from "@dmb/shared";
import type { MessageData } from "@dmb/shared";

describe("Milestone 2 Stress Tests: toDiscordPayload Overrides & Sanitization", () => {
  it("does not transmit legacy sender overrides in classic mode", () => {
    const msg: MessageData = {
      content: "Override check",
      username: "Legacy Name",
      avatar_url: "https://example.com/bot.png",
      thread_name: "Test Thread",
      embeds: [],
      components: [],
    };
    const payload = toDiscordPayload(msg, "classic");
    expect(payload.username).toBeUndefined();
    expect(payload.avatar_url).toBeUndefined();
    expect(payload.thread_name).toBe("Test Thread");
    expect(payload.content).toBe("Override check");
  });


  it("does not transmit legacy sender overrides in v2 mode", () => {
    const msg: MessageData = {
      content: "V2 Override",
      username: "V2Agent",
      avatar_url: "https://example.com/v2.png",
      thread_name: "",
      embeds: [],
      components: [],
    };
    const payload = toDiscordPayload(msg, "v2");
    expect(payload.username).toBeUndefined();
    expect(payload.avatar_url).toBeUndefined();
    expect((payload.flags ?? 0) & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2);
  });

  it("trims and sanitizes whitespace-only profile overrides", () => {
    const msg: MessageData = {
      content: "Whitespace test",
      username: "   ",
      avatar_url: " \t\n ",
      thread_name: "",
      embeds: [],
      components: [],
    };
    const payload = toDiscordPayload(msg, "classic");
    expect(payload.username).toBeUndefined();
    expect(payload.avatar_url).toBeUndefined();
    expect(payload.content).toBe("Whitespace test");
  });

  it("handles null / undefined / empty string profile overrides safely", () => {
    const msg = {
      content: "Null/empty test",
      username: "",
      avatar_url: undefined,
      thread_name: "",
      embeds: [],
      components: [],
    } as unknown as MessageData;
    const payload = toDiscordPayload(msg, "classic");
    expect(payload.username).toBeUndefined();
    expect(payload.avatar_url).toBeUndefined();
    expect(payload.content).toBe("Null/empty test");
  });

  it("preserves Unicode message content but omits legacy sender overrides", () => {
    const msg: MessageData = {
      content: "Unicode test ðŸ¤– æ¸¬è©¦ ðŸš€",
      username: "ðŸ¤– Bot / æ¸¬è©¦ / ðŸš€",
      avatar_url: "https://example.com/ðŸš€.png",
      thread_name: "",
      embeds: [],
      components: [],
    };
    const payload = toDiscordPayload(msg, "classic");
    expect(payload.content).toBe("Unicode test ðŸ¤– æ¸¬è©¦ ðŸš€");
    expect(payload.username).toBeUndefined();
    expect(payload.avatar_url).toBeUndefined();
  });

  it("strips internal keys (_id, _state) from embeds and components", () => {
    const msg: MessageData = {
      content: "Internal key stripping",
      username: "StripperBot",
      avatar_url: "https://example.com/bot.png",
      thread_name: "",
      embeds: [
        {
          title: "Embed 1",
          _id: "internal-embed-123",
          fields: [
            { name: "Field 1", value: "Value 1", _id: "internal-field-456" } as any,
          ],
        } as any,
      ],
      components: [
        {
          type: ComponentType.ActionRow,
          _id: "internal-row-789",
          components: [
            {
              type: ComponentType.Button,
              style: 1,
              label: "Click",
              custom_id: "btn_1",
              _id: "internal-btn-012",
            } as any,
          ],
        } as any,
      ],
    };
    const payload = toDiscordPayload(msg, "classic");
    expect(payload.embeds).toBeDefined();
    expect((payload.embeds![0] as any)._id).toBeUndefined();
    expect((payload.embeds![0].fields![0] as any)._id).toBeUndefined();
    expect(payload.components).toBeDefined();
    expect((payload.components![0] as any)._id).toBeUndefined();
  });
});

describe("Milestone 2 Stress Tests: Multi-Message Import & Export / Store Load", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it("imports multi-message Discohook backup without wiping canvas", () => {
    const discohookBackup = {
      backups: [
        {
          name: "Backup 1",
          messages: [
            { data: { content: "First message in backup", embeds: [] } },
            { data: { content: "Second message in backup", embeds: [] } },
            { data: { content: "Third message in backup", embeds: [] } },
          ],
          targets: [{ url: "https://discord.com/api/webhooks/123/backup" }],
        },
      ],
    };

    // Load via App.tsx pattern: load({ data: document, targets: document?.targets, mode: document?.mode })
    const document: any = discohookBackup;
    useMessageStore.getState().load({
      data: document,
      targets: document?.targets,
      mode: document?.mode,
    });

    const state = useMessageStore.getState();
    expect(state.messages.length).toBe(3);
    expect(state.messages[0]?.content).toBe("First message in backup");
    expect(state.messages[1]?.content).toBe("Second message in backup");
    expect(state.messages[2]?.content).toBe("Third message in backup");
    expect(state.data.content).toBe("First message in backup");

    // fromQueryData correctly parses backup[0].targets from official Discohook backups
    const parsed = fromQueryData(discohookBackup);
    expect(parsed.messages.length).toBe(3);
    expect(parsed.targets?.[0]?.url).toBe("https://discord.com/api/webhooks/123/backup");
  });

  it("imports Hoho QueryData format (version: d2) with 4 messages and preserves all", () => {
    const queryData = {
      version: "d2",
      messages: [
        { data: { content: "Message 1", embeds: [{ title: "E1" }] } },
        { data: { content: "Message 2", embeds: [{ title: "E2" }] } },
        { data: { content: "Message 3", embeds: [{ title: "E3" }] } },
        { data: { content: "Message 4", embeds: [{ title: "E4" }] } },
      ],
      targets: [{ url: "https://discord.com/api/webhooks/hoho/1" }],
    };

    useMessageStore.getState().load({
      data: queryData,
      targets: queryData?.targets,
      mode: undefined,
    });

    const state = useMessageStore.getState();
    expect(state.messages.length).toBe(4);
    expect(state.messages[0]?.content).toBe("Message 1");
    expect(state.messages[1]?.content).toBe("Message 2");
    expect(state.messages[2]?.content).toBe("Message 3");
    expect(state.messages[3]?.content).toBe("Message 4");
    expect(state.messages[3]?.embeds[0]?.title).toBe("E4");
  });

  it("handles unwrapped load call: load(document) directly", () => {
    const directDoc = {
      messages: [
        { content: "Direct Msg A" },
        { content: "Direct Msg B" },
      ],
      targets: [{ url: "https://discord.com/api/webhooks/direct" }],
    };

    useMessageStore.getState().load(directDoc);

    const state = useMessageStore.getState();
    expect(state.messages.length).toBe(2);
    expect(state.messages[0]?.content).toBe("Direct Msg A");
    expect(state.messages[1]?.content).toBe("Direct Msg B");
  });

  it("gracefully falls back on malformed or empty load payloads", () => {
    useMessageStore.getState().load(null);
    expect(useMessageStore.getState().messages.length).toBe(1);
    expect(useMessageStore.getState().data.content).toBe("");

    useMessageStore.getState().load({});
    expect(useMessageStore.getState().messages.length).toBe(1);

    useMessageStore.getState().load({ data: null });
    expect(useMessageStore.getState().messages.length).toBe(1);
  });

  it("fromQueryData roundtrip preserves all 10 multi-messages and targets", () => {
    const originalMessages: MessageData[] = Array.from({ length: 10 }, (_, i) => ({
      content: `Batch Message #${i + 1}`,
      username: `BotUser_${i}`,
      avatar_url: `https://example.com/avatar_${i}.png`,
      thread_name: `Thread_${i}`,
      embeds: [{ title: `Title ${i}`, description: `Desc ${i}` }],
      components: [],
    }));

    const targets = [{ url: "https://discord.com/api/webhooks/multi/1" }];
    const exported = toQueryData(originalMessages, targets, "classic");

    expect(exported.version).toBe("d2");
    expect(exported.messages.length).toBe(10);

    const parsed = fromQueryData(exported);
    expect(parsed.messages.length).toBe(10);
    expect(parsed.targets?.[0]?.url).toBe("https://discord.com/api/webhooks/multi/1");
    for (let i = 0; i < 10; i++) {
      expect(parsed.messages[i]?.content).toBe(`Batch Message #${i + 1}`);
      expect(parsed.messages[i]?.username).toBe(`BotUser_${i}`);
      expect(parsed.messages[i]?.embeds[0]?.title).toBe(`Title ${i}`);
    }
  });
});
