import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Trash2,
  Edit2,
  Plus,
  Link,
  SlidersHorizontal,
  Image as ImageIcon,
  Layers,
  X,
} from "lucide-react";
import { Limits, ComponentType } from "@dmb/shared";
import { DiscordMentionInput } from "./DiscordMentionInput";
import { EmbedEditor } from "./EmbedEditor";
import { DiscohookComponentsEditor } from "./DiscohookComponentsEditor";
import { FileAttachmentsSection } from "./FileAttachmentsSection";
import { useMessageStore } from "../../store/messageStore";
import { EDITOR_MODES } from "../../utils/constants";

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
  const setField = useMessageStore((state) => state.setField);
  const addEmbed = useMessageStore((state) => state.addEmbed);
  const addComponent = useMessageStore((state) => state.addComponent);
  const mode = useMessageStore((state) => state.mode);
  const setMode = useMessageStore((state) => state.setMode);

  const message = (messages && messages[index]) || (index === 0 ? data : messages?.[0]) || data;
  const isActive = activeMessageIndex === index;

  // Local collapsible section states matching Discohook
  const [isOpen, setIsOpen] = useState(true);
  const [threadOpen, setThreadOpen] = useState(Boolean(message.thread_name));
  const [profileOpen, setProfileOpen] = useState(Boolean(message.username || message.avatar_url));

  // Rename message state
  const [isEditingName, setIsEditingName] = useState(false);
  const [customName, setCustomName] = useState("");

  // Dropdown states with outside-click handling
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [messageLinkInput, setMessageLinkInput] = useState("");

  const addMenuRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    if (!addMenuOpen && !optionsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (addMenuOpen && addMenuRef.current && !addMenuRef.current.contains(target)) {
        setAddMenuOpen(false);
      }
      if (optionsMenuOpen && optionsMenuRef.current && !optionsMenuRef.current.contains(target)) {
        setOptionsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addMenuOpen, optionsMenuOpen]);

  return (
    <div
      onClick={() => setActiveMessageIndex?.(index)}
      className={`rounded-lg bg-[#292b2f] border transition-all overflow-hidden ${
        isActive
          ? "border-[#5865f2] ring-1 ring-[#5865f2] shadow-md"
          : "border-[#1e1f22] hover:border-[#383a40]"
      }`}
    >
      {/* ── Message Collapsible Trigger Header (Discohook style) ── */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#232428] border-b border-[#1e1f22] select-none">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
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
        </div>

        {/* Action icons: Move Up, Move Down, Rename, Duplicate, Delete */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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

      {/* ── Mode Switch Bar: Classic vs Components V2 & Options ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#232428] border-b border-[#1e1f22]">
        <div
          className="flex rounded-lg bg-[#1e1f22] p-0.5 border border-[#111214]"
          role="tablist"
          aria-label="Message Editor Mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === EDITOR_MODES.CLASSIC}
            onClick={() => setMode(EDITOR_MODES.CLASSIC)}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              mode === EDITOR_MODES.CLASSIC
                ? "bg-[#5865f2] text-white shadow-sm"
                : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#2b2d31]"
            }`}
          >
            Classic
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === EDITOR_MODES.V2}
            onClick={() => setMode(EDITOR_MODES.V2)}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              mode === EDITOR_MODES.V2
                ? "bg-[#5865f2] text-white shadow-sm"
                : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#2b2d31]"
            }`}
          >
            Components V2
          </button>
        </div>

        {/* Options ∨ Button */}
        <div className="relative" ref={optionsMenuRef}>
          <button
            type="button"
            onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
            className="px-2.5 py-1 rounded bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal size={13} /> Options <ChevronDown size={13} />
          </button>

          {optionsMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#1e1f22] border border-[#111214] shadow-2xl rounded-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-75 text-xs">
              <button
                type="button"
                onClick={() => {
                  const text = JSON.stringify(message, null, 2);
                  navigator.clipboard.writeText(text);
                  alert("Message JSON copied to clipboard!");
                  setOptionsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
              >
                <Copy size={13} /> Copy Message JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Message Body Panel ── */}
      {isOpen && (
        <div className="p-3 space-y-3 bg-[#2b2d31]">
          {/* Mode-Specific Body: Classic vs Components V2 */}
          {mode === EDITOR_MODES.CLASSIC ? (
            <>
              {/* 1. Main Content Textarea */}
              <DiscordMentionInput
                label="Content"
                maxLength={Limits.content}
                rows={4}
                value={message.content || ""}
                placeholder="Say something… (type @, #, or : for suggestions)"
                onChange={(val) => setField("content", val)}
              />

              {/* 2. Thread Sub-Section */}
              <div className="rounded border border-[#1e1f22] bg-[#232428] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setThreadOpen(!threadOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
                >
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#949ba4]">
                    {threadOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Thread
                  </span>
                  {message.thread_name && (
                    <span className="text-[10px] text-[#5865f2] font-semibold truncate max-w-[150px]">
                      #{message.thread_name}
                    </span>
                  )}
                </button>

                {threadOpen && (
                  <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-2.5">
                    <p className="text-[11px] text-[#949ba4] italic">
                      Bot can create and post into forum threads or active threads.
                    </p>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                          Forum Thread Name
                        </label>
                        <span className="text-[10px] text-[#949ba4] font-mono">
                          {(message.thread_name?.length || 0)}/100
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={100}
                        value={message.thread_name || ""}
                        placeholder="Thread Title"
                        onChange={(e) => setField("thread_name", e.target.value)}
                        className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Profile Override Sub-Section */}
              <div className="rounded border border-[#1e1f22] bg-[#232428] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
                >
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#949ba4]">
                    {profileOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Profile
                  </span>
                  {message.username && (
                    <span className="text-[10px] text-[#949ba4] truncate max-w-[150px]">
                      {message.username}
                    </span>
                  )}
                </button>

                {profileOpen && (
                  <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                          Name
                        </label>
                        <span className="text-[10px] text-[#949ba4] font-mono">
                          {(message.username?.length || 0)}/80
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={80}
                        value={message.username || ""}
                        placeholder="Bot Name Override"
                        onChange={(e) => setField("username", e.target.value)}
                        className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                        Avatar URL
                      </label>
                      <input
                        type="url"
                        value={message.avatar_url || ""}
                        placeholder="https://…"
                        onChange={(e) => setField("avatar_url", e.target.value)}
                        className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Files Sub-Section */}
              <FileAttachmentsSection />

              {/* 5. Embeds List */}
              {message.embeds && message.embeds.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  {message.embeds.map((embed: any, eIdx: number) => (
                    <EmbedEditor key={embed._id || eIdx} embed={embed} index={eIdx} />
                  ))}
                </div>
              )}

              {/* 6. Action Rows / Interactive Components */}
              <div className="pt-1">
                <DiscohookComponentsEditor />
              </div>
            </>
          ) : (
            <>
              {/* Components V2 Builder Mode */}
              {/* 1. Profile Override Sub-Section */}
              <div className="rounded border border-[#1e1f22] bg-[#232428] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
                >
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#949ba4]">
                    {profileOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Profile Override
                  </span>
                  {message.username && (
                    <span className="text-[10px] text-[#949ba4] truncate max-w-[150px]">
                      {message.username}
                    </span>
                  )}
                </button>

                {profileOpen && (
                  <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                          Name
                        </label>
                        <span className="text-[10px] text-[#949ba4] font-mono">
                          {(message.username?.length || 0)}/80
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={80}
                        value={message.username || ""}
                        placeholder="Bot Name Override"
                        onChange={(e) => setField("username", e.target.value)}
                        className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                        Avatar URL
                      </label>
                      <input
                        type="url"
                        value={message.avatar_url || ""}
                        placeholder="https://…"
                        onChange={(e) => setField("avatar_url", e.target.value)}
                        className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Files Sub-Section */}
              <FileAttachmentsSection />

              {/* 3. Discohook Components Editor (Action Rows & Component Palette) */}
              <div className="pt-1">
                <DiscohookComponentsEditor />
              </div>
            </>
          )}

          {/* ── Bottom Action Toolbar ── */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#1e1f22]">
            {/* Add ∨ Button with Dropdown */}
            <div className="relative" ref={addMenuRef}>
              <button
                type="button"
                onClick={() => setAddMenuOpen(!addMenuOpen)}
                className="px-3 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus size={13} /> Add <ChevronDown size={13} />
              </button>

              {addMenuOpen && (
                <div className="absolute left-0 bottom-full mb-1.5 w-48 bg-[#1e1f22] border border-[#111214] shadow-2xl rounded-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-75">
                  <button
                    type="button"
                    onClick={() => {
                      addEmbed();
                      setAddMenuOpen(false);
                    }}
                    disabled={(message.embeds || []).length >= 10}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2 disabled:opacity-40"
                  >
                    <ImageIcon size={14} /> Add Embed
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      addComponent(ComponentType.ActionRow, null);
                      setAddMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                  >
                    <Layers size={14} /> Add Action Row
                  </button>
                </div>
              )}
            </div>

            {/* Set Link Button */}
            <button
              type="button"
              onClick={() => setLinkModalOpen(true)}
              className="px-3 py-1.5 rounded bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Link size={13} /> Set Link
            </button>
          </div>
        </div>
      )}

      {/* Set Link Modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#2b2d31] rounded-lg border border-[#1e1f22] p-4 w-full max-w-sm space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Set Message Link / Reference
              </h4>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="text-[#949ba4] hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] text-[#949ba4]">
              Enter a Discord message link to reply to or edit.
            </p>
            <input
              type="text"
              placeholder="https://discord.com/channels/..."
              value={messageLinkInput}
              onChange={(e) => setMessageLinkInput(e.target.value)}
              className="w-full bg-[#1e1f22] text-xs text-white px-2.5 py-1.5 rounded border border-[#383a40] focus:border-[#5865f2] focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[#949ba4] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="px-3 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-xs font-semibold text-white"
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageEditor);