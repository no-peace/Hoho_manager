import React, { useEffect, useState, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Bot,
  Copy,
  Trash2,
  Share2,
  FolderOpen,
  Download,
  Upload,
} from "lucide-react";
import { Button } from "./components/ui/Button";
import { Modal } from "./components/ui/Modal";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { SplitPane } from "./components/layout/SplitPane";
import { MessageEditor } from "./components/editor/MessageEditor";
import { MessagePreview } from "./components/preview/MessagePreview";
import { DocsPage } from "./pages/DocsPage";
import { useGlobalStore } from "./store/globalStore";

import { FlowBuilder } from "./components/actions/FlowBuilder";
import { COMPONENT_FORMS } from "./components/editor/ComponentForms";
import { BotDispatchModal } from "./components/send/BotDispatchModal";
import { componentLabel, isInteractiveComponent } from "./utils/componentsV2";
import { findComponent } from "./utils/tree";
import { useActionStore } from "./store/actionStore";
import { useMessageStore } from "./store/messageStore";
import { useProfileStore } from "./store/profileStore";
import { useTemplateStore } from "./store/templateStore";
import { useTemplates } from "./hooks/useTemplates";
import { downloadJson, parseImportedJson } from "./utils/exportImport";
import { useSend } from "./hooks/useSend";
import { SEND_MODES } from "./utils/constants";
import { copyTextToClipboard } from "./utils/clipboard";
import { ButtonStyle, ComponentType } from "@dmb/shared";

// Discohook Accordion
const Accordion = ({
  title,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#1e1f22]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#35373c]/50 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown size={14} className="text-[#949ba4]" />
          ) : (
            <ChevronRight size={14} className="text-[#949ba4]" />
          )}
          <span className="font-bold text-[13px] text-[#dbdee1]">{title}</span>
        </div>
        {badge}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
};

