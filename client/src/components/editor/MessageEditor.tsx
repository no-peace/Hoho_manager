import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Link,
  Edit2,
  Check,
  LayoutGrid,
} from "lucide-react";
import { ComponentType } from "@dmb/shared";
import { EmbedEditor } from "./EmbedEditor";
import { DiscohookComponentsEditor } from "./DiscohookComponentsEditor";
import { DiscordMentionInput } from "./DiscordMentionInput";
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

  const [isOpen, setIsOpen] = useState(true);
  const [threadOpen, setThreadOpen] = useState(Boolean(message.thread_name));
  const [profileOpen, setProfileOpen] = useState(Boolean(message.username || message.avatar_url));

  const [isEditingName, setIsEditingName] = useState(false);
  const [customName, setCustomName] = useState("");

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [messageLinkInput, setMessageLinkInput] = useState("");

  return (
    <div
      onClick={() => setActiveMessageIndex?.(index)}
      className={`rounded-lg bg-[#292b2f] border transition-all overflow-hidden ${
        isActive
          ? "border-[#5865f2] shadow-[0_0_12px_rgba(88,101,242,0.25)]"
          : "border-[#202225] hover:border-[#36393f]"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#202225] select-none">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="text-[#949ba4] hover:text-white"
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {isEditingName ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={`Message ${index + 1}`}
                className="rounded bg-[#1e1f22] px-2 py-0.5 text-xs text-white outline-none ring-1 ring-[#5865f2]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") setIsEditingName(false);
                }}
              />
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="p-1 text-[#5865f2] hover:text-[#4752c4]"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
              className="text-sm font-semibold text-white flex items-center gap-1.5 cursor-pointer"
            >
              {customName || `Message ${index + 1}`}
              <Edit2
                size={12}
                className="text-[#949ba4] opacity-0 group-hover:opacity-100 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Move Up"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              moveMessage?.(index, -1);
            }}
            className="p-1 text-[#949ba4] hover:text-white disabled:opacity-30 disabled:hover:text-[#949ba4]"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            title="Move Down"
            disabled={index === (messages?.length ?? 1) - 1}
            onClick={(e) => {
              e.stopPropagation();
              moveMessage?.(index, 1);
            }}
            className="p-1 text-[#949ba4] hover:text-white disabled:opacity-30 disabled:hover:text-[#949ba4]"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            title="Duplicate Message"
            onClick={(e) => {
              e.stopPropagation();
              duplicateMessage?.(index);
            }}
            className="p-1 text-[#949ba4] hover:text-white"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            title="Delete Message"
            disabled={(messages?.length ?? 1) <= 1}
            onClick={(e) => {
              e.stopPropagation();
              removeMessage?.(index);
            }}
            className="p-1 text-[#da373c] hover:text-[#f23f43] disabled:opacity-30"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold uppercase tracking-wider text-[#949ba4]">
                Content
              </label>
              <span
                className={`text-[11px] font-mono ${
                  (message.content?.length ?? 0) > 2000
                    ? "text-[#da373c]"
                    : "text-[#949ba4]"
                }`}
              >
                {message.content?.length ?? 0}/2000
              </span>
            </div>

            <DiscordMentionInput
              value={message.content || ""}
              onChange={(val) => setField("content", val)}
              placeholder="Message content (supports markdown, @mentions, #channels, :emojis)"
              rows={4}
              maxLength={2000}
            />
          </div>

          {/* Thread Collapsible */}
          <div className="rounded border border-[#202225] bg-[#202225]/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setThreadOpen(!threadOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-[#949ba4] hover:text-white"
            >
              <span>Thread</span>
              {threadOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {threadOpen && (
              <div className="p-3 border-t border-[#202225] space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#949ba4] mb-1">
                    Thread Name
                  </label>
                  <input
                    type="text"
                    value={message.thread_name || ""}
                    onChange={(e) => setField("thread_name", e.target.value)}
                    placeholder="Provide a name to create a forum post or start a thread"
                    className="w-full rounded bg-[#1e1f22] px-3 py-1.5 text-xs text-white placeholder-[#949ba4]/50 outline-none ring-1 ring-[#202225] focus:ring-[#5865f2]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Profile Collapsible */}
          <div className="rounded border border-[#202225] bg-[#202225]/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-[#949ba4] hover:text-white"
            >
              <span>Profile</span>
              {profileOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {profileOpen && (
              <div className="p-3 border-t border-[#202225] space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#949ba4] mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={message.username || ""}
                    onChange={(e) => setField("username", e.target.value)}
                    placeholder="Override webhook bot username"
                    className="w-full rounded bg-[#1e1f22] px-3 py-1.5 text-xs text-white placeholder-[#949ba4]/50 outline-none ring-1 ring-[#202225] focus:ring-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#949ba4] mb-1">
                    Avatar URL
                  </label>
                  <input
                    type="text"
                    value={message.avatar_url || ""}
                    onChange={(e) => setField("avatar_url", e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded bg-[#1e1f22] px-3 py-1.5 text-xs text-white placeholder-[#949ba4]/50 outline-none ring-1 ring-[#202225] focus:ring-[#5865f2]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Files Section */}
          <FileAttachmentsSection />

          {/* Embeds Studio */}
          {message.embeds && message.embeds.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#949ba4]">
                  Embeds ({message.embeds.length}/10)
                </span>
              </div>
              {message.embeds.map((embed, i) => (
                <EmbedEditor key={embed._id || i} embed={embed} index={i} />
              ))}
            </div>
          )}

          {/* Components V2 Studio */}
          <div className="pt-2">
            <DiscohookComponentsEditor />
          </div>

          {/* Bottom Toolbar */}
          <div className="flex items-center gap-2 pt-3 border-t border-[#202225] relative">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-1.5 rounded bg-[#35373c] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#404249]"
              >
                <span>Add</span>
                <ChevronDown size={14} />
              </button>

              {showAddMenu && (
                <div
                  className="absolute left-0 bottom-full mb-1 w-44 rounded bg-[#1e1f22] p-1 shadow-lg ring-1 ring-black/40 z-30"
                  onClick={() => setShowAddMenu(false)}
                >
                  <button
                    type="button"
                    disabled={(message.embeds?.length ?? 0) >= 10}
                    onClick={() => addEmbed()}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-[#dbdee1] hover:bg-[#35373c] disabled:opacity-40"
                  >
                    <Plus size={14} className="text-[#5865f2]" />
                    <span>Add Embed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addComponent(ComponentType.ActionRow)}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-[#dbdee1] hover:bg-[#35373c]"
                  >
                    <LayoutGrid size={14} className="text-[#5865f2]" />
                    <span>Add Action Row</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="flex items-center gap-1.5 rounded bg-[#35373c] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#404249]"
            >
              <Link size={13} />
              <span>Set Link</span>
            </button>

            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className="flex items-center gap-1.5 rounded bg-[#35373c] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#404249]"
              >
                <span>Options</span>
                <ChevronDown size={14} />
              </button>

              {showOptionsMenu && (
                <div
                  className="absolute right-0 bottom-full mb-1 w-48 rounded bg-[#1e1f22] p-1 shadow-lg ring-1 ring-black/40 z-30"
                  onClick={() => setShowOptionsMenu(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (message.content) {
                        navigator.clipboard.writeText(message.content);
                      }
                    }}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-[#dbdee1] hover:bg-[#35373c]"
                  >
                    <Copy size={13} />
                    <span>Copy Content</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setField("content", "");
                    }}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-[#da373c] hover:bg-[#35373c]"
                  >
                    <Trash2 size={13} />
                    <span>Clear Content</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg bg-[#2b2d31] p-5 shadow-xl border border-[#1e1f22]">
            <h3 className="text-sm font-semibold text-white mb-2">Set Message Link</h3>
            <p className="text-xs text-[#949ba4] mb-3">
              Enter an existing Discord message link to target it for editing:
            </p>
            <input
              type="text"
              value={messageLinkInput}
              onChange={(e) => setMessageLinkInput(e.target.value)}
              placeholder="https://discord.com/channels/..."
              className="w-full rounded bg-[#1e1f22] px-3 py-2 text-xs text-white placeholder-[#949ba4]/50 outline-none ring-1 ring-[#1e1f22] focus:ring-[#5865f2] mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="rounded px-3 py-1.5 text-xs font-medium text-[#949ba4] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                }}
                className="rounded bg-[#5865f2] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#4752c4]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageEditor;