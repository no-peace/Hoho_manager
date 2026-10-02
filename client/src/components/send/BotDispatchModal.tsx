import { useEffect, useState } from "react";
import { Bot, CheckSquare, Server, Square, Edit3, Send } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Select, TextField } from "../ui/Field";
import { useProfileStore } from "../../store/profileStore";
import { useMessageStore } from "../../store/messageStore";
import { useActionStore } from "../../store/actionStore";

export const BotDispatchModal = ({ 
  open, 
  onClose, 
  initialMode = 'send' 
}: { 
  open: boolean; 
  onClose: () => void;
  initialMode?: 'send' | 'edit';
}) => {
  const botProfiles = useProfileStore((state) => state.botProfiles);
  const fetchProfiles = useProfileStore((state) => state.fetchProfiles);
  const botProfileId = useProfileStore((state) => state.botProfileId);
  const setBotProfileId = useProfileStore((state) => state.setBotProfileId);

  const [mode, setMode] = useState<'send' | 'edit'>(initialMode);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  
  const [selectedChannels, setSelectedChannels] = useState<string[]>(() => 
    JSON.parse(localStorage.getItem('bot_selected_channels') || '[]')
  );

  // Cached Bot Identities
  const [identities, setIdentities] = useState<Record<string, {name: string, avatar: string}>>(() => 
    JSON.parse(localStorage.getItem('bot_identities_cache') || '{}')
  );

  const [botMessages, setBotMessages] = useState<{id: string, content: string}[]>([]);
  const [targetMessageId, setTargetMessageId] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  useEffect(() => {
    localStorage.setItem('bot_selected_channels', JSON.stringify(selectedChannels));
  }, [selectedChannels]);

  useEffect(() => {
    if (open) {
      void fetchProfiles();
      setSendResult(null);
      
      const cachedBot = localStorage.getItem('bot_selected_profile');
      const initialId = cachedBot !== null && botProfileId === null ? (cachedBot === "default" ? null : Number(cachedBot)) : botProfileId;
      
      setBotProfileId(initialId);
      fetchIdentity(initialId);
      fetchChannels(initialId);
    }
  }, [open]);

  useEffect(() => {
    if (mode === 'edit' && selectedChannels.length === 1) {
      fetchRecentMessages(selectedChannels[0], botProfileId);
    } else {
      setBotMessages([]);
    }
  }, [mode, selectedChannels, botProfileId]);

  const handleBotSelect = (id: number | null) => {
    setBotProfileId(id);
    localStorage.setItem('bot_selected_profile', id === null ? "default" : String(id));
    fetchIdentity(id);
    fetchChannels(id);
    setSelectedChannels([]); // Reset channels on bot change to prevent permission errors
  };

  const fetchIdentity = async (id: number | null) => {
    const key = id === null ? 'default' : String(id);
    if (identities[key]) return; // Skip if already cached

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const adminKey = import.meta.env.VITE_ADMIN_API_KEY || "";
      const qs = id ? `?profileId=${id}` : '';
      const res = await fetch(`${baseUrl}/api/send/identity${qs}`, { headers: { "x-admin-key": adminKey } });
      const data = await res.json();
      
      if (data && data.name) {
        const newCache = { ...identities, [key]: data };
        setIdentities(newCache);
        localStorage.setItem('bot_identities_cache', JSON.stringify(newCache));
      }
    } catch (e) {
      console.error("Failed to fetch bot identity", e);
    }
  };

  const fetchChannels = async (id: number | null) => {
    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const adminKey = import.meta.env.VITE_ADMIN_API_KEY || "";
      const qs = id ? `?profileId=${id}` : '';
      const res = await fetch(`${baseUrl}/api/send/channels${qs}`, { headers: { "x-admin-key": adminKey } });
      const data = await res.json();
      if (Array.isArray(data)) setChannels(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentMessages = async (cId: string, profileId: number | null) => {
    setIsLoadingMessages(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const adminKey = import.meta.env.VITE_ADMIN_API_KEY || "";
      const qs = profileId ? `?profileId=${profileId}` : '';
      const res = await fetch(`${baseUrl}/api/send/channels/${cId}/messages${qs}`, { headers: { "x-admin-key": adminKey } });
      const data = await res.json();
      if (Array.isArray(data)) setBotMessages(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const toggleChannel = (id: string) => {
    if (mode === 'edit') {
      setSelectedChannels([id]); 
    } else {
      setSelectedChannels((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
    }
  };

  const handleDispatch = async () => {
    if (selectedChannels.length === 0) return;
    if (mode === 'edit' && !targetMessageId) return;

    setIsSending(true);
    setSendResult(null);
    try {
      const payload = useMessageStore.getState().getPayload();
      const flows = useActionStore.getState().toRegistrations();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const adminKey = import.meta.env.VITE_ADMIN_API_KEY || "";

      let successCount = 0;
      for (const cId of selectedChannels) {
        const res = await fetch(`${baseUrl}/api/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
          body: JSON.stringify({
            mode: "bot",
            payload,
            channelId: cId,
            profileId: botProfileId,
            flows,
            editMessageId: mode === 'edit' ? targetMessageId : undefined
          }),
        });
        if (res.ok) successCount++;
      }
      setSendResult(`Successfully ${mode === 'edit' ? 'updated message' : `dispatched to ${successCount} channel(s)`}.`);
      if (successCount === selectedChannels.length) {
        setTimeout(() => onClose(), 2000);
      }
    } catch (e) {
      setSendResult("An error occurred while communicating with the server.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Dispatch via Bot`} width="max-w-2xl">
      <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 120px)' }}>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-6 min-h-0">
          
          <div className="flex bg-[#1e1f22] p-1 rounded-md border border-[#111214] shrink-0 mt-1">
            <button onClick={() => setMode('send')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-[11px] font-bold uppercase transition-all ${mode === 'send' ? 'bg-[#5865f2] text-white shadow-sm' : 'text-[#b5bac1] hover:bg-[#2b2d31]'}`}>
              <Send size={14} /> Send New Message
            </button>
            <button onClick={() => setMode('edit')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-[11px] font-bold uppercase transition-all ${mode === 'edit' ? 'bg-[#faa61a] text-white shadow-sm' : 'text-[#b5bac1] hover:bg-[#2b2d31]'}`}>
              <Edit3 size={14} /> Edit Existing
            </button>
          </div>

          <div>
            <div className="flex justify-between items-end mb-2">
              <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase">1. Select Bot Identity</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
              
              {/* Default Token */}
              <div onClick={() => handleBotSelect(null)} className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-all ${botProfileId === null ? 'border-[#5865f2] bg-[#5865f2]/10' : 'border-[#1e1f22] bg-[#1e1f22] hover:border-[#35373c]'}`}>
                {identities['default']?.avatar ? (
                  <img src={identities['default'].avatar} alt="Bot" className="w-10 h-10 rounded-full shadow-sm object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center text-white shrink-0 shadow-sm"><Server size={20} /></div>
                )}
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white truncate">{identities['default'] ? identities['default'].name : "Server Default"}</p>
                  <p className="text-[11px] text-[#949ba4] truncate">Uses primary .env token</p>
                </div>
              </div>
              
              {/* Database Profiles */}
              {botProfiles.map(p => {
                const iden = identities[String(p.id)];
                return (
                  <div key={p.id} onClick={() => handleBotSelect(p.id)} className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-all ${botProfileId === p.id ? 'border-[#5865f2] bg-[#5865f2]/10' : 'border-[#1e1f22] bg-[#1e1f22] hover:border-[#35373c]'}`}>
                    {iden?.avatar ? (
                      <img src={iden.avatar} alt="Bot" className="w-10 h-10 rounded-full shadow-sm object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#23a559] flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden">
                         <Bot size={20} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-white truncate">{iden ? iden.name : p.name}</p>
                      <p className="text-[11px] text-[#949ba4] truncate">ID: {p.application_id || 'Custom'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-2">
              <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase">2. Select Target Channel{mode === 'send' ? 's' : ''}</h4>
              {mode === 'send' && (
                <div className="flex gap-3">
                  <button onClick={() => setSelectedChannels(channels.map(c => c.id))} className="text-[11px] font-bold text-[#5865f2] hover:underline uppercase tracking-wide">Select All</button>
                  <button onClick={() => setSelectedChannels([])} className="text-[11px] font-bold text-[#f28b8b] hover:underline uppercase tracking-wide">Clear</button>
                </div>
              )}
            </div>
            
            <div className="bg-[#1e1f22] border border-[#111214] rounded-lg p-2 max-h-48 overflow-y-auto custom-scrollbar shrink-0">
              {isLoading ? (
                <div className="flex h-16 items-center justify-center text-sm text-[#949ba4]">Fetching channels...</div>
              ) : channels.length === 0 ? (
                <div className="flex h-16 items-center justify-center text-sm text-[#949ba4]">No channels found.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {channels.map((c) => {
                    const isChecked = selectedChannels.includes(c.id);
                    return (
                      <div key={c.id} onClick={() => toggleChannel(c.id)} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isChecked ? 'bg-[#35373c]' : 'hover:bg-[#2b2d31]'}`}>
                        {isChecked ? <CheckSquare size={16} className="text-[#5865f2]" /> : <Square size={16} className="text-[#949ba4]" />}
                        <span className={`text-[13px] font-medium ${isChecked ? 'text-white' : 'text-[#dbdee1]'}`}># {c.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {mode === 'edit' && (
            <div className="bg-[#2b2d31] rounded-lg shrink-0 pb-2">
              <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase mb-2">3. Select Message to Edit</h4>
              <div className="flex flex-col sm:flex-row gap-2 items-start">
                <div className="flex-1 w-full">
                  <Select
                    value={targetMessageId}
                    onChange={(e) => setTargetMessageId(e.target.value)}
                    options={
                      isLoadingMessages ? [{ value: "", label: "Fetching recent messages..." }]
                      : botMessages.length === 0 ? [{ value: "", label: "No recent messages found." }]
                      : [{ value: "", label: "Select a message..." }, ...botMessages.map(m => ({ value: m.id, label: `${m.content.substring(0, 30)} (${m.id})` }))]
                    }
                  />
                </div>
                <div className="flex-1 w-full">
                  <TextField
                    value={targetMessageId}
                    placeholder="Or paste Message ID/Link"
                    onChange={(e) => {
                      const val = e.target.value;
                      const urlMatch = val.match(/\/channels\/\d+\/\d+\/(\d+)/);
                      setTargetMessageId(urlMatch ? urlMatch[1] : val);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#1e1f22] pt-4 mt-2 shrink-0 bg-[#313338]">
          <div className="text-[12px] font-medium text-[#23a559] truncate pr-4">{sendResult && sendResult}</div>
          <div className="flex gap-2 ml-auto shrink-0">
            <Button variant="secondary" onClick={onClose} className="bg-[#1e1f22] text-[#b5bac1] hover:text-white border-[#111214]">Cancel</Button>
            <Button 
              className={`${mode === 'edit' ? 'bg-[#faa61a] hover:bg-[#e09415]' : 'bg-[#5865f2] hover:bg-[#4752c4]'} text-white border-none flex items-center gap-2`} 
              onClick={handleDispatch}
              loading={isSending}
              disabled={selectedChannels.length === 0 || isSending || (mode === 'edit' && !targetMessageId)}
            >
              {mode === 'edit' ? <><Edit3 size={16} /> Update Message</> : <><Send size={16} /> Dispatch to {selectedChannels.length}</>}
            </Button>
          </div>
        </div>

      </div>
    </Modal>
  );
};