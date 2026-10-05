import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AtSign,
  Smile,
  Code,
  Clock,
  Plus,
  User,
  Hash,
  Shield,
} from "lucide-react";
import { VARIABLES } from "./Field";

export interface CustomEmoji {
  id: string;
  name: string;
  animated?: boolean;
}

const EMOJI_STORAGE_KEY = "discohook_custom_emojis";
let memoryEmojiFallback: string | null = null;

export const getStoredCustomEmojis = (): CustomEmoji[] => {
  try {
    let raw: string | null = null;
    try {
      if (typeof localStorage !== "undefined") {
        raw = localStorage.getItem(EMOJI_STORAGE_KEY);
      }
    } catch {
      raw = memoryEmojiFallback;
    }
    if (!raw) raw = memoryEmojiFallback;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveStoredCustomEmojis = (emojis: CustomEmoji[]): void => {
  try {
    const serialized = JSON.stringify(emojis);
    memoryEmojiFallback = serialized;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(EMOJI_STORAGE_KEY, serialized);
      }
    } catch {
      // Storage quota or sandbox restrictions
    }
  } catch {
    // Ignore storage errors
  }
};

const COMMON_EMOJIS = [
  "👍", "👎", "❤️", "🔥", "🎉", "✨", "🚀", "👀",
  "💯", "🤖", "⭐", "✅", "❌", "⚠️", "📌", "💬",
  "🔔", "🎯", "💡", "💎", "🏆", "🔒", "⚡", "🌟"
];

interface QuickMentionBoxProps {
  onSelect: (tag: string) => void;
}

