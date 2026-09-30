import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Send, Edit3, Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { Select, TextField } from "../ui/Field";
import { useSend } from "../../hooks/useSend";
import { useMessageStore } from "../../store/messageStore";
import { useProfileStore } from "../../store/profileStore";
import { SEND_MODES } from "../../utils/constants";

export const SendPanel = () => {
  const { sendMessage, isConfigured } = useSend();

  const channelId = useProfileStore((state) => state.channelId);
  const botProfileId = useProfileStore((state) => state.botProfileId);
  const botProfiles = useProfileStore((state) => state.botProfiles);
  const fetchProfiles = useProfileStore((state) => state.fetchProfiles);
  const profilesStatus = useProfileStore((state) => state.status);

  const setSendMode = useProfileStore((state) => state.setSendMode);
  const setChannelId = useProfileStore((state) => state.setChannelId);
  const setBotProfileId = useProfileStore((state) => state.setBotProfileId);

  const send = useMessageStore((state) => state.send);
  const resetSendState = useMessageStore((state) => state.resetSendState);

  const [fetchedChannels, setFetchedChannels] = useState<{id: string, name: string}[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState("");
  const [botMessages, setBotMessages] = useState<{id: string, content: string, raw: any}[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    setSendMode(SEND_MODES.BOT);
    void fetchProfiles();
  }, [fetchProfiles, setSendMode]);

  useEffect(() => {
    setIsLoadingChannels(true);
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const adminKey = import.meta.env.VITE_ADMIN_API_KEY || '';
    
    fetch(`${baseUrl}/api/send/channels`, { headers: { 'x-admin-key': adminKey } })
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        setFetchedChannels(data);
        if (data.length > 0 && !channelId) setChannelId(data[0].id);
      }
    })
    .catch(console.error)
    .finally(() => setIsLoadingChannels(false));
  }, [channelId, setChannelId]);

  useEffect(() => {
    if (isEditMode && channelId) {
      setIsLoadingMessages(true);
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const adminKey = import.meta.env.VITE_ADMIN_API_KEY || '';
      
      fetch(`${baseUrl}/api/send/channels/${channelId}/messages`, { headers: { 'x-admin-key': adminKey } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBotMessages(data);
      })
      .catch(console.error)
      .finally(() => setIsLoadingMessages(false));
    }
  }, [isEditMode, channelId]);

