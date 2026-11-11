import React, { useEffect, useState, useMemo } from "react";
import { request, api } from "../../api/client";
import {
  Bot,
  CheckSquare,
  Server,
  Square,
  Edit3,
  Send,
  KeyRound,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { WEBHOOK_URL_REGEX, MessageFlags } from "@dmb/shared";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useProfileStore } from "../../store/profileStore";
import { useMessageStore } from "../../store/messageStore";
import { useActionStore } from "../../store/actionStore";
import { useGlobalStore } from "../../store/globalStore";
import { fromQueryData, getEditorModeForDiscordMessage } from "../../utils/exportImport";
import { EDITOR_MODES } from "../../utils/constants";
import { checkUnauthorizedMentions } from "../../utils/mentionValidation";

export interface DispatchModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: "send" | "edit";
  initialChannel?: "bot" | "webhook";
}

const BotDispatchModalComponent: React.FC<DispatchModalProps> = ({
  open,
  onClose,
  initialMode = "send",
  initialChannel,
}) => {
  // Top-Level Channel Mode: "bot" vs "webhook"
  const [dispatchChannel, setDispatchChannel] = useState<"bot" | "webhook">(() => {
    if (initialChannel) return initialChannel;
    try {
      return (localStorage.getItem("studio_dispatch_channel") as "bot" | "webhook") || "bot";
    } catch {
      return "bot";
    }
  });

  useEffect(() => {
    if (initialChannel) {
      setDispatchChannel(initialChannel);
    }
  }, [initialChannel]);

  useEffect(() => {
    try {
      localStorage.setItem("studio_dispatch_channel", dispatchChannel);
    } catch {
      // ignore
    }
  }, [dispatchChannel]);

  // Webhook Dispatch State
  const webhookUrlFromStore = useProfileStore((state) => state.webhookUrl);
  const setStoreWebhookUrl = useProfileStore((state) => state.setWebhookUrl);
  const threadIdFromStore = useProfileStore((state) => state.threadId);
  const setStoreThreadId = useProfileStore((state) => state.setThreadId);
  const targets = useMessageStore((state) => state.targets);
  const messagesFromStore = useMessageStore((state) => state.messages);
  const dataFromStore = useMessageStore((state) => state.data);

  const [webhookUrlInput, setWebhookUrlInput] = useState(() => {
    return webhookUrlFromStore || targets?.[0]?.url || "";
  });
  const [threadIdInput, setThreadIdInput] = useState(() => threadIdFromStore || "");

  useEffect(() => {
    if (open) {
      if (webhookUrlFromStore) setWebhookUrlInput(webhookUrlFromStore);
      else if (targets?.[0]?.url) setWebhookUrlInput(targets[0].url);
      if (threadIdFromStore) setThreadIdInput(threadIdFromStore);
    }
  }, [open, webhookUrlFromStore, threadIdFromStore, targets]);

  const isWebhookUrlValid = useMemo(() => {
    return WEBHOOK_URL_REGEX.test(webhookUrlInput.trim());
  }, [webhookUrlInput]);

  const isThreadIdValid = useMemo(() => {
    const trimmed = threadIdInput.trim();
    if (!trimmed) return true;
    return /^\d{17,20}$/.test(trimmed);
  }, [threadIdInput]);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const canDispatchWebhook = isWebhookUrlValid && isThreadIdValid && !isSending;

  const displayMessages = useMemo(() => {
    return messagesFromStore && messagesFromStore.length > 0
      ? messagesFromStore
      : [dataFromStore];
  }, [messagesFromStore, dataFromStore]);

  // Bot Dispatch State
  const botProfiles = useProfileStore((state) => state.botProfiles);
  const fetchProfiles = useProfileStore((state) => state.fetchProfiles);
  const botProfileId = useProfileStore((state) => state.botProfileId);
  const setBotProfileId = useProfileStore((state) => state.setBotProfileId);

  const currentUser = useGlobalStore((state) => state.currentUser);
  const setConfigModalOpen = useGlobalStore((state) => state.setConfigModalOpen);
  const canUseDefaultBot = Boolean(currentUser?.isAdmin || currentUser?.hasDefaultBotAccess);

  const [mode, setMode] = useState<"send" | "edit">(initialMode);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("bot_selected_channels") || "[]");
    } catch {
      return [];
    }
  });

  const [cachedBotInfo, setCachedBotInfo] = useState<{
    name: string;
    avatar: string;
  } | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("bot_identity_cache") || "null");
    } catch {
      return null;
    }
  });

  const [botMessages, setBotMessages] = useState<
    { id: string; content: string; timestamp?: string; raw?: any }[]
  >([]);
  const [targetMessageId, setTargetMessageId] = useState("");
  const [loadedMessageId, setLoadedMessageId] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    try {
      localStorage.setItem("bot_selected_channels", JSON.stringify(selectedChannels));
    } catch {
      // ignore
    }
  }, [selectedChannels]);

  useEffect(() => {
    if (open) {
      void (async () => {
        await fetchProfiles();
        setSendResult(null);
        setLoadedMessageId(null);

        const activeData = useMessageStore.getState().data as any;
        if (
          activeData.link_mode === "edit" &&
          activeData.edit_channel_id &&
          activeData.edit_message_id
        ) {
          setMode("edit");
          setSelectedChannels([activeData.edit_channel_id]);
          setTargetMessageId(activeData.edit_message_id);
        }

        const latestProfiles = useProfileStore.getState().botProfiles;
        let activeProfileId = useProfileStore.getState().botProfileId;

        if (!canUseDefaultBot && activeProfileId === null) {
          activeProfileId = latestProfiles[0]?.id ?? null;
          setBotProfileId(activeProfileId);
        }

        if (canUseDefaultBot || activeProfileId !== null) {
          void fetchChannels(activeProfileId);
        } else {
          setChannels([]);
        }
      })();
    }
  }, [open, canUseDefaultBot]);

  useEffect(() => {
    if (mode === "edit" && selectedChannels.length === 1 && (canUseDefaultBot || botProfileId !== null)) {
      void fetchRecentMessages(selectedChannels[0], botProfileId);
    } else {
      setBotMessages([]);
    }
  }, [mode, selectedChannels, botProfileId, canUseDefaultBot]);

  const handleBotSelect = (id: number | null) => {
    if (id === null && !canUseDefaultBot) return;
    setBotProfileId(id);
    try {
      localStorage.setItem("bot_selected_profile", id === null ? "default" : String(id));
    } catch {
      // ignore
    }
    setCachedBotInfo(null);
    setSelectedChannels([]);
    setTargetMessageId("");
    setBotMessages([]);
    void fetchChannels(id);
  };

  const fetchChannels = async (profileId: number | null = botProfileId) => {
    if (profileId === null && !canUseDefaultBot) {
      setChannels([]);
      return;
    }
    setIsLoading(true);
    try {
      const query = profileId === null ? "" : `?profileId=${encodeURIComponent(String(profileId))}`;
      const data = await request<{ id: string; name: string }[]>(`/api/send/channels${query}`);
      if (Array.isArray(data)) setChannels(data);
    } catch (e) {
      console.error(e);
      setChannels([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentMessages = async (cId: string, profileId: number | null = botProfileId) => {
    setIsLoadingMessages(true);
    try {
      const query = profileId === null ? "" : `?profileId=${encodeURIComponent(String(profileId))}`;
      const data = await request<any[]>(
        `/api/send/channels/${encodeURIComponent(cId)}/messages${query}`,
      );
      if (Array.isArray(data)) setBotMessages(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const loadMessageIntoEditor = (msgId: string) => {
    setTargetMessageId(msgId);
    if (!msgId) return;

    const selected = botMessages.find((m) => m.id === msgId);
    if (selected && selected.raw) {
      const restored = fromQueryData(selected.raw);
      useMessageStore.getState().load({
        data: restored,
        mode: getEditorModeForDiscordMessage(selected.raw),
      });
      setLoadedMessageId(msgId);
    }
  };

  const handleDispatch = async () => {
    // ── Webhook Mode Dispatch Path ──
    if (dispatchChannel === "webhook") {
      const trimmedUrl = webhookUrlInput.trim();
      if (!WEBHOOK_URL_REGEX.test(trimmedUrl)) {
        setSendResult("Please provide a valid Discord Webhook URL.");
        return;
      }
      const trimmedThreadId = threadIdInput.trim();
      if (trimmedThreadId && !/^\d{17,20}$/.test(trimmedThreadId)) {
        setSendResult("Thread ID must be a 17-20 digit Discord Snowflake.");
        return;
      }

      setIsSending(true);
      setSendResult(null);

      try {
        const store = useMessageStore.getState();
        const allPayloads = store.getAllPayloads();
        const payloadsToSend = allPayloads.length > 0 ? allPayloads : [store.getPayload()];

        const mentionCheck = checkUnauthorizedMentions(payloadsToSend);
        if (!mentionCheck.valid) {
          const errorMsg = `Permission Denied: You do not have permission to ping ${mentionCheck.violations.join(", ")}. Please remove unauthorized mentions before dispatching.`;
          setSendResult(errorMsg);
          useGlobalStore.getState().showToast(errorMsg, "error");
          setIsSending(false);
          return;
        }

        const attachedFiles = store.attachedFiles;
        const flows = useActionStore.getState().toRegistrations();

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

        // Persist entered URL and thread ID in profileStore and messageStore targets
        setStoreWebhookUrl(trimmedUrl);
        setStoreThreadId(trimmedThreadId);
        if (store.setTargetUrl) {
          store.setTargetUrl(0, trimmedUrl);
        }

        if (localFiles.length > 0) {
          const formData = new FormData();
          const sendBody = {
            mode: "webhook",
            webhookUrl: trimmedUrl,
            threadId: trimmedThreadId || undefined,
            messages: payloadsToSend,
            payload: payloadsToSend[0],
            flows,
            ...(urlAttachments.length > 0 ? { attachments: urlAttachments } : {}),
          };
          formData.append("payload_json", JSON.stringify(sendBody));
          for (const fileItem of localFiles) {
            const filename = fileItem.spoiler ? `SPOILER_${fileItem.name}` : fileItem.name;
            formData.append("files", fileItem.file, filename);
          }
          await api.send(formData);
        } else {
          await api.send({
            mode: "webhook",
            webhookUrl: trimmedUrl,
            threadId: trimmedThreadId || undefined,
            messages: payloadsToSend,
            payload: payloadsToSend[0],
            flows,
            ...(urlAttachments.length > 0 ? { attachments: urlAttachments } : {}),
          });
        }

        setSendResult(
          payloadsToSend.length > 1
            ? `Successfully dispatched ${payloadsToSend.length} messages in sequence to webhook!`
            : "Successfully dispatched message to webhook!",
        );
        setTimeout(() => onClose(), 2000);
      } catch (err: any) {
        const errorMsg =
          err?.response?.data?.error ||
          err?.message ||
          "An error occurred while dispatching to webhook.";
        setSendResult(String(errorMsg));
      } finally {
        setIsSending(false);
      }
      return;
    }

    // ── Bot Token Dispatch Path ──
    if (selectedChannels.length === 0) return;
    if (mode === "edit" && !targetMessageId) return;
    if (!canUseDefaultBot && botProfileId === null) {
      setSendResult("Please configure and select your own Custom Bot first.");
      return;
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
        const errorMsg = `Permission Denied: You do not have permission to ping ${mentionCheck.violations.join(", ")}. Please remove unauthorized mentions before dispatching.`;
        setSendResult(errorMsg);
        useGlobalStore.getState().showToast(errorMsg, "error");
        setIsSending(false);
        return;
      }

      const attachedFiles = store.attachedFiles;
      const flows = useActionStore.getState().toRegistrations();

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

      let successCount = 0;
      let firstFailure: string | null = null;

      const targetMessageIds = targetMessageId
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      for (let i = 0; i < selectedChannels.length; i++) {
        const cId = selectedChannels[i];
        const currentTargetId = targetMessageIds[i] || targetMessageIds[0];

        try {
          if (mode === "send") {
            // Batch all messages into a single HTTP dispatch request to prevent multi-message staff cooldown lockout (RB-14)
            if (localFiles.length > 0) {
              const formData = new FormData();
              const sendBody = {
                mode: "bot",
                messages: payloadsToSend,
                payload: payloadsToSend[0],
                channelId: cId,
                profileId: botProfileId ?? undefined,
                flows,
                ...(urlAttachments.length > 0 ? { attachments: urlAttachments } : {}),
              };
              formData.append("payload_json", JSON.stringify(sendBody));
              for (const fileItem of localFiles) {
                const filename = fileItem.spoiler ? `SPOILER_${fileItem.name}` : fileItem.name;
                formData.append("files", fileItem.file, filename);
              }
              await api.send(formData);
            } else {
              await api.send({
                mode: "bot",
                messages: payloadsToSend,
                payload: payloadsToSend[0],
                channelId: cId,
                profileId: botProfileId ?? undefined,
                flows,
                ...(urlAttachments.length > 0 ? { attachments: urlAttachments } : {}),
              });
            }
          } else {
            for (let mIdx = 0; mIdx < payloadsToSend.length; mIdx++) {
              const msgPayload = payloadsToSend[mIdx];
              const includeFiles = mIdx === 0;

              if (includeFiles && localFiles.length > 0) {
                const formData = new FormData();
                const sendBody = {
                  mode: "bot",
                  payload: msgPayload,
                  channelId: cId,
                  profileId: botProfileId ?? undefined,
                  flows,
                  editMessageId: currentTargetId,
                  ...(urlAttachments.length > 0 ? { attachments: urlAttachments } : {}),
                };
                formData.append("payload_json", JSON.stringify(sendBody));
                for (const fileItem of localFiles) {
                  const filename = fileItem.spoiler ? `SPOILER_${fileItem.name}` : fileItem.name;
                  formData.append("files", fileItem.file, filename);
                }
                await api.send(formData);
              } else {
                await api.send({
                  mode: "bot",
                  payload: msgPayload,
                  channelId: cId,
                  profileId: botProfileId ?? undefined,
                  flows,
                  editMessageId: currentTargetId,
                  ...(includeFiles && urlAttachments.length > 0 ? { attachments: urlAttachments } : {}),
                });
              }
            }
          }
          successCount++;
        } catch (err) {
          if (firstFailure === null) {
            firstFailure = err instanceof Error ? err.message : String(err);
          }
        }
      }

      if (successCount === selectedChannels.length) {
        setSendResult(
          mode === "edit"
            ? "Message updated successfully."
            : `Dispatched to all ${successCount} selected channel(s).`,
        );
      } else if (successCount > 0) {
        setSendResult(
          `${successCount} of ${selectedChannels.length} channel(s) succeeded. ${firstFailure ?? "Some requests failed."}`,
        );
      } else {
        setSendResult(firstFailure ?? "No messages were sent.");
      }

      if (successCount === selectedChannels.length) {
        setTimeout(() => onClose(), 2000);
      }
    } catch {
      setSendResult("An error occurred while communicating with the server.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dispatchChannel === "webhook" ? "Dispatch to Discord Webhook" : "Dispatch via Bot"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className={`${
              dispatchChannel === "webhook"
                ? "bg-[#5865f2] hover:bg-[#4752c4]"
                : mode === "edit"
                  ? "bg-[#faa61a] hover:bg-[#d88c0e]"
                  : "bg-[#248046] hover:bg-[#1a6334]"
            } text-white border-none flex items-center gap-2`}
            onClick={() => void handleDispatch()}
            loading={isSending}
            disabled={
              dispatchChannel === "webhook"
                ? !canDispatchWebhook
                : (selectedChannels.length === 0 ||
                  isSending ||
                  (mode === "edit" && !targetMessageId) ||
                  (!canUseDefaultBot && botProfileId === null))
            }
          >
            {dispatchChannel === "webhook" ? (
              <>
                <Send size={16} />
                <span>
                  {displayMessages.length > 1
                    ? `Dispatch Batch (${displayMessages.length} Messages)`
                    : "Dispatch to Webhook"}
                </span>
              </>
            ) : mode === "edit" ? (
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
        {/* Top Channel Selector: Bot Token vs Webhook */}
        <div className="flex bg-[#111214] p-1 rounded-lg border border-[#1e1f22] shrink-0">
          <button
            type="button"
            onClick={() => setDispatchChannel("bot")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${
              dispatchChannel === "bot"
                ? "bg-[#2b2d31] text-white shadow-sm border border-[#35373c]"
                : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#1e1f22]"
            }`}
          >
            <Bot size={15} className={dispatchChannel === "bot" ? "text-[#57f287]" : ""} />
            <span>Bot Token Dispatch</span>
          </button>
          <button
            type="button"
            onClick={() => setDispatchChannel("webhook")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${
              dispatchChannel === "webhook"
                ? "bg-[#5865f2] text-white shadow-sm"
                : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#1e1f22]"
            }`}
          >
            <Send size={15} />
            <span>Webhook URL Dispatch</span>
          </button>
        </div>

        {/* ── Webhook Channel View ── */}
        {dispatchChannel === "webhook" ? (
          <div className="space-y-4">
            {/* 1. Webhook URL Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wide flex items-center gap-1.5">
                  1. Discord Webhook URL <span className="text-[#f28b8b]">*</span>
                </label>
                {webhookUrlInput && (
                  <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                    isWebhookUrlValid ? "text-[#57f287]" : "text-[#f28b8b]"
                  }`}>
                    {isWebhookUrlValid ? (
                      <>
                        <Check size={11} /> Valid Discord Webhook
                      </>
                    ) : (
                      <>
                        <AlertCircle size={11} /> Invalid Webhook URL
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="url"
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/1234567890/token_string..."
                  className={`w-full bg-[#1e1f22] text-xs font-mono text-[#dbdee1] px-3 py-2 rounded-md border transition-colors outline-none focus:ring-1 ${
                    webhookUrlInput && !isWebhookUrlValid
                      ? "border-[#f28b8b] focus:ring-[#f28b8b]"
                      : "border-[#111214] focus:border-[#5865f2] focus:ring-[#5865f2]"
                  }`}
                />
                {webhookUrlInput && (
                  <button
                    type="button"
                    onClick={() => setWebhookUrlInput("")}
                    className="absolute right-2.5 top-2.5 text-[#949ba4] hover:text-white"
                    title="Clear URL"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[#949ba4]">
                Obtained from Discord Server Settings → Integrations → Webhooks → Copy Webhook URL.
              </p>
            </div>

            {/* 2. Thread / Forum Post ID (Optional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wide">
                  2. Thread ID (Optional)
                </label>
                {threadIdInput && (
                  <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                    isThreadIdValid ? "text-[#57f287]" : "text-[#f28b8b]"
                  }`}>
                    {isThreadIdValid ? (
                      <>
                        <Check size={11} /> Valid Snowflake
                      </>
                    ) : (
                      <>
                        <AlertCircle size={11} /> Must be 17–20 Digits
                      </>
                    )}
                  </span>
                )}
              </div>
              <input
                type="text"
                maxLength={20}
                value={threadIdInput}
                onChange={(e) => setThreadIdInput(e.target.value.replace(/\D/g, ""))}
                placeholder="1098765432109876543 (Thread / Forum Post ID)"
                className={`w-full bg-[#1e1f22] text-xs font-mono text-[#dbdee1] px-3 py-2 rounded-md border transition-colors outline-none focus:ring-1 ${
                  threadIdInput && !isThreadIdValid
                    ? "border-[#f28b8b] focus:ring-[#f28b8b]"
                    : "border-[#111214] focus:border-[#5865f2] focus:ring-[#5865f2]"
                }`}
              />
              <p className="text-[11px] text-[#949ba4]">
                If specified, Discord sends this message inside the specified active Thread or Forum Post rather than the parent channel.
              </p>
            </div>

            {/* 3. Batch Dispatch Summary Card */}
            <div className="p-3 bg-[#1e1f22] border border-[#111214] rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#dbdee1] flex items-center gap-1.5">
                  <Send size={13} className="text-[#5865f2]" /> Batch Scope
                </span>
                <span className="bg-[#2b2d31] px-2 py-0.5 rounded text-[11px] font-mono text-[#5865f2]">
                  {displayMessages.length} Message{displayMessages.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {displayMessages.map((m, idx) => {
                  const isV2 =
                    Boolean((m.flags ?? 0) & MessageFlags.IsComponentsV2) ||
                    (m as any).mode === EDITOR_MODES.V2;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-[#2b2d31] border border-[#35373c] text-[11px]"
                    >
                      <span className="font-semibold text-white">Msg {idx + 1}:</span>
                      <span className="text-[#949ba4]">{isV2 ? "V2" : "Classic"}</span>
                      {m.username && (
                        <span className="text-[#57f287] font-medium truncate max-w-[80px]">
                          @{m.username}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ── Bot Token Channel View ── */
          <>
            {/* Mode Toggles */}
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

            {/* 1. Bot Identity Selector */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase">
                  1. Select Bot Identity
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setConfigModalOpen(true);
                  }}
                  className="text-[11px] font-bold text-[#5865f2] hover:underline flex items-center gap-1"
                >
                  <KeyRound size={12} /> + Add Custom Bot
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
                {canUseDefaultBot && (
                  <div
                    onClick={() => handleBotSelect(null)}
                    className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-all ${
                      botProfileId === null
                        ? "border-[#5865f2] bg-[#5865f2]/10"
                        : "border-[#1e1f22] bg-[#1e1f22] hover:border-[#35373c]"
                    }`}
                  >
                    {cachedBotInfo?.avatar ? (
                      <img
                        src={cachedBotInfo.avatar}
                        alt="Bot"
                        className="w-10 h-10 rounded-full shadow-sm object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center text-white shrink-0 shadow-sm">
                        <Server size={20} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-white truncate">
                        {cachedBotInfo ? cachedBotInfo.name : "Server Default"}
                      </p>
                      <p className="text-[11px] text-[#949ba4] truncate">
                        Authorized Staff / Admin Bot
                      </p>
                    </div>
                  </div>
                )}

                {botProfiles.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleBotSelect(p.id)}
                    className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-all ${
                      botProfileId === p.id
                        ? "border-[#5865f2] bg-[#5865f2]/10"
                        : "border-[#1e1f22] bg-[#1e1f22] hover:border-[#35373c]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#23a559] flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden">
                      <Bot size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-white truncate">{p.name}</p>
                      <p className="text-[11px] text-[#949ba4] truncate">
                        ID: {p.application_id || "Custom"}
                      </p>
                    </div>
                  </div>
                ))}

                {!canUseDefaultBot && botProfiles.length === 0 && (
                  <div className="col-span-full p-4 rounded-lg bg-[#1e1f22] border border-[#f0b232]/40 text-center space-y-2">
                    <p className="text-xs text-[#dbdee1] font-semibold">
                      No Custom Bot Configured Yet
                    </p>
                    <p className="text-[11px] text-[#949ba4]">
                      You don&apos;t have access to the Server Default bot. Click below to add your own Bot Token.
                    </p>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        onClose();
                        setConfigModalOpen(true);
                      }}
                    >
                      Configure Custom Bot
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Target Channel Selector */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase">
                  2. Select Target Channel(s)
                </h4>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedChannels(channels.map((c) => c.id))}
                    className="text-[11px] font-bold text-[#5865f2] hover:underline uppercase tracking-wide"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedChannels([])}
                    className="text-[11px] font-bold text-[#f28b8b] hover:underline uppercase tracking-wide"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="bg-[#1e1f22] border border-[#111214] rounded-lg p-2 h-44 overflow-y-auto custom-scrollbar shrink-0">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-[#949ba4]">
                    Fetching channels...
                  </div>
                ) : channels.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[#949ba4]">
                    No channels found.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {channels.map((c) => {
                      const isChecked = selectedChannels.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleChannel(c.id)}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                            isChecked ? "bg-[#35373c]" : "hover:bg-[#2b2d31]"
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-[#5865f2]" />
                          ) : (
                            <Square size={16} className="text-[#949ba4]" />
                          )}
                          <span
                            className={`text-[13px] font-medium ${
                              isChecked ? "text-white" : "text-[#dbdee1]"
                            }`}
                          >
                            # {c.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Message Target Selector (Edit Mode Only) */}
            {mode === "edit" && (
              <div className="space-y-3 bg-[#1e1f22] p-3 rounded-lg border border-[#111214]">
                <div>
                  <label className="block text-[11px] font-bold text-[#b5bac1] uppercase mb-1">
                    3. Target Message ID(s)
                  </label>
                  <input
                    type="text"
                    value={targetMessageId}
                    onChange={(e) => setTargetMessageId(e.target.value)}
                    placeholder="Enter message ID or select a recent bot message below..."
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
                      <p className="text-xs text-[#949ba4]">No recent bot messages found.</p>
                    ) : (
                      <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                        {botMessages.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => loadMessageIntoEditor(m.id)}
                            className={`p-2 rounded text-xs cursor-pointer flex items-center justify-between ${
                              targetMessageId === m.id
                                ? "bg-[#5865f2]/20 border border-[#5865f2]"
                                : "bg-[#2b2d31] hover:bg-[#35373c]"
                            }`}
                          >
                            <span className="truncate flex-1 mr-2 text-[#dbdee1]">
                              {m.content}
                            </span>
                            <span className="font-mono text-[10px] text-[#949ba4] shrink-0">
                              {loadedMessageId === m.id ? "Loaded ✓" : m.id.slice(-6)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {sendResult && (
          <div
            className={`p-3 rounded border text-xs leading-relaxed break-words [overflow-wrap:anywhere] ${
              sendResult.toLowerCase().includes("success") || sendResult.toLowerCase().includes("successfully")
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
