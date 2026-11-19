import { describe, it, expect, beforeEach } from "vitest";
import { toDiscordPayload } from "../discord";
import { fromQueryData, toQueryData } from "../exportImport";
import useMessageStore from "../../store/messageStore";
import { MessageFlags, ComponentType } from "@dmb/shared";
import type { MessageData } from "@dmb/shared";

describe("Bot message payload and sanitization", () => {
  it("builds a classic bot payload with thread metadata", () => {
    const message: MessageData = {
      content: "Bot message",
      thread_name: "Release notes",
      embeds: [],
      components: [],
    };

    const payload = toDiscordPayload(message, "classic");

    expect(payload.content).toBe("Bot message");
    expect(payload.thread_name).toBe("Release notes");
  });

  it("builds a Components V2 bot payload", () => {
    const message: MessageData = {
      content: "",
      thread_name: "",
      embeds: [],
      components: [],
    };

    const payload = toDiscordPayload(message, "v2");

    expect((payload.flags ?? 0) & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2);
  });

  it("strips internal keys (_id, _state) from embeds and components", () => {
    const message = {
      content: "Internal key stripping",
      thread_name: "",
      embeds: [
        {
          title: "Embed 1",
          _id: "internal-embed-123",
          fields: [{ name: "Field 1", value: "Value 1", _id: "internal-field-456" }],
        },
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
            },
          ],
        },
      ],
    } as unknown as MessageData;

    const payload = toDiscordPayload(message, "classic");

    expect(payload.embeds).toBeDefined();
    expect((payload.embeds?.[0] as Record<string, unknown>)._id).toBeUndefined();
    expect((payload.embeds?.[0]?.fields?.[0] as Record<string, unknown>)._id).toBeUndefined();
    expect(payload.components).toBeDefined();
    expect((payload.components?.[0] as Record<string, unknown>)._id).toBeUndefined();
  });
});

describe("Multi-message import, export, and store loading", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it("imports a multi-message Discohook backup", () => {
    const backup = {
      backups: [
        {
          name: "Backup 1",
          messages: [
            { data: { content: "First message in backup", embeds: [] } },
            { data: { content: "Second message in backup", embeds: [] } },
            { data: { content: "Third message in backup", embeds: [] } },
          ],
        },
      ],
    };

    useMessageStore.getState().load({ data: backup });

    const state = useMessageStore.getState();
    expect(state.messages).toHaveLength(3);
    expect(state.messages[0]?.content).toBe("First message in backup");
    expect(state.messages[1]?.content).toBe("Second message in backup");
    expect(state.messages[2]?.content).toBe("Third message in backup");
    expect(state.data.content).toBe("First message in backup");

    const parsed = fromQueryData(backup);
    expect(parsed.messages).toHaveLength(3);
  });

  it("imports Hoho QueryData with four messages", () => {
    const queryData = {
      version: "d2",
      messages: [
        { data: { content: "Message 1", embeds: [{ title: "E1" }] } },
        { data: { content: "Message 2", embeds: [{ title: "E2" }] } },
        { data: { content: "Message 3", embeds: [{ title: "E3" }] } },
        { data: { content: "Message 4", embeds: [{ title: "E4" }] } },
      ],
    };

    useMessageStore.getState().load({ data: queryData });

    const state = useMessageStore.getState();
    expect(state.messages).toHaveLength(4);
    expect(state.messages[0]?.content).toBe("Message 1");
    expect(state.messages[1]?.content).toBe("Message 2");
    expect(state.messages[2]?.content).toBe("Message 3");
    expect(state.messages[3]?.content).toBe("Message 4");
    expect(state.messages[3]?.embeds[0]?.title).toBe("E4");
  });

  it("supports an unwrapped direct load call", () => {
    const document = {
      messages: [{ content: "Direct Msg A" }, { content: "Direct Msg B" }],
    };

    useMessageStore.getState().load(document);

    const state = useMessageStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]?.content).toBe("Direct Msg A");
    expect(state.messages[1]?.content).toBe("Direct Msg B");
  });

  it("gracefully falls back on malformed or empty load payloads", () => {
    useMessageStore.getState().load(null);
    expect(useMessageStore.getState().messages).toHaveLength(1);
    expect(useMessageStore.getState().data.content).toBe("");

    useMessageStore.getState().load({});
    expect(useMessageStore.getState().messages).toHaveLength(1);

    useMessageStore.getState().load({ data: null });
    expect(useMessageStore.getState().messages).toHaveLength(1);
  });

  it("round-trips ten messages without losing content or embeds", () => {
    const originalMessages: MessageData[] = Array.from({ length: 10 }, (_, index) => ({
      content: `Batch Message #${index + 1}`,
      thread_name: `Thread_${index}`,
      embeds: [{ title: `Title ${index}`, description: `Desc ${index}` }],
      components: [],
    }));

    const exported = toQueryData(originalMessages, "classic");

    expect(exported.version).toBe("d2");
    expect(exported.messages).toHaveLength(10);

    const parsed = fromQueryData(exported);
    expect(parsed.messages).toHaveLength(10);
    for (let index = 0; index < 10; index += 1) {
      expect(parsed.messages[index]?.content).toBe(`Batch Message #${index + 1}`);
      expect(parsed.messages[index]?.embeds[0]?.title).toBe(`Title ${index}`);
    }
  });
});