// NEW: Auto-load the message into the preview when selected!
  useEffect(() => {
    if (isEditMode && targetMessageId) {
      const selected = botMessages.find(m => m.id === targetMessageId);
      if (selected && selected.raw) {
        const store = useMessageStore.getState();
        const raw = selected.raw;
        
        const genId = () => Math.random().toString(36).substring(2, 9);
        
        const mappedData = {
          content: raw.content || "",
          username: raw.author?.username || "",
          avatar_url: raw.author?.avatar 
            ? `https://cdn.discordapp.com/avatars/${raw.author.id}/${raw.author.avatar}.png` 
            : "",
          thread_name: "",
          embeds: (raw.embeds || []).map((e: any) => ({
            ...e,
            _id: genId(),
            fields: (e.fields || []).map((f: any) => ({ ...f, _id: genId() }))
          })),
          components: (raw.components || []).map((c: any) => ({
            ...c,
            _id: genId(),
            components: (c.components || []).map((child: any) => ({
              ...child,
              _id: genId(),
              options: (child.options || []).map((o: any) => ({ ...o, _id: genId() }))
            }))
          }))
        };

        // FIX: ALWAYS load imported messages as "classic" mode!
        // Discord doesn't save V2 layout blocks (Containers/Sections). 
        // By forcing classic mode, all text, embeds, and action rows become perfectly editable!
        store.load({ 
          data: mappedData as any, 
          mode: "classic" as any 
        });
      }
    }
  }, [targetMessageId, isEditMode, botMessages]);

  return (
    <div className="bg-[#2b2d31] p-4 rounded-lg shadow-sm font-sans flex flex-col gap-4 border border-[#1e1f22]">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-[#dbdee1] uppercase text-xs tracking-wider flex items-center gap-2">
          <span className="bg-[#5865f2] w-2 h-2 rounded-full"></span> Bot Dispatch
        </h3>
        
        <div className="flex bg-[#1e1f22] p-1 rounded-md">
          <button onClick={() => { setIsEditMode(false); setTargetMessageId(""); }} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${!isEditMode ? 'bg-[#5865f2] text-white' : 'text-[#b5bac1] hover:bg-[#313338]'}`}>
            <Plus size={12} /> New
          </button>
          <button onClick={() => setIsEditMode(true)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${isEditMode ? 'bg-[#faa61a] text-white' : 'text-[#b5bac1] hover:bg-[#313338]'}`}>
            <Edit3 size={12} /> Edit
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <Select
          label="Target Channel"
          value={channelId}
          onChange={(event) => setChannelId(event.target.value)}
          options={
            isLoadingChannels
              ? [{ value: "", label: "Loading channels..." }]
              : fetchedChannels.length === 0
              ? [{ value: "", label: "No channels found..." }]
              : [
                  { value: "", label: "Select a channel..." },
                  ...fetchedChannels.map(c => ({ value: c.id, label: `# ${c.name}` }))
                ]
          }
        />

        {isEditMode && (
          <div className="p-3 bg-[#1e1f22] rounded border border-[#faa61a]/30 mb-2">
            <Select
              label="Message to Edit"
              value={targetMessageId}
              onChange={(event) => setTargetMessageId(event.target.value)}
              options={
                isLoadingMessages
                  ? [{ value: "", label: "Fetching recent messages..." }]
                  : botMessages.length === 0
                  ? [{ value: "", label: "No recent messages from bot here." }]
                  : [
                      { value: "", label: "Select a message to edit..." },
                      ...botMessages.map(m => ({
                        value: m.id,
                        label: `${m.content.substring(0, 30)}${m.content.length > 30 ? '...' : ''} (${m.id})`
                      }))
                    ]
              }
            />
            
            {/* NEW: Discord URL Link Parser */}
            <TextField
              label="Manual Message ID or Link"
              value={targetMessageId}
              placeholder="123456789... or https://discord.com/..."
              onChange={(event) => {
                const val = event.target.value;
                const urlMatch = val.match(/\/channels\/\d+\/\d+\/(\d+)/);
                setTargetMessageId(urlMatch ? urlMatch[1] : val);
              }}
            />
          </div>
        )}

        <Select
          label="Bot Token Profile"
          value={String(botProfileId ?? "")}
          onChange={(event) => setBotProfileId(event.target.value ? Number(event.target.value) : null)}
          options={[
            { value: "", label: "Server Default Token (.env)" },
            ...botProfiles.map((profile) => ({ value: String(profile.id), label: profile.name })),
          ]}
        />
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Button
          icon={isEditMode ? Edit3 : Send}
          // NEW: We now pass the editMessageId to the hook!
          onClick={() => void sendMessage(isEditMode ? targetMessageId : undefined)}
          disabled={!isConfigured || (isEditMode && !targetMessageId)}
          loading={send.status === "sending"}
          className={`flex-1 text-white border-none ${isEditMode ? 'bg-[#faa61a] hover:bg-[#e09415]' : 'bg-[#5865f2] hover:bg-[#4752c4]'}`}
        >
          {send.status === "sending" ? "Processing…" : isEditMode ? "Update Message" : "Send via Bot"}
        </Button>
        <Button variant="ghost" icon={RefreshCw} onClick={() => void fetchProfiles()} loading={profilesStatus === "loading"} title="Reload profiles" className="text-[#b5bac1]" />
      </div>

      {!isConfigured && (
        <p className="flex items-start gap-1.5 text-[12px] text-[#faa61a] bg-[#faa61a]/10 p-2 rounded">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          Select a channel ID to enable.
        </p>
      )}

      {send.status === "success" && (
        <p className="flex items-start gap-1.5 rounded bg-[#23a559]/10 px-3 py-2 text-[12px] text-[#23a559]">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          Message {isEditMode ? "updated" : "dispatched"} and flows registered!
        </p>
      )}

      {send.status === "error" && (
        <div className="rounded bg-[#da373c]/10 border border-[#da373c]/20 px-3 py-2">
          <p className="flex items-start gap-1.5 text-[12px] text-[#f28b8b]"><AlertCircle size={14} className="mt-0.5 shrink-0" /> {send.error}</p>
          <button type="button" className="mt-2 text-[11px] text-[#b5bac1] underline" onClick={resetSendState}>Dismiss</button>
        </div>
      )}
    </div>
  );
};

export default SendPanel;