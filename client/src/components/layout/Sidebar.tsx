import { useState } from "react";
import {
  Blocks,
  FolderOpen,
  FileText,
  RefreshCw,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { LayersPanel } from "../editor/LayersPanel";
import { useGlobalStore } from "../../store/globalStore";
import { useTemplates } from "../../hooks/useTemplates";

interface SidebarProps {
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<"elements" | "templates">("elements");
  const [layersOpen, setLayersOpen] = useState(true);

  const setIsSidebarOpen = useGlobalStore((state) => state.setIsSidebarOpen);
  const { templates, currentId, loadTemplate, refresh } = useTemplates();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="h-full bg-[#2b2d31] w-full flex flex-col font-sans select-none z-10 shadow-lg">
      {/* Header with Title and Close Button */}
      <div className="p-3 border-b border-[#1e1f22] bg-[#1e1f22] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Blocks size={16} className="text-[#5865f2]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#dbdee1]">
            Toolbox
          </span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2] transition-colors"
          title="Close Toolbox"
          aria-label="Close Toolbox"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex p-2 gap-1 bg-[#1e1f22] border-b border-[#1e1f22] shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("elements")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold transition-all ${
            activeTab === "elements"
              ? "bg-[#5865f2] text-white shadow-sm"
              : "text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]"
          }`}
        >
          <Blocks size={14} /> Elements
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("templates")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold transition-all ${
            activeTab === "templates"
              ? "bg-[#5865f2] text-white shadow-sm"
              : "text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]"
          }`}
        >
          <FolderOpen size={14} /> Templates
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0">
        {activeTab === "elements" && (
          <div className="p-3 space-y-3">
            {/* The Component Palette lives inline in the editor pane now — the drawer
                keeps the layer tree (and templates). */}

            {/* Layers & Hierarchy Collapsible Accordion */}
            <div className="rounded border border-[#1e1f22] bg-[#232428] overflow-hidden">
              <button
                type="button"
                onClick={() => setLayersOpen(!layersOpen)}
                className="w-full flex items-center justify-between p-2.5 bg-[#1e1f22]/60 hover:bg-[#1e1f22] transition-colors text-left"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
                  Layers & Hierarchy
                </span>
                {layersOpen ? (
                  <ChevronDown size={14} className="text-[#949ba4]" />
                ) : (
                  <ChevronRight size={14} className="text-[#949ba4]" />
                )}
              </button>
              {layersOpen && (
                <div className="p-2.5 border-t border-[#1e1f22]">
                  <LayersPanel />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
                Saved Templates ({templates.length})
              </span>
              <button
                type="button"
                onClick={() => void refresh()}
                className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c]"
                title="Refresh templates"
              >
                <RefreshCw size={12} />
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="p-4 border border-dashed border-[#35373c] rounded text-center">
                <p className="text-xs text-[#949ba4]">No templates saved yet.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {templates.map((tpl) => {
                  const isCurrent = tpl.id === currentId;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => void loadTemplate(tpl.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                        isCurrent
                          ? "bg-[#5865f2]/15 border-[#5865f2] text-white"
                          : "bg-[#232428] hover:bg-[#35373c] border-[#1e1f22] text-[#dbdee1]"
                      }`}
                    >
                      <FileText size={15} className={isCurrent ? "text-[#5865f2] mt-0.5" : "text-[#949ba4] mt-0.5"} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate text-[#f2f3f5]">
                          {tpl.name || "Untitled Template"}
                        </p>
                        <p className="text-[10px] text-[#949ba4] mt-0.5">
                          {new Date(tpl.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;