import { useState } from "react";
import { Blocks, BookOpen, Send, Users } from "lucide-react";
import { ComponentPalette } from "../editor/ComponentPalette";
import { LayersPanel } from "../editor/LayersPanel";
import { BotDispatchModal } from "../send/BotDispatchModal";
import { ProfilesPanel } from "./ProfilesPanel";

export const Sidebar = () => {
  const [activeTab, setActiveTab] = useState<'build' | 'send' | 'profiles'>('build');
  const [sendModalOpen, setSendModalOpen] = useState(false);

  return (
    <div className="w-80 h-full bg-[#2b2d31] border-r border-[#1e1f22] flex flex-col shadow-lg z-10 font-sans shrink-0">
      {/* Tab Navigation Rail */}
      <div className="flex p-2 gap-1 bg-[#1e1f22] border-b border-[#111214]">
        <button
          onClick={() => setActiveTab('build')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-[11px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'build' ? 'bg-[#5865f2] text-white shadow-sm' : 'text-[#b5bac1] hover:bg-[#2b2d31] hover:text-[#dbdee1]'
          }`}
        >
          <Blocks size={14} /> Build
        </button>
        <button
          onClick={() => setActiveTab('send')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-[11px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'send' ? 'bg-[#5865f2] text-white shadow-sm' : 'text-[#b5bac1] hover:bg-[#2b2d31] hover:text-[#dbdee1]'
          }`}
        >
          <Send size={14} /> Send
        </button>
        <button
          onClick={() => setActiveTab('profiles')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-[11px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'profiles' ? 'bg-[#5865f2] text-white shadow-sm' : 'text-[#b5bac1] hover:bg-[#2b2d31] hover:text-[#dbdee1]'
          }`}
        >
          <Users size={14} /> Profs
        </button>
        <a
          href="/docs"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] hover:bg-[#2b2d31] hover:text-[#dbdee1] transition-all"
        >
          <BookOpen size={14} /> Docs
        </a>
      </div>

      {/* Tab Content Panels */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative">
        <div className={`flex flex-col h-full ${activeTab === 'build' ? 'flex' : 'hidden'}`}>
          <div className="p-4 shrink-0 border-b border-[#1e1f22]">
            <ComponentPalette />
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <LayersPanel />
          </div>
        </div>

        <div className={`p-4 h-full ${activeTab === 'send' ? 'block' : 'hidden'}`}>
          <button
            type="button"
            onClick={() => setSendModalOpen(true)}
            className="flex items-center gap-2 rounded bg-[#5865f2] px-3 py-2 text-sm font-medium text-white hover:bg-[#4752c4]"
          >
            <Send size={14} /> Send via bot
          </button>
          <BotDispatchModal
            open={sendModalOpen}
            onClose={() => setSendModalOpen(false)}
          />
        </div>

        <div className={`p-4 h-full ${activeTab === 'profiles' ? 'block' : 'hidden'}`}>
          <ProfilesPanel />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;