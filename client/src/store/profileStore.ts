import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, type BotProfile, type WebhookProfile } from "../api/client";
import { SEND_MODES } from "../utils/constants";
import type { SendModeValue } from "../utils/constants";

/**
 * Where a message is sent from, and the profiles available to send it with.
 *
 * Two modes exist side by side:
 *   - `webhook` — sent straight from the browser, no backend involved
 *   - `bot`     — proxied through `/api/send` so the token stays server-side
 *
 * The webhook URL is persisted for convenience. It *is* a credential, so it only
 * ever lives in this browser's localStorage and is never sent anywhere except
 * Discord itself.
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
    (set, get) => ({
      sendMode: SEND_MODES.WEBHOOK,
      webhookUrl: "",
      channelId: "",
      botProfileId: null,
      threadId: "",

      webhookProfiles: [],
      botProfiles: [],
      status: "idle",
      error: null,

      setSendMode: (sendMode) => set({ sendMode }),
      setWebhookUrl: (webhookUrl) => set({ webhookUrl: webhookUrl.trim() }),
      setChannelId: (channelId) => set({ channelId: channelId.trim() }),
      setBotProfileId: (botProfileId) => set({ botProfileId }),
      setThreadId: (threadId) => set({ threadId }),

      fetchProfiles: async () => {
        set({ status: "loading" });
        try {
          const [webhooks, bots] = await Promise.all([
            api.profiles.listWebhooks(),
            // Bot profiles are admin-only; a 403 here is expected and harmless.
            api.profiles.listBots().catch(() => ({ profiles: [] as BotProfile[] })),
          ]);
          set({
            webhookProfiles: webhooks.profiles,
            botProfiles: bots.profiles,
            status: "idle",
            error: null,
          });
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },

      /** Apply a saved profile's URL to the active target. */
      useWebhookProfile: (profile) => get().setWebhookUrl(profile.url),

      reset: () =>
        set({ webhookUrl: "", channelId: "", botProfileId: null, threadId: "", error: null }),
    }),
    {
      name: "dmb:profile",
      // Cached profile lists are excluded: they are refetched from the server.
      partialize: (state) => ({
        sendMode: state.sendMode,
        webhookUrl: state.webhookUrl,
        channelId: state.channelId,
        botProfileId: state.botProfileId,
        threadId: state.threadId,
      }),
      version: 1,
    },
  ),
);

export default useProfileStore;
