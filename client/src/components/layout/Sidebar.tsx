import { useState } from "react";
import { Blocks, Send, Users, BookOpen } from "lucide-react";
import { ComponentPalette } from "../editor/ComponentPalette";
import { LayersPanel } from "../editor/LayersPanel";
import { SendPanel } from "../send/SendPanel";
import { ProfilesPanel } from "./ProfilesPanel";

export const Sidebar = () => {
  const [activeTab, setActiveTab] = useState<'build' | 'send' | 'profiles'>('build');

  return (
    <div className="w-80 h-screen bg-[#2b2d31] border-r border-[#1e1f22] flex flex-col shadow-lg z-10 font-sans">
      <div className="h-14 flex items-center px-4 border-b border-[#1e1f22] bg-[#2b2d31]">
        <h1 className="text-white font-bold text-[15px] flex items-center gap-2">
          <Blocks size={18} className="text-[#5865f2]" />
          Discohook Hybrid
        </h1>
      </div>

      <div className="flex p-2 gap-1 bg-[#1e1f22]">
        <button 
          onClick={() => setActiveTab('build')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-[11px] uppercase font-bold tracking-wide transition-all ${activeTab === 'build' ? 'bg-[#5865f2] text-white' : 'text-[#b5bac1] hover:bg-[#2b2d31] hover:text-[#dbdee1]'}`}
        >
          <Blocks size={14} /> Build
        </button>
        <button 
          onClick={() => setActiveTab('send')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-[11px] uppercase font-bold tracking-wide transition-all ${activeTab === 'send' ? 'bg-[#5865f2] text-white' : 'text-[#b5bac1] hover:bg-[#2b2d31] hover:text-[#dbdee1]'}`}
        >
          <Send size={14} /> Send
        </button>
        <button 
          onClick={() => setActiveTab('profiles')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-[11px] uppercase font-bold tracking-wide transition-all ${activeTab === 'profiles' ? 'bg-[#5865f2] text-white' : 'text-[#b5bac1] hover:bg-[#2b2d31] hover:text-[#dbdee1]'}`}
        >
          <Users size={14} /> Profs
        </button>
        
        {/* FIXED: This is now a real link to the /docs URL! */}
        <a 
          href="/docs"
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-[11px] uppercase font-bold tracking-wide text-[#b5bac1] hover:bg-[#2b2d31] hover:text-[#dbdee1] transition-all"
        >
          <BookOpen size={14} /> Docs
        </a>
      </div>

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
          <SendPanel />
        </div>
        <div className={`p-4 h-full ${activeTab === 'profiles' ? 'block' : 'hidden'}`}>
          <ProfilesPanel />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;