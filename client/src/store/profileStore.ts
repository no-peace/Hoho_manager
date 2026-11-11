import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BotProfile, WebhookProfile } from "../api/client";
import { SEND_MODES } from "../utils/constants";
import type { SendModeValue } from "../utils/constants";

/**
 * Retained as a compatibility store for older components and saved workspace
 * state. Sending is always through the single server-configured bot.
 * Webhook URLs and profile IDs are deliberately never persisted or selected.
 */
export interface ProfileState {
  sendMode: SendModeValue;
  webhookUrl: string;
  channelId: string;
  botProfileId: number | null;
  threadId: string;
  webhookProfiles: WebhookProfile[];
  botProfiles: BotProfile[];
  status: "idle" | "loading" | "error";
  error: string | null;
  setSendMode(mode: SendModeValue): void;
  setWebhookUrl(url: string): void;
  setChannelId(channelId: string): void;
  setBotProfileId(id: number | null): void;
  setThreadId(threadId: string): void;
  fetchProfiles(): Promise<void>;
  useWebhookProfile(profile: WebhookProfile): void;
  reset(): void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      sendMode: SEND_MODES.BOT,
      webhookUrl: "",
      channelId: "",
      botProfileId: null,
      threadId: "",
      webhookProfiles: [],
      botProfiles: [],
      status: "idle",
      error: null,
      setSendMode: (_mode) => set({ sendMode: SEND_MODES.BOT }),
      setWebhookUrl: (_url) => set({ webhookUrl: "" }),
      setChannelId: (channelId) => set({ channelId: channelId.trim() }),
      setBotProfileId: (_id) => set({ botProfileId: null }),
      setThreadId: (threadId) => set({ threadId: threadId.trim() }),
      fetchProfiles: async () => {
        set({ webhookProfiles: [], botProfiles: [], status: "idle", error: null });
      },
      useWebhookProfile: (_profile) => set({ webhookUrl: "" }),
      reset: () =>
        set({
          webhookUrl: "",
          channelId: "",
          botProfileId: null,
          threadId: "",
          webhookProfiles: [],
          botProfiles: [],
          status: "idle",
          error: null,
          sendMode: SEND_MODES.BOT,
        }),
    }),
    {
      name: "dmb:profile",
      version: 2,
      // Migrate old localStorage entries without retaining webhook URLs or IDs.
      migrate: (persistedState: unknown) => {
        const oldState = (persistedState ?? {}) as Partial<ProfileState>;
        return {
          channelId: typeof oldState.channelId === "string" ? oldState.channelId : "",
          threadId: typeof oldState.threadId === "string" ? oldState.threadId : "",
        };
      },
      partialize: (state) => ({
        channelId: state.channelId,
        threadId: state.threadId,
      }),
      merge: (persistedState, currentState) => {
        const saved = (persistedState ?? {}) as Partial<ProfileState>;
        return {
          ...currentState,
          channelId: typeof saved.channelId === "string" ? saved.channelId : "",
          threadId: typeof saved.threadId === "string" ? saved.threadId : "",
          sendMode: SEND_MODES.BOT,
          webhookUrl: "",
          botProfileId: null,
          webhookProfiles: [],
          botProfiles: [],
        };
      },
    },
  ),
);

export default useProfileStore;
