import React, { useCallback, useEffect, useMemo, useState } from "react";
import { request, api } from "../../api/client";
import {
  CheckSquare,
  Edit3,
  Send,
  Server,
  Square,
  RefreshCw,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { DateTimePickerPopover } from "../ui/DateTimePickerPopover";
import { Checkbox } from "../ui/Field";
import { Button } from "../ui/Button";
import { useMessageStore } from "../../store/messageStore";
import { useActionStore } from "../../store/actionStore";
import { useGlobalStore } from "../../store/globalStore";
import { fromQueryData, getEditorModeForDiscordMessage } from "../../utils/exportImport";
import { checkUnauthorizedMentions } from "../../utils/mentionValidation";
import { parseEditTargetMessageIds } from "../../utils/dispatchValidation";
import { lintPayloads } from "../../utils/payloadLinter";

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
  const [lintExpanded, setLintExpanded] = useState(false);
  const lintMessages = useMessageStore((state) => state.messages);
  const lintAttachments = useMessageStore((state) => state.attachedFiles);
  const lintActiveMessageIndex = useMessageStore((state) => state.activeMessageIndex);
  const lintIssues = useMemo(
    () => open
      ? lintPayloads(lintMessages, lintAttachments, lintActiveMessageIndex)
      : [],
    [open, lintMessages, lintAttachments, lintActiveMessageIndex],
  );
  const lintErrorCount = lintIssues.filter((issue) => issue.severity === "error").length;
  const lintWarningCount = lintIssues.length - lintErrorCount;
  const focusLintIssue = (issue: (typeof lintIssues)[number]) => {
    const store = useMessageStore.getState();
    store.setActiveMessageIndex(issue.messageIndex);
    store.select(issue.componentId
      ? { kind: "component", id: issue.componentId }
      : { kind: "message", index: issue.messageIndex });
  };
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [trackAfterSend, setTrackAfterSend] = useState(() => {
    const payload = JSON.stringify(useMessageStore.getState().getAllPayloads());
    return /\{user\.\d{17,20}\./i.test(payload) || payload.includes("{exploit.") || payload.includes("discord.com/users/");
  });
  const [customExpiry, setCustomExpiry] = useState<string | null>(null);
  const [mode, setMode] = useState<"send" | "edit">(initialMode);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelQuery, setChannelQuery] = useState("");
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
      const activePayload = JSON.stringify(useMessageStore.getState().getAllPayloads());
      setTrackAfterSend(/\{user\.\d{17,20}\./i.test(activePayload) || activePayload.includes("{exploit.") || activePayload.includes("discord.com/users/"));
      setCustomExpiry(null);

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
      const message = "Server Bot Access Required. Ask a Head Admin to grant your account staff access.";
      setSendResult(message);
      useGlobalStore.getState().showToast(message, "error");
      return;
    }

    if (selectedChannels.length === 0) return;

    let targetMessageIds: string[] = [];
    if (mode === "edit") {
      const parsedTargets = parseEditTargetMessageIds(targetMessageId, selectedChannels.length);
      if (!parsedTargets.valid) {
        setSendResult(parsedTargets.message);
        useGlobalStore.getState().showToast(parsedTargets.message, "error");
        return;
      }
      targetMessageIds = parsedTargets.ids;
    }

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
        const editMessageId = mode === "edit" ? targetMessageIds[channelIndex] : undefined;

        try {
          if (mode === "send") {
            await sendRequest(
              {
                mode: "bot",
                messages: payloadsToSend,
                payload: payloadsToSend[0],
                channelId,
                flows,
                track: trackAfterSend,
                expiresAt: customExpiry,
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
                  track: trackAfterSend,
                  expiresAt: customExpiry,
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
        const message = mode === "edit"
          ? "Message updated successfully."
          : `Dispatched to all ${successCount} selected channel(s).`;
        setSendResult(message);
        useGlobalStore.getState().showToast(message, "success");
        window.setTimeout(onClose, 2000);
      } else if (successCount > 0) {
        const message = `${successCount} of ${selectedChannels.length} channel(s) succeeded. ${firstFailure ?? "Some requests failed."}`;
        setSendResult(message);
        useGlobalStore.getState().showToast(message, "error");
      } else {
        const message = firstFailure ?? "No messages were sent.";
        setSendResult(message);
        useGlobalStore.getState().showToast(message, "error");
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "An error occurred while communicating with the server.";
      setSendResult(message);
      useGlobalStore.getState().showToast(message, "error");
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
                ? "bg-[#FBBF24] hover:bg-[#d88c0e]"
                : "bg-[#818CF8] hover:bg-[#6366F1]"
            } text-white border-none flex items-center gap-2`}
            onClick={() => void handleDispatch()}
            loading={isSending}
            disabled={
              !canUseServerBot ||
              selectedChannels.length === 0 ||
              isSending ||
              lintErrorCount > 0 ||
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
        <div className="flex bg-[#1D2230] p-1 rounded-md border border-[#10131A] shrink-0">
          <button
            type="button"
            onClick={() => setMode("send")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-[11px] font-bold uppercase transition-[background-color,border-color,color] duration-150 ease-out ${
              mode === "send"
                ? "bg-[#818CF8] text-[#0B0D12] shadow-sm"
                : "text-[#A1A8B8] hover:bg-[#161A23]"
            }`}
          >
            <Send size={14} /> Send New Message
          </button>
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-[11px] font-bold uppercase transition-[background-color,border-color,color] duration-150 ease-out ${
              mode === "edit"
                ? "bg-[#FBBF24] text-white shadow-sm"
                : "text-[#A1A8B8] hover:bg-[#161A23]"
            }`}
          >
            <Edit3 size={14} /> Edit Existing
          </button>
        </div>

        <section>
          <div className="flex justify-between items-end mb-2">
            <h4 className="text-[12px] font-bold text-[#A1A8B8] uppercase">
              1. Server Bot Identity
            </h4>
            <button
              type="button"
              onClick={openBotAccess}
              className="text-[11px] font-bold text-[#818CF8] hover:underline"
            >
              View Bot Access
            </button>
          </div>

          <div className="p-3 rounded-lg border border-[#818CF8]/50 bg-[#818CF8]/10 flex items-center gap-3">
            {botIdentity?.avatar ? (
              <img
                src={botIdentity.avatar}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#818CF8] flex items-center justify-center text-white shrink-0">
                <Server size={20} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-white truncate">
                {botIdentity?.username || "HoHo Bot"}
              </p>
              <p className="text-[11px] text-[#A1A8B8] truncate">
                {canUseServerBot
                  ? "Configured server bot"
                  : "Your account does not have permission to use this bot"}
              </p>
            </div>
          </div>

          {!canUseServerBot && (
            <div className="mt-2 p-3 rounded-lg bg-[#1D2230] border border-[#FBBF24]/40 text-center space-y-2">
              <p className="text-xs text-[#F1F3F9] font-semibold">
                Server Bot Access Required
              </p>
              <p className="text-[11px] text-[#A1A8B8]">
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
            <h4 className="text-[12px] font-bold text-[#A1A8B8] uppercase">
              2. Select Target Channel(s)
            </h4>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedChannels(channels.map((channel) => channel.id))}
                disabled={!canUseServerBot || channels.length === 0}
                className="text-[11px] font-bold text-[#818CF8] hover:underline uppercase tracking-wide disabled:opacity-40"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedChannels([])}
                disabled={selectedChannels.length === 0}
                className="text-[11px] font-bold text-[#F87171] hover:underline uppercase tracking-wide disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          {channels.length > 5 && (
            <input
              type="text"
              value={channelQuery}
              onChange={(event) => setChannelQuery(event.target.value)}
              placeholder="Filter channels by name..."
              aria-label="Filter channels by name"
              className="mb-2 w-full rounded-lg border border-[#10131A] bg-[#1D2230] px-3 py-1.5 text-xs text-[#F1F3F9] placeholder-[#A1A8B8] outline-none focus:border-[#818CF8]"
            />
          )}
          <div className="bg-[#10131A] border border-[#272D3A] rounded-lg p-2 h-44 overflow-y-auto custom-scrollbar">
            {!canUseServerBot ? (
              <div className="flex h-full items-center justify-center text-sm text-[#A1A8B8]">
                Server bot access is required.
              </div>
            ) : isLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-xs text-[#A1A8B8]"><RefreshCw size={15} className="animate-spin text-[#818CF8]" /><span>Fetching channels...</span></div>
            ) : channels.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[#A1A8B8]">
                No channels found.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {channels.filter((channel) => !channelQuery.trim() || channel.name.toLowerCase().includes(channelQuery.trim().toLowerCase())).map((channel) => {
                  const checked = selectedChannels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => toggleChannel(channel.id)}
                      aria-pressed={checked}
                      className={`w-full flex items-center gap-3 p-2 rounded text-left transition-colors ${
                        checked ? "bg-[#252B3A]" : "hover:bg-[#161A23]"
                      }`}
                    >
                      {checked ? (
                        <CheckSquare size={16} className="text-[#818CF8]" />
                      ) : (
                        <Square size={16} className="text-[#A1A8B8]" />
                      )}
                      <span
                        className={`text-[13px] font-medium ${
                          checked ? "text-white" : "text-[#F1F3F9]"
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
          <section className="space-y-3 rounded-xl border border-[#272D3A] bg-[#10131A] p-3.5">
            <div>
              <label
                htmlFor="dispatch-target-message-id"
                className="block text-[11px] font-bold text-[#A1A8B8] uppercase mb-1"
              >
                3. Target Message ID(s)
              </label>
              <input
                id="dispatch-target-message-id"
                type="text"
                value={targetMessageId}
                onChange={(event) => setTargetMessageId(event.target.value)}
                placeholder="Enter a message ID or select a recent bot message below..."
                className="w-full bg-[#1D2230] text-[#F1F3F9] border border-[#272D3A] rounded px-3 py-1.5 text-xs font-mono outline-none focus:border-[#818CF8]"
              />
            </div>

            {selectedChannels.length === 1 && (
              <div>
                <p className="text-[11px] font-bold text-[#A1A8B8] uppercase mb-1.5">
                  Recent Bot Messages in Selected Channel
                </p>
                {isLoadingMessages ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-[#A1A8B8]"><RefreshCw size={14} className="animate-spin text-[#818CF8]" /><span>Loading messages...</span></div>
                ) : botMessages.length === 0 ? (
                  <p className="text-xs text-[#A1A8B8]">
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
                            ? "bg-[#818CF8]/20 border border-[#818CF8]"
                            : "bg-[#161A23] hover:bg-[#252B3A]"
                        }`}
                      >
                        <span className="truncate flex-1 mr-2 text-[#F1F3F9]">
                          {message.content}
                        </span>
                        <span className="font-mono text-[10px] text-[#A1A8B8] shrink-0">
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

        <section className="space-y-3 rounded-lg border border-[#272D3A] bg-[#10131A] p-3">
          <Checkbox
            checked={trackAfterSend}
            onChange={setTrackAfterSend}
            label="Track this message (Auto-update dynamic variables)"
            className="text-xs font-medium"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-[#A1A8B8]">Optional retention expiry</span>
            <DateTimePickerPopover value={customExpiry} onChange={setCustomExpiry} placeholder="No expiry" />
          </div>
        </section>

        <section className="rounded-lg border border-[#272D3A] bg-[#10131A] p-3">
          <button
            type="button"
            onClick={() => setLintExpanded((value) => !value)}
            aria-expanded={lintExpanded}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className={lintErrorCount > 0 ? "text-xs font-semibold text-[#F87171]" : "text-xs font-semibold text-[#34D399]"}>
              {lintErrorCount > 0
                ? `Pre-flight: ${lintErrorCount} error(s) blocking dispatch`
                : `Ready to dispatch${lintWarningCount ? ` · ${lintWarningCount} warning(s)` : ""}`}
            </span>
            <span className="text-[10px] text-[#A1A8B8]">{lintExpanded ? "Hide details" : "View details"}</span>
          </button>
          {lintExpanded && (
            <div className="mt-2 space-y-1.5 border-t border-[#272D3A] pt-2">
              {lintIssues.length === 0 ? (
                <p className="text-[11px] text-[#34D399]">No payload issues found.</p>
              ) : lintIssues.map((issue, index) => (
                <button
                  key={`${issue.messageIndex}-${issue.componentId ?? "message"}-${index}`}
                  type="button"
                  onClick={() => focusLintIssue(issue)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[#1D2230]"
                >
                  <span className={issue.severity === "error" ? "mt-0.5 text-[9px] font-bold uppercase text-[#F87171]" : "mt-0.5 text-[9px] font-bold uppercase text-[#FBBF24]"}>
                    {issue.severity}
                  </span>
                  <span className="text-[11px] leading-relaxed text-[#F1F3F9]">
                    Message {issue.messageIndex + 1}: {issue.message}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {sendResult && (
          <div
            role="status"
            className={`p-3 rounded border text-xs leading-relaxed break-words [overflow-wrap:anywhere] ${
              /success|successfully/i.test(sendResult)
                ? "bg-[#34D399]/10 border-[#34D399]/30 text-[#34D399]"
                : "bg-[#F87171]/10 border-[#F87171]/30 text-[#F87171]"
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
