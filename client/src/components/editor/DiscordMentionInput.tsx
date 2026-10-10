import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Hash,
  Volume2,
  Megaphone,
  Keyboard,
} from "lucide-react";
import { RichPicker } from "./RichPicker";
import { useGlobalStore } from "../../store/globalStore";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
import api from "../../api/client";

export interface DiscordMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  label?: string;
  className?: string;
  disabled?: boolean;
  guildId?: string | null;
}

type AutocompleteType = "user" | "channel" | "emoji" | null;

interface AutocompleteItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  replacement: string;
}

// Module-level stable empty arrays to prevent React 18 getSnapshot infinite loop
const EMPTY_CHANNELS: { id: string; name: string; type: number; parent_id?: string | null }[] = [];
const EMPTY_ROLES: { id: string; name: string; color: number }[] = [];

const COMMON_EMOJIS_LIST = [
  { name: "grinning", char: "😀" },
  { name: "smiley", char: "😃" },
  { name: "smile", char: "😄" },
  { name: "grin", char: "😁" },
  { name: "laughing", char: "😆" },
  { name: "sweat_smile", char: "😅" },
  { name: "rofl", char: "🤣" },
  { name: "joy", char: "😂" },
  { name: "wink", char: "😉" },
  { name: "blush", char: "😊" },
  { name: "innocent", char: "😇" },
  { name: "heart_eyes", char: "😍" },
  { name: "star_struck", char: "🤩" },
  { name: "sunglasses", char: "😎" },
  { name: "thinking", char: "🤔" },
  { name: "fire", char: "🔥" },
  { name: "sparkles", char: "✨" },
  { name: "heart", char: "❤️" },
  { name: "thumbsup", char: "👍" },
  { name: "thumbsdown", char: "👎" },
  { name: "clap", char: "👏" },
  { name: "wave", char: "👋" },
  { name: "white_check_mark", char: "✅" },
  { name: "x", char: "❌" },
  { name: "warning", char: "⚠️" },
  { name: "bell", char: "🔔" },
  { name: "tada", char: "🎉" },
];

