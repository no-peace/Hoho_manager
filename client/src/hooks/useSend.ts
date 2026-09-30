import { useCallback } from "react";
import { sendWebhookDirect } from "../api/discord";
import { useActionStore } from "../store/actionStore";
import { useMessageStore } from "../store/messageStore";
import { useProfileStore } from "../store/profileStore";
import { SEND_MODES } from "../utils/constants";
import type { EditorMode, SendModeValue } from "../utils/constants";
import { isPayloadEmpty } from "../utils/discord";

export interface SendResult {
  ok: boolean;
  error?: string;
  result?: unknown;
}

export interface UseSendReturn {
  sendMessage: (editMessageId?: string) => Promise<SendResult>;
  isConfigured: boolean;
  mode: EditorMode;
  sendMode: SendModeValue;
}

export const useSend = (): UseSendReturn => {
  const mode = useMessageStore((state) => state.mode);
  const setSendState = useMessageStore((state) => state.setSendState);

  const sendMode = useProfileStore((state) => state.sendMode);
  const webhookUrl = useProfileStore((state) => state.webhookUrl);
  const channelId = useProfileStore((state) => state.channelId);
  const threadId = useProfileStore((state) => state.threadId);
  const botProfileId = useProfileStore((state) => state.botProfileId);

  const sendMessage = useCallback(async (editMessageId?: string): Promise<SendResult> => {
    const store = useMessageStore.getState();
    const rawPayload = store.getPayload();
    const problems = store.getValidationErrors();

    if (problems.length > 0) {
      setSendState({ status: "error", error: problems[0], result: null });
      return { ok: false, error: problems[0] };
    }
    if (isPayloadEmpty(rawPayload)) {
      setSendState({ status: "error", error: "Message is empty", result: null });
      return { ok: false, error: "Message is empty" };
    }

    setSendState({ status: "sending", error: null, result: null });

    try {
      let result: unknown;
      
      // Cleanse the internal V2 flag (32768) which causes Discord to throw Invalid Form Body
      const payload = { ...rawPayload };
      if (payload.flags !== undefined) {
          payload.flags &= ~32768;
          if (payload.flags === 0) delete payload.flags;
      }

      if (sendMode === SEND_MODES.BOT) {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const adminKey = import.meta.env.VITE_ADMIN_API_KEY || '';
        const body = {
          mode: "bot",
          payload,
          channelId,
          profileId: botProfileId,
          flows: useActionStore.getState().toRegistrations(),
          editMessageId
        };
        
        // We use direct fetch to guarantee the editMessageId is not stripped by shared types
        const res = await fetch(`${baseUrl}/api/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
            body: JSON.stringify(body)
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || `API Error ${res.status}`);
        result = data;
      } else {
        result = await sendWebhookDirect(webhookUrl, payload, { threadId: threadId || undefined });
      }

      setSendState({ status: "success", error: null, result });
      return { ok: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSendState({ status: "error", error: message, result: null });
      return { ok: false, error: message };
    }
  }, [sendMode, webhookUrl, channelId, threadId, botProfileId, setSendState]);

  const isConfigured = sendMode === SEND_MODES.BOT ? channelId.trim() !== "" : webhookUrl.trim() !== "";
  return { sendMessage, isConfigured, mode, sendMode };
};

export default useSend;