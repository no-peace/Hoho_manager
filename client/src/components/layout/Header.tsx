import React, { useRef, useState } from "react";
import {
  Code,
  Download,
  FolderOpen,
  PanelLeft,
  Save,
  Sparkles,
  Upload,
  ShieldAlert,
  Settings,
} from "lucide-react";
import { Button, IconButton } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { SearchableDiscordSelect } from "../ui/SearchableDiscordSelect";
import { SettingsModal } from "./SettingsModal";
import { useMessageStore } from "../../store/messageStore";
import { useGlobalStore } from "../../store/globalStore";
import { useTemplateStore } from "../../store/templateStore";
import { useTemplates } from "../../hooks/useTemplates";
import { downloadJson, parseImportedJson } from "../../utils/exportImport";
import { EDITOR_MODES } from "../../utils/constants";
import { AccessPanel } from "./AccessPanel";

const ModeToggle: React.FC = () => {
  const mode = useMessageStore((state) => state.mode);
  const setMode = useMessageStore((state) => state.setMode);

  return (
    <div className="flex items-center rounded-lg bg-[#1e1f22] p-0.5 border border-[#111214]" role="group" aria-label="Editor mode">
      {[
        { id: EDITOR_MODES.CLASSIC, label: "Classic" },
        { id: EDITOR_MODES.V2, label: "Components V2" },
      ].map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={mode === option.id}
          onClick={() => setMode(option.id)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
            mode === option.id
              ? "bg-[#5865f2] text-white shadow-sm"
              : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]/50"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export const Header: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [rawJsonOpen, setRawJsonOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rawJsonText, setRawJsonText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const { templates, currentName, dirty, saveCurrent, loadTemplate } = useTemplates();
  const { selectedGuildId, setSelectedGuildId, isSidebarOpen, toggleSidebar } = useGlobalStore();
  const setCurrentName = useTemplateStore((state) => state.setCurrentName);
  const removeTemplate = useTemplateStore((state) => state.remove);

  const exportJson = (): void => {
    const payload = useMessageStore.getState().getPayload();
    downloadJson(payload, `${currentName.trim() || "discohook-message"}.json`);
  };

  const importJson = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const document = parseImportedJson(text);
      // Wrapped in { data: document } to satisfy LoadDocumentInput
      useMessageStore.getState().load({ data: document });
      setCurrentName(file.name.replace(/\.json$/i, ""));
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to parse JSON file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openRawJsonEditor = (): void => {
    const payload = useMessageStore.getState().getPayload();
    setRawJsonText(JSON.stringify(payload, null, 2));
    setRawJsonOpen(true);
  };

  const applyRawJson = (): void => {
    try {
      const document = parseImportedJson(rawJsonText);
      // Wrapped in { data: document } to satisfy LoadDocumentInput
      useMessageStore.getState().load({ data: document });
      setRawJsonOpen(false);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Invalid JSON format.");
    }
  };

  return (
    <>
      <header className="sticky top-0 left-0 z-20 bg-slate-50 dark:bg-[#1E1F22] border-b-2 border-slate-50 dark:border-[#1E1F22] shadow-md w-full px-4 h-12 flex items-center justify-between font-sans shrink-0">
        {/* Brand, Mode & Sidebar Toggle */}
        <div className="flex items-center gap-2">
          <IconButton
            icon={PanelLeft}
            label="Toggle Sidebar (Ctrl+B)"
            onClick={toggleSidebar}
            className={`transition-colors ${
              isSidebarOpen
                ? "bg-[#5865f2] text-white hover:bg-[#4752c4] shadow-sm"
                : "text-gray-500 dark:text-[#b5bac1] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#1e1f22]"
            }`}
          />
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5865f2] text-white shadow-sm">
            <Sparkles size={18} />
          </div>
          <span className="text-[15px] font-bold text-gray-900 dark:text-white tracking-wide mr-1 hidden sm:inline">
            HoHo Manager
          </span>
          <ModeToggle />
          
          <div className="w-48 ml-2">
            <SearchableDiscordSelect
              type="guild"
              value={selectedGuildId || ""}
              onChange={(val) => setSelectedGuildId(val as string)}
              placeholder="Select Server..."
            />
          </div>
        </div>

        {/* Template Bar */}
        <div className="flex items-center gap-2 max-w-md w-full mx-4">
          <input
            className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-[#404248] text-gray-900 dark:text-white text-xs px-3 py-1.5 rounded outline-none focus:border-blurple dark:focus:border-blurple"
            placeholder="Untitled Template"
            value={currentName}
            onChange={(e) => setCurrentName(e.target.value)}
          />
          <Button
            size="sm"
            variant={dirty ? "primary" : "secondary"}
            icon={Save}
            onClick={() => void saveCurrent()}
            title={dirty ? "Save changes" : "Saved"}
            className={
              dirty
                ? "bg-blurple hover:bg-blurple-600 text-white border-none"
                : "bg-gray-200 dark:bg-[#1e1f22] text-gray-600 dark:text-[#b5bac1] hover:text-gray-900 dark:hover:text-white border-transparent dark:border-[#111214]"
            }
          >
            {dirty ? "Save" : "Saved"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={FolderOpen}
            onClick={() => setLoadOpen(true)}
            className="bg-gray-200 dark:bg-[#1e1f22] text-gray-600 dark:text-[#b5bac1] hover:text-gray-900 dark:hover:text-white border-transparent dark:border-[#111214]"
          >
            Load
          </Button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <IconButton
            icon={Code}
            label="Raw JSON Editor"
            onClick={openRawJsonEditor}
            className="text-gray-500 dark:text-[#b5bac1] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#1e1f22]"
          />
          <IconButton
            icon={Upload}
            label="Import JSON"
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-500 dark:text-[#b5bac1] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#1e1f22]"
          />
          <IconButton
            icon={Download}
            label="Export JSON"
            onClick={exportJson}
            className="text-gray-500 dark:text-[#b5bac1] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#1e1f22]"
          />
          {import.meta.env.VITE_ADMIN_API_KEY ? (
            <>
              <button
                onClick={() => setSettingsOpen(true)}
                className="ml-2 text-xs flex items-center gap-1.5 font-semibold text-[#b5bac1] hover:text-white border border-[#35373c] bg-[#1e1f22] px-3 py-1 rounded transition-colors"
                title="Settings"
              >
                <Settings size={14} /> Settings
              </button>
              <button
                onClick={() => setAccessOpen(true)}
                className="ml-2 text-xs flex items-center gap-1.5 font-semibold text-warning hover:text-warning/80 border border-warning/30 bg-warning/10 px-3 py-1 rounded transition-colors"
              >
                <ShieldAlert size={14} /> Staff Access
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                const current = localStorage.getItem("staff_id");
                if (current) {
                  if (confirm("Log out of Staff ID " + current + "?")) {
                    localStorage.removeItem("staff_id");
                    window.location.reload();
                  }
                } else {
                  const id = prompt("Enter your Discord User ID to authenticate as Staff:");
                  if (id && /^\d{17,20}$/.test(id)) {
                    localStorage.setItem("staff_id", id);
                    window.location.reload();
                  } else if (id) {
                    alert("Invalid Discord ID format.");
                  }
                }
              }}
              className="ml-2 text-xs flex items-center gap-1.5 font-semibold text-blurple hover:text-white border border-blurple/30 bg-blurple/10 px-3 py-1 rounded transition-colors"
            >
              {localStorage.getItem("staff_id") ? `Staff: ${localStorage.getItem("staff_id")}` : "Staff Login"}
            </button>
          )}
          <a
            href="/docs"
            className="ml-2 text-xs font-semibold text-gray-500 dark:text-[#b5bac1] hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-[#35373c] bg-gray-100 dark:bg-[#1e1f22] px-3 py-1 rounded transition-colors"
          >
            Docs
          </a>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void importJson(e)}
          />
        </div>
      </header>

      {/* Raw JSON Editor Modal */}
      <Modal
        open={rawJsonOpen}
        onClose={() => setRawJsonOpen(false)}
        title="Message Raw JSON Data"
        width="max-w-2xl"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setRawJsonOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={applyRawJson}>
              Apply Changes
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-xs text-[#949ba4]">
            Paste an official Discohook backup, a custom JSON message payload, or edit the current data directly.
          </p>
          <textarea
            rows={16}
            value={rawJsonText}
            onChange={(e) => setRawJsonText(e.target.value)}
            className="w-full font-mono text-xs p-3 rounded bg-[#1e1f22] text-[#dbdee1] border border-[#111214] outline-none focus:border-[#5865f2] resize-y custom-scrollbar"
            spellCheck={false}
          />
        </div>
      </Modal>

      {/* Staff Access Modal */}
      <Modal
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
        title=""
        width="max-w-4xl"
      >
        <div className="h-[70vh]">
          {accessOpen && <AccessPanel />}
        </div>
      </Modal>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Import Error Modal */}
      <Modal
        open={Boolean(importError)}
        onClose={() => setImportError(null)}
        title="Import Problem"
        footer={<Button onClick={() => setImportError(null)}>Got it</Button>}
      >
        <p className="text-sm text-[#dbdee1]">{importError}</p>
      </Modal>

      {/* Template Load Modal */}
      <Modal
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        title="Saved Templates"
        width="max-w-xl"
      >
        {templates.length === 0 ? (
          <p className="text-xs text-[#949ba4] py-6 text-center">
            No saved templates yet. Name your template above and click Save.
          </p>
        ) : (
          <ul className="divide-y divide-[#1e1f22]">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-bold text-white">{template.name}</p>
                  <p className="text-[11px] text-[#949ba4]">
                    Updated {new Date(template.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => {
                      void loadTemplate(template.id);
                      setLoadOpen(false);
                    }}
                    className="bg-[#5865f2] hover:bg-[#4752c4] text-white border-none"
                  >
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void removeTemplate(template.id)}
                    className="text-[#f28b8b] hover:bg-[#da373c]/10 border-none"
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
};

export default Header;