export const DiscordMentionInput: React.FC<DiscordMentionInputProps> = ({
  value,
  onChange,
  placeholder = "Say something…",
  rows = 4,
  maxLength,
  label,
  className = "",
  disabled = false,
  guildId: propGuildId,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [showRichPicker, setShowRichPicker] = useState(false);

  // Autocomplete state
  const [acType, setAcType] = useState<AutocompleteType>(null);
  const [acQuery, setAcQuery] = useState("");
  const [acCursorStart, setAcCursorStart] = useState(-1);
  const [acCursorEnd, setAcCursorEnd] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Guild info from store
  const storeGuildId = useGlobalStore((s) => s.selectedGuildId);
  const effectiveGuildId = propGuildId || storeGuildId;

  // Use stable selectors to avoid returning new array references
  const allChannels = useDiscordCacheStore((s) => s.channels);
  const allRoles = useDiscordCacheStore((s) => s.roles);
  const channels = (effectiveGuildId && allChannels[effectiveGuildId]) || EMPTY_CHANNELS;
  const roles = (effectiveGuildId && allRoles[effectiveGuildId]) || EMPTY_ROLES;

  const fetchChannels = useDiscordCacheStore((s) => s.fetchChannels);
  const fetchRoles = useDiscordCacheStore((s) => s.fetchRoles);

  // Server emojis
  const [serverEmojis, setServerEmojis] = useState<
    Array<{ id: string; name: string; animated?: boolean }>
  >([]);

  // Member search results for @
  const [memberResults, setMemberResults] = useState<
    Array<{
      id: string;
      username: string;
      global_name: string | null;
      nickname: string | null;
      avatar: string | null;
    }>
  >([]);

  // Fetch initial guild cache only when effectiveGuildId changes
  useEffect(() => {
    if (effectiveGuildId) {
      fetchChannels(effectiveGuildId);
      fetchRoles(effectiveGuildId);
      (api.discord as any)
        .emojis?.(effectiveGuildId)
        .then((res: { emojis: Array<{ id: string; name: string; animated?: boolean }> }) => {
          if (res?.emojis) setServerEmojis(res.emojis);
        })
        .catch(() => {});
    }
  }, [effectiveGuildId, fetchChannels, fetchRoles]);

  // Live member search when @ query changes
  useEffect(() => {
    if (acType !== "user" || !effectiveGuildId) {
      setMemberResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.discord.searchMembers(effectiveGuildId, acQuery);
        setMemberResults(res.members || []);
      } catch {
        setMemberResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [acType, acQuery, effectiveGuildId]);

  // Detect triggers (@, #, :) based on cursor position
  const checkAutocomplete = useCallback(
    (text: string, cursorPos: number) => {
      const textBeforeCursor = text.slice(0, cursorPos);

      // Check @ mention
      const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
      if (mentionMatch) {
        const atIdx = textBeforeCursor.lastIndexOf("@");
        setAcType("user");
        setAcQuery(mentionMatch[1]);
        setAcCursorStart(atIdx);
        setAcCursorEnd(cursorPos);
        setSelectedIndex(0);
        return;
      }

      // Check # channel
      const channelMatch = textBeforeCursor.match(/(?:^|\s)#([a-zA-Z0-9_-]*)$/);
      if (channelMatch) {
        const hashIdx = textBeforeCursor.lastIndexOf("#");
        setAcType("channel");
        setAcQuery(channelMatch[1]);
        setAcCursorStart(hashIdx);
        setAcCursorEnd(cursorPos);
        setSelectedIndex(0);
        return;
      }

      // Check : emoji
      const emojiMatch = textBeforeCursor.match(/(?:^|\s):([a-zA-Z0-9_]{1,})$/);
      if (emojiMatch) {
        const colonIdx = textBeforeCursor.lastIndexOf(":");
        setAcType("emoji");
        setAcQuery(emojiMatch[1]);
        setAcCursorStart(colonIdx);
        setAcCursorEnd(cursorPos);
        setSelectedIndex(0);
        return;
      }

      // No trigger found
      setAcType(null);
      setAcQuery("");
    },
    []
  );

  // Compute autocomplete items
  const acItems = useMemo<AutocompleteItem[]>(() => {
    const q = acQuery.toLowerCase();

    if (acType === "user") {
      const items: AutocompleteItem[] = [];

      // Everyone & Here
      if (!q || "@everyone".includes(q)) {
        items.push({
          id: "everyone",
          title: "@everyone",
          subtitle: "Notify all members",
          icon: <span className="w-2.5 h-2.5 rounded-full bg-[#f28b8b]" />,
          replacement: "@everyone",
        });
      }
      if (!q || "@here".includes(q)) {
        items.push({
          id: "here",
          title: "@here",
          subtitle: "Notify online members",
          icon: <span className="w-2.5 h-2.5 rounded-full bg-[#f28b8b]" />,
          replacement: "@here",
        });
      }

      // Roles
      roles
        .filter((r) => !q || r.name.toLowerCase().includes(q))
        .slice(0, 5)
        .forEach((r) => {
          const colorHex = r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#99aab5";
          items.push({
            id: `role_${r.id}`,
            title: `@${r.name}`,
            subtitle: "Role",
            icon: (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: colorHex }}
              />
            ),
            replacement: `<@&${r.id}>`,
          });
        });

      // Member search results
      memberResults.slice(0, 10).forEach((m) => {
        items.push({
          id: `member_${m.id}`,
          title: m.nickname || m.global_name || m.username,
          subtitle: `@${m.username}`,
          icon: m.avatar ? (
            <img
              src={`https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.webp?size=24`}
              alt=""
              className="w-5 h-5 rounded-full bg-[#1e1f22] shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#5865f2] flex items-center justify-center text-[10px] text-white font-bold shrink-0">
              {m.username.charAt(0).toUpperCase()}
            </div>
          ),
          replacement: `<@${m.id}>`,
        });
      });

      return items;
    }

    if (acType === "channel") {
      return channels
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .slice(0, 15)
        .map((c) => ({
          id: c.id,
          title: `#${c.name}`,
          subtitle: c.type === 2 ? "Voice Channel" : c.type === 5 ? "Announcement" : "Text Channel",
          icon:
            c.type === 2 ? (
              <Volume2 size={13} className="text-[#949ba4] shrink-0" />
            ) : c.type === 5 ? (
              <Megaphone size={13} className="text-[#949ba4] shrink-0" />
            ) : (
              <Hash size={13} className="text-[#949ba4] shrink-0" />
            ),
          replacement: `<#${c.id}>`,
        }));
    }

    if (acType === "emoji") {
      const items: AutocompleteItem[] = [];

      // Server custom emojis
      serverEmojis
        .filter((e) => !q || e.name.toLowerCase().includes(q))
        .slice(0, 8)
        .forEach((e) => {
          const src = `https://cdn.discordapp.com/emojis/${e.id}.${
            e.animated ? "gif" : "webp"
          }?size=24&quality=lossless`;
          items.push({
            id: `server_${e.id}`,
            title: `:${e.name}:`,
            subtitle: "Custom Emoji",
            icon: <img src={src} alt={e.name} className="w-4 h-4 object-contain" />,
            replacement: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
          });
        });

      // Unicode emojis
      COMMON_EMOJIS_LIST.filter((e) => !q || e.name.toLowerCase().includes(q))
        .slice(0, 10)
        .forEach((e) => {
          items.push({
            id: `unicode_${e.name}`,
            title: `:${e.name}:`,
            subtitle: "Emoji",
            icon: <span className="text-base">{e.char}</span>,
            replacement: e.char,
          });
        });

      return items;
    }

    return [];
  }, [acType, acQuery, roles, memberResults, channels, serverEmojis]);

  // Insert replacement into text
  const applyReplacement = useCallback(
    (replacement: string) => {
      if (acCursorStart < 0 || acCursorEnd < 0) return;

      const before = value.slice(0, acCursorStart);
      const after = value.slice(acCursorEnd);
      const insertText = replacement.endsWith(" ") ? replacement : `${replacement} `;
      const nextValue = before + insertText + after;

      onChange(nextValue);
      setAcType(null);
      setAcQuery("");

      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = before.length + insertText.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    },
    [acCursorStart, acCursorEnd, value, onChange]
  );

  // Insert text directly (from RichPicker)
  const insertDirect = useCallback(
    (textToInsert: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange((value || "") + textToInsert);
        return;
      }

      const start = textarea.selectionStart ?? value.length;
      const end = textarea.selectionEnd ?? value.length;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const insertWithSpace = textToInsert.endsWith(" ") ? textToInsert : `${textToInsert} `;
      const nextValue = before + insertWithSpace + after;

      onChange(nextValue);

      setTimeout(() => {
        textarea.focus();
        const newPos = start + insertWithSpace.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [value, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (acType && acItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % acItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + acItems.length) % acItems.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const item = acItems[selectedIndex];
        if (item) {
          applyReplacement(item.replacement);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAcType(null);
        return;
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    checkAutocomplete(e.target.value, e.target.selectionStart);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "Enter") {
      checkAutocomplete(e.currentTarget.value, e.currentTarget.selectionStart);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    checkAutocomplete(e.currentTarget.value, e.currentTarget.selectionStart);
  };

  const charCount = value?.length || 0;
  const isOverLimit = maxLength ? charCount > maxLength : false;

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {/* Header Label and Character Count */}
      <div className="flex items-center justify-between">
        {label ? (
          <label className="text-xs font-semibold text-[#dbdee1]">
            {label}
            {maxLength !== undefined && (
              <span
                className={`ms-2 italic text-xs font-mono tabular-nums ${
                  isOverLimit
                    ? "text-[#f28b8b] font-bold"
                    : charCount / maxLength >= 0.9
                    ? "text-yellow-400"
                    : "text-[#949ba4]"
                }`}
              >
                {charCount}/{maxLength}
              </span>
            )}
          </label>
        ) : <div />}
      </div>

      {/* Input container - Discohook styled textarea with bottom-right quick mention button */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value || ""}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onClick={handleClick}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-[#1e1f22] text-[#dbdee1] placeholder-[#949ba4] text-sm p-3 pr-10 rounded-lg border border-[#232428] hover:border-[#35373c] focus:border-[#5865f2] focus:outline-none transition-colors resize-y leading-relaxed font-sans"
          style={{ minHeight: `${rows * 26}px` }}
        />

        {/* Bottom-right Quick Mentions / Rich Picker Trigger */}
        <div className="absolute right-2.5 bottom-2.5 z-10 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowRichPicker(!showRichPicker)}
            className={`p-1.5 rounded transition-colors ${
              showRichPicker
                ? "bg-[#5865f2] text-white"
                : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]"
            }`}
            title="Quick Mentions, Timestamps & Emojis"
          >
            <Keyboard size={16} />
          </button>

          {/* Floating Rich Picker Popover */}
          {showRichPicker && (
            <RichPicker
              onInsert={insertDirect}
              onClose={() => setShowRichPicker(false)}
              guildId={effectiveGuildId}
            />
          )}
        </div>

        {/* Inline Autocomplete Dropdown Popup */}
        {acType && acItems.length > 0 && (
          <div
            className="absolute bottom-full left-0 mb-1 w-72 sm:w-80 rounded-lg bg-[#2b2d31] border border-[#1e1f22] shadow-2xl overflow-hidden z-40 animate-in fade-in zoom-in-95 duration-75"
            style={{ maxHeight: "240px" }}
          >
            <div className="px-2.5 py-1.5 bg-[#1e1f22] text-[10px] font-bold uppercase tracking-wider text-[#949ba4] border-b border-[#313338] flex items-center justify-between">
              <span>
                {acType === "user"
                  ? "Matching Users & Roles"
                  : acType === "channel"
                  ? "Matching Channels"
                  : "Matching Emojis"}
              </span>
              <span className="text-[9px] lowercase font-normal text-[#949ba4]">
                tab or enter to select
              </span>
            </div>

            <div className="overflow-y-auto max-h-48 p-1 space-y-0.5 custom-scrollbar">
              {acItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => applyReplacement(item.replacement)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? "bg-[#5865f2] text-white"
                        : "text-[#dbdee1] hover:bg-[#35373c] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.icon}
                      <span className="font-semibold truncate">{item.title}</span>
                    </div>
                    {item.subtitle && (
                      <span
                        className={`text-[10px] truncate shrink-0 ${
                          isSelected ? "text-white/80" : "text-[#949ba4]"
                        }`}
                      >
                        {item.subtitle}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};