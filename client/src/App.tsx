import { useEffect, useState } from "react";
import { BookOpen, PenTool, Send, Users } from "lucide-react";
import { Header } from "./components/layout/Header";
import { SplitPane } from "./components/layout/SplitPane";
import { MessageEditor } from "./components/editor/MessageEditor";
import { PropertyPanel } from "./components/editor/PropertyPanel";
import { MessagePreview } from "./components/preview/MessagePreview";
import { DocsPage } from "./pages/DocsPage";
import { SendPanel } from "./components/send/SendPanel";
import { ProfilesPanel } from "./components/layout/ProfilesPanel";
import { ComponentPalette } from "./components/editor/ComponentPalette";
import { LayersPanel } from "./components/editor/LayersPanel";
import { useActionStore } from "./store/actionStore";
import { useMessageStore } from "./store/messageStore";

export const App = () => {
  const selection = useMessageStore((state) => state.selection);
  const mode = useMessageStore((state) => state.mode);
  const fetchActionTypes = useActionStore((state) => state.fetchActionTypes);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [activeTab, setActiveTab] = useState<'build' | 'send' | 'profiles'>('build');

  useEffect(() => {
    void fetchActionTypes();
  }, [fetchActionTypes]);

  useEffect(() => {
    const onLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  if (currentPath === "/docs") {
    return <DocsPage />;
  }

  return (
    <div className="flex h-screen flex-col bg-[#313338] text-[#dbdee1] font-sans overflow-hidden">
      <Header />

      <main className="flex min-h-0 flex-1">
        <SplitPane
          initialRatio={0.45}
          left={
            <div className="flex flex-col h-full bg-[#2b2d31] border-r border-[#1e1f22]">
              {/* Top Navigation replacing the old Sidebar */}
              <div className="flex p-2 gap-1 bg-[#2b2d31] border-b border-[#1e1f22] shrink-0">
                <button
                  onClick={() => setActiveTab('build')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'build' ? 'bg-[#5865f2] text-white shadow-sm' : 'text-[#b5bac1] hover:bg-[#1e1f22] hover:text-[#dbdee1]'
                  }`}
                >
                  <PenTool size={14} /> Editor
                </button>
                <button
                  onClick={() => setActiveTab('send')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'send' ? 'bg-[#5865f2] text-white shadow-sm' : 'text-[#b5bac1] hover:bg-[#1e1f22] hover:text-[#dbdee1]'
                  }`}
                >
                  <Send size={14} /> Send
                </button>
                <button
                  onClick={() => setActiveTab('profiles')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'profiles' ? 'bg-[#5865f2] text-white shadow-sm' : 'text-[#b5bac1] hover:bg-[#1e1f22] hover:text-[#dbdee1]'
                  }`}
                >
                  <Users size={14} /> Profiles
                </button>
                <a
                  href="/docs"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] hover:bg-[#1e1f22] hover:text-[#dbdee1] transition-all"
                >
                  <BookOpen size={14} /> Docs
                </a>
              </div>

              {/* Left Column Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {activeTab === 'build' && (
                  <div className="flex flex-col p-4 gap-6">
                    <MessageEditor />
                    
                    {/* Inline Property Panel - Expands vertically like Discohook */}
                    {selection && (
                      <div className="border-t border-[#1e1f22] pt-4 mt-2">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-[11px] font-bold text-[#5865f2] uppercase tracking-wider">Properties</h3>
                            <button onClick={() => useMessageStore.getState().select(null)} className="text-[10px] text-[#949ba4] hover:text-white uppercase font-bold">Close X</button>
                          </div>
                          <PropertyPanel />
                      </div>
                    )}

                    {/* V2 Component Palette (Hidden in Classic Mode) */}
                    {mode === 'v2' && (
                      <div className="border-t border-[#1e1f22] pt-6 flex flex-col gap-6">
                        <div>
                          <h3 className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-3">Add Component</h3>
                          <ComponentPalette />
                        </div>
                        <div>
                          <h3 className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-3">Layer Tree</h3>
                          <LayersPanel />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'send' && <div className="p-4"><SendPanel /></div>}
                {activeTab === 'profiles' && <div className="p-4"><ProfilesPanel /></div>}
              </div>
            </div>
          }
          right={
            <div className="flex min-h-0 flex-1 flex-col bg-[#313338]">
              <MessagePreview />
            </div>
          }
        />
      </main>
    </div>
  );
};

export default App;