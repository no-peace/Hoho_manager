import { useCallback } from "react";
import type { SendRequestBody } from "@dmb/shared";
import { api } from "../api/client";
import { sendWebhookDirect } from "../api/discord";
import { useActionStore } from "../store/actionStore";
import { useMessageStore } from "../store/messageStore";
import { useProfileStore } from "../store/profileStore";
import { SEND_MODES } from "../utils/constants";
import type { EditorMode, SendModeValue } from "../utils/constants";
import { isPayloadEmpty } from "../utils/discord";

/**
 * Sending logic, in one place.
 *
 * The two modes take very different paths:
 *   - **webhook** goes browser -> Discord directly (fewer hops, no server load)
 *   - **bot** goes browser -> `/api/send` -> Discord, because the token must
 *     never reach the client
 *
 * The UI only needs "did it work, and why not", so both paths normalise into the
 * message store's `send` state.
 */

export interface SendResult {
  ok: boolean;
  error?: string;
  result?: unknown;
}

export interface UseSendReturn {
  sendMessage: () => Promise<SendResult>;
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

  const sendMessage = useCallback(async (): Promise<SendResult> => {
    const store = useMessageStore.getState();
    const payload = store.getPayload();
    const problems = store.getValidationErrors();

    if (problems.length > 0) {
      const message = problems[0] ?? "This message can't be sent.";
      setSendState({ status: "error", error: message, result: null });
      return { ok: false, error: message };
    }

    if (isPayloadEmpty(payload)) {
      const message = "Write something first — an empty message can't be sent.";
      setSendState({ status: "error", error: message, result: null });
      return { ok: false, error: message };
    }

    setSendState({ status: "sending", error: null, result: null });

    try {
      let result: unknown;

      if (sendMode === SEND_MODES.BOT) {
        const body: SendRequestBody = {
          mode: "bot",
          payload,
          channelId,
          profileId: botProfileId,
          // Multi-step flows can't fit in a 100-char custom_id, so they ride
          // alongside the message and are registered server-side before send.
          flows: useActionStore.getState().toRegistrations(),
        };
        result = await api.send(body);
      } else {
        result = await sendWebhookDirect(webhookUrl, payload, {
          threadId: threadId || undefined,
        });
      }

      setSendState({ status: "success", error: null, result });
      return { ok: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSendState({ status: "error", error: message, result: null });
      return { ok: false, error: message };
    }
  }, [sendMode, webhookUrl, channelId, threadId, botProfileId, setSendState]);

  /** Client-side readiness check used to enable/disable the send button. */
  const isConfigured =
    sendMode === SEND_MODES.BOT ? channelId.trim() !== "" : webhookUrl.trim() !== "";

  return { sendMessage, isConfigured, mode, sendMode };
};

export default useSend;
