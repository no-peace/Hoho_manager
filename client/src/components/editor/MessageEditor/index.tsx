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

  const rawMessage =
    (messages && messages[index]) || (index === 0 ? data : messages?.[0]) || data;
  const message = rawMessage as ExtendedMessageData;
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

  return (
    <div
      onClick={() => ensureActive()}
      className={
        isActive
          ? UI_THEME_CONFIG.surfaces.editorCardActive
          : UI_THEME_CONFIG.surfaces.editorCardInactive
      }
    >
      {/* ── Message Collapsible Trigger Header ── */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 bg-[#232428] select-none ${
          isOpen ? "rounded-t-xl border-b border-[#1e1f22]" : "rounded-xl"
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
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors"
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
              className="bg-[#1e1f22] text-xs font-bold text-white px-2 py-0.5 rounded border border-[#5865f2] outline-none"
            />
          ) : (
            <span className="text-xs font-bold text-[#dbdee1] truncate">
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
              className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors"
              title="Move Message Up"
            >
              <ChevronUp size={14} />
            </button>
          )}

          {index < messages.length - 1 && (
            <button
              type="button"
              onClick={() => moveMessage?.(index, 1)}
              className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors"
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
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors"
            title="Rename Message"
          >
            <Edit2 size={13} />
          </button>

          <button
            type="button"
            onClick={() => duplicateMessage?.(index)}
            disabled={messages.length >= 10}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] disabled:opacity-30 transition-colors"
            title="Duplicate Message"
          >
            <Copy size={13} />
          </button>

          <button
            type="button"
            onClick={() => removeMessage?.(index)}
            disabled={messages.length <= 1}
            className="p-1 rounded text-[#949ba4] hover:text-[#f28b8b] hover:bg-[#da373c]/20 disabled:opacity-30 transition-colors"
            title="Delete Message"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Message Body Panel ── */}
      {isOpen && (
        <div className="p-3 space-y-3 bg-[#2b2d31] rounded-b-xl">
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
          <div className="pt-2 border-t border-[#1e1f22] flex flex-wrap items-center gap-2">
            {!isV2 ? (
              <>
                <button
                  type="button"
                  disabled={(message.embeds?.length ?? 0) >= 10}
                  onClick={() => {
                    ensureActive();
                    addEmbed();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] active:scale-[0.97] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-all"
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
                  className="px-3 py-1.5 rounded-lg bg-[#35373c] hover:bg-[#4e5058] active:scale-[0.97] text-[#dbdee1] hover:text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-all"
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
                  className="px-3 py-1.5 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] active:scale-[0.97] text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
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
                      className="absolute left-0 bottom-full mb-1.5 w-48 max-w-[calc(100vw-2rem)] bg-[#18191c] border border-[#26282d] shadow-2xl rounded-xl py-1 z-30 text-xs"
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
                            className="w-full text-left px-3 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2 transition-colors"
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 active:scale-[0.97] transition-all ${
                message.message_link
                  ? "bg-[#5865f2]/20 text-[#dee0fc] border border-[#5865f2]/50 hover:bg-[#5865f2]/30"
                  : "bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] hover:text-white"
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
                className="px-3 py-1.5 rounded-lg bg-[#35373c] hover:bg-[#4e5058] active:scale-[0.97] text-[#dbdee1] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
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
                    className="absolute left-0 bottom-full mb-1.5 w-56 max-w-[calc(100vw-2rem)] bg-[#18191c] border border-[#26282d] shadow-2xl rounded-xl py-1 z-30 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const text = JSON.stringify(message, null, 2);
                        void navigator.clipboard.writeText(text);
                        useGlobalStore.getState().showToast("Message JSON copied to clipboard!", "success");
                        setOptionsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                    >
                      <Copy size={13} /> Copy Message JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMessageMode(
                          index,
                          isV2 ? EDITOR_MODES.CLASSIC : EDITOR_MODES.V2,
                        );
                        setOptionsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
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
