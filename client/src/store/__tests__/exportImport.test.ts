import { describe, expect, it, beforeEach } from "vitest";
import { fromQueryData, toQueryData } from "../../utils/exportImport";
import { useMessageStore } from "../messageStore";
import { ComponentType, ButtonStyle } from "@dmb/shared";

describe("Export / Import & Store Parity (INV-5)", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it("parses Discohook backup file containing 3 messages in backups[0].messages without losing secondary messages (RB-02, RB-04)", () => {
    const discohookBackup = {
      backups: [
        {
          name: "Main Backup",
          messages: [
            { data: { content: "Message 1" } },
            { data: { content: "Message 2" } },
            { data: { content: "Message 3" } },
          ],
        },
      ],
    };

    const parsed = fromQueryData(discohookBackup);

    expect(parsed.messages).toHaveLength(3);
    expect(parsed.messages[0].content).toBe("Message 1");
    expect(parsed.messages[1].content).toBe("Message 2");
    expect(parsed.messages[2].content).toBe("Message 3");
    expect(parsed.content).toBe("Message 1"); // primary matches first message
  });

  it("parses standard QueryData with 5 messages retaining all 5 in messages array (RB-03, RB-05)", () => {
    const queryData = {
      version: "d2",
      messages: [
        { data: { content: "Msg A" } },
        { data: { content: "Msg B" } },
        { data: { content: "Msg C" } },
        { data: { content: "Msg D" } },
        { data: { content: "Msg E" } },
      ],
    };

    const parsed = fromQueryData(queryData);

    expect(parsed.messages).toHaveLength(5);
    expect(parsed.messages.map((m) => m.content)).toEqual([
      "Msg A",
      "Msg B",
      "Msg C",
      "Msg D",
      "Msg E",
    ]);
  });

  it("generates unique fresh _id values for all imported embeds, fields, and components", () => {
    const payload = {
      messages: [
        {
          data: {
            content: "Card with embeds",
            embeds: [
              {
                title: "Embed 1",
                fields: [{ name: "F1", value: "V1" }, { name: "F2", value: "V2" }],
              },
            ],
            components: [
              {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    label: "Action",
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const parsed = fromQueryData(payload);
    const msg = parsed.messages[0];

    expect(msg.embeds).toHaveLength(1);
    expect(msg.embeds![0]._id).toBeDefined();
    expect(msg.embeds![0].fields![0]._id).toBeDefined();
    expect(msg.embeds![0].fields![1]._id).toBeDefined();
    expect(msg.embeds![0].fields![0]._id).not.toBe(msg.embeds![0].fields![1]._id);

    expect(msg.components).toHaveLength(1);
    expect(msg.components![0]._id).toBeDefined();
    expect(msg.components![0].components![0]._id).toBeDefined();
  });

  it("serializes array of 4 messages into valid QueryData document via toQueryData", () => {
    const messages = [
      { content: "Part 1" },
      { content: "Part 2" },
      { content: "Part 3" },
      { content: "Part 4" },
    ];

    const result = toQueryData(messages as any);

    expect(result.version).toBe("d2");
    expect(result.messages).toHaveLength(4);
    expect((result.messages[0].data as any).content).toBe("Part 1");
    expect((result.messages[3].data as any).content).toBe("Part 4");
  });

  it("loads 3-message payload into messageStore: sets length=3, activeIndex=0, and points data to messages[0]", () => {
    const multiMessageDoc = {
      version: "d2",
      messages: [
        { data: { content: "First" } },
        { data: { content: "Second" } },
        { data: { content: "Third" } },
      ],
    };

    useMessageStore.getState().load(multiMessageDoc);

    const state = useMessageStore.getState();
    expect(state.messages).toHaveLength(3);
    expect(state.activeMessageIndex).toBe(0);
    expect(state.data.content).toBe("First");
    expect(state.messages[0].content).toBe("First");
    expect(state.messages[1].content).toBe("Second");
    expect(state.messages[2].content).toBe("Third");
  });

  it("duplicates selected message with deep cloned components and re-generated IDs via duplicateMessage()", () => {
    useMessageStore.getState().load({
      messages: [
        {
          data: {
            content: "Original Message",
            embeds: [{ title: "Emb", fields: [{ name: "Field1", value: "Val1" }] }],
            components: [
              {
                type: ComponentType.ActionRow,
                custom_id: "action:dud:1",
                components: [
                  {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    label: "Original Button",
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    expect(useMessageStore.getState().messages).toHaveLength(1);

    // Duplicate message at index 0
    useMessageStore.getState().duplicateMessage(0);

    const state = useMessageStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.activeMessageIndex).toBe(1);

    const original = state.messages[0];
    const duplicate = state.messages[1];

    expect(duplicate.content).toBe(original.content);
    // Deep clone check: embeds have different _ids
    expect(duplicate.embeds![0]._id).not.toBe(original.embeds![0]._id);
    expect(duplicate.components![0]._id).not.toBe(original.components![0]._id);
  });
});