// Backups & Templates Modal (Harmonized with templateStore)
const BackupsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { templates, saveCurrent, loadTemplate } = useTemplates();
  const currentName = useTemplateStore((state) => state.currentName);
  const setCurrentName = useTemplateStore((state) => state.setCurrentName);
  const removeTemplate = useTemplateStore((state) => state.remove);
  const [templateName, setTemplateName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleSave = async () => {
    if (templateName.trim()) {
      setCurrentName(templateName.trim());
    }
    try {
      await saveCurrent();
      setTemplateName("");
    } catch (e: any) {
      alert(e?.message || "Failed to save template");
    }
  };

  const handleLoad = async (id: number) => {
    if (confirm("Load this template? Current unsaved changes will be overwritten.")) {
      await loadTemplate(id);
      onClose();
    }
  };

  const handleExportJson = () => {
    const payload = useMessageStore.getState().getPayload();
    downloadJson(payload, `${currentName.trim() || "discohook-message"}.json`);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const document = parseImportedJson(text);
      useMessageStore.getState().load({ data: document });
      setCurrentName(file.name.replace(/\.json$/i, ""));
      onClose();
    } catch (err: any) {
      alert(err?.message || "Invalid JSON file format.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Saved Templates & Backups" width="max-w-md">
      <div className="space-y-4">
        {/* Save Current */}
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-[#1e1f22] border border-[#111214] text-[#dbdee1] text-xs px-2.5 py-1.5 rounded outline-none focus:border-[#5865f2]"
            placeholder="Template / Backup name..."
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <Button size="sm" variant="primary" onClick={() => void handleSave()}>
            Save
          </Button>
        </div>

        {/* Import / Export JSON */}
        <div className="flex gap-2 pt-2 border-t border-[#1e1f22]">
          <Button
            size="sm"
            variant="secondary"
            icon={Download}
            onClick={handleExportJson}
            className="flex-1 text-xs"
          >
            Export JSON
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={Upload}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 text-xs"
          >
            Import JSON
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".json,application/json"
            onChange={(e) => void handleImportJson(e)}
          />
        </div>

        {/* Backups / Templates List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
            Saved Templates ({templates.length})
          </p>
          {templates.length === 0 ? (
            <p className="text-xs text-[#949ba4] py-4 text-center">
              No saved templates yet. Name your template above and click Save.
            </p>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between p-2 rounded bg-[#1e1f22] border border-[#111214] hover:border-[#35373c]"
              >
                <div className="min-w-0 flex-1 mr-2">
                  <p className="text-xs font-semibold text-[#dbdee1] truncate">{tpl.name}</p>
                  <p className="text-[10px] text-[#949ba4]">
                    Updated {new Date(tpl.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleLoad(tpl.id)}
                    className="text-xs text-[#5865f2] hover:bg-[#5865f2]/10"
                  >
                    Load
                  </Button>
                  <button
                    type="button"
                    onClick={() => void removeTemplate(tpl.id)}
                    className="p-1 text-[#949ba4] hover:text-[#da373c] transition-colors"
                    title="Delete template"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};

// Component & Flow Editor Modal
const ComponentEditorModal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"properties" | "flow">("properties");
  const selection = useMessageStore((state) => state.selection);
  const components = useMessageStore((state) => state.data.components);
  const select = useMessageStore((state) => state.select);
  const updateComponentById = useMessageStore((state) => state.updateComponentById);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);

  if (!selection || selection.kind !== "component") return null;

  const component = findComponent(components, selection.id);
  if (!component) return null;

  const Form = COMPONENT_FORMS[component.type];
  const isLinkButton =
    component.type === ComponentType.Button && component.style === ButtonStyle.Link;
  const hasFlow = isInteractiveComponent(component) && !isLinkButton;

  return (
    <Modal
      open={true}
      onClose={() => select(null)}
      title={`Edit ${componentLabel(component)}`}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {component._id && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Copy}
                  onClick={() => duplicateComponentById(component._id as string)}
                  className="text-[#dbdee1] hover:bg-[#35373c]"
                >
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  onClick={() => {
                    removeComponentById(component._id as string);
                    select(null);
                  }}
                  className="text-[#f28b8b] hover:bg-[#da373c]/10"
                >
                  Delete
                </Button>
              </>
            )}
          </div>
          <Button
            variant="primary"
            onClick={() => select(null)}
            className="bg-[#5865f2] hover:bg-[#4752c4] text-white"
          >
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {hasFlow && (
          <div className="flex rounded-lg bg-[#1e1f22] p-1 border border-[#111214]">
            <button
              type="button"
              onClick={() => setActiveTab("properties")}
              className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "properties"
                  ? "bg-[#5865f2] text-white shadow-sm"
                  : "text-[#949ba4] hover:text-[#dbdee1]"
              }`}
            >
              Component Properties
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("flow")}
              className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "flow"
                  ? "bg-[#5865f2] text-white shadow-sm"
                  : "text-[#949ba4] hover:text-[#dbdee1]"
              }`}
            >
              Action Flow (When Clicked)
            </button>
          </div>
        )}

        <div className="max-h-[60vh] min-w-0 overflow-y-auto pr-1 custom-scrollbar">
          {activeTab === "flow" && hasFlow ? (
            <FlowBuilder component={component} />
          ) : Form ? (
            <Form
              component={component}
              update={(patch) =>
                component._id && updateComponentById(component._id, patch)
              }
            />
          ) : (
            <p className="text-xs text-[#949ba4] py-4 text-center">
              No configuration available for this component.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};

export const App: React.FC = () => {
  const fetchActionTypes = useActionStore((state) => state.fetchActionTypes);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [mobileView, setMobileView] = useState<"sidebar" | "editor" | "preview">("editor");

  const [backupsOpen, setBackupsOpen] = useState(false);
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [botModalMode, setBotModalMode] = useState<"send" | "edit">("send");

  const [webhookDropOpen, setWebhookDropOpen] = useState(false);
  const [botDropOpen, setBotDropOpen] = useState(false);

  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useGlobalStore();

  const webhookUrl = useProfileStore((state) => state.webhookUrl);
  const setWebhookUrl = useProfileStore((state) => state.setWebhookUrl);
  const setSendMode = useProfileStore((state) => state.setSendMode);
  const { sendMessage } = useSend();

  const webhookRef = useRef<HTMLDivElement>(null);
  const botRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut listener: Ctrl+B / Cmd+B to toggle sidebar, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
      if (e.key === "Escape" && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar, isSidebarOpen, setIsSidebarOpen]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (webhookRef.current && !webhookRef.current.contains(e.target as Node)) {
        setWebhookDropOpen(false);
      }
      if (botRef.current && !botRef.current.contains(e.target as Node)) {
        setBotDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    void fetchActionTypes();
    void useGlobalStore.getState().fetchCurrentUser();

    if (typeof window !== "undefined" && window.location.search.includes("login=success")) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // Auto-fetch bot identity on load and update global store
    const fetchIdentity = async () => {
      try {
        const { default: api } = await import("./api/client");
        const identity = await api.discord.identity();
        if (identity) {
          useGlobalStore.getState().setBotIdentity({
            id: identity.id,
            username: identity.username,
            avatar: identity.avatar,
          });
        }
      } catch (err) {
        console.error("Failed to auto-fetch bot identity", err);
      }
    };
    fetchIdentity();
  }, [fetchActionTypes]);

  useEffect(() => {
    const onLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  const handleWebhook = async (actionMode: "send" | "edit") => {
    setWebhookDropOpen(false);
    if (!webhookUrl) return alert("Please enter a Webhook URL first.");
    setSendMode(SEND_MODES.WEBHOOK);
    if (actionMode === "send") {
      await sendMessage();
    } else {
      const msgId = prompt("Enter the Webhook Message ID to edit:");
      if (msgId) await sendMessage(msgId);
    }
  };

  const openBotModal = (actionMode: "send" | "edit") => {
    setBotDropOpen(false);
    setBotModalMode(actionMode);
    setBotModalOpen(true);
  };

  const handleShare = async () => {
    const payload = useMessageStore.getState().getPayload();
    const text = JSON.stringify(payload, null, 2);
    const copied = await copyTextToClipboard(text);
    if (copied) {
      window.alert("Message JSON payload copied to your clipboard.");
      return;
    }
    window.alert("Could not copy message JSON.");
  };

  const handleClearAll = () => {
    if (confirm("Clear all message contents and start over?")) {
      useMessageStore.getState().reset();
      useActionStore.getState().reset();
      useTemplateStore.getState().detach();
    }
  };

  if (currentPath === "/docs") return <DocsPage />;

  return (
    <div className="flex h-screen flex-col bg-[#313338] text-[#dbdee1] font-sans overflow-hidden">
      <Header onOpenBackups={() => setBackupsOpen(true)} />

      {/* Mobile Switcher (only for screens < 768px) */}
      <div className="md:hidden flex bg-[#2b2d31] border-b border-[#1e1f22] shrink-0 p-1.5 gap-1">
        <button
          type="button"
          onClick={() => {
            setMobileView("sidebar");
            setIsSidebarOpen(true);
          }}
          className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
            isSidebarOpen || mobileView === "sidebar"
              ? "bg-[#5865f2] text-white"
              : "bg-[#35373c] text-[#b5bac1]"
          }`}
        >
          Sidebar
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileView("editor");
            setIsSidebarOpen(false);
          }}
          className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
            !isSidebarOpen && mobileView === "editor"
              ? "bg-[#5865f2] text-white"
              : "bg-[#35373c] text-[#b5bac1]"
          }`}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileView("preview");
            setIsSidebarOpen(false);
          }}
          className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
            !isSidebarOpen && mobileView === "preview"
              ? "bg-[#5865f2] text-white"
              : "bg-[#35373c] text-[#b5bac1]"
          }`}
        >
          Preview
        </button>
      </div>

      <main className="flex min-h-0 flex-1 overflow-hidden relative">
        {/* Off-Canvas Drawer Overlay Backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Off-Canvas Overlay Drawer */}
        <div
          className={`fixed inset-y-0 left-0 z-50 h-full w-80 max-w-[calc(100vw-3rem)] shadow-2xl bg-[#2b2d31] border-r border-[#1e1f22] transition-transform duration-200 ease-in-out flex flex-col ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Toolbox Drawer"
        >
          <Sidebar onClose={() => setIsSidebarOpen(false)} />
        </div>

        {/* Center & Right Panes: SplitPane hosting Editor & Live Preview */}
        <div
          className={`
            ${mobileView === "sidebar" ? "hidden" : "flex"}
            md:flex flex-1 min-w-0 h-full w-full
          `}
        >
          <SplitPane
            initialRatio={0.5}
            left={
              <div
                className={`${
                  mobileView === "editor" ? "flex" : "hidden"
                } md:flex flex-col h-full bg-[#2b2d31] border-r border-[#1e1f22] w-full min-w-0`}
              >
                {/* Action Bar */}
                <div className="p-2.5 border-b border-[#1e1f22] flex flex-col gap-2 shrink-0 bg-[#2b2d31]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleShare}
                        className="bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <Share2 size={12} /> Share
                      </button>
                      <button
                        type="button"
                        onClick={() => setBackupsOpen(true)}
                        className="bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <FolderOpen size={12} /> Backups
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="bg-[#35373c] hover:bg-[#da373c] text-[#dbdee1] hover:text-white px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Clear
                      </button>
                    </div>

                    {/* Bot Button with Split Chevron */}
                    <div className={`relative inline-flex ${botDropOpen ? 'z-50' : 'z-20'}`} ref={botRef}>
                      <button
                        type="button"
                        onClick={() => openBotModal("send")}
                        className="bg-[#23a55a] hover:bg-[#1da24a] text-white px-3 py-1 text-xs font-medium transition-colors rounded-l flex items-center gap-1 border-r border-[#1da24a]"
                      >
                        <Bot size={13} /> Bot
                      </button>
                      <button
                        type="button"
                        onClick={() => setBotDropOpen(!botDropOpen)}
                        className="bg-[#23a55a] hover:bg-[#1da24a] text-white px-1.5 py-1 text-xs font-medium transition-colors rounded-r flex items-center"
                      >
                        <ChevronDown size={13} />
                      </button>
                      {botDropOpen && (
                        <div className="absolute top-full right-0 mt-1 w-36 bg-[#1e1f22] border border-[#111214] rounded shadow-2xl z-[9999] py-1">
                          <button
                            type="button"
                            onClick={() => openBotModal("edit")}
                            className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors"
                          >
                            Edit Message
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Webhook URL Input & Send Split Button */}
                  <div className="flex gap-1.5 items-center">
                    <input
                      className="bg-[#1e1f22] border border-[#111214] text-[#dbdee1] text-xs px-2.5 py-1.5 rounded flex-1 outline-none focus:border-[#5865f2] min-w-0"
                      placeholder="Discord Webhook URL"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />

                    {/* Webhook Send / Edit Split Dropdown */}
                    <div className={`relative inline-flex shrink-0 ${webhookDropOpen ? 'z-50' : 'z-20'}`} ref={webhookRef}>
                      <button
                        type="button"
                        onClick={() => handleWebhook("send")}
                        className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-3.5 py-1.5 text-xs font-semibold transition-colors rounded-l border-r border-[#4752c4]"
                      >
                        Send
                      </button>
                      <button
                        type="button"
                        onClick={() => setWebhookDropOpen(!webhookDropOpen)}
                        className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-2 py-1.5 text-xs font-semibold transition-colors rounded-r flex items-center"
                      >
                        <ChevronDown size={13} />
                      </button>
                      {webhookDropOpen && (
                        <div className="absolute top-full right-0 mt-1 w-36 bg-[#1e1f22] border border-[#111214] rounded shadow-2xl z-[9999] py-1">
                          <button
                            type="button"
                            onClick={() => handleWebhook("edit")}
                            className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors"
                          >
                            Edit Message
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Editor Workspace */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <Accordion title="Message 1" defaultOpen={true}>
                    <MessageEditor />
                  </Accordion>
                </div>
              </div>
            }
            right={
              <div
                className={`${
                  mobileView === "preview" ? "flex" : "hidden"
                } md:flex flex-col h-full bg-[#313338] w-full min-w-0`}
              >
                <MessagePreview />
              </div>
            }
          />
        </div>
      </main>

      <ComponentEditorModal />
      <BackupsModal open={backupsOpen} onClose={() => setBackupsOpen(false)} />
      <BotDispatchModal
        open={botModalOpen}
        onClose={() => setBotModalOpen(false)}
        initialMode={botModalMode}
      />
    </div>
  );
};

export default App;