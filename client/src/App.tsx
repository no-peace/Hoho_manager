import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Bot,
  Plus,
  Send,
  Edit3,
  Download,
  Upload,
} from "lucide-react";
import { Button } from "./components/ui/Button";
import { Modal } from "./components/ui/Modal";
import { Header } from "./components/layout/Header";
import { SplitPane } from "./components/layout/SplitPane";
import { MessageEditor } from "./components/editor/MessageEditor";
import { MessagePreview } from "./components/preview/MessagePreview";
import { DocsPage } from "./pages/DocsPage";
import { JsonModal } from "./components/editor/JsonModal";
import { BotDispatchModal } from "./components/send/BotDispatchModal";
import { useMessageStore } from "./store/messageStore";
import { useProfileStore } from "./store/profileStore";
import { useActionStore } from "./store/actionStore";
import { useTemplateStore } from "./store/templateStore";
import { useTemplates } from "./hooks/useTemplates";
import { downloadJson, parseImportedJson } from "./utils/exportImport";
import { useSend } from "./hooks/useSend";
import { copyTextToClipboard } from "./utils/clipboard";

// Backups Modal
const BackupsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { templates, saveCurrent, loadTemplate } = useTemplates();
  const [templateName, setTemplateName] = useState("");
  const currentName = useTemplateStore((state) => state.currentName);
  const setCurrentName = useTemplateStore((state) => state.setCurrentName);
  const remove = useTemplateStore((state) => state.remove);
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
                    onClick={() => remove(tpl.id)}
                    className="p-1 text-[#949ba4] hover:text-[#f28b8b] hover:bg-[#da373c]/20 rounded"
                    title="Delete backup"
                  >
                    ×
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

export const App: React.FC = () => {
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [editWebhookModalOpen, setEditWebhookModalOpen] = useState(false);
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [botModalMode, setBotModalMode] = useState<"send" | "edit">("send");
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");

  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/bots/webhook"
  );

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const fetchActionTypes = useActionStore((state) => state.fetchActionTypes);
  useEffect(() => {
    fetchActionTypes();
  }, [fetchActionTypes]);

  // Profiles and Sending State
  const webhookUrl = useProfileStore((state) => state.webhookUrl);
  const setWebhookUrl = useProfileStore((state) => state.setWebhookUrl);
  const threadId = useProfileStore((state) => state.threadId);
  const setThreadId = useProfileStore((state) => state.setThreadId);

  // Direct 1:1 state selectors
  const messages = useMessageStore((state) => state.messages);
  const data = useMessageStore((state) => state.data);
  const activeMessages = useMemo(
    () => (messages && messages.length > 0 ? messages : [data]),
    [messages, data]
  );

  const addMessage = useMessageStore((state) => state.addMessage);
  const send = useMessageStore((state) => state.send);
  const isSending = send?.status === "sending";
  const { sendMessage } = useSend();

  const handleExecuteWebhookEdit = async (messageId: string) => {
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
    if (copied) alert("Message JSON payload copied to clipboard.");
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
        <div className="flex min-h-0 flex-1">
          <SplitPane
            initialRatio={0.48}
            minRatio={0.3}
            maxRatio={0.7}
            left={
              <div
                className={`${
                  mobileView === "editor" ? "flex" : "hidden"
                } md:flex flex-col h-full bg-[#2b2d31] border-r border-[#1e1f22] w-full min-w-0`}
              >
                {/* Top Action Bar (Discohook style) */}
                <div className="p-3 bg-[#232428] border-b border-[#1e1f22] shrink-0 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleShare}
                        className="text-xs"
                      >
                        Share
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setBackupsOpen(true)}
                        className="text-xs"
                      >
                        Backups
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setJsonModalOpen(true)}
                        className="text-xs"
                      >
                        JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleClearAll}
                        className="text-xs text-[#f28b8b] hover:bg-[#da373c]/20"
                      >
                        Clear All
                      </Button>
                    </div>

                    {/* Dispatch Buttons */}
                    <div className="flex items-center gap-2">
                      {/* Webhook Send / Edit */}
                      <div className="inline-flex rounded-lg overflow-hidden border border-[#3c45a5] shadow-sm">
                        <button
                          type="button"
                          onClick={() => sendMessage()}
                          disabled={isSending}
                          className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 border-r border-[#4752c4] disabled:opacity-40"
                        >
                          <Send size={12} /> Send
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditWebhookModalOpen(true)}
                          className="bg-[#4752c4] hover:bg-[#3c45a5] text-white px-2 py-1.5 text-xs font-medium transition-colors flex items-center gap-1"
                          title="Edit existing webhook message"
                        >
                          <Edit3 size={11} /> Edit
                        </button>
                      </div>

                      {/* Bot Token Dispatch */}
                      <div className="inline-flex rounded-lg overflow-hidden border border-[#1a6334] shadow-sm">
                        <button
                          type="button"
                          onClick={() => openBotModal("send")}
                          className="bg-[#248046] hover:bg-[#1a6334] text-white px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 border-r border-[#1a6334]"
                        >
                          <Bot size={13} /> Bot Send
                        </button>
                        <button
                          type="button"
                          onClick={() => openBotModal("edit")}
                          className="bg-[#1a6334] hover:bg-[#144f28] text-white px-2 py-1.5 text-xs font-medium transition-colors flex items-center gap-1"
                          title="Edit message via bot token"
                        >
                          <Edit3 size={11} /> Edit
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Webhook URL & Thread ID Inputs */}
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

                {/* Multi-Message Workspace (Discohook layout) */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {activeMessages.map((_, idx) => (
                    <MessageEditor key={idx} index={idx} />
                  ))}

                  <button
                    type="button"
                    onClick={() => addMessage()}
                    disabled={activeMessages.length >= 10}
                    className="w-full py-2.5 mt-2 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-40"
                  >
                    <Plus size={15} /> Add Message ({activeMessages.length}/10)
                  </button>
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
      <BotDispatchModal
        open={botModalOpen}
        onClose={() => setBotModalOpen(false)}
        initialMode={botModalMode}
      />
    </div>
  );
};

export default App;