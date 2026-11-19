import { useCallback } from "react";
import { api } from "../api/client";
import { useActionStore } from "../store/actionStore";
import { useMessageStore } from "../store/messageStore";
import { EDITOR_MODES } from "../utils/constants";
import type { EditorMode } from "../utils/constants";
import { isPayloadEmpty, validateMessage } from "../utils/discord";
import { checkUnauthorizedMentions } from "../utils/mentionValidation";
import { useGlobalStore } from "../store/globalStore";

export interface SendResult {
  ok: boolean;
  error?: string;
  result?: unknown;
}

export interface UseSendReturn {
  sendMessage: (editMessageId?: string) => Promise<SendResult>;
  isConfigured: boolean;
  mode: EditorMode;
}

export const useSend = (): UseSendReturn => {
  const mode = useMessageStore((state) => state.mode);
  const setSendState = useMessageStore((state) => state.setSendState);

  const sendMessage = useCallback(async (editMessageId?: string): Promise<SendResult> => {
    const store = useMessageStore.getState();
    const rawPayload = store.getPayload();
    const problems = store.messages.flatMap((message, index) => {
      const messageMode = (message.flags ?? 0) & 32768
        ? EDITOR_MODES.V2
        : EDITOR_MODES.CLASSIC;
      return validateMessage(message, messageMode).map((problem) =>
        store.messages.length > 1 ? `Message #${index + 1}: ${problem}` : problem,
      );
    });
    const attachedFiles = store.attachedFiles;
    const activeMessage = store.messages?.[store.activeMessageIndex] ?? store.data;
    const threadId = typeof (activeMessage as unknown as { thread_id?: unknown }).thread_id === "string"
      ? (activeMessage as unknown as { thread_id: string }).thread_id.trim()
      : "";

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
      const isMulti = store.messages && store.messages.length > 1;
      const allPayloads = isMulti ? store.getAllPayloads() : [rawPayload];

      const mentionCheck = checkUnauthorizedMentions(allPayloads);
      if (!mentionCheck.valid) {
        const errorMsg = `Permission Denied: You do not have permission to ping ${mentionCheck.violations.join(", ")}. Please remove unauthorized mentions before sending.`;
        setSendState({ status: "error", error: errorMsg, result: null });
        useGlobalStore.getState().showToast(errorMsg, "error");
        return { ok: false, error: errorMsg };
      }

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
          mode: "bot",
          payload: isMulti ? undefined : payload,
          messages: isMulti ? allPayloads : undefined,
          ...(threadId ? { threadId } : {}),
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
      } else {
        result = await api.send({
          mode: "bot",
          payload: isMulti ? undefined : payload,
          messages: isMulti ? allPayloads : undefined,
          ...(threadId ? { threadId } : {}),
          flows: useActionStore.getState().toRegistrations(),
          editMessageId,
          ...(urlAttachments.length > 0 ? { attachments: urlAttachments } : {}),
        });
      }

      setSendState({ status: "success", error: null, result });
      return { ok: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSendState({ status: "error", error: message, result: null });
      return { ok: false, error: message };
    }
  }, [setSendState]);

  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const isConfigured = Boolean(selectedGuildId);
  return { sendMessage, isConfigured, mode };
};

export default useSend;