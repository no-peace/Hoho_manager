import React, { useEffect, useState, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Bot,
  Copy,
  Trash2,
  Share2,
  FolderOpen,
} from "lucide-react";
import { Button } from "./components/ui/Button";
import { Modal } from "./components/ui/Modal";
import { Header } from "./components/layout/Header";
import { SplitPane } from "./components/layout/SplitPane";
import { MessageEditor } from "./components/editor/MessageEditor";
import { ComponentPalette } from "./components/editor/ComponentPalette";
import { LayersPanel } from "./components/editor/LayersPanel";
import { MessagePreview } from "./components/preview/MessagePreview";
import { DocsPage } from "./pages/DocsPage";
import { ProfilesPanel } from "./components/layout/ProfilesPanel";
import { DiscohookComponentsEditor } from "./components/editor/DiscohookComponentsEditor";
import { FlowBuilder } from "./components/actions/FlowBuilder";
import { COMPONENT_FORMS } from "./components/editor/ComponentForms";
import { BotDispatchModal } from "./components/send/BotDispatchModal";
import { componentLabel, isInteractiveComponent } from "./utils/componentsV2";
import { findComponent } from "./utils/tree";
import { useActionStore } from "./store/actionStore";
import { useMessageStore } from "./store/messageStore";
import { useProfileStore } from "./store/profileStore";
import { useTemplates } from "./hooks/useTemplates";
import { useSend } from "./hooks/useSend";
import { SEND_MODES } from "./utils/constants";
import { copyTextToClipboard } from "./utils/clipboard";
import { ButtonStyle, ComponentType } from "@dmb/shared";

