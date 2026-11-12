import React, { useCallback, useEffect, useState } from "react";
import { request, api } from "../../api/client";
import {
  CheckSquare,
  Edit3,
  Send,
  Server,
  Square,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useMessageStore } from "../../store/messageStore";
import { useActionStore } from "../../store/actionStore";
import { useGlobalStore } from "../../store/globalStore";
import { fromQueryData, getEditorModeForDiscordMessage } from "../../utils/exportImport";
import { checkUnauthorizedMentions } from "../../utils/mentionValidation";

export interface DispatchModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: "send" | "edit";
}

type Channel = { id: string; name: string };
type BotMessage = {
  id: string;
  content: string;
  timestamp?: string;
  raw?: any;
};

const BotDispatchModalComponent: React.FC<DispatchModalProps> = ({
  open,
  onClose,
  initialMode = "send",
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [mode, setMode] = useState<"send" | "edit">(initialMode);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("bot_selected_channels") || "[]");
      return Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });
  const botIdentity = useGlobalStore((state) => state.botIdentity);
  const [botMessages, setBotMessages] = useState<BotMessage[]>([]);
  const [targetMessageId, setTargetMessageId] = useState("");
  const [loadedMessageId, setLoadedMessageId] = useState<string | null>(null);

  const currentUser = useGlobalStore((state) => state.currentUser);
  const setConfigModalOpen = useGlobalStore((state) => state.setConfigModalOpen);
  const canUseServerBot = Boolean(
    currentUser?.isAdmin || currentUser?.hasDefaultBotAccess,
  );

  const fetchChannels = useCallback(async () => {
    if (!canUseServerBot) {
      setChannels([]);
      return;
    }

    setIsLoading(true);
    try {
      const data = await request<Channel[]>("/api/send/channels");
      setChannels(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch channels:", error);
      setChannels([]);
    } finally {
      setIsLoading(false);
    }
  }, [canUseServerBot]);

  const fetchRecentMessages = useCallback(async (channelId: string) => {
    setIsLoadingMessages(true);
    try {
      const data = await request<BotMessage[]>(
        `/api/send/channels/${encodeURIComponent(channelId)}/messages`,
      );
      setBotMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch recent bot messages:", error);
      setBotMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    try {
      localStorage.setItem("bot_selected_channels", JSON.stringify(selectedChannels));
    } catch {
      // Local storage may be unavailable; channel selection still works in memory.
    }
  }, [selectedChannels]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const initialize = async () => {
      setSendResult(null);
      setLoadedMessageId(null);
      setBotMessages([]);

      const activeData = useMessageStore.getState().data as any;
      if (
        activeData.link_mode === "edit" &&
        activeData.edit_channel_id &&
        activeData.edit_message_id
      ) {
        setMode("edit");
        setSelectedChannels([activeData.edit_channel_id]);
        setTargetMessageId(activeData.edit_message_id);
      } else {
        setMode(initialMode);
      }

      if (!canUseServerBot) {
        setChannels([]);
        return;
      }

      await fetchChannels();
      if (cancelled) return;
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [open, initialMode, canUseServerBot, fetchChannels]);

  useEffect(() => {
    if (mode === "edit" && selectedChannels.length === 1 && canUseServerBot) {
      void fetchRecentMessages(selectedChannels[0]);
    } else {
      setBotMessages([]);
    }
  }, [mode, selectedChannels, canUseServerBot, fetchRecentMessages]);

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((previous) =>
      previous.includes(channelId)
        ? previous.filter((id) => id !== channelId)
        : [...previous, channelId],
    );
  };

  const loadMessageIntoEditor = (messageId: string) => {
    setTargetMessageId(messageId);
    if (!messageId) return;

    const selected = botMessages.find((message) => message.id === messageId);
    if (!selected?.raw) return;

    const restored = fromQueryData(selected.raw);
    useMessageStore.getState().load({
      data: restored,
      mode: getEditorModeForDiscordMessage(selected.raw),
    });
    setLoadedMessageId(messageId);
  };

  const handleDispatch = async () => {
    if (!canUseServerBot) {
      setSendResult(
        "Server Bot Access Required. Ask a Head Admin to grant your account staff access.",
      );
      return;
    }

    if (selectedChannels.length === 0) return;
    if (mode === "edit" && !targetMessageId.trim()) return;

    setIsSending(true);
    setSendResult(null);

    try {
      const store = useMessageStore.getState();
      const allPayloads = store.getAllPayloads();
      const payloadsToSend =
        mode === "edit"
          ? [store.getPayload()]
          : allPayloads.length > 0
            ? allPayloads
            : [store.getPayload()];

      const mentionCheck = checkUnauthorizedMentions(payloadsToSend);
      if (!mentionCheck.valid) {
        const errorMessage = `Permission denied: You do not have permission to ping ${mentionCheck.violations.join(", ")}. Remove unauthorized mentions before dispatching.`;
        setSendResult(errorMessage);
        useGlobalStore.getState().showToast(errorMessage, "error");
        return;
      }

      const attachedFiles = store.attachedFiles;
      const flows = useActionStore.getState().toRegistrations();
      const localFiles = attachedFiles.filter(
        (file): file is typeof file & { file: File } => file.file instanceof File,
      );
      const urlAttachments = attachedFiles
        .filter((file) => !file.file && typeof file.url === "string")
        .map((file, index) => ({
          id: `url-${index}`,
          filename: file.spoiler ? `SPOILER_${file.name}` : file.name,
          url: file.url as string,
          is_spoiler: Boolean(file.spoiler),
          ...(file.description ? { description: file.description } : {}),
        }));

      const targetMessageIds = targetMessageId
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      let successCount = 0;
      let firstFailure: string | null = null;

      const sendRequest = async (body: any, includeLocalFiles: boolean) => {
        if (includeLocalFiles && localFiles.length > 0) {
          const formData = new FormData();
          formData.append("payload_json", JSON.stringify(body));

          for (const fileItem of localFiles) {
            const filename = fileItem.spoiler
              ? `SPOILER_${fileItem.name}`
              : fileItem.name;
            formData.append("files", fileItem.file, filename);
          }

          await api.send(formData);
          return;
        }

        await api.send(body);
      };

      for (let channelIndex = 0; channelIndex < selectedChannels.length; channelIndex++) {
        const channelId = selectedChannels[channelIndex];
        const editMessageId = targetMessageIds[channelIndex] || targetMessageIds[0];

        try {
          if (mode === "send") {
            await sendRequest(
              {
                mode: "bot",
                messages: payloadsToSend,
                payload: payloadsToSend[0],
                channelId,
                flows,
                ...(urlAttachments.length > 0 ? { attachments: urlAttachments } : {}),
              },
              true,
            );
          } else {
            for (let messageIndex = 0; messageIndex < payloadsToSend.length; messageIndex++) {
              const messagePayload = payloadsToSend[messageIndex];
              const includeAttachments = messageIndex === 0;

              await sendRequest(
                {
                  mode: "bot",
                  payload: messagePayload,
                  channelId,
                  flows,
                  editMessageId,
                  ...(includeAttachments && urlAttachments.length > 0
                    ? { attachments: urlAttachments }
                    : {}),
                },
                includeAttachments,
              );
            }
          }

          successCount++;
        } catch (error) {
          if (firstFailure === null) {
            firstFailure =
              error instanceof Error ? error.message : String(error);
          }
        }
      }

      if (successCount === selectedChannels.length) {
        setSendResult(
          mode === "edit"
            ? "Message updated successfully."
            : `Dispatched to all ${successCount} selected channel(s).`,
        );
        window.setTimeout(onClose, 2000);
      } else if (successCount > 0) {
        setSendResult(
          `${successCount} of ${selectedChannels.length} channel(s) succeeded. ${firstFailure ?? "Some requests failed."}`,
        );
      } else {
        setSendResult(firstFailure ?? "No messages were sent.");
      }
    } catch (error) {
      setSendResult(
        error instanceof Error
          ? error.message
          : "An error occurred while communicating with the server.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const openBotAccess = () => {
    onClose();
    setConfigModalOpen(true);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit via Server Bot" : "Dispatch via Server Bot"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className={`${
              mode === "edit"
                ? "bg-[#faa61a] hover:bg-[#d88c0e]"
                : "bg-[#248046] hover:bg-[#1a6334]"
            } text-white border-none flex items-center gap-2`}
            onClick={() => void handleDispatch()}
            loading={isSending}
            disabled={
              !canUseServerBot ||
              selectedChannels.length === 0 ||
              isSending ||
              (mode === "edit" && !targetMessageId.trim())
            }
          >
            {mode === "edit" ? (
              <>
                <Edit3 size={16} /> Update Message
              </>
            ) : (
              <>
                <Send size={16} /> Dispatch to {selectedChannels.length}
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex bg-[#1e1f22] p-1 rounded-md border border-[#111214] shrink-0">
          <button
            type="button"
            onClick={() => setMode("send")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-[11px] font-bold uppercase transition-all ${
              mode === "send"
                ? "bg-[#5865f2] text-white shadow-sm"
                : "text-[#b5bac1] hover:bg-[#2b2d31]"
            }`}
          >
            <Send size={14} /> Send New Message
          </button>
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-[11px] font-bold uppercase transition-all ${
              mode === "edit"
                ? "bg-[#faa61a] text-white shadow-sm"
                : "text-[#b5bac1] hover:bg-[#2b2d31]"
            }`}
          >
            <Edit3 size={14} /> Edit Existing
          </button>
        </div>

        <section>
          <div className="flex justify-between items-end mb-2">
            <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase">
              1. Server Bot Identity
            </h4>
            <button
              type="button"
              onClick={openBotAccess}
              className="text-[11px] font-bold text-[#5865f2] hover:underline"
            >
              View Bot Access
            </button>
          </div>

          <div className="p-3 rounded-lg border border-[#5865f2]/50 bg-[#5865f2]/10 flex items-center gap-3">
            {botIdentity?.avatar ? (
              <img
                src={botIdentity.avatar}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center text-white shrink-0">
                <Server size={20} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-white truncate">
                {botIdentity?.username || "HoHo Bot"}
              </p>
              <p className="text-[11px] text-[#949ba4] truncate">
                {canUseServerBot
                  ? "Configured server bot"
                  : "Your account does not have permission to use this bot"}
              </p>
            </div>
          </div>

          {!canUseServerBot && (
            <div className="mt-2 p-3 rounded-lg bg-[#1e1f22] border border-[#f0b232]/40 text-center space-y-2">
              <p className="text-xs text-[#dbdee1] font-semibold">
                Server Bot Access Required
              </p>
              <p className="text-[11px] text-[#949ba4]">
                Ask a Head Admin to grant your account staff access to the configured server bot.
              </p>
              <Button size="sm" variant="primary" onClick={openBotAccess}>
                View Bot Access
              </Button>
            </div>
          )}
        </section>

        <section>
          <div className="flex justify-between items-end mb-2">
            <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase">
              2. Select Target Channel(s)
            </h4>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedChannels(channels.map((channel) => channel.id))}
                disabled={!canUseServerBot || channels.length === 0}
                className="text-[11px] font-bold text-[#5865f2] hover:underline uppercase tracking-wide disabled:opacity-40"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedChannels([])}
                disabled={selectedChannels.length === 0}
                className="text-[11px] font-bold text-[#f28b8b] hover:underline uppercase tracking-wide disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="bg-[#1e1f22] border border-[#111214] rounded-lg p-2 h-44 overflow-y-auto custom-scrollbar">
            {!canUseServerBot ? (
              <div className="flex h-full items-center justify-center text-sm text-[#949ba4]">
                Server bot access is required.
              </div>
            ) : isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-[#949ba4]">
                Fetching channels...
              </div>
            ) : channels.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[#949ba4]">
                No channels found.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {channels.map((channel) => {
                  const checked = selectedChannels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => toggleChannel(channel.id)}
                      aria-pressed={checked}
                      className={`w-full flex items-center gap-3 p-2 rounded text-left transition-colors ${
                        checked ? "bg-[#35373c]" : "hover:bg-[#2b2d31]"
                      }`}
                    >
                      {checked ? (
                        <CheckSquare size={16} className="text-[#5865f2]" />
                      ) : (
                        <Square size={16} className="text-[#949ba4]" />
                      )}
                      <span
                        className={`text-[13px] font-medium ${
                          checked ? "text-white" : "text-[#dbdee1]"
                        }`}
                      >
                        # {channel.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {mode === "edit" && (
          <section className="space-y-3 bg-[#1e1f22] p-3 rounded-lg border border-[#111214]">
            <div>
              <label
                htmlFor="dispatch-target-message-id"
                className="block text-[11px] font-bold text-[#b5bac1] uppercase mb-1"
              >
                3. Target Message ID(s)
              </label>
              <input
                id="dispatch-target-message-id"
                type="text"
                value={targetMessageId}
                onChange={(event) => setTargetMessageId(event.target.value)}
                placeholder="Enter a message ID or select a recent bot message below..."
                className="w-full bg-[#2b2d31] text-[#dbdee1] border border-[#111214] rounded px-3 py-1.5 text-xs font-mono outline-none focus:border-[#5865f2]"
              />
            </div>

            {selectedChannels.length === 1 && (
              <div>
                <p className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5">
                  Recent Bot Messages in Selected Channel
                </p>
                {isLoadingMessages ? (
                  <p className="text-xs text-[#949ba4]">Loading messages...</p>
                ) : botMessages.length === 0 ? (
                  <p className="text-xs text-[#949ba4]">
                    No recent bot messages found.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                    {botMessages.map((message) => (
                      <button
                        key={message.id}
                        type="button"
                        onClick={() => loadMessageIntoEditor(message.id)}
                        className={`w-full p-2 rounded text-xs text-left flex items-center justify-between ${
                          targetMessageId === message.id
                            ? "bg-[#5865f2]/20 border border-[#5865f2]"
                            : "bg-[#2b2d31] hover:bg-[#35373c]"
                        }`}
                      >
                        <span className="truncate flex-1 mr-2 text-[#dbdee1]">
                          {message.content}
                        </span>
                        <span className="font-mono text-[10px] text-[#949ba4] shrink-0">
                          {loadedMessageId === message.id
                            ? "Loaded ✓"
                            : message.id.slice(-6)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {sendResult && (
          <div
            role="status"
            className={`p-3 rounded border text-xs leading-relaxed break-words [overflow-wrap:anywhere] ${
              /success|successfully/i.test(sendResult)
                ? "bg-[#23a55a]/10 border-[#23a55a]/30 text-[#57f287]"
                : "bg-[#da373c]/10 border-[#da373c]/30 text-[#f28b8b]"
            }`}
          >
            {sendResult}
          </div>
        )}
      </div>
    </Modal>
  );
};

export const DispatchModal = React.memo(BotDispatchModalComponent);
export const BotDispatchModal = DispatchModal;
export default DispatchModal;
