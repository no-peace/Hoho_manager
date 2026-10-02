import { useEffect, useState, useRef } from "react";
import { ChevronDown, ChevronRight, Bot } from "lucide-react";
import { Header } from "./components/layout/Header";
import { SplitPane } from "./components/layout/SplitPane";
import { MessageEditor } from "./components/editor/MessageEditor";
import { MessagePreview } from "./components/preview/MessagePreview";
import { DocsPage } from "./pages/DocsPage";
import { ProfilesPanel } from "./components/layout/ProfilesPanel";
import { ComponentPalette } from "./components/editor/ComponentPalette";
import { LayersPanel } from "./components/editor/LayersPanel";
import { BotDispatchModal } from "./components/send/BotDispatchModal";
import { useActionStore } from "./store/actionStore";
import { useMessageStore } from "./store/messageStore";
import { useProfileStore } from "./store/profileStore";
import { useSend } from "./hooks/useSend";
import { SEND_MODES } from "./utils/constants";

// Discohook Accordion
const Accordion = ({ title, children, defaultOpen = false, muted = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean, muted?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#1e1f22]">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#35373c] transition-colors text-left focus:outline-none"
      >
        {open ? <ChevronDown size={14} className="text-[#949ba4]" /> : <ChevronRight size={14} className="text-[#949ba4]" />}
        <span className={`font-bold text-[13px] ${muted ? 'text-[#949ba4]' : 'text-white'}`}>{title}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

export const App = () => {
  const mode = useMessageStore((state) => state.mode);
  const fetchActionTypes = useActionStore((state) => state.fetchActionTypes);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');
  
  // Modal & Dropdown States
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [botModalMode, setBotModalMode] = useState<'send' | 'edit'>('send');
  const [webhookDropOpen, setWebhookDropOpen] = useState(false);
  const [botDropOpen, setBotDropOpen] = useState(false);
  
  // Hooks
  const webhookUrl = useProfileStore((state) => state.webhookUrl);
  const setWebhookUrl = useProfileStore((state) => state.setWebhookUrl);
  const setSendMode = useProfileStore((state) => state.setSendMode);
  const { sendMessage } = useSend();

  const webhookRef = useRef<HTMLDivElement>(null);
  const botRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (webhookRef.current && !webhookRef.current.contains(e.target as Node)) setWebhookDropOpen(false);
      if (botRef.current && !botRef.current.contains(e.target as Node)) setBotDropOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => { void fetchActionTypes(); }, [fetchActionTypes]);
  useEffect(() => {
    const onLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  const handleWebhook = async (actionMode: 'send' | 'edit') => {
    setWebhookDropOpen(false);
    if (!webhookUrl) return alert("Please enter a Webhook URL first.");
    setSendMode(SEND_MODES.WEBHOOK);
    if (actionMode === 'send') {
      await sendMessage();
    } else {
      const msgId = prompt("Enter the Webhook Message ID to edit:");
      if (msgId) await sendMessage(msgId);
    }
  };

  const openBotModal = (actionMode: 'send' | 'edit') => {
    setBotDropOpen(false);
    setBotModalMode(actionMode);
    setBotModalOpen(true);
  };

  if (currentPath === "/docs") return <DocsPage />;

  return (
    <div className="flex h-screen flex-col bg-[#313338] text-[#dbdee1] font-sans overflow-hidden">
      <Header />

      <div className="md:hidden flex bg-[#2b2d31] border-b border-[#1e1f22] shrink-0 p-2 gap-2">
        <button onClick={() => setMobileView('editor')} className={`flex-1 py-1.5 rounded text-[13px] font-bold transition-colors ${mobileView === 'editor' ? 'bg-[#5865f2] text-white' : 'bg-[#35373c] text-[#b5bac1] hover:text-white'}`}>Editor</button>
        <button onClick={() => setMobileView('preview')} className={`flex-1 py-1.5 rounded text-[13px] font-bold transition-colors ${mobileView === 'preview' ? 'bg-[#5865f2] text-white' : 'bg-[#35373c] text-[#b5bac1] hover:text-white'}`}>Preview</button>
      </div>

      <main className="flex min-h-0 flex-1">
        <SplitPane
          initialRatio={0.45}
          left={
            <div className={`${mobileView === 'editor' ? 'flex' : 'hidden'} md:flex flex-col h-full bg-[#2b2d31] border-r border-[#1e1f22] w-full`}>
              
              <div className="p-3 border-b border-[#1e1f22] flex flex-col gap-3 shrink-0 bg-[#2b2d31]">
                <div className="flex gap-2">
                  <button className="bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] px-3.5 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors">Share</button>
                  <button className="bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] px-3.5 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors">Backups</button>
                  <button onClick={() => { useMessageStore.getState().reset(); useActionStore.getState().reset(); }} className="bg-[#35373c] hover:bg-[#da373c] text-[#dbdee1] hover:text-white px-3.5 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors">Clear All</button>
                </div>
                
                <div className="flex gap-2 items-center flex-wrap relative">
                  <input
                    className="bg-[#1e1f22] border border-[#111214] text-[#dbdee1] text-[13px] px-3 py-1.5 rounded-[4px] w-64 outline-none focus:border-[#5865f2]"
                    placeholder="Webhook URL"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                  
                  {/* WEBHOOK SPLIT BUTTON */}
                  <div className="relative flex shadow-sm" ref={webhookRef}>
                    <button onClick={() => handleWebhook('send')} className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-4 py-1.5 text-[13px] font-medium transition-colors rounded-l-[4px]">
                      Send
                    </button>
                    <div className="w-[1px] bg-[#4752c4]"></div>
                    <button onClick={() => setWebhookDropOpen(!webhookDropOpen)} className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-1.5 flex items-center justify-center transition-colors rounded-r-[4px]">
                      <ChevronDown size={16} />
                    </button>
                    {webhookDropOpen && (
                      <div className="absolute top-full left-0 mt-1 w-32 bg-[#1e1f22] border border-[#111214] rounded shadow-lg z-50 py-1">
                        <button onClick={() => handleWebhook('edit')} className="w-full text-left px-3 py-1.5 text-[13px] text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors">
                          Edit Message
                        </button>
                      </div>
                    )}
                  </div>

                  {/* BOT SPLIT BUTTON */}
                  <div className="relative flex shadow-sm" ref={botRef}>
                    <button onClick={() => openBotModal('send')} className="bg-[#23a559] hover:bg-[#1da24a] text-white px-4 py-1.5 text-[13px] font-medium transition-colors rounded-l-[4px] flex items-center gap-1.5">
                      <Bot size={16} /> Send via Bot
                    </button>
                    <div className="w-[1px] bg-[#1da24a]"></div>
                    <button onClick={() => setBotDropOpen(!botDropOpen)} className="bg-[#23a559] hover:bg-[#1da24a] text-white px-1.5 flex items-center justify-center transition-colors rounded-r-[4px]">
                      <ChevronDown size={16} />
                    </button>
                    {botDropOpen && (
                      <div className="absolute top-full left-0 mt-1 w-36 bg-[#1e1f22] border border-[#111214] rounded shadow-lg z-50 py-1">
                        <button onClick={() => openBotModal('edit')} className="w-full text-left px-3 py-1.5 text-[13px] text-[#dbdee1] hover:bg-[#faa61a] hover:text-white transition-colors">
                          Edit Message
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <Accordion title="Message 1" defaultOpen={true}>
                  <MessageEditor />
                </Accordion>
                <Accordion title="Thread" defaultOpen={false}>
                   <div className="text-[12px] text-[#949ba4] italic p-2 border border-dashed border-[#35373c] rounded text-center">
                     Thread configuration coming soon...
                   </div>
                </Accordion>
                <Accordion title="Profile" defaultOpen={false}>
                  <ProfilesPanel />
                </Accordion>
                <Accordion title="Attachments (0/10)" defaultOpen={false}>
                   <div className="flex gap-2">
                     <button className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-3.5 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors">Add File</button>
                     <button className="bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] px-3.5 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors">Paste File</button>
                   </div>
                </Accordion>

                {mode === 'v2' && (
                  <Accordion title="Interactive Components (HoHo Engine)" defaultOpen={true} muted={true}>
                    <div className="flex flex-col gap-4">
                      <ComponentPalette />
                      <div className="mt-2 border-t border-[#1e1f22] pt-4">
                        <LayersPanel />
                      </div>
                    </div>
                  </Accordion>
                )}
              </div>
            </div>
          }
          right={
            <div className={`${mobileView === 'preview' ? 'flex' : 'hidden'} md:flex min-h-0 flex-1 flex-col bg-[#313338] relative`}>
              <MessagePreview />
            </div>
          }
        />
      </main>

      <BotDispatchModal open={botModalOpen} onClose={() => setBotModalOpen(false)} initialMode={botModalMode} />
    </div>
  );
};

export default App;