// Reusable Discohook Accordion
const Accordion = ({
  title,
  children,
  defaultOpen = false,
  muted = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  muted?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#1e1f22]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#35373c]/50 transition-colors text-left focus:outline-none"
      >
        {open ? (
          <ChevronDown size={14} className="text-[#949ba4]" />
        ) : (
          <ChevronRight size={14} className="text-[#949ba4]" />
        )}
        <span
          className={`font-bold text-[13px] ${
            muted ? "text-[#949ba4]" : "text-[#dbdee1]"
          }`}
        >
          {title}
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

// Discohook Component & Flow Editor Modal
const ComponentEditorModal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"properties" | "flow">("properties");
  const selection = useMessageStore((state) => state.selection);
  const components = useMessageStore((state) => state.data.components);
  const mode = useMessageStore((state) => state.mode);
  const select = useMessageStore((state) => state.select);
  const updateComponentById = useMessageStore((state) => state.updateComponentById);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const duplicateComponentById = useMessageStore(
    (state) => state.duplicateComponentById
  );

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

        <div
          className={
            mode === "v2" && activeTab !== "flow"
              ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
              : ""
          }
        >
          {mode === "v2" && activeTab !== "flow" && (
            <div className="max-h-[60vh] min-h-0 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#b5bac1]">
                  Component tree
                </h3>
                <LayersPanel />
              </section>
              <section className="space-y-2 border-t border-[#1e1f22] pt-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#b5bac1]">
                  Add component
                </h3>
                <ComponentPalette />
              </section>
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
      </div>
    </Modal>
  );
};

export const App: React.FC = () => {
  const mode = useMessageStore((state) => state.mode);
  const fetchActionTypes = useActionStore((state) => state.fetchActionTypes);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");

  // Send Dropdown & Modal States
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [botModalMode, setBotModalMode] = useState<"send" | "edit">("send");
  const [backupsModalOpen, setBackupsModalOpen] = useState(false);

  const [webhookDropOpen, setWebhookDropOpen] = useState(false);
  const [botDropOpen, setBotDropOpen] = useState(false);

  // Store references
  const sendMode = useProfileStore((state) => state.sendMode);
  const webhookUrl = useProfileStore((state) => state.webhookUrl);
  const channelId = useProfileStore((state) => state.channelId);
  const botProfileId = useProfileStore((state) => state.botProfileId);
  const setWebhookUrl = useProfileStore((state) => state.setWebhookUrl);
  const setSendMode = useProfileStore((state) => state.setSendMode);
  const { sendMessage } = useSend();
  const { templates, loadTemplate } = useTemplates();

  const webhookRef = useRef<HTMLDivElement>(null);
  const botRef = useRef<HTMLDivElement>(null);

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
      window.alert("Message JSON payload copied to your clipboard for sharing.");
      return;
    }

    window.alert("Could not copy the message JSON. Check clipboard permissions and try again.");
  };

  const hasConfiguredSendTarget =
    sendMode === SEND_MODES.BOT
      ? Boolean(channelId.trim() || botProfileId !== null)
      : Boolean(webhookUrl.trim());

  const sendModeHint =
    sendMode === SEND_MODES.BOT
      ? "Bot mode is active — pick a channel and bot profile before dispatching."
      : "Webhook mode is active — add a Discord webhook URL to send immediately.";

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all contents?")) {
      useMessageStore.getState().reset();
      useActionStore.getState().reset();
    }
  };

  if (currentPath === "/docs") return <DocsPage />;

  return (
    <div className="flex h-screen flex-col bg-[#313338] text-[#dbdee1] font-sans overflow-hidden">
      <Header />

      {/* Mobile Switcher */}
      <div className="md:hidden flex bg-[#2b2d31] border-b border-[#1e1f22] shrink-0 p-2 gap-2">
        <button
          type="button"
          onClick={() => setMobileView("editor")}
          className={`flex-1 py-1.5 rounded text-[13px] font-bold transition-colors ${
            mobileView === "editor"
              ? "bg-[#5865f2] text-white"
              : "bg-[#35373c] text-[#b5bac1] hover:text-white"
          }`}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() => setMobileView("preview")}
          className={`flex-1 py-1.5 rounded text-[13px] font-bold transition-colors ${
            mobileView === "preview"
              ? "bg-[#5865f2] text-white"
              : "bg-[#35373c] text-[#b5bac1] hover:text-white"
          }`}
        >
          Preview
        </button>
      </div>

      <main className="flex min-h-0 flex-1">
        <SplitPane
          initialRatio={0.48}
          left={
            <div
              className={`${
                mobileView === "editor" ? "flex" : "hidden"
              } md:flex flex-col h-full bg-[#2b2d31] border-r border-[#1e1f22] w-full`}
            >
              {/* Discohook Action Bar */}
              <div className="p-3 border-b border-[#1e1f22] flex flex-col gap-3 shrink-0 bg-[#2b2d31]">
                <div className="rounded-lg border border-[#5865f2]/20 bg-[#5865f2]/5 px-3 py-2 text-[11px] text-[#dfe4ff]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold uppercase tracking-[0.14em] text-[#b5c0ff]">
                      {sendMode === SEND_MODES.BOT ? "Bot delivery" : "Webhook delivery"}
                    </span>
                    <span className="rounded-full border border-[#5865f2]/30 bg-[#1e1f22] px-2 py-0.5 text-[10px] font-medium text-[#dfe4ff]">
                      {hasConfiguredSendTarget ? "Ready" : "Needs setup"}
                    </span>
                  </div>
                  <p className="mt-1 text-[#d0d5ff]">{sendModeHint}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] px-3.5 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Share2 size={13} /> Share
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackupsModalOpen(true)}
                    className="bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] px-3.5 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors flex items-center gap-1.5"
                  >
                    <FolderOpen size={13} /> Backups
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="bg-[#35373c] hover:bg-[#da373c] text-[#dbdee1] hover:text-white px-3.5 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={13} /> Clear All
                  </button>
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    className="bg-[#1e1f22] border border-[#111214] text-[#dbdee1] text-[13px] px-3 py-1.5 rounded-[4px] w-64 outline-none focus:border-[#5865f2]"
                    placeholder="Webhook URL"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />

                  {/* Webhook Send/Edit Split Button */}
                  <div
                    className="relative flex bg-[#5865f2] rounded-[4px] shadow-sm overflow-hidden"
                    ref={webhookRef}
                  >
                    <button
                      type="button"
                      onClick={() => handleWebhook("send")}
                      className="hover:bg-[#4752c4] text-white px-4 py-1.5 text-[13px] font-medium transition-colors border-r border-[#4752c4]"
                    >
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => setWebhookDropOpen(!webhookDropOpen)}
                      className="hover:bg-[#4752c4] text-white px-2 py-1.5 text-[13px] font-medium transition-colors flex items-center"
                    >
                      <ChevronDown size={14} />
                    </button>
                    {webhookDropOpen && (
                      <div className="absolute top-full left-0 mt-1 w-32 bg-[#1e1f22] border border-[#111214] rounded shadow-lg z-50 py-1">
                        <button
                          type="button"
                          onClick={() => handleWebhook("edit")}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors"
                        >
                          Edit Message
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="w-px h-5 bg-[#1e1f22] mx-1" />

                  {/* Send via Bot Split Button */}
                  <div
                    className="relative flex bg-[#23a55a] rounded-[4px] shadow-sm overflow-hidden ml-auto"
                    ref={botRef}
                  >
                    <button
                      type="button"
                      onClick={() => openBotModal("send")}
                      className="hover:bg-[#1da24a] text-white px-4 py-1.5 text-[13px] font-medium transition-colors border-r border-[#1da24a] flex items-center gap-1.5"
                    >
                      <Bot size={15} /> Send via Bot
                    </button>
                    <button
                      type="button"
                      onClick={() => setBotDropOpen(!botDropOpen)}
                      className="hover:bg-[#1da24a] text-white px-2 py-1.5 text-[13px] font-medium transition-colors flex items-center"
                    >
                      <ChevronDown size={14} />
                    </button>
                    {botDropOpen && (
                      <div className="absolute top-full right-0 mt-1 w-36 bg-[#1e1f22] border border-[#111214] rounded shadow-lg z-50 py-1">
                        <button
                          type="button"
                          onClick={() => openBotModal("edit")}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors"
                        >
                          Edit Message
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stacked Discohook Accordion Workspace */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <Accordion title="Message 1" defaultOpen={true}>
                  <MessageEditor />
                </Accordion>

                <Accordion title="Thread" defaultOpen={false}>
                  <div className="text-[12px] text-[#949ba4] italic p-2 border border-dashed border-[#35373c] rounded text-center">
                    Thread configuration is active via the Message Identity section in Message 1.
                  </div>
                </Accordion>

                <Accordion title="Profile" defaultOpen={false}>
                  <ProfilesPanel />
                </Accordion>

                <Accordion title="Attachments (0/10)" defaultOpen={false}>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => alert("Upload file directly to Discord CDN or via Webhook.")}
                      className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-3.5 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors"
                    >
                      Add File
                    </button>
                    <button
                      type="button"
                      onClick={() => alert("Paste image URL into Embed Image or Message Content.")}
                      className="bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] px-3.5 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors"
                    >
                      Paste File
                    </button>
                  </div>
                </Accordion>

                <Accordion title="Component Palette" defaultOpen={mode === "v2"}>
                  <ComponentPalette />
                </Accordion>

                <Accordion title="Component Layers" defaultOpen={mode === "v2"}>
                  <LayersPanel />
                </Accordion>

                <Accordion
                  title="Action Rows & Buttons"
                  defaultOpen={mode === "v2"}
                >
                  <DiscohookComponentsEditor />
                </Accordion>
              </div>
            </div>
          }
          right={
            <div
              className={`${
                mobileView === "preview" ? "flex" : "hidden"
              } md:flex min-h-0 flex-1 flex-col bg-[#313338] relative`}
            >
              <MessagePreview />
            </div>
          }
        />
      </main>

      {/* Modal Dialogs */}
      <ComponentEditorModal />

      <BotDispatchModal
        open={botModalOpen}
        onClose={() => setBotModalOpen(false)}
        initialMode={botModalMode}
      />

      <Modal
        open={backupsModalOpen}
        onClose={() => setBackupsModalOpen(false)}
        title="Saved Backups & Templates"
        width="max-w-xl"
      >
        {templates.length === 0 ? (
          <p className="text-xs text-[#949ba4] py-6 text-center">
            No saved templates yet. Name your template in the top bar and click Save.
          </p>
        ) : (
          <ul className="divide-y divide-[#1e1f22]">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex items-center justify-between py-2.5"
              >
                <div>
                  <p className="text-sm font-bold text-white">{template.name}</p>
                  <p className="text-[11px] text-[#949ba4]">
                    Updated {new Date(template.updated_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    void loadTemplate(template.id);
                    setBackupsModalOpen(false);
                  }}
                  className="bg-[#5865f2] hover:bg-[#4752c4] text-white border-none"
                >
                  Load
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
};

export default App;