import { useState } from "react";
import {
  Search,
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
  const [templateSearch, setTemplateSearch] = useState("");

  const setIsSidebarOpen = useGlobalStore((state) => state.setIsSidebarOpen);
  const { templates, currentId, loadTemplate, refresh } = useTemplates();

  const filteredTemplates = templates.filter((template) =>
    (template.name || "Untitled Template").toLowerCase().includes(templateSearch.trim().toLowerCase()),
  );

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="h-full w-full max-w-[260px] border-r border-[#272D3A] bg-[#10131A] flex flex-col font-sans select-none z-10">
      {/* Header with Title and Close Button */}
      <div className="px-4 py-3 border-b border-[#272D3A] bg-[#10131A] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Blocks size={16} className="text-[#818CF8]" />
          <span className="text-[12px] font-semibold text-[#F1F3F9]">
            Toolbox
          </span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-1 rounded text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8] transition-colors"
          title="Close Toolbox"
          aria-label="Close Toolbox"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex p-2 gap-1 bg-[#10131A] border-b border-[#272D3A] shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("elements")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition-[background-color,color,box-shadow] duration-150 ${
            activeTab === "elements"
              ? "bg-[#818CF8]/15 text-[#F1F3F9] border border-[#818CF8]/25"
              : "text-[#A1A8B8] hover:bg-[#252B3A] hover:text-[#F1F3F9]"
          }`}
        >
          <Blocks size={14} /> Elements
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("templates")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold transition-[background-color,border-color,color] duration-150 ease-out ${
            activeTab === "templates"
              ? "bg-[#818CF8] text-white shadow-sm"
              : "text-[#A1A8B8] hover:bg-[#252B3A] hover:text-[#F1F3F9]"
          }`}
        >
          <FolderOpen size={14} /> Templates
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0">
        {activeTab === "elements" && (
          <div className="p-3 space-y-3">
            {/* The Component Palette lives inline in the editor pane now  the drawer
                keeps the layer tree (and templates). */}

            {/* Layers & Hierarchy Collapsible Accordion */}
            <div className="rounded border border-[#10131A] bg-[#161A23] overflow-hidden">
              <button
                type="button"
                onClick={() => setLayersOpen(!layersOpen)}
                className="w-full flex items-center justify-between p-2.5 bg-[#10131A]/60 hover:bg-[#10131A] transition-colors text-left"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A8B8]">
                  Layers & Hierarchy
                </span>
                {layersOpen ? (
                  <ChevronDown size={14} className="text-[#A1A8B8]" />
                ) : (
                  <ChevronRight size={14} className="text-[#A1A8B8]" />
                )}
              </button>
              {layersOpen && (
                <div className="p-2.5 border-t border-[#10131A]">
                  <LayersPanel />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="p-3 space-y-3">
            <label className="relative block">
              <Search size={13} className="absolute left-2.5 top-2.5 text-[#6F788A]" aria-hidden="true" />
              <input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="Search templates..." className="h-8 w-full rounded-[8px] border border-[#272D3A] bg-[#1D2230] pl-8 pr-3 text-xs text-[#F1F3F9] placeholder:text-[#6F788A] outline-none focus:border-[#818CF8]" />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A8B8]">
                Saved Templates ({filteredTemplates.length})
              </span>
              <button
                type="button"
                onClick={() => void refresh()}
                className="p-1 rounded text-[#A1A8B8] hover:text-white hover:bg-[#252B3A]"
                title="Refresh templates"
              >
                <RefreshCw size={12} />
              </button>
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="p-4 border border-dashed border-[#252B3A] rounded text-center">
                <p className="text-xs text-[#A1A8B8]">{templateSearch ? "No matching templates." : "No templates saved yet."}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredTemplates.map((tpl) => {
                  const isCurrent = tpl.id === currentId;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => void loadTemplate(tpl.id)}
                      className={`w-full text-left min-h-[40px] p-2.5 rounded-[8px] border transition-colors duration-150 flex items-start gap-2.5 ${
                        isCurrent
                          ? "bg-[#818CF8]/10 border-[#818CF8] border-l-2 text-[#F1F3F9]"
                          : "bg-[#161A23] hover:bg-[#252B3A] border-[#10131A] text-[#F1F3F9]"
                      }`}
                    >
                      <FileText size={15} className={isCurrent ? "text-[#818CF8] mt-0.5" : "text-[#A1A8B8] mt-0.5"} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate text-[#F1F3F9]">
                          {tpl.name || "Untitled Template"}
                        </p>
                        <p className="text-[10px] text-[#A1A8B8] mt-0.5">
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