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
import { MessageFlags } from "@dmb/shared";
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
}

const BotDispatchModalComponent: React.FC<DispatchModalProps> = ({
  open,
  onClose,
  initialMode = "send",
}) => {
  const messagesFromStore = useMessageStore((state) => state.messages);
  const dataFromStore = useMessageStore((state) => state.data);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

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
      title={mode === "edit" ? "Edit via Bot" : "Dispatch via Bot"}
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
              selectedChannels.length === 0 ||
              isSending ||
              (mode === "edit" && !targetMessageId) ||
              (!canUseDefaultBot && botProfileId === null)
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
