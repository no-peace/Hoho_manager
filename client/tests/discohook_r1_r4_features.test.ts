import { describe, it, expect, beforeEach, vi } from "vitest";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Header } from "../src/components/layout/Header";
import { MessageEditor } from "../src/components/editor/MessageEditor";
import { AuditLogsModal } from "../src/components/layout/AuditLogsModal";
import { SessionsModal } from "../src/components/layout/SessionsModal";
import { FlagsModal } from "../src/components/editor/FlagsModal";
import { AllowedMentionsModal } from "../src/components/editor/AllowedMentionsModal";
import { QuickMentionBox, getStoredCustomEmojis, saveStoredCustomEmojis } from "../src/components/ui/QuickMentionBox";
import { StepList } from "../src/components/actions/StepList";
import { useMessageStore } from "../src/store/messageStore";
import { MessageFlags } from "@dmb/shared";

describe("Discohook R1-R4 Client Feature Coverage", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  describe("R1: Top Bar & Administration", () => {
    it("renders Top Bar with Server Selection, Toolbox button, and Audit Logs & Sessions buttons", () => {
      const html = renderToStaticMarkup(createElement(Header));
      expect(html).toContain("HoHo Manager");
      expect(html).toContain("Toggle Toolbox (Ctrl+B)");
      expect(html).toContain("Audit Logs");
      expect(html).toContain("Sessions");
      expect(html).toContain("Settings");
      expect(html).toContain("Select Server...");
    });

    it("renders AuditLogsModal and SessionsModal without SSR crashes", () => {
      const auditHtml = renderToStaticMarkup(
        createElement(AuditLogsModal, { open: true, onClose: () => {}, guildId: "123456789" })
      );
      expect(auditHtml).toContain("Guild Audit Logs");

      const sessionsHtml = renderToStaticMarkup(
        createElement(SessionsModal, { open: true, onClose: () => {}, guildId: "123456789" })
      );
      expect(sessionsHtml).toContain("Active Sessions");
    });
  });

  describe("R2: Multi-Message & Options", () => {
    it("renders MessageEditor with Options button and Mode tabs", () => {
      const html = renderToStaticMarkup(createElement(MessageEditor));
      expect(html).toContain("Classic");
      expect(html).toContain("Components V2");
      expect(html).toContain("Options");
    });

    it("renders FlagsModal and AllowedMentionsModal without errors", () => {
      const flagsHtml = renderToStaticMarkup(createElement(FlagsModal, { open: true, onClose: () => {} }));
      expect(flagsHtml).toContain("Message Flags");
      expect(flagsHtml).toContain("Suppress Notifications (Silent)");
      expect(flagsHtml).toContain("Suppress Embeds");
      expect(flagsHtml).toContain("Voice Message");

      const mentionsHtml = renderToStaticMarkup(createElement(AllowedMentionsModal, { open: true, onClose: () => {} }));
      expect(mentionsHtml).toContain("Allowed Mentions");
      expect(mentionsHtml).toContain("Custom Allowed Mentions");
    });

    it("verifies MessageStore multi-message lifecycle and payload aggregation", () => {
      const store = useMessageStore.getState();
      expect(store.messages.length).toBe(1);

      // 1. Add message
      store.addMessage({ content: "Second message" });
      expect(useMessageStore.getState().messages.length).toBe(2);
      expect(useMessageStore.getState().activeMessageIndex).toBe(1);

      // 2. Set flags & mentions on active message
      useMessageStore.getState().setMessageFlags(MessageFlags.SuppressNotifications);
      expect(useMessageStore.getState().data.flags).toBe(MessageFlags.SuppressNotifications);

      useMessageStore.getState().setAllowedMentions({ parse: ["users"], users: ["111111111111111111"] });
      expect(useMessageStore.getState().data.allowed_mentions?.users).toEqual(["111111111111111111"]);

      // 3. Duplicate message
      useMessageStore.getState().duplicateMessage(1);
      expect(useMessageStore.getState().messages.length).toBe(3);

      // 4. Get all payloads
      const payloads = useMessageStore.getState().getAllPayloads();
      expect(payloads.length).toBe(3);
      expect(payloads[1].flags).toBe(MessageFlags.SuppressNotifications);
      expect(payloads[1].allowed_mentions?.users).toEqual(["111111111111111111"]);

      // 5. Remove message
      useMessageStore.getState().removeMessage(2);
      expect(useMessageStore.getState().messages.length).toBe(2);
    });

    it("verifies embeds and components remain synchronized across multi-message active index switches", () => {
      const store = useMessageStore.getState();
      expect(store.messages.length).toBe(1);
      expect(store.activeMessageIndex).toBe(0);

      // Add embed to Message 0
      store.addEmbed();
      store.updateEmbed(useMessageStore.getState().data.embeds[0]._id, { title: "Embed in Message 0" });
      expect(useMessageStore.getState().data.embeds[0].title).toBe("Embed in Message 0");

      // Add component to Message 0
      store.addComponent(1); // ActionRow
      expect(useMessageStore.getState().data.components.length).toBe(1);

      // Add Message 1 (switches active to 1)
      store.addMessage({ content: "Message 1 Content" });
      expect(useMessageStore.getState().activeMessageIndex).toBe(1);
      expect(useMessageStore.getState().data.content).toBe("Message 1 Content");
      expect(useMessageStore.getState().data.embeds.length).toBe(0);

      // Switch back to Message 0
      useMessageStore.getState().setActiveMessageIndex(0);
      expect(useMessageStore.getState().activeMessageIndex).toBe(0);
      // Embed and component must still be present!
      expect(useMessageStore.getState().data.embeds.length).toBe(1);
      expect(useMessageStore.getState().data.embeds[0].title).toBe("Embed in Message 0");
      expect(useMessageStore.getState().data.components.length).toBe(1);

      // All payloads must reflect both messages correctly
      const allPayloads = useMessageStore.getState().getAllPayloads();
      expect(allPayloads).toHaveLength(2);
      expect(allPayloads[0].embeds?.[0]?.title).toBe("Embed in Message 0");
      expect(allPayloads[0].components).toHaveLength(1);
      expect(allPayloads[1].content).toBe("Message 1 Content");
    });

    it("enforces maximum 10 messages limit in messageStore", () => {
      const store = useMessageStore.getState();
      for (let i = 0; i < 15; i++) {
        store.addMessage({ content: `Msg ${i}` });
      }
      expect(useMessageStore.getState().messages.length).toBe(10);
    });
  });

  describe("R3: Quick Mention Context Box & Custom Emoji Cache", () => {
    it("persists custom emojis to localStorage under discohook_custom_emojis", () => {
      const mockEmojis = [
        { id: "123456789012345678", name: "pepedance", animated: true },
        { id: "987654321098765432", name: "blobcat", animated: false },
      ];
      saveStoredCustomEmojis(mockEmojis);
      const loaded = getStoredCustomEmojis();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].name).toBe("pepedance");
      expect(loaded[0].animated).toBe(true);
      expect(loaded[1].name).toBe("blobcat");
    });

    it("gracefully falls back to memory storage when localStorage throws exception", () => {
      const originalStorage = (globalThis as any).localStorage;
      try {
        (globalThis as any).localStorage = {
          setItem: vi.fn().mockImplementation(() => {
            throw new Error("QuotaExceededError");
          }),
          getItem: vi.fn().mockImplementation(() => {
            throw new Error("SecurityError: Access is denied");
          }),
        };

        const fallbackEmojis = [
          { id: "112233445566778899", name: "secure_emoji", animated: false },
        ];
        saveStoredCustomEmojis(fallbackEmojis);
        const retrieved = getStoredCustomEmojis();
        expect(retrieved).toHaveLength(1);
        expect(retrieved[0].name).toBe("secure_emoji");
      } finally {
        if (originalStorage !== undefined) {
          (globalThis as any).localStorage = originalStorage;
        } else {
          delete (globalThis as any).localStorage;
        }
      }
    });

    it("renders QuickMentionBox button without error", () => {
      const html = renderToStaticMarkup(createElement(QuickMentionBox, { onSelect: () => {} }));
      expect(html).toContain("Quick Mentions, Emojis, Variables &amp; Timestamps");
    });
  });

  describe("R4: Flow Triggers 'Member has role' Step Configuration", () => {
    it("renders StepList check step with 'Member has role' toggle", () => {
      const steps = [
        {
          _id: "step_check_1",
          type: "check" as const,
          config: {
            checkType: "member_has_role",
            roleMode: "static",
            roleId: "123456789012345678",
            target: "member",
          },
        },
      ];

      const html = renderToStaticMarkup(
        createElement(StepList, {
          steps,
          onChange: () => {},
          depth: 0,
        })
      );

      expect(html).toContain("Member has role");
      expect(html).toContain("Comparison (A == B)");
      expect(html).toContain("Role Selection Mode");
      expect(html).toContain("Static (Guild Role / ID)");
    });
  });
});
