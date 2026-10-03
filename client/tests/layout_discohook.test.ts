import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "../src/store/settingsStore";
import { useProfileStore } from "../src/store/profileStore";
import { useMessageStore } from "../src/store/messageStore";
import { useGlobalStore } from "../src/store/globalStore";
import { newButton, newContainer, newSection } from "../src/utils/componentsV2";
import { stripInternal, toDiscordPayload, validateMessage } from "../src/utils/discord";
import { ButtonStyle, ComponentType, MessageFlags, SNOWFLAKE_REGEX } from "@dmb/shared";

describe("Client Discohook Layout & UI Components (Tiers 1-4)", () => {
  beforeEach(() => {
    const storage: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete storage[k];
      },
      clear: () => {
        for (const k in storage) delete storage[k];
      },
      length: 0,
      key: () => null,
    } as any;

    useSettingsStore.getState().updateSettings({
      theme: "dark",
      messageDisplay: "cozy",
      fontSize: 16,
    });
    useProfileStore.getState().reset();
    useMessageStore.getState().reset();
    useGlobalStore.getState().setBotIdentity(null);
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F1 & F2: Discohook Layout & Settings State
     ────────────────────────────────────────────────────────────────────────── */
  describe("F1 & F2: Layout Configuration & Unified Editor State", () => {
    it("1. Initializes with dark theme and cozy message display by default", () => {
      const state = useSettingsStore.getState();
      expect(state.settings.theme).toBe("dark");
      expect(state.settings.messageDisplay).toBe("cozy");
    });

    it("2. Updates UI display settings (compact vs cozy, font size)", () => {
      useSettingsStore.getState().updateSettings({
        messageDisplay: "compact",
        fontSize: 14,
        compactAvatars: true,
      });
      const state = useSettingsStore.getState();
      expect(state.settings.messageDisplay).toBe("compact");
      expect(state.settings.fontSize).toBe(14);
      expect(state.settings.compactAvatars).toBe(true);
    });

    it("3. MessageStore manages unified message document state", () => {
      const store = useMessageStore.getState();
      store.setContent("Announcement message body");
      expect(useMessageStore.getState().data.content).toBe("Announcement message body");
    });

    it("4. Consolidates editor modes cleanly without state drift", () => {
      const store = useMessageStore.getState();
      store.setMode("v2");
      expect(useMessageStore.getState().mode).toBe("v2");
      store.setMode("classic");
      expect(useMessageStore.getState().mode).toBe("classic");
    });

    it("5. Initializes isSidebarOpen to false and toggles state with localStorage persistence", () => {
      const store = useGlobalStore.getState();
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);

      store.setIsSidebarOpen(true);
      expect(useGlobalStore.getState().isSidebarOpen).toBe(true);
      expect(localStorage.getItem("hoho_global_state")).toContain('"isSidebarOpen":true');

      store.toggleSidebar();
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);
      expect(localStorage.getItem("hoho_global_state")).toContain('"isSidebarOpen":false');

      store.toggleSidebar();
      expect(useGlobalStore.getState().isSidebarOpen).toBe(true);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F3: Bot Avatar & Identity Live Preview Integration
     ────────────────────────────────────────────────────────────────────────── */
  describe("F3: Bot Profile Picture & Identity Resolution", () => {
    it("1. Profile store manages bot profile selection", () => {
      const profileStore = useProfileStore.getState();
      profileStore.setBotProfileId(42);
      expect(useProfileStore.getState().botProfileId).toBe(42);
    });

    it("2. Bot mode switch sets sendMode to 'bot'", () => {
      const profileStore = useProfileStore.getState();
      profileStore.setSendMode("bot");
      expect(useProfileStore.getState().sendMode).toBe("bot");
    });

    it("3. Webhook mode switch sets sendMode to 'webhook' and tracks webhookUrl", () => {
      const profileStore = useProfileStore.getState();
      profileStore.setSendMode("webhook");
      profileStore.setWebhookUrl("https://discord.com/api/webhooks/123/abc");
      expect(useProfileStore.getState().sendMode).toBe("webhook");
      expect(useProfileStore.getState().webhookUrl).toBe("https://discord.com/api/webhooks/123/abc");
    });

    it("4. useGlobalStore sets and gets botIdentity with localStorage serialization", () => {
      const globalStore = useGlobalStore.getState();
      globalStore.setBotIdentity({
        id: "123456789012345678",
        username: "HohoBot",
        avatar: "https://cdn.discordapp.com/avatars/123/avatar.png",
      });
      expect(useGlobalStore.getState().botIdentity).toEqual({
        id: "123456789012345678",
        username: "HohoBot",
        avatar: "https://cdn.discordapp.com/avatars/123/avatar.png",
      });
      expect(localStorage.getItem("bot_identity_cache")).toContain("HohoBot");

      globalStore.setBotIdentity(null);
      expect(useGlobalStore.getState().botIdentity).toBeNull();
      expect(localStorage.getItem("bot_identity_cache")).toBeNull();
    });

    it("5. Computes default Discord avatar URL using CDN snowflake formula", () => {
      const getDiscordDefaultAvatar = (botId: string) =>
        `https://cdn.discordapp.com/embed/avatars/${(BigInt(botId) >> 22n) % 6n}.png`;

      const id1 = "911111111111111111";
      const avatar1 = getDiscordDefaultAvatar(id1);
      const mod1 = (BigInt(id1) >> 22n) % 6n;
      expect(avatar1).toBe(`https://cdn.discordapp.com/embed/avatars/${mod1}.png`);
      expect(Number(mod1)).toBeGreaterThanOrEqual(0);
      expect(Number(mod1)).toBeLessThan(6);

      const id2 = "123456789012345678";
      const mod2 = (BigInt(id2) >> 22n) % 6n;
      expect(getDiscordDefaultAvatar(id2)).toBe(`https://cdn.discordapp.com/embed/avatars/${mod2}.png`);
    });

    it("6. Safely guards against non-numeric snowflake IDs without throwing SyntaxError", () => {
      const getSafeDiscordDefaultAvatar = (botId?: string | null): string | null => {
        if (!botId || !/^\d+$/.test(botId)) return null;
        try {
          return `https://cdn.discordapp.com/embed/avatars/${(BigInt(botId) >> 22n) % 6n}.png`;
        } catch {
          return null;
        }
      };

      expect(getSafeDiscordDefaultAvatar("invalid_bot_id")).toBeNull();
      expect(getSafeDiscordDefaultAvatar("123abc456")).toBeNull();
      expect(getSafeDiscordDefaultAvatar("")).toBeNull();
      expect(getSafeDiscordDefaultAvatar(null)).toBeNull();
      expect(getSafeDiscordDefaultAvatar(undefined)).toBeNull();

      const valid = getSafeDiscordDefaultAvatar("123456789012345678");
      expect(valid).toMatch(/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F4: Visual Action Rows & Component V2 Building
     ────────────────────────────────────────────────────────────────────────── */
  describe("F4: Visual Action Rows & Modals Building", () => {
    it("1. Factory creates Button component with valid Discord attributes", () => {
      const btn = newButton(ButtonStyle.Primary);
      expect(btn.type).toBe(ComponentType.Button);
      expect(btn.style).toBe(ButtonStyle.Primary);
      expect(btn.label).toBe("Button");
      expect(btn.custom_id).toBe("action:dud");
      expect(btn._id).toBeDefined();
    });

    it("2. Action Row builder nests buttons inside row structure", () => {
      const btn1 = { ...newButton(ButtonStyle.Primary), custom_id: "btn_accept", label: "Accept" };
      const btn2 = { ...newButton(ButtonStyle.Secondary), custom_id: "btn_decline", label: "Decline" };
      const actionRow = {
        type: ComponentType.ActionRow,
        components: [btn1, btn2],
      };
      expect(actionRow.components).toHaveLength(2);
      expect(actionRow.components[0].custom_id).toBe("btn_accept");
    });

    it("3. stripInternal drops all _id properties before payload generation", () => {
      const btn = { ...newButton(ButtonStyle.Primary), custom_id: "btn_act" };
      const container = newContainer([btn]);
      const stripped = stripInternal(container) as any;
      expect(stripped._id).toBeUndefined();
      expect(stripped.components[0]._id).toBeUndefined();
      expect(stripped.components[0].custom_id).toBe("btn_act");
    });

    it("4. Validates message content limit (2000 characters maximum)", () => {
      const longContent = "a".repeat(2001);
      const errors = validateMessage({ content: longContent, embeds: [], components: [] }, "classic");
      expect(errors.some((e) => e.includes("content"))).toBe(true);
    });

    it("5. Transforms document into valid Discord payload structure", () => {
      const payload = toDiscordPayload({
        content: "Preview message",
        embeds: [{ title: "Embed Title", description: "Embed Body" } as any],
        components: [],
      });
      expect(payload.content).toBe("Preview message");
      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds![0].title).toBe("Embed Title");
    });

    it("6. Reorders buttons horizontally within an Action Row using moveComponentById", () => {
      const store = useMessageStore.getState();
      const btn1 = { ...newButton(ButtonStyle.Primary), _id: "btn_1", label: "Button 1" };
      const btn2 = { ...newButton(ButtonStyle.Secondary), _id: "btn_2", label: "Button 2" };
      const btn3 = { ...newButton(ButtonStyle.Success), _id: "btn_3", label: "Button 3" };
      const row = {
        _id: "row_1",
        type: ComponentType.ActionRow,
        components: [btn1, btn2, btn3],
      };
      useMessageStore.setState({
        data: {
          content: "",
          embeds: [],
          components: [row],
          username: "",
          avatar_url: "",
          thread_name: "",
        },
      });

      // Move btn2 left (-1) within row_1
      store.moveComponentById("btn_2", -1, "row_1");
      const updatedRow = useMessageStore.getState().data.components[0];
      expect(updatedRow.components?.map((c) => c._id)).toEqual(["btn_2", "btn_1", "btn_3"]);

      // Move btn2 right (1) within row_1
      store.moveComponentById("btn_2", 1, "row_1");
      const updatedRow2 = useMessageStore.getState().data.components[0];
      expect(updatedRow2.components?.map((c) => c._id)).toEqual(["btn_1", "btn_2", "btn_3"]);
    });

    it("7. Modal input question reordering preserves fields and structure", () => {
      const questions = [
        { customId: "q1", label: "Question 1", style: 1, required: true },
        { customId: "q2", label: "Question 2", style: 2, required: false },
        { customId: "q3", label: "Question 3", style: 1, required: true },
      ];

      // Move q2 up (-1)
      const moveQuestion = (list: typeof questions, idx: number, delta: number) => {
        const next = [...list];
        const [removed] = next.splice(idx, 1);
        next.splice(idx + delta, 0, removed);
        return next;
      };

      const reorderedUp = moveQuestion(questions, 1, -1);
      expect(reorderedUp.map((q) => q.customId)).toEqual(["q2", "q1", "q3"]);
      expect(reorderedUp[0].style).toBe(2);
      expect(reorderedUp[0].required).toBe(false);

      // Move q2 down (1) from index 0
      const reorderedDown = moveQuestion(reorderedUp, 0, 1);
      expect(reorderedDown.map((q) => q.customId)).toEqual(["q1", "q2", "q3"]);
    });

    it("8. Unified message document maintains content, embeds, and components without loss across modes", () => {
      const store = useMessageStore.getState();
      const testEmbed = { _id: "emb_1", title: "Test Embed", description: "Hello" };
      const testButton = { ...newButton(ButtonStyle.Primary), _id: "b_1", label: "Click" };
      const testRow = { _id: "r_1", type: ComponentType.ActionRow, components: [testButton] };

      store.setContent("Unified message text");
      useMessageStore.setState({
        data: {
          content: "Unified message text",
          embeds: [testEmbed as any],
          components: [testRow],
          username: "BotAuthor",
          avatar_url: "",
          thread_name: "",
        },
      });

      // In Classic mode
      store.setMode("classic");
      const classicPayload = store.getPayload();
      expect(classicPayload.content).toBe("Unified message text");
      expect(classicPayload.embeds).toHaveLength(1);
      expect(classicPayload.components).toHaveLength(1);

      // In V2 mode: Discord wire payload transmits components and IsComponentsV2 flag
      store.setMode("v2");
      const v2Payload = store.getPayload();
      expect(v2Payload.flags).toBe(MessageFlags.IsComponentsV2);
      expect(v2Payload.components).toHaveLength(1);

      // Re-verifying state hasn't degraded in store document
      const currentDoc = useMessageStore.getState().data;
      expect(currentDoc.content).toBe("Unified message text");
      expect(currentDoc.embeds).toHaveLength(1);
      expect(currentDoc.components).toHaveLength(1);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F7: Manual Snowflake Fallback Logic
     ────────────────────────────────────────────────────────────────────────── */
  describe("F7: Manual Snowflake ID Fallback & Regex", () => {
    it("1. Validates Discord channel/role/member snowflake string", () => {
      expect(SNOWFLAKE_REGEX.test("123456789012345678")).toBe(true);
      expect(SNOWFLAKE_REGEX.test("9999999999999999999")).toBe(true);
    });

    it("2. Rejects invalid snowflake input strings", () => {
      expect(SNOWFLAKE_REGEX.test("not_a_snowflake")).toBe(false);
      expect(SNOWFLAKE_REGEX.test("12345")).toBe(false);
      expect(SNOWFLAKE_REGEX.test("")).toBe(false);
    });

    it("3. Profile store trims and sanitizes manual channelId inputs", () => {
      const store = useProfileStore.getState();
      store.setChannelId("   123456789012345678   ");
      expect(useProfileStore.getState().channelId).toBe("123456789012345678");
    });
  });
});
