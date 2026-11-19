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
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ComponentType, MessageFlags } from "@dmb/shared";
import { ShinyText } from "../../reactbits/ReactBitsPrimitives";
import { useGlobalStore } from "../../../store/globalStore";
import { useMessageStore } from "../../../store/messageStore";
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

export const MessageEditor: React.FC<MessageEditorProps> = ({ index }) => {
  // Subscribe to this card's message object, not the entire messages array.
  // Editing one message therefore leaves every other MessageEditor instance stable.
  const message = useMessageStore(
    (state) =>
      state.messages[index] ||
      (index === 0 ? state.data : state.messages[0]) ||
      state.data,
  ) as ExtendedMessageData;
  const messageCount = useMessageStore((state) => state.messages.length);
  const activeMessageIndex = useMessageStore((state) => state.activeMessageIndex ?? 0);
  const selectedTargetId = useMessageStore((state) => {
    if ((state.activeMessageIndex ?? 0) !== index) return undefined;
    const selection = state.selection;
    return selection?.kind === "embed" || selection?.kind === "component"
      ? `${selection.kind}:${selection.id}`
      : undefined;
  });
  const selectedMessage = useMessageStore(
    (state) => state.selection?.kind === "message" && state.selection.index === index,
  );
  const setActiveMessageIndex = useMessageStore((state) => state.setActiveMessageIndex);
  const duplicateMessage = useMessageStore((state) => state.duplicateMessage);
  const removeMessage = useMessageStore((state) => state.removeMessage);
  const moveMessage = useMessageStore((state) => state.moveMessage);
  const setMessageMode = useMessageStore((state) => state.setMessageMode);
  const setField = useMessageStore((state) => state.setField);
  const addEmbed = useMessageStore((state) => state.addEmbed);
  const addComponent = useMessageStore((state) => state.addComponent);

  const isActive = activeMessageIndex === index;

  const setExtendedField = <K extends keyof ExtendedMessageData>(
    key: K,
    value: ExtendedMessageData[K],
  ) => {
    setField(key as any, value as any);
  };

  const ensureActive = () => {
    if (!isActive && setActiveMessageIndex) {
      setActiveMessageIndex(index);
    }
  };

  const isV2 =
    Boolean((message.flags ?? 0) & MessageFlags.IsComponentsV2) ||
    (message as any).mode === EDITOR_MODES.V2;

  const [isOpen, setIsOpen] = useState(true);

  // Preview navigation must reveal a selected target even when its message card
  // was previously collapsed by the user.
  useEffect(() => {
    if (selectedMessage || selectedTargetId !== undefined) setIsOpen(true);
  }, [activeMessageIndex, index, selectedMessage, selectedTargetId]);

  const [customName, setCustomName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const addMenuRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addMenuOpen && !optionsMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) setOptionsMenuOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddMenuOpen(false);
        setOptionsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [addMenuOpen, optionsMenuOpen]);

  const canAddClassicActionRow =
    !isV2 &&
    (message.components || []).filter((c) => c.type === ComponentType.ActionRow).length < 5;

  const handleModeConversion = () => {
    const components = message.components ?? [];
    const classicInteractiveTypes = new Set<number>([
      ComponentType.Button,
      ComponentType.StringSelect,
      ComponentType.UserSelect,
      ComponentType.RoleSelect,
      ComponentType.MentionableSelect,
      ComponentType.ChannelSelect,
    ]);
    const projectedClassicContent = [
      message.content ?? "",
      ...components
        .filter((component) => component.type === ComponentType.TextDisplay)
        .map((component) => component.content ?? ""),
    ].filter((part) => part.length > 0).join("\n\n");
    const canConvertV2ToClassic =
      projectedClassicContent.length <= 2000 &&
      components.every(
        (component) =>
          component.type === ComponentType.TextDisplay ||
          (component.type === ComponentType.ActionRow &&
            (component.components ?? []).every((child) =>
              classicInteractiveTypes.has(child.type),
            )),
      );
    const canConvertClassicToV2 =
      components.every(
        (component) =>
          component.type === ComponentType.ActionRow &&
          (component.components ?? []).every((child) =>
            classicInteractiveTypes.has(child.type),
          ),
      ) && (message.embeds?.length ?? 0) === 0;

    if (isV2 && !canConvertV2ToClassic) {
      useGlobalStore.getState().showToast(
        projectedClassicContent.length > 2000
          ? "Cannot convert: Classic text limit is 2,000 characters."
          : "Cannot convert: unsupported V2 components.",
        "warning",
      );
      setOptionsMenuOpen(false);
      return;
    }

    if (!isV2 && !canConvertClassicToV2) {
      useGlobalStore.getState().showToast(
        (message.embeds?.length ?? 0) > 0
          ? "Cannot convert: remove embeds before switching to V2."
          : "Cannot convert: unsupported Classic components.",
        "warning",
      );
      setOptionsMenuOpen(false);
      return;
    }

    setMessageMode(index, isV2 ? EDITOR_MODES.CLASSIC : EDITOR_MODES.V2);
    setOptionsMenuOpen(false);
  };

  return (
    <div
      data-message-editor-index={index}
      onClick={() => ensureActive()}
      className={
        isActive
          ? UI_THEME_CONFIG.surfaces.editorCardActive
          : UI_THEME_CONFIG.surfaces.editorCardInactive
      }
    >
      {/* ── Message Collapsible Trigger Header ── */}
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 bg-[#161A23] border-b border-[#272D3A] select-none ${
          isOpen ? "rounded-t-xl border-b border-[#272D3A]" : "rounded-xl"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            title={isOpen ? "Collapse Message" : "Expand Message"}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-1 rounded text-[#A1A8B8] hover:text-white hover:bg-[#252B3A] transition-colors"
          >
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {isEditingName ? (
            <input
              type="text"
              autoFocus
              value={customName}
              placeholder={`Message ${index + 1}`}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setCustomName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditingName(false);
              }}
              className="bg-[#272D3A] text-xs font-bold text-white px-2 py-0.5 rounded border border-[#818CF8] outline-none"
            />
          ) : (
            <span className="text-xs font-bold text-[#F1F3F9] truncate">
              {customName || `Message ${index + 1}`}
            </span>
          )}

          <span
            className={
              isV2
                ? UI_THEME_CONFIG.surfaces.badgeBlurple
                : UI_THEME_CONFIG.surfaces.badgeNeutral
            }
          >
            {isV2 ? <ShinyText text="Components V2" /> : "Classic"}
          </span>
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {index > 0 && (
            <button
              type="button"
              onClick={() => moveMessage?.(index, -1)}
              className="p-1 rounded text-[#A1A8B8] hover:text-white hover:bg-[#252B3A] transition-colors"
              title="Move Message Up"
            >
              <ChevronUp size={14} />
            </button>
          )}

          {index < messageCount - 1 && (
            <button
              type="button"
              onClick={() => moveMessage?.(index, 1)}
              className="p-1 rounded text-[#A1A8B8] hover:text-white hover:bg-[#252B3A] transition-colors"
              title="Move Message Down"
            >
              <ChevronDown size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setCustomName(customName || `Message ${index + 1}`);
              setIsEditingName(true);
            }}
            className="p-1 rounded text-[#A1A8B8] hover:text-white hover:bg-[#252B3A] transition-colors"
            title="Rename Message"
          >
            <Edit2 size={13} />
          </button>

          <button
            type="button"
            onClick={() => duplicateMessage?.(index)}
            disabled={messageCount >= 10}
            className="p-1 rounded text-[#A1A8B8] hover:text-white hover:bg-[#252B3A] disabled:opacity-30 transition-colors"
            title="Duplicate Message"
          >
            <Copy size={13} />
          </button>

          <button
            type="button"
            onClick={() => removeMessage?.(index)}
            disabled={messageCount <= 1}
            className="p-1 rounded text-[#A1A8B8] hover:text-[#f28b8b] hover:bg-[#da373c]/20 disabled:opacity-30 transition-colors"
            title="Delete Message"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Message Body Panel ── */}
      {isOpen && (
        <div className="p-3 space-y-3 bg-[#161A23] rounded-b-xl">
          <ContentTab
            message={message}
            isV2={isV2}
            ensureActive={ensureActive}
            setField={setField}
            setExtendedField={setExtendedField}
          />

          {!isV2 && <EmbedsTab embeds={message.embeds || []} />}

          <ComponentsTab message={message} isV2={isV2} ensureActive={ensureActive} />

          {/* ── Footer Action Bar (+ Add, Set Link, Options) ── */}
          <div className="pt-2 border-t border-[#272D3A] flex flex-wrap items-center gap-2">
            {!isV2 ? (
              <>
                <button
                  type="button"
                  disabled={(message.embeds?.length ?? 0) >= 10}
                  onClick={() => {
                    ensureActive();
                    addEmbed();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] active:scale-[0.97] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out"
                >
                  <Plus size={13} /> Add Embed ({message.embeds?.length ?? 0}/10)
                </button>
                <button
                  type="button"
                  disabled={!canAddClassicActionRow}
                  onClick={() => {
                    ensureActive();
                    addComponent(ComponentType.ActionRow, null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#252B3A] hover:bg-[#4e5058] active:scale-[0.97] text-[#F1F3F9] hover:text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out"
                >
                  <Plus size={13} /> Add Action Row
                </button>
              </>
            ) : (
              <div className="relative" ref={addMenuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddMenuOpen(!addMenuOpen);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] active:scale-[0.97] text-white text-xs font-semibold flex items-center gap-1.5 transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out"
                >
                  <Plus size={13} /> Add <ChevronDown size={13} />
                </button>

                <AnimatePresence>
                  {addMenuOpen && (
                    <motion.div
                      initial={UI_THEME_CONFIG.motion.popoverPoses.initial}
                      animate={UI_THEME_CONFIG.motion.popoverPoses.animate}
                      exit={UI_THEME_CONFIG.motion.popoverPoses.exit}
                      style={{ transformOrigin: "bottom left" }}
                      className="absolute left-0 bottom-full mb-1.5 w-48 max-w-[calc(100vw-2rem)] bg-[#10131A] border border-[#272D3A] shadow-2xl rounded-xl py-1 z-30 text-xs"
                    >
                      {V2_ADD_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                              ensureActive();
                              addComponent(opt.type, null);
                              setAddMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-1.5 text-[#F1F3F9] hover:bg-[#818CF8] hover:text-white flex items-center gap-2 transition-colors"
                          >
                            <Icon size={13} /> {opt.label}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                ensureActive();
                setLinkModalOpen(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 active:scale-[0.97] transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out ${
                message.message_link
                  ? "bg-[#818CF8]/20 text-[#dee0fc] border border-[#818CF8]/50 hover:bg-[#818CF8]/30"
                  : "bg-[#252B3A] hover:bg-[#4e5058] text-[#F1F3F9] hover:text-white"
              }`}
            >
              <Link size={13} /> {message.message_link ? "Edit Link" : "Set Link"}
            </button>

            <div className="relative" ref={optionsMenuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOptionsMenuOpen(!optionsMenuOpen);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#252B3A] hover:bg-[#4e5058] active:scale-[0.97] text-[#F1F3F9] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out"
              >
                <SlidersHorizontal size={13} /> Options <ChevronDown size={13} />
              </button>

              <AnimatePresence>
                {optionsMenuOpen && (
                  <motion.div
                    initial={UI_THEME_CONFIG.motion.popoverPoses.initial}
                    animate={UI_THEME_CONFIG.motion.popoverPoses.animate}
                    exit={UI_THEME_CONFIG.motion.popoverPoses.exit}
                    style={{ transformOrigin: "bottom left" }}
                    className="absolute left-0 bottom-full mb-1.5 w-56 max-w-[calc(100vw-2rem)] bg-[#10131A] border border-[#272D3A] shadow-2xl rounded-xl py-1 z-30 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const text = JSON.stringify(message, null, 2);
                        void navigator.clipboard.writeText(text);
                        useGlobalStore.getState().showToast("Message JSON copied to clipboard!", "success");
                        setOptionsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[#F1F3F9] hover:bg-[#818CF8] hover:text-white flex items-center gap-2"
                    >
                      <Copy size={13} /> Copy Message JSON
                    </button>
                    <button
                      type="button"
                      onClick={handleModeConversion}
                      className="w-full text-left px-3 py-1.5 text-[#F1F3F9] hover:bg-[#818CF8] hover:text-white flex items-center gap-2"
                    >
                      <Layers size={13} /> Convert to {isV2 ? "Classic" : "Components V2"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      <MessageLinkModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        message={message}
        ensureActive={ensureActive}
        setExtendedField={setExtendedField}
      />
    </div>
  );
};

export default React.memo(MessageEditor);
