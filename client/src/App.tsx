import React, { useEffect, useState, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Bot,
  Copy,
  Trash2,
  Share2,
  FolderOpen,
  Code2,
  Plus,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
  Send,
  Edit3,
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
import { JsonModal } from "./components/editor/JsonModal";
import { BotDispatchModal } from "./components/send/BotDispatchModal";
import { FlowBuilder } from "./components/actions/FlowBuilder";
import { COMPONENT_FORMS } from "./components/editor/ComponentForms";
import { componentLabel, isInteractiveComponent } from "./utils/componentsV2";
import { findComponent } from "./utils/tree";
import { useMessageStore } from "./store/messageStore";
import { useProfileStore } from "./store/profileStore";
import { useActionStore } from "./store/actionStore";
import { useTemplateStore } from "./store/templateStore";
import { useTemplates } from "./hooks/useTemplates";
import { downloadJson, parseImportedJson } from "./utils/exportImport";
import { useSend } from "./hooks/useSend";
import { SEND_MODES } from "./utils/constants";
import { copyTextToClipboard } from "./utils/clipboard";
import { ButtonStyle, ComponentType } from "@dmb/shared";

// Backups Modal
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

// Edit Webhook Message Dialog Modal
const EditWebhookModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onExecuteEdit: (messageId: string) => Promise<void>;
}> = ({ open, onClose, onExecuteEdit }) => {
  const [editInput, setEditInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleEdit = async () => {
    const trimmed = editInput.trim();
    if (!trimmed) return alert("Please enter a Discord Message ID or message link.");
    const idMatch = trimmed.match(/\d{17,20}/);
    const targetId = idMatch ? idMatch[0] : trimmed;
    setSubmitting(true);
    try {
      await onExecuteEdit(targetId);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Existing Webhook Message"
      width="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={submitting} onClick={handleEdit}>
            Update Message
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-[#949ba4] leading-relaxed">
          Provide the 17–20 digit Snowflake ID of the message sent by this webhook, or paste its full Discord message link.
        </p>
        <input
          type="text"
          placeholder="Message ID or Link (e.g. 1363426163892162591)"
          value={editInput}
          onChange={(e) => setEditInput(e.target.value)}
          className="w-full bg-[#1e1f22] border border-[#111214] text-[#dbdee1] text-xs px-3 py-2 rounded-lg outline-none focus:border-[#5865f2]"
        />
      </div>
    </Modal>
  );
};

// Component & Flow Editor Modal
const ComponentEditorModal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"properties" | "flow">("properties");
  const selection = useMessageStore((state) => state.selection);
  const components = useMessageStore((state) => state.data?.components ?? []);
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
              update={(patch) => component._id && updateComponentById(component._id, patch)}
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

const MessageAccordion: React.FC<{
  index: number;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ index, title, isOpen, onToggle, children }) => {
  const store = useMessageStore();
  const messagesCount = store.messages.length;

  return (
    <div className="border border-[#1e1f22] bg-[#2b2d31] rounded-lg overflow-hidden shadow-sm transition-colors">
      <div
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#35373c]/50 transition-colors cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown size={14} className="text-[#949ba4]" />
          ) : (
            <ChevronRight size={14} className="text-[#949ba4]" />
          )}
          <span className="font-bold text-[13px] text-[#dbdee1]">{title}</span>
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {index > 0 && (
            <button
              type="button"
              onClick={() => store.moveMessage(index, -1)}
              className="p-1 text-[#949ba4] hover:text-white transition-colors"
              title="Move Up"
            >
              <ArrowUp size={13} />
            </button>
          )}
          {index < messagesCount - 1 && (
            <button
              type="button"
              onClick={() => store.moveMessage(index, 1)}
              className="p-1 text-[#949ba4] hover:text-white transition-colors"
              title="Move Down"
            >
              <ArrowDown size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => store.duplicateMessage(index)}
            className="p-1 text-[#949ba4] hover:text-white transition-colors"
            title="Duplicate Message"
          >
            <Copy size={13} />
          </button>
          {messagesCount > 1 && (
            <button
              type="button"
              onClick={() => store.removeMessage(index)}
              className="p-1 text-[#949ba4] hover:text-[#da373c] transition-colors"
              title="Delete Message"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="p-3 border-t border-[#1e1f22] bg-[#313338] animate-in fade-in duration-100">
          {children}
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  const fetchActionTypes = useActionStore((state) => state.fetchActionTypes);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");

  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [editWebhookModalOpen, setEditWebhookModalOpen] = useState(false);
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [botModalMode, setBotModalMode] = useState<"send" | "edit">("send");

  const webhookUrl = useProfileStore((state) => state.webhookUrl);
  const setWebhookUrl = useProfileStore((state) => state.setWebhookUrl);
  const threadId = useProfileStore((state) => state.threadId);
  const setThreadId = useProfileStore((state) => state.setThreadId);
  const setSendMode = useProfileStore((state) => state.setSendMode);
  const { sendMessage } = useSend();

  const messages = useMessageStore((state) => state.messages);
  const activeMessageIndex = useMessageStore((state) => state.activeMessageIndex);
  const addMessage = useMessageStore((state) => state.addMessage);
  const setActiveMessageIndex = useMessageStore((state) => state.setActiveMessageIndex);

  const isSidebarOpen = useGlobalStore((state) => state.isSidebarOpen);
  const setIsSidebarOpen = useGlobalStore((state) => state.setIsSidebarOpen);

  useEffect(() => {
    void fetchActionTypes();
    void useGlobalStore.getState().fetchCurrentUser();

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

  const handleSendWebhook = async () => {
    if (!webhookUrl) return alert("Please enter a Discord Webhook URL first.");
    setSendMode(SEND_MODES.WEBHOOK);
    const res = await sendMessage();
    if (res.ok) alert("Message dispatched successfully via Webhook!");
  };

  const handleExecuteWebhookEdit = async (messageId: string) => {
    if (!webhookUrl) return alert("Please enter a Discord Webhook URL first.");
    setSendMode(SEND_MODES.WEBHOOK);
    const res = await sendMessage(messageId);
    if (res.ok) alert("Webhook message updated successfully!");
  };

  const openBotModal = (actionMode: "send" | "edit") => {
    setBotModalMode(actionMode);
    setBotModalOpen(true);
  };

  const handleShare = async () => {
    const payload = useMessageStore.getState().getPayload();
    const text = JSON.stringify(payload, null, 2);
    const copied = await copyTextToClipboard(text);
    if (copied) {
      alert("Message JSON payload copied to clipboard.");
    }
  };

  const handleClearAll = () => {
    if (confirm("Clear all messages and start fresh?")) {
      useMessageStore.getState().reset();
      useActionStore.getState().reset();
      useTemplateStore.getState().detach();
    }
  };

  if (currentPath === "/docs") return <DocsPage />;

  return (
    <div className="flex h-screen flex-col bg-[#313338] text-[#dbdee1] font-sans overflow-hidden">
      <Header onOpenBackups={() => setBackupsOpen(true)} />

      {/* Mobile Switcher (< 768px) */}
      <div className="md:hidden flex bg-[#2b2d31] border-b border-[#1e1f22] shrink-0 p-1.5 gap-1">
        <button
          type="button"
          onClick={() => setMobileView("editor")}
          className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
            mobileView === "editor" ? "bg-[#5865f2] text-white" : "bg-[#35373c] text-[#b5bac1]"
          }`}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() => setMobileView("preview")}
          className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
            mobileView === "preview" ? "bg-[#5865f2] text-white" : "bg-[#35373c] text-[#b5bac1]"
          }`}
        >
          Preview
        </button>
      </div>

      <main className="flex min-h-0 flex-1 overflow-hidden relative">
        {/* Drawer Backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Drawer */}
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

        {/* 50/50 Dual Pane Split */}
        <div className="md:flex flex-1 min-w-0 h-full w-full">
          <SplitPane
            initialRatio={0.5}
            left={
              <div
                className={`${
                  mobileView === "editor" ? "flex" : "hidden"
                } md:flex flex-col h-full bg-[#2b2d31] border-r border-[#1e1f22] w-full min-w-0`}
              >
                {/* Action Bar */}
                <div className="p-3 border-b border-[#1e1f22] flex flex-col gap-2 shrink-0 bg-[#2b2d31]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleShare}
                        className="bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <Share2 size={13} /> Share
                      </button>
                      <button
                        type="button"
                        onClick={() => setBackupsOpen(true)}
                        className="bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <FolderOpen size={13} /> Backups
                      </button>
                      <button
                        type="button"
                        onClick={() => setJsonModalOpen(true)}
                        className="bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <Code2 size={13} /> JSON Data
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="bg-[#35373c] hover:bg-[#da373c]/20 hover:text-[#f28b8b] text-[#dbdee1] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={13} /> Clear
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Webhook Send & Edit Button Group */}
                      <div className="inline-flex rounded-lg overflow-hidden border border-[#4752c4] shadow-sm">
                        <button
                          type="button"
                          onClick={() => void handleSendWebhook()}
                          className="bg-[#5865f2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white px-3.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 border-r border-[#4752c4]"
                        >
                          <Send size={12} /> Send
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditWebhookModalOpen(true)}
                          className="bg-[#4752c4] hover:bg-[#3c45a5] text-white px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1"
                          title="Edit existing webhook message"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      </div>

                      {/* Bot Dispatch Buttons */}
                      <div className="inline-flex rounded-lg overflow-hidden border border-[#1a6334] shadow-sm">
                        <button
                          type="button"
                          onClick={() => openBotModal("send")}
                          className="bg-[#248046] hover:bg-[#1a6334] text-white px-3.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 border-r border-[#1a6334]"
                        >
                          <Bot size={13} /> Bot Send
                        </button>
                        <button
                          type="button"
                          onClick={() => openBotModal("edit")}
                          className="bg-[#1a6334] hover:bg-[#144f28] text-white px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1"
                          title="Edit message via bot token"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Webhook URL & Thread ID */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <input
                      type="url"
                      placeholder="Discord Webhook URL (https://discord.com/api/webhooks/...)"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="sm:col-span-2 bg-[#1e1f22] border border-[#111214] text-[#dbdee1] text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-[#5865f2]"
                    />
                    <input
                      type="text"
                      placeholder="Thread ID (optional)"
                      value={threadId}
                      onChange={(e) => setThreadId(e.target.value)}
                      className="bg-[#1e1f22] border border-[#111214] text-[#dbdee1] text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-[#5865f2]"
                    />
                  </div>
                </div>

                {/* Multi-Message Accordion Workspace */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {messages.map((_, idx) => (
                    <MessageAccordion
                      key={idx}
                      index={idx}
                      title={`Message ${idx + 1}`}
                      isOpen={activeMessageIndex === idx}
                      onToggle={() => setActiveMessageIndex(idx)}
                    >
                      <MessageEditor />
                    </MessageAccordion>
                  ))}

                  <Button
                    variant="secondary"
                    icon={Plus}
                    onClick={() => addMessage()}
                    disabled={messages.length >= 10}
                    className="w-full text-xs font-semibold py-2.5 bg-[#2b2d31] hover:bg-[#35373c] border border-[#1e1f22] rounded-lg"
                  >
                    Add Message ({messages.length}/10)
                  </Button>
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

      <JsonModal open={jsonModalOpen} onClose={() => setJsonModalOpen(false)} />
      <BackupsModal open={backupsOpen} onClose={() => setBackupsOpen(false)} />
      <EditWebhookModal
        open={editWebhookModalOpen}
        onClose={() => setEditWebhookModalOpen(false)}
        onExecuteEdit={handleExecuteWebhookEdit}
      />
      <ComponentEditorModal />
      <BotDispatchModal
        open={botModalOpen}
        onClose={() => setBotModalOpen(false)}
        initialMode={botModalMode}
      />
    </div>
  );
};

export default App;