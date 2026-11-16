import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Edit2,
  Layers,
  Link,
  Plus,
  Trash2,
  Workflow,
  FileText,
  Box,
} from "lucide-react";
import { ComponentType, MessageFlags } from "@dmb/shared";
import { useGlobalStore } from "../../../store/globalStore";
import { useMessageStore } from "../../../store/messageStore";
import { useActionStore } from "../../../store/actionStore";
import { EDITOR_MODES } from "../../../utils/constants";
import type { ExtendedMessageData } from "../../../utils/discord";
import { UI_THEME_CONFIG } from "../../../config/uiThemeConfig";
import { ContentTab } from "./ContentTab";
import { EmbedsTab } from "./EmbedsTab";
import { ComponentsTab, V2_ADD_OPTIONS } from "./ComponentsTab";
import { MessageLinkModal } from "./MessageLinkModal";

export interface MessageEditorProps {
  index: number;
}

type WorkspaceTab = "content" | "embeds" | "components" | "actions";

const collectComponents = (nodes: any[] = []): any[] =>
  nodes.flatMap((node) => [
    node,
    ...(Array.isArray(node.components) ? collectComponents(node.components) : []),
    ...(node.accessory ? collectComponents([node.accessory]) : []),
  ]);

export const MessageEditor: React.FC<MessageEditorProps> = ({ index }) => {
  const messages = useMessageStore((state) => state.messages);
  const data = useMessageStore((state) => state.data);
  const activeMessageIndex = useMessageStore((state) => state.activeMessageIndex ?? 0);
  const setActiveMessageIndex = useMessageStore((state) => state.setActiveMessageIndex);
  const duplicateMessage = useMessageStore((state) => state.duplicateMessage);
  const removeMessage = useMessageStore((state) => state.removeMessage);
  const moveMessage = useMessageStore((state) => state.moveMessage);
  const setMessageMode = useMessageStore((state) => state.setMessageMode);
  const setField = useMessageStore((state) => state.setField);
  const addEmbed = useMessageStore((state) => state.addEmbed);
  const addComponent = useMessageStore((state) => state.addComponent);
  const select = useMessageStore((state) => state.select);
  const attachedFiles = useMessageStore((state) => state.attachedFiles);
  const clearFiles = useMessageStore((state) => state.clearFiles);
  const flows = useActionStore((state) => state.flows);
  const removeFlow = useActionStore((state) => state.removeFlow);

  const rawMessage =
    (messages && messages[index]) || (index === 0 ? data : messages?.[0]) || data;
  const message = rawMessage as ExtendedMessageData;
  const isActive = activeMessageIndex === index;
  const [isOpen, setIsOpen] = useState(true);
  const [customName, setCustomName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("content");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const setExtendedField = <K extends keyof ExtendedMessageData>(
    key: K,
    value: ExtendedMessageData[K],
  ) => setField(key as any, value as any);

  const ensureActive = () => {
    if (!isActive && setActiveMessageIndex) setActiveMessageIndex(index);
  };

  const isV2 =
    Boolean((message.flags ?? 0) & MessageFlags.IsComponentsV2) ||
    (message as any).mode === EDITOR_MODES.V2;

  const components = collectComponents(message.components || []);
  const actionItems = components
    .filter((component) => Boolean(component.custom_id && flows[component.custom_id]?.length))
    .map((component) => ({
      component,
      customId: component.custom_id as string,
      steps: flows[component.custom_id as string] || [],
    }));
  const actionCount = actionItems.length;
  const componentCount = components.length;
  const canAddClassicActionRow =
    !isV2 &&
    (message.components || []).filter((component) => component.type === ComponentType.ActionRow).length < 5;

  useEffect(() => {
    if (!addMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) setAddMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [addMenuOpen]);

  const clearCurrentMessage = () => {
    if (!window.confirm("Clear all content, embeds, components, attachments, and message settings? This cannot be undone.")) return;
    ensureActive();
    for (const item of components) {
      if (item.custom_id) removeFlow(item.custom_id);
    }
    const emptyFields: Record<string, unknown> = {
      content: "",
      embeds: [],
      components: [],
      username: "",
      avatar_url: "",
      thread_name: "",
      thread_id: "",
      message_link: undefined,
      link_mode: undefined,
      edit_channel_id: undefined,
      edit_message_id: undefined,
      message_reference: undefined,
      allowed_mentions: undefined,
      flags: 0,
    };
    Object.entries(emptyFields).forEach(([key, value]) => setField(key as any, value as any));
    clearFiles();
    select(null);
    setActiveTab("content");
    useGlobalStore.getState().showToast("Message content cleared.", "success");
  };

  const tabButton = (
    tab: WorkspaceTab,
    label: string,
    count?: number,
    icon?: React.ComponentType<{ size?: number }>,
  ) => {
    const Icon = icon;
    const selected = activeTab === tab;
    return (
      <button
        key={tab}
        type="button"
        onClick={() => {
          ensureActive();
          setActiveTab(tab);
        }}
        aria-pressed={selected}
        className={`inline-flex h-9 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition-colors ${selected
          ? "border-[#818CF8] text-[#F1F3F9]"
          : "border-transparent text-[#8D96A8] hover:text-[#E3E7F0]"}`}
      >
        {Icon && <Icon size={13} />}
        {label}
        {typeof count === "number" && (
          <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${selected ? "bg-[#818CF8]/15 text-[#C7D2FE]" : "bg-[#1D2230] text-[#8D96A8]"}`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      onClick={() => ensureActive()}
      className={isActive ? UI_THEME_CONFIG.surfaces.editorCardActive : UI_THEME_CONFIG.surfaces.editorCardInactive}
    >
      <div className={`flex items-center justify-between gap-2 border-b border-[#272D3A] bg-[#10131A] px-3 py-2 select-none ${isOpen ? "rounded-t-xl" : "rounded-xl"}`}>
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            title={isOpen ? "Collapse Message" : "Expand Message"}
            onClick={(event) => { event.stopPropagation(); setIsOpen(!isOpen); }}
            className="rounded p-1 text-[#A1A8B8] transition-colors hover:bg-[#252B3A] hover:text-white"
          >
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          {isEditingName ? (
            <input
              type="text"
              autoFocus
              value={customName}
              placeholder={`Message ${index + 1}`}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setCustomName(event.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(event) => { if (event.key === "Enter") setIsEditingName(false); }}
              className="rounded border border-[#818CF8] bg-[#1D2230] px-2 py-0.5 text-xs font-bold text-white outline-none"
            />
          ) : (
            <span className="truncate text-xs font-bold text-[#F1F3F9]">{customName || `Message ${index + 1}`}</span>
          )}
          <span className={isV2 ? UI_THEME_CONFIG.surfaces.badgeBlurple : UI_THEME_CONFIG.surfaces.badgeNeutral}>
            {isV2 ? "Components V2" : "Classic"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
          {index > 0 && <button type="button" onClick={() => moveMessage?.(index, -1)} className="rounded p-1 text-[#A1A8B8] hover:bg-[#252B3A] hover:text-white" title="Move Message Up"><ChevronUp size={14} /></button>}
          {index < messages.length - 1 && <button type="button" onClick={() => moveMessage?.(index, 1)} className="rounded p-1 text-[#A1A8B8] hover:bg-[#252B3A] hover:text-white" title="Move Message Down"><ChevronDown size={14} /></button>}
          <button type="button" onClick={() => { setCustomName(customName || `Message ${index + 1}`); setIsEditingName(true); }} className="rounded p-1 text-[#A1A8B8] hover:bg-[#252B3A] hover:text-white" title="Rename Message"><Edit2 size={13} /></button>
          <button type="button" onClick={() => duplicateMessage?.(index)} disabled={messages.length >= 10} className="rounded p-1 text-[#A1A8B8] hover:bg-[#252B3A] hover:text-white disabled:opacity-30" title="Duplicate Message"><Copy size={13} /></button>
          <button type="button" onClick={() => removeMessage?.(index)} disabled={messages.length <= 1} className="rounded p-1 text-[#A1A8B8] hover:bg-[#F87171]/20 hover:text-[#F87171] disabled:opacity-30" title="Delete Message"><Trash2 size={13} /></button>
        </div>
      </div>

      {isOpen && (
        <div className="rounded-b-[10px] bg-[#0B0D12]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#272D3A] bg-[#10131A] px-4">
            <div className="flex min-w-0 items-center overflow-x-auto">
              {tabButton("content", "Content", undefined, FileText)}
              {tabButton("embeds", "Embeds", message.embeds?.length ?? 0)}
              {tabButton("components", "Components V2", componentCount, Layers)}
              {tabButton("actions", "Actions", actionCount, Workflow)}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 py-1.5">
              <button type="button" onClick={(event) => { event.stopPropagation(); ensureActive(); setLinkModalOpen(true); }} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#272D3A] bg-[#1D2230] px-2 text-[11px] font-medium text-[#C7D0DF] hover:border-[#818CF8]/50 hover:text-white">
                <Link size={12} /> Import Message Link
              </button>
              <button type="button" onClick={(event) => { event.stopPropagation(); clearCurrentMessage(); }} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#713B43]/60 bg-[#3B2028]/50 px-2 text-[11px] font-medium text-[#FCA5A5] hover:bg-[#713B43]/40">
                <Trash2 size={12} /> Clear All
              </button>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); ensureActive(); setMessageMode(index, isV2 ? EDITOR_MODES.CLASSIC : EDITOR_MODES.V2); }}
                title="Toggle Components V2 mode"
                className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[10px] font-semibold ${isV2 ? "border-[#818CF8]/50 bg-[#818CF8]/15 text-[#C7D2FE]" : "border-[#272D3A] bg-[#1D2230] text-[#9AA4B6] hover:text-white"}`}
              >
                <Layers size={12} /> {isV2 ? "V2 Mode" : "Classic Mode"}
              </button>
            </div>
          </div>

          <div className="min-h-[240px] p-3 sm:p-4">
            {activeTab === "content" && (
              <ContentTab message={message} isV2={isV2} ensureActive={ensureActive} setField={setField} setExtendedField={setExtendedField} />
            )}
            {activeTab === "embeds" && (
              isV2 ? (
                <div className="rounded-[10px] border border-[#272D3A] bg-[#161A23] p-4 text-xs text-[#A1A8B8]">
                  Embeds are unavailable while Components V2 mode is enabled. Switch to Classic Mode to edit embeds.
                </div>
              ) : (
                <EmbedsTab embeds={message.embeds || []} canAdd={(message.embeds?.length ?? 0) < 10} onAddEmbed={() => { ensureActive(); addEmbed(); }} />
              )
            )}
            {activeTab === "components" && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-[#F1F3F9]">{isV2 ? "Components V2" : "Message Components"}</h3>
                    <p className="mt-0.5 text-[10px] text-[#7F899C]">{componentCount} component{componentCount === 1 ? "" : "s"} in this message</p>
                  </div>
                  {!isV2 ? (
                    <button type="button" disabled={!canAddClassicActionRow} onClick={() => { ensureActive(); addComponent(ComponentType.ActionRow, null); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#252B3A] px-3 text-xs font-semibold text-[#F1F3F9] hover:bg-[#343C4E] disabled:opacity-40">
                      <Plus size={13} /> Add Action Row
                    </button>
                  ) : (
                    <div className="relative" ref={addMenuRef}>
                      <button type="button" onClick={(event) => { event.stopPropagation(); setAddMenuOpen(!addMenuOpen); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#818CF8] px-3 text-xs font-semibold text-white hover:bg-[#6366F1]">
                        <Plus size={13} /> Add Component <ChevronDown size={13} />
                      </button>
                      {addMenuOpen && (
                        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-[#272D3A] bg-[#10131A] py-1 shadow-2xl">
                          {V2_ADD_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            return <button key={option.label} type="button" onClick={() => { ensureActive(); addComponent(option.type, null); setAddMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#DCE2ED] hover:bg-[#252B3A]"><Icon size={13} />{option.label}</button>;
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <ComponentsTab message={message} isV2={isV2} ensureActive={ensureActive} />
              </section>
            )}
            {activeTab === "actions" && (
              <section className="space-y-3">
                <div>
                  <h3 className="text-xs font-semibold text-[#F1F3F9]">Interactive component actions</h3>
                  <p className="mt-0.5 text-[11px] text-[#8D96A8]">Action flows attached to interactive components in this message.</p>
                </div>
                {actionItems.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-[#272D3A] bg-[#161A23] px-5 py-8 text-center">
                    <Workflow size={20} className="mx-auto text-[#818CF8]" />
                    <h4 className="mt-2 text-sm font-semibold text-[#F1F3F9]">No actions configured</h4>
                    <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#8D96A8]">Add an interactive button, select it in the editor, then configure its Actions Flow in the inspector.</p>
                    <button type="button" onClick={() => setActiveTab("components")} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-[#252B3A] px-3 text-xs font-semibold text-[#E3E7F0] hover:bg-[#343C4E]"><Box size={13} /> Open Components</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {actionItems.map(({ component, customId, steps }, actionIndex) => (
                      <button
                        key={customId}
                        type="button"
                        onClick={() => {
                          ensureActive();
                          if (component._id) {
                            select({ kind: "component", id: component._id });
                            window.dispatchEvent(new CustomEvent("hoho:open-component-flow", { detail: { componentId: component._id } }));
                          }
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-[#272D3A] bg-[#161A23] p-3 text-left transition-colors hover:border-[#818CF8]/60 hover:bg-[#1D2230]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#818CF8]/10 text-[#A5B4FC]"><Workflow size={15} /></span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-[#F1F3F9]">{component.label || component.placeholder || `Interactive component ${actionIndex + 1}`}</span>
                            <span className="mt-0.5 block truncate font-mono text-[10px] text-[#8D96A8]">{customId}</span>
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md border border-[#272D3A] bg-[#10131A] px-2 py-1 font-mono text-[10px] text-[#C7D2FE]">{steps.length} step{steps.length === 1 ? "" : "s"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      <MessageLinkModal open={linkModalOpen} onClose={() => setLinkModalOpen(false)} message={message} ensureActive={ensureActive} setExtendedField={setExtendedField} />
    </div>
  );
};

export default React.memo(MessageEditor);
