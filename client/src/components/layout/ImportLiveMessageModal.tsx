import React, { useEffect, useMemo, useState } from "react";
import { request } from "../../api/client";
import { Modal } from "../ui/Modal";
import { fromQueryData, getEditorModeForDiscordMessage } from "../../utils/exportImport";
import { useMessageStore } from "../../store/messageStore";
import { useGlobalStore } from "../../store/globalStore";
import { Search, RefreshCw, Download } from "lucide-react";

interface Channel { id: string; name: string }
interface LiveMessage { id: string; content: string; timestamp?: string; raw?: any }

export const ImportLiveMessageModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const guildId = useGlobalStore((state) => state.selectedGuildId);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [channelId, setChannelId] = useState("");
  const [query, setQuery] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingChannels(true);
    setError("");
    void request<Channel[]>(`/api/send/channels${guildId ? `?guildId=${encodeURIComponent(guildId)}` : ""}`)
      .then((result) => {
        if (cancelled) return;
        setChannels(Array.isArray(result) ? result : []);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load channels."); })
      .finally(() => { if (!cancelled) setLoadingChannels(false); });
    return () => { cancelled = true; };
  }, [open, guildId]);

  useEffect(() => {
    if (!open || !channelId) { setMessages([]); return; }
    let cancelled = false;
    setLoadingMessages(true);
    setError("");
    void request<LiveMessage[]>(`/api/send/channels/${encodeURIComponent(channelId)}/messages`)
      .then((result) => { if (!cancelled) setMessages(Array.isArray(result) ? result : []); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load messages."); })
      .finally(() => { if (!cancelled) setLoadingMessages(false); });
    return () => { cancelled = true; };
  }, [open, channelId]);

  const filteredMessages = useMemo(() => messages.filter((message) =>
    !query.trim() || message.content.toLowerCase().includes(query.trim().toLowerCase()) || message.id.includes(query.trim()),
  ), [messages, query]);

  const importMessage = (message: LiveMessage) => {
    if (!message.raw) {
      setError("The API did not include the message payload needed for import.");
      return;
    }
    const restored = fromQueryData(message.raw);
    useMessageStore.getState().load({
      data: restored,
      mode: getEditorModeForDiscordMessage(message.raw),
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Import Live Discord Message" width="max-w-2xl">
      <div className="space-y-3">
        <p className="text-xs text-[#A1A8B8]">Choose a server channel, then select a recent message to load its content, embeds, and components into Studio.</p>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">
          Channel
          <select value={channelId} onChange={(event) => setChannelId(event.target.value)} className="mt-1 w-full rounded-lg border border-[#272D3A] bg-[#1D2230] px-3 py-2 text-xs text-[#F1F3F9] outline-none focus:border-[#818CF8]">
            <option value="">{loadingChannels ? "Loading channels..." : "Select a channel"}</option>
            {channels.map((channel) => <option key={channel.id} value={channel.id}># {channel.name}</option>)}
          </select>
        </label>
        {channelId && (
          <>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A8B8]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search message text or ID..." className="w-full rounded-lg border border-[#272D3A] bg-[#1D2230] py-2 pl-8 pr-3 text-xs text-[#F1F3F9] outline-none focus:border-[#818CF8]" />
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-[#272D3A] bg-[#10131A] p-2 custom-scrollbar">
              {loadingMessages ? <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#A1A8B8]"><RefreshCw size={14} className="animate-spin" /> Loading messages...</div>
                : filteredMessages.length === 0 ? <p className="py-8 text-center text-xs text-[#A1A8B8]">No messages found in this channel.</p>
                : filteredMessages.map((message) => (
                  <button key={message.id} type="button" onClick={() => importMessage(message)} className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-[#161A23] px-3 py-2.5 text-left transition-colors hover:border-[#818CF8]/50 hover:bg-[#1D2230]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-[#F1F3F9]">{message.content || "(No text content)"}</span>
                      <span className="mt-0.5 block font-mono text-[9px] text-[#A1A8B8]">{message.id}{message.timestamp ? ` · ${new Date(message.timestamp).toLocaleString()}` : ""}</span>
                    </span>
                    <Download size={14} className="shrink-0 text-[#818CF8]" />
                  </button>
                ))}
            </div>
          </>
        )}
        {error && <p role="alert" className="rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-xs text-[#F87171]">{error}</p>}
      </div>
    </Modal>
  );
};

export default ImportLiveMessageModal;
