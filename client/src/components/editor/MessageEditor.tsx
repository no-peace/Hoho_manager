import React, { useState } from "react";
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

  const message = (messages && messages[index]) || (index === 0 ? data : messages?.[0]) || data;
  const isActive = activeMessageIndex === index;

  // Local collapsible section states matching Discohook
  const [isOpen, setIsOpen] = useState(true);
  const [threadOpen, setThreadOpen] = useState(Boolean(message.thread_name));
  const [profileOpen, setProfileOpen] = useState(Boolean(message.username || message.avatar_url));

  // Rename message state
  const [isEditingName, setIsEditingName] = useState(false);
  const [customName, setCustomName] = useState("");

  // Dropdown & modal states
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [messageLinkInput, setMessageLinkInput] = useState("");

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
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={`Message ${index + 1}`}
                className="bg-[#1e1f22] border border-[#5865f2] rounded px-2 py-0.5 text-xs text-white outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") setIsEditingName(false);
                }}
              />
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="text-xs text-[#5865f2] hover:underline"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                className="text-xs font-bold text-white uppercase tracking-wider truncate cursor-pointer"
              >
                {customName || `Message ${index + 1}`}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                className="text-[#949ba4] hover:text-white"
                title="Rename message"
              >
                <Edit2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Message Actions: Reorder, Duplicate, Delete */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Move Up"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              moveMessage?.(index, -1);
            }}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            title="Move Down"
            disabled={index >= (messages?.length ?? 1) - 1}
            onClick={(e) => {
              e.stopPropagation();
              moveMessage?.(index, 1);
            }}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDown size={15} />
          </button>
          <button
            type="button"
            title="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              duplicateMessage?.(index);
            }}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c]"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            title="Delete"
            disabled={(messages?.length ?? 1) <= 1}
            onClick={(e) => {
              e.stopPropagation();
              removeMessage?.(index);
            }}
            className="p-1 rounded text-[#f28b8b] hover:text-white hover:bg-[#da373c]/30 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Message Content & Sub-Sections ── */}
      {isOpen && (
        <div className="p-4 space-y-4">
          {/* Main Content Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-[#b5bac1] uppercase tracking-wider text-[11px]">
                Content
              </label>
              <span
                className={`text-[10px] font-mono ${
                  (message.content?.length || 0) > Limits.content
                    ? "text-[#f28b8b]"
                    : "text-[#949ba4]"
                }`}
              >
                {message.content?.length || 0} / {Limits.content}
              </span>
            </div>

            <DiscordMentionInput
              value={message.content || ""}
              onChange={(val) => setField("content", val)}
              placeholder="Message content (supports markdown, @mentions, #channels, :emojis:)"
              rows={4}
            />
          </div>

          {/* Thread Section (Collapsible) */}
          <div className="border border-[#202225] rounded-lg bg-[#202225]/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setThreadOpen(!threadOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#dbdee1] hover:bg-[#2b2d31]/50"
            >
              <span>Thread</span>
              {threadOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {threadOpen && (
              <div className="p-3 border-t border-[#202225] space-y-2 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[#949ba4] mb-1">
                    Thread Name
                  </label>
                  <input
                    type="text"
                    value={message.thread_name || ""}
                    onChange={(e) => setField("thread_name", e.target.value)}
                    placeholder="Provide a name to post in a new thread"
                    className="w-full bg-[#1e1f22] text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#313338] focus:border-[#5865f2] outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Profile Section (Collapsible) */}
          <div className="border border-[#202225] rounded-lg bg-[#202225]/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#dbdee1] hover:bg-[#2b2d31]/50"
            >
              <span>Profile</span>
              {profileOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {profileOpen && (
              <div className="p-3 border-t border-[#202225] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[#949ba4] mb-1">
                    Username Override
                  </label>
                  <input
                    type="text"
                    value={message.username || ""}
                    onChange={(e) => setField("username", e.target.value)}
                    placeholder="Spiffy Bot"
                    className="w-full bg-[#1e1f22] text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#313338] focus:border-[#5865f2] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#949ba4] mb-1">
                    Avatar URL Override
                  </label>
                  <input
                    type="url"
                    value={message.avatar_url || ""}
                    onChange={(e) => setField("avatar_url", e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#1e1f22] text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#313338] focus:border-[#5865f2] outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Files Section */}
          <FileAttachmentsSection />

          {/* Inline Embeds List */}
          {message.embeds && message.embeds.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-[#202225]">
              <span className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider">
                Embeds ({message.embeds.length} / 10)
              </span>
              {message.embeds.map((embed, embedIdx) => (
                <EmbedEditor key={embed._id || embedIdx} embed={embed} index={embedIdx} />
              ))}
            </div>
          )}

          {/* Inline Components V2 Studio */}
          <div className="pt-2 border-t border-[#202225]">
            <DiscohookComponentsEditor />
          </div>

          {/* Bottom Discohook Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#202225]">
            {/* Add ∨ Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddMenuOpen(!addMenuOpen)}
                className="px-3 py-1.5 rounded bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus size={14} /> Add <ChevronDown size={13} />
              </button>

              {addMenuOpen && (
                <div
                  className="absolute left-0 bottom-full mb-1.5 w-48 bg-[#1e1f22] border border-[#111214] shadow-2xl rounded-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-75"
                  onClick={() => setAddMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => addEmbed()}
                    disabled={(message.embeds || []).length >= 10}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2 disabled:opacity-40"
                  >
                    <ImageIcon size={14} /> Add Embed
                  </button>
                  <button
                    type="button"
                    onClick={() => addComponent(ComponentType.ActionRow, null)}
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

            {/* Options ∨ Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
                className="px-3 py-1.5 rounded bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <SlidersHorizontal size={13} /> Options <ChevronDown size={13} />
              </button>

              {optionsMenuOpen && (
                <div
                  className="absolute left-0 bottom-full mb-1.5 w-52 bg-[#1e1f22] border border-[#111214] shadow-2xl rounded-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-75 text-xs"
                  onClick={() => setOptionsMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const text = JSON.stringify(message, null, 2);
                      navigator.clipboard.writeText(text);
                      alert("Message JSON copied to clipboard!");
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                  >
                    <Copy size={13} /> Copy Message JSON
                  </button>
                </div>
              )}
            </div>
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
              className="w-full bg-[#1e1f22] text-xs text-white px-2.5 py-1.5 rounded border border-[#383a40] focus:border-[#5865f2] outline-none"
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