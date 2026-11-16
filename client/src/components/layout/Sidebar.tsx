import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Blocks,
  FolderOpen,
  FileText,
  RefreshCw,
  X,
  ChevronDown,
  ChevronRight,
  Radio,
  Workflow,
  Layers,
} from "lucide-react";
import { LayersPanel } from "../editor/LayersPanel";
import { useGlobalStore } from "../../store/globalStore";
import { useActionStore } from "../../store/actionStore";
import { useTemplates } from "../../hooks/useTemplates";
import { api } from "../../api/client";

interface SidebarProps {
  onClose?: () => void;
}

type SidebarTab = "templates" | "tracked" | "actions";

interface TrackedMessage {
  id: number;
  channelId: string;
  messageId: string;
  name: string | null;
  exploitName: string | null;
  updatedAt: string;
  expiresAt: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>("templates");
  const [layersOpen, setLayersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [trackedMessages, setTrackedMessages] = useState<TrackedMessage[]>([]);
  const [trackedLoading, setTrackedLoading] = useState(false);
  const [trackedError, setTrackedError] = useState<string | null>(null);

  const setIsSidebarOpen = useGlobalStore((state) => state.setIsSidebarOpen);
  const { templates, currentId, loadTemplate, refresh } = useTemplates();
  const flows = useActionStore((state) => state.flows);

  const handleClose = () => {
    if (onClose) onClose();
    else setIsSidebarOpen(false);
  };

  const loadTrackedMessages = useCallback(async () => {
    setTrackedLoading(true);
    setTrackedError(null);
    try {
      const response = await api.tracking.list();
      setTrackedMessages((response.messages ?? []) as TrackedMessage[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load tracked messages.";
      setTrackedError(message);
      setTrackedMessages([]);
    } finally {
      setTrackedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "tracked") void loadTrackedMessages();
  }, [activeTab, loadTrackedMessages]);

  const filteredTemplates = useMemo(
    () => templates.filter((template) =>
      (template.name || "Untitled Template").toLowerCase().includes(search.trim().toLowerCase()),
    ),
    [templates, search],
  );

  const filteredTracked = useMemo(
    () => trackedMessages.filter((item) =>
      [item.name, item.exploitName, item.channelId, item.messageId]
        .some((value) => String(value ?? "").toLowerCase().includes(search.trim().toLowerCase())),
    ),
    [trackedMessages, search],
  );

  const filteredActions = useMemo(
    () => Object.entries(flows)
      .filter(([customId, steps]) =>
        steps.length > 0 && customId.toLowerCase().includes(search.trim().toLowerCase()),
      )
      .sort(([a], [b]) => a.localeCompare(b)),
    [flows, search],
  );

  const tabs: { id: SidebarTab; label: string; icon: typeof FolderOpen; count: number }[] = [
    { id: "templates", label: "Templates", icon: FolderOpen, count: templates.length },
    { id: "tracked", label: "Tracked", icon: Radio, count: trackedMessages.length },
    { id: "actions", label: "Actions", icon: Workflow, count: Object.values(flows).filter((steps) => steps.length > 0).length },
  ];

  return (
    <div className="flex h-full w-full max-w-[260px] select-none flex-col border-r border-[#272D3A] bg-[#10131A] font-sans">
      <div className="flex shrink-0 items-center justify-between border-b border-[#272D3A] px-4 py-3">
        <div className="flex items-center gap-2">
          <Blocks size={16} className="text-[#818CF8]" />
          <span className="text-[12px] font-semibold text-[#F1F3F9]">Workspace</span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="rounded p-1 text-[#A1A8B8] transition-colors hover:bg-[#252B3A] hover:text-[#F1F3F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8]"
          title="Close Workspace"
          aria-label="Close Workspace"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-1 border-b border-[#272D3A] bg-[#10131A] p-2">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setActiveTab(id); setSearch(""); }}
            aria-pressed={activeTab === id}
            className={`flex min-w-0 items-center justify-center gap-1 rounded-md px-1.5 py-2 text-[10px] font-semibold transition-colors ${
              activeTab === id
                ? "border border-[#818CF8]/25 bg-[#818CF8]/15 text-[#A5B4FC]"
                : "text-[#A1A8B8] hover:bg-[#252B3A] hover:text-[#F1F3F9]"
            }`}
          >
            <Icon size={12} />
            <span>{label}</span>
            <span className="font-mono text-[9px] opacity-70">{count}</span>
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 space-y-2 border-b border-[#202531] p-3">
          <label className="relative block">
            <Search size={13} className="absolute left-2.5 top-2.5 text-[#6F788A]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${activeTab}…`}
              aria-label={`Search ${activeTab}`}
              className="h-8 w-full rounded-[8px] border border-[#272D3A] bg-[#1D2230] pl-8 pr-3 text-xs text-[#F1F3F9] outline-none placeholder:text-[#6F788A] focus:border-[#818CF8]"
            />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">
              {activeTab === "templates" ? "Saved Templates" : activeTab === "tracked" ? "Tracked Messages" : "Attached Action Flows"}
            </span>
            {activeTab === "templates" ? (
              <button type="button" onClick={() => void refresh()} className="rounded p-1 text-[#A1A8B8] hover:bg-[#252B3A] hover:text-white" title="Refresh templates" aria-label="Refresh templates">
                <RefreshCw size={12} />
              </button>
            ) : activeTab === "tracked" ? (
              <button type="button" onClick={() => void loadTrackedMessages()} disabled={trackedLoading} className="rounded p-1 text-[#A1A8B8] hover:bg-[#252B3A] hover:text-white disabled:opacity-50" title="Refresh tracked messages" aria-label="Refresh tracked messages">
                <RefreshCw size={12} className={trackedLoading ? "animate-spin" : ""} />
              </button>
            ) : (
              <span className="font-mono text-[10px] text-[#6F788A]">{filteredActions.length}</span>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 custom-scrollbar">
          {activeTab === "templates" && (
            filteredTemplates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#272D3A] p-4 text-center">
                <FileText size={18} className="mx-auto text-[#6F788A]" />
                <p className="mt-2 text-xs text-[#A1A8B8]">{search ? "No matching templates." : "No templates saved yet."}</p>
              </div>
            ) : filteredTemplates.map((template) => {
              const isCurrent = template.id === currentId;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => void loadTemplate(template.id)}
                  aria-current={isCurrent ? "true" : undefined}
                  className={`flex min-h-[40px] w-full items-start gap-2.5 rounded-[8px] border p-2.5 text-left transition-colors ${
                    isCurrent ? "border-[#818CF8] border-l-2 bg-[#818CF8]/10 text-[#F1F3F9]" : "border-[#202531] bg-[#161A23] text-[#F1F3F9] hover:border-[#343C4E] hover:bg-[#1D2230]"
                  }`}
                >
                  <FileText size={14} className={`mt-0.5 shrink-0 ${isCurrent ? "text-[#818CF8]" : "text-[#A1A8B8]"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{template.name || "Untitled Template"}</span>
                    <span className="mt-0.5 block text-[10px] text-[#6F788A]">{new Date(template.updated_at).toLocaleDateString()}</span>
                  </span>
                </button>
              );
            })
          )}

          {activeTab === "tracked" && (
            trackedLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#A1A8B8]"><RefreshCw size={14} className="animate-spin text-[#818CF8]" />Loading tracked messages…</div>
            ) : trackedError ? (
              <div className="rounded-lg border border-[#F87171]/25 bg-[#F87171]/5 p-3 text-xs text-[#FCA5A5]">{trackedError}</div>
            ) : filteredTracked.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#272D3A] p-4 text-center">
                <Radio size={18} className="mx-auto text-[#6F788A]" />
                <p className="mt-2 text-xs text-[#A1A8B8]">{search ? "No matching tracked messages." : "No messages are being tracked."}</p>
              </div>
            ) : filteredTracked.map((item) => (
              <div
                key={item.id}
                className="flex min-h-[48px] items-start gap-2 rounded-[8px] border border-[#202531] bg-[#161A23] p-2.5 transition-colors hover:border-[#818CF8]/50 hover:bg-[#1D2230]"
              >
                <Radio size={13} className="mt-0.5 shrink-0 text-[#34D399]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-[#F1F3F9]">{item.name || item.exploitName || `Message ${item.messageId.slice(-6)}`}</span>
                  <span className="mt-1 block truncate font-mono text-[9px] text-[#6F788A]">#{item.channelId} · {item.messageId.slice(-8)}</span>
                </span>
              </div>
            ))
          )}

          {activeTab === "actions" && (
            filteredActions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#272D3A] p-4 text-center">
                <Workflow size={18} className="mx-auto text-[#6F788A]" />
                <p className="mt-2 text-xs text-[#A1A8B8]">{search ? "No matching action flows." : "No action flows are attached to this message yet."}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-[#6F788A]">Select a button or select menu in the editor to create an action flow.</p>
              </div>
            ) : filteredActions.map(([customId, steps]) => (
              <div key={customId} className="rounded-[8px] border border-[#202531] bg-[#161A23] p-2.5">
                <div className="flex items-center gap-2">
                  <Workflow size={13} className="shrink-0 text-[#A78BFA]" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#F1F3F9]" title={customId}>{customId}</span>
                  <span className="shrink-0 rounded bg-[#818CF8]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#A5B4FC]">{steps.length}</span>
                </div>
                <p className="mt-1 pl-5 text-[10px] text-[#6F788A]">{steps.length === 1 ? "1 configured step" : `${steps.length} configured steps`}</p>
              </div>
            ))
          )}
        </div>

        <div className="shrink-0 border-t border-[#202531] p-2">
          <button
            type="button"
            onClick={() => setLayersOpen((open) => !open)}
            aria-expanded={layersOpen}
            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8] transition-colors hover:bg-[#1D2230] hover:text-[#F1F3F9]"
          >
            <span className="flex items-center gap-1.5"><Layers size={12} /> Layers & Hierarchy</span>
            {layersOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {layersOpen && <div className="max-h-48 overflow-y-auto border-t border-[#202531] px-1 pt-2"><LayersPanel /></div>}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