export const QuickMentionBox: React.FC<QuickMentionBoxProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"mentions" | "emojis" | "variables" | "timestamps">("mentions");
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [searchQuery, setSearchQuery] = useState("");

  // Mention inputs
  const [mentionType, setMentionType] = useState<"user" | "role" | "channel">("user");
  const [mentionId, setMentionId] = useState("");

  // Custom emoji inputs
  const [customEmojiInput, setCustomEmojiInput] = useState("");
  const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>([]);

  // Timestamps
  const [timestampMode, setTimestampMode] = useState<"now" | "custom">("now");
  const [customDate, setCustomDate] = useState("");

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomEmojis(getStoredCustomEmojis());
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropWidth = 320;
      const dropHeight = 360;

      let top = rect.bottom + 4;
      if (top + dropHeight > window.innerHeight) {
        top = Math.max(10, rect.top - dropHeight - 4);
      }

      let left = rect.right - dropWidth;
      if (left < 10) left = 10;
      if (left + dropWidth > window.innerWidth) {
        left = window.innerWidth - dropWidth - 10;
      }

      setCoords({ top, left });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) setIsOpen(false);
    };

    if (isOpen) {
      if (typeof document !== "undefined") {
        document.addEventListener("mousedown", handleClickOutside);
      }
      if (typeof window !== "undefined") {
        window.addEventListener("scroll", handleScroll, true);
      }
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("mousedown", handleClickOutside);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("scroll", handleScroll, true);
      }
    };
  }, [isOpen]);

  const handleInsert = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  // Add Custom Emoji
  const handleAddCustomEmoji = () => {
    const trimmed = customEmojiInput.trim();
    if (!trimmed) return;

    // Pattern 1: <:name:id> or <a:name:id>
    const match = trimmed.match(/^<(a)?:([a-zA-Z0-9_]+):(\d{17,20})>$/);
    if (match) {
      const animated = Boolean(match[1]);
      const name = match[2];
      const id = match[3];
      const next = [...customEmojis.filter((e) => e.id !== id), { id, name, animated }];
      setCustomEmojis(next);
      saveStoredCustomEmojis(next);
      setCustomEmojiInput("");
      return;
    }

    // Pattern 2: name:id or name id
    const parts = trimmed.split(/[:\s]+/);
    if (parts.length === 2 && /^\d{17,20}$/.test(parts[1])) {
      const name = parts[0].replace(/[^a-zA-Z0-9_]/g, "") || "emoji";
      const id = parts[1];
      const next = [...customEmojis.filter((e) => e.id !== id), { id, name, animated: false }];
      setCustomEmojis(next);
      saveStoredCustomEmojis(next);
      setCustomEmojiInput("");
      return;
    }

    // Pattern 3: Snowflake ID only
    if (/^\d{17,20}$/.test(trimmed)) {
      const id = trimmed;
      const next = [...customEmojis.filter((e) => e.id !== id), { id, name: `emoji_${id.slice(-4)}`, animated: false }];
      setCustomEmojis(next);
      saveStoredCustomEmojis(next);
      setCustomEmojiInput("");
      return;
    }

    alert("Please enter custom emoji format: <:name:id> or name:id or Discord snowflake ID");
  };

  const handleRemoveCustomEmoji = (id: string) => {
    const next = customEmojis.filter((e) => e.id !== id);
    setCustomEmojis(next);
    saveStoredCustomEmojis(next);
  };

  // Insert mention
  const handleInsertMention = () => {
    const id = mentionId.trim();
    if (!id || !/^\d{17,20}$/.test(id)) {
      alert("Please enter a valid 17-20 digit snowflake ID");
      return;
    }
    if (mentionType === "user") handleInsert(`<@${id}>`);
    else if (mentionType === "role") handleInsert(`<@&${id}>`);
    else if (mentionType === "channel") handleInsert(`<#${id}>`);
  };

  // Compute timestamp tag
  const getUnixSeconds = () => {
    if (timestampMode === "now") return Math.floor(Date.now() / 1000);
    if (!customDate) return Math.floor(Date.now() / 1000);
    return Math.floor(new Date(customDate).getTime() / 1000);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        className="absolute right-2 top-1.5 z-10 flex h-[22px] items-center justify-center rounded bg-[#2b2d31] px-1.5 text-[11px] font-mono font-bold text-[#b5bac1] hover:bg-[#5865f2] hover:text-white transition-colors border border-[#1e1f22] shadow-sm gap-1"
        title="Quick Mentions, Emojis, Variables & Timestamps"
        aria-label="Quick Mentions, Emojis, Variables & Timestamps"
      >
        <AtSign size={11} />
        <span>{"{ }"}</span>
      </button>

      {isOpen && (() => {
        const dropdownNode = (
          <div
            ref={dropdownRef}
            style={{ top: coords.top, left: coords.left }}
            className="fixed w-80 rounded-lg border border-[#111214] bg-[#2b2d31] shadow-2xl z-[99999] overflow-hidden flex flex-col max-h-[380px] font-sans text-xs text-[#dbdee1]"
          >
            {/* Tab navigation */}
            <div className="flex border-b border-[#1e1f22] bg-[#1e1f22] p-1 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("mentions")}
                className={`flex-1 py-1 px-1.5 rounded flex items-center justify-center gap-1 font-semibold text-[11px] transition-colors ${
                  activeTab === "mentions" ? "bg-[#5865f2] text-white" : "text-[#949ba4] hover:text-white"
                }`}
              >
                <AtSign size={12} /> Mentions
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("emojis")}
                className={`flex-1 py-1 px-1.5 rounded flex items-center justify-center gap-1 font-semibold text-[11px] transition-colors ${
                  activeTab === "emojis" ? "bg-[#5865f2] text-white" : "text-[#949ba4] hover:text-white"
                }`}
              >
                <Smile size={12} /> Emojis
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("variables")}
                className={`flex-1 py-1 px-1.5 rounded flex items-center justify-center gap-1 font-semibold text-[11px] transition-colors ${
                  activeTab === "variables" ? "bg-[#5865f2] text-white" : "text-[#949ba4] hover:text-white"
                }`}
              >
                <Code size={12} /> Variables
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("timestamps")}
                className={`flex-1 py-1 px-1.5 rounded flex items-center justify-center gap-1 font-semibold text-[11px] transition-colors ${
                  activeTab === "timestamps" ? "bg-[#5865f2] text-white" : "text-[#949ba4] hover:text-white"
                }`}
              >
                <Clock size={12} /> Time
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-3">
              {/* 1. MENTIONS TAB */}
              {activeTab === "mentions" && (
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#949ba4] tracking-wider block mb-1.5">
                      Broadcast Mentions
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleInsert("@everyone")}
                        className="px-2.5 py-1 rounded bg-[#1e1f22] hover:bg-[#5865f2] hover:text-white text-[#dbdee1] font-mono text-xs border border-[#35373c] transition-colors flex-1"
                      >
                        @everyone
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsert("@here")}
                        className="px-2.5 py-1 rounded bg-[#1e1f22] hover:bg-[#5865f2] hover:text-white text-[#dbdee1] font-mono text-xs border border-[#35373c] transition-colors flex-1"
                      >
                        @here
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-[#1e1f22] pt-2 space-y-2">
                    <span className="text-[10px] font-bold uppercase text-[#949ba4] tracking-wider block">
                      Targeted Mention Generator
                    </span>
                    <div className="flex gap-1 bg-[#1e1f22] p-0.5 rounded border border-[#35373c]">
                      <button
                        type="button"
                        onClick={() => setMentionType("user")}
                        className={`flex-1 py-0.5 rounded text-[11px] font-medium flex items-center justify-center gap-1 ${
                          mentionType === "user" ? "bg-[#5865f2] text-white" : "text-[#949ba4]"
                        }`}
                      >
                        <User size={11} /> User
                      </button>
                      <button
                        type="button"
                        onClick={() => setMentionType("role")}
                        className={`flex-1 py-0.5 rounded text-[11px] font-medium flex items-center justify-center gap-1 ${
                          mentionType === "role" ? "bg-[#5865f2] text-white" : "text-[#949ba4]"
                        }`}
                      >
                        <Shield size={11} /> Role
                      </button>
                      <button
                        type="button"
                        onClick={() => setMentionType("channel")}
                        className={`flex-1 py-0.5 rounded text-[11px] font-medium flex items-center justify-center gap-1 ${
                          mentionType === "channel" ? "bg-[#5865f2] text-white" : "text-[#949ba4]"
                        }`}
                      >
                        <Hash size={11} /> Channel
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Enter Snowflake ID..."
                        value={mentionId}
                        onChange={(e) => setMentionId(e.target.value)}
                        className="flex-1 bg-[#1e1f22] border border-[#35373c] rounded px-2.5 py-1 text-xs text-[#dbdee1] placeholder-[#6d6f78] focus:outline-none focus:border-[#5865f2]"
                      />
                      <button
                        type="button"
                        onClick={handleInsertMention}
                        className="px-2.5 py-1 bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold rounded text-xs transition-colors shrink-0"
                      >
                        Insert
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. EMOJIS TAB */}
              {activeTab === "emojis" && (
                <div className="space-y-3">
                  {/* Custom emoji addition */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#949ba4] tracking-wider block">
                      Add Custom Emoji (Persists to Cache)
                    </span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="<:name:123456789> or name:id"
                        value={customEmojiInput}
                        onChange={(e) => setCustomEmojiInput(e.target.value)}
                        className="flex-1 bg-[#1e1f22] border border-[#35373c] rounded px-2.5 py-1 text-xs text-[#dbdee1] placeholder-[#6d6f78] focus:outline-none focus:border-[#5865f2]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomEmoji}
                        className="px-2 py-1 bg-[#23a55a] hover:bg-[#1da24a] text-white font-semibold rounded text-xs transition-colors shrink-0 flex items-center gap-1"
                        title="Save to browser cache"
                      >
                        <Plus size={13} /> Add
                      </button>
                    </div>
                  </div>

                  {/* Saved custom emojis */}
                  {customEmojis.length > 0 && (
                    <div className="space-y-1.5 border-t border-[#1e1f22] pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-[#949ba4] tracking-wider">
                          Cached Custom Emojis ({customEmojis.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto">
                        {customEmojis.map((e) => {
                          const tag = e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;
                          const url = `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? "gif" : "png"}?size=32`;
                          return (
                            <div
                              key={e.id}
                              className="group relative flex flex-col items-center justify-center p-1.5 bg-[#1e1f22] hover:bg-[#35373c] rounded border border-[#35373c] cursor-pointer transition-colors"
                              onClick={() => handleInsert(tag)}
                              title={`${tag} (Click to insert)`}
                            >
                              <img
                                src={url}
                                alt={e.name}
                                className="w-6 h-6 object-contain"
                                onError={(ev) => {
                                  // Fallback to text icon if CDN fails
                                  ev.currentTarget.style.display = "none";
                                }}
                              />
                              <span className="text-[9px] text-[#949ba4] truncate w-full text-center mt-0.5">
                                {e.name}
                              </span>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleRemoveCustomEmoji(e.id);
                                }}
                                className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 rounded-full bg-[#da373c] text-white items-center justify-center text-[10px]"
                                title="Remove emoji from cache"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Common standard emojis */}
                  <div className="space-y-1.5 border-t border-[#1e1f22] pt-2">
                    <span className="text-[10px] font-bold uppercase text-[#949ba4] tracking-wider block">
                      Standard Emojis
                    </span>
                    <div className="grid grid-cols-6 gap-1.5">
                      {COMMON_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleInsert(emoji)}
                          className="h-8 rounded bg-[#1e1f22] hover:bg-[#35373c] text-base flex items-center justify-center transition-colors border border-transparent hover:border-[#5865f2]"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. VARIABLES TAB */}
              {activeTab === "variables" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search variables..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#1e1f22] border border-[#35373c] rounded px-2.5 py-1 text-xs text-[#dbdee1] placeholder-[#6d6f78] focus:outline-none focus:border-[#5865f2]"
                  />
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {VARIABLES.filter((v) => {
                      if (!searchQuery) return true;
                      if (v.group) return false;
                      const q = searchQuery.toLowerCase();
                      return (
                        v.tag?.toLowerCase().includes(q) ||
                        v.label?.toLowerCase().includes(q) ||
                        v.desc?.toLowerCase().includes(q)
                      );
                    }).map((v, i) =>
                      v.group ? (
                        <div
                          key={`group-${i}`}
                          className="px-1.5 pt-2 pb-0.5 text-[10px] font-bold uppercase text-[#949ba4] tracking-wider border-b border-[#1e1f22]"
                        >
                          {v.group}
                        </div>
                      ) : (
                        <button
                          key={v.tag}
                          type="button"
                          onClick={() => handleInsert(v.tag!)}
                          className="flex flex-col items-start justify-center rounded px-2 py-1 w-full hover:bg-[#5865f2] hover:text-white group transition-colors text-left"
                        >
                          <div className="flex w-full items-baseline justify-between">
                            <span className="font-mono text-[11px] font-bold text-[#5865f2] group-hover:text-white">
                              {v.tag}
                            </span>
                            <span className="text-[10px] text-[#949ba4] group-hover:text-indigo-200">
                              {v.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#b5bac1] group-hover:text-indigo-100 line-clamp-1">
                            {v.desc}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* 4. TIMESTAMPS TAB */}
              {activeTab === "timestamps" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#949ba4] tracking-wider block">
                      Timestamp Target
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTimestampMode("now")}
                        className={`flex-1 py-1 rounded text-xs font-semibold ${
                          timestampMode === "now" ? "bg-[#5865f2] text-white" : "bg-[#1e1f22] text-[#949ba4]"
                        }`}
                      >
                        Right Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimestampMode("custom")}
                        className={`flex-1 py-1 rounded text-xs font-semibold ${
                          timestampMode === "custom" ? "bg-[#5865f2] text-white" : "bg-[#1e1f22] text-[#949ba4]"
                        }`}
                      >
                        Custom Date
                      </button>
                    </div>
                    {timestampMode === "custom" && (
                      <input
                        type="datetime-local"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="w-full bg-[#1e1f22] border border-[#35373c] rounded px-2.5 py-1 text-xs text-[#dbdee1] mt-1"
                      />
                    )}
                  </div>

                  <div className="space-y-1 border-t border-[#1e1f22] pt-2">
                    <span className="text-[10px] font-bold uppercase text-[#949ba4] tracking-wider block mb-1">
                      Discord Formats
                    </span>
                    {[
                      { flag: "R", label: "Relative", preview: "2 minutes ago" },
                      { flag: "t", label: "Short Time", preview: "9:01 PM" },
                      { flag: "T", label: "Long Time", preview: "9:01:00 PM" },
                      { flag: "d", label: "Short Date", preview: "10/05/2026" },
                      { flag: "D", label: "Long Date", preview: "October 5, 2026" },
                      { flag: "F", label: "Full Long", preview: "Monday, October 5, 2026 9:01 PM" },
                    ].map((item) => {
                      const unix = getUnixSeconds();
                      const tag = `<t:${unix}:${item.flag}>`;
                      return (
                        <button
                          key={item.flag}
                          type="button"
                          onClick={() => handleInsert(tag)}
                          className="w-full flex items-center justify-between p-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors group text-left"
                        >
                          <div>
                            <span className="font-semibold block text-xs">{item.label}</span>
                            <span className="text-[10px] text-[#949ba4] group-hover:text-indigo-200">
                              {item.preview}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-[#949ba4] group-hover:text-white">
                            {tag}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
        if (typeof document === "undefined" || !document.body) {
          return dropdownNode;
        }
        return createPortal(dropdownNode, document.body);
      })()}
    </>
  );
};

export default QuickMentionBox;
