import { useCallback } from "react";
import { api } from "../api/client";
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
    const attachedFiles = store.attachedFiles;

    if (problems.length > 0) {
      setSendState({ status: "error", error: problems[0], result: null });
      return { ok: false, error: problems[0] };
    }
    if (isPayloadEmpty(rawPayload, attachedFiles.length > 0)) {
      setSendState({ status: "error", error: "Message is empty", result: null });
      return { ok: false, error: "Message is empty" };
    }

    setSendState({ status: "sending", error: null, result: null });

    try {
      let result: unknown;
      const payload = { ...rawPayload };

      // Local files ride as multipart `files`; external URL attachments are
      // resolved and downloaded by the server before forwarding to Discord.
      const localFiles = attachedFiles.filter(
        (f): f is typeof f & { file: File } => f.file instanceof File,
      );
      const urlAttachments = attachedFiles
        .filter((f) => !f.file && typeof f.url === "string")
        .map((f, index) => ({
          id: `url-${index}`,
          filename: f.spoiler ? `SPOILER_${f.name}` : f.name,
          url: f.url as string,
          is_spoiler: Boolean(f.spoiler),
          ...(f.description ? { description: f.description } : {}),
        }));

      if (localFiles.length > 0) {
        // Send multipart form with payload_json and files
        const formData = new FormData();
        const sendBody = {
          mode: sendMode === SEND_MODES.BOT ? "bot" : "webhook",
          payload,
          channelId: sendMode === SEND_MODES.BOT ? channelId : undefined,
          webhookUrl: sendMode === SEND_MODES.BOT ? undefined : webhookUrl,
          threadId: threadId || undefined,
          profileId: sendMode === SEND_MODES.BOT ? (botProfileId ?? undefined) : undefined,
          flows: useActionStore.getState().toRegistrations(),
          editMessageId,
          ...(urlAttachments.length > 0 ? { attachments: urlAttachments } : {}),
        };
        formData.append("payload_json", JSON.stringify(sendBody));
        for (const fileItem of localFiles) {
          const filename = fileItem.spoiler ? `SPOILER_${fileItem.name}` : fileItem.name;
          formData.append("files", fileItem.file, filename);
        }
        result = await api.send(formData);
      } else if (sendMode === SEND_MODES.BOT) {
        result = await api.send({
          mode: "bot",
          payload,
          channelId,
          profileId: botProfileId ?? undefined,
          flows: useActionStore.getState().toRegistrations(),
          editMessageId,
          ...(urlAttachments.length > 0 ? { attachments: urlAttachments } : {}),
        });
      } else if (urlAttachments.length > 0) {
        // URL attachments need the server to fetch and forward them, so a
        // webhook send with URL attachments is proxied through the API.
        result = await api.send({
          mode: "webhook",
          payload,
          webhookUrl,
          threadId: threadId || undefined,
          flows: useActionStore.getState().toRegistrations(),
          editMessageId,
          attachments: urlAttachments,
        });
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