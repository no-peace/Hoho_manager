import React, { useState, useRef, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Smile, X } from "lucide-react";
import { UNICODE_EMOJI_LIST } from "../../utils/unicodeEmojis";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
import { useGlobalStore } from "../../store/globalStore";
import { RichPicker } from "../editor/RichPicker";
import { calculateFloatingPosition } from "../../utils/floatingPosition";

export interface EmojiData {
  id?: string | null;
  name: string;
  animated?: boolean;
}

export interface EmojiPickerFieldProps {
  label?: string;
  hint?: React.ReactNode;
  value?: EmojiData | null;
  onChange: (emoji?: EmojiData) => void;
  placeholder?: string;
  className?: string;
}

export const parseEmojiInput = (
  raw: string,
): { id?: string; name: string; animated?: boolean } | undefined => {
  const val = raw.trim();
  if (!val) return undefined;
  const match = val.match(/^<(a?):([a-zA-Z0-9_]+):(\d+)>$/);
  if (match) {
    return {
      animated: match[1] === "a",
      name: match[2],
      id: match[3],
    };
  }
  return { name: val };
};

export const formatEmojiInput = (
  emoji?: {
    id?: string | null;
    name?: string | null;
    animated?: boolean | null;
  } | null,
): string => {
  if (!emoji) return "";
  if (emoji.id && emoji.name) {
    return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
  }
  return emoji.name ?? "";
};

export const EmojiPickerField: React.FC<EmojiPickerFieldProps> = ({
  label,
  hint,
  value,
  onChange,
  placeholder = "⭐ or <:name:123456789> or type :name",
  className = "",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const [textValue, setTextValue] = useState(() => formatEmojiInput(value));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [acOpen, setAcOpen] = useState(false);
  const [acQuery, setAcQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autocompleteStyle, setAutocompleteStyle] = useState<CSSProperties>({});
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const closeAutocompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const emojisByGuild = useDiscordCacheStore((state) => state.emojis);
  const fetchEmojis = useDiscordCacheStore((state) => state.fetchEmojis);
  const guildEmojis = (selectedGuildId && emojisByGuild[selectedGuildId]) || [];

  useEffect(() => () => {
    if (closeAutocompleteTimeoutRef.current) clearTimeout(closeAutocompleteTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (selectedGuildId) {
      void fetchEmojis(selectedGuildId);
    }
  }, [selectedGuildId, fetchEmojis]);

  useEffect(() => {
    setTextValue(formatEmojiInput(value));
  }, [value]);

  useEffect(() => {
    if (!acOpen || !inputRef.current) return;
    const updatePosition = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const placement = calculateFloatingPosition(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        { width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight, offsetTop: viewport?.offsetTop },
        { menuWidth: 256, maxMenuHeight: 240 },
      );
      setAutocompleteStyle({
        position: "fixed",
        top: placement.top,
        left: placement.left,
        width: placement.width,
        maxHeight: placement.maxHeight,
        zIndex: 60,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [acOpen, acQuery]);

  const filteredEmojis = useMemo(() => {
    if (!acQuery) {
      return UNICODE_EMOJI_LIST.slice(0, 10).map((u) => ({
        key: u.name,
        name: u.name,
        display: u.char,
        insert: u.char,
      }));
    }
    const q = acQuery.toLowerCase().replace(/^:/, "").replace(/:$/, "");
    const results: Array<{ key: string; name: string; display: React.ReactNode; insert: string }> = [];

    // 1. Custom Discord Emojis
    for (const g of guildEmojis) {
      if (g.name.toLowerCase().includes(q)) {
        const fullTag = `<${g.animated ? "a" : ""}:${g.name}:${g.id}>`;
        results.push({
          key: g.id,
          name: g.name,
          display: (
            <img
              src={`https://cdn.discordapp.com/emojis/${g.id}.${g.animated ? "gif" : "png"}?size=32`}
              alt={g.name}
              className="w-4 h-4 object-contain inline-block"
            />
          ),
          insert: fullTag,
        });
      }
      if (results.length >= 6) break;
    }

    // 2. Unicode Emojis
    for (const u of UNICODE_EMOJI_LIST) {
      if (u.name.toLowerCase().includes(q) || u.keywords.some((k) => k.toLowerCase().includes(q))) {
        results.push({
          key: u.name,
          name: u.name,
          display: <span className="text-base">{u.char}</span>,
          insert: u.char,
        });
      }
      if (results.length >= 12) break;
    }

    return results;
  }, [acQuery, guildEmojis]);

  useEffect(() => {
    selectedOptionRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex, filteredEmojis]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTextValue(val);
    const parsed = parseEmojiInput(val);
    onChange(parsed);

    // Check for inline :name autocomplete
    const cursor = e.target.selectionEnd ?? val.length;
    const textBefore = val.slice(0, cursor);
    const colonIdx = textBefore.lastIndexOf(":");
    if (colonIdx !== -1) {
      const q = textBefore.slice(colonIdx + 1);
      if (!/\s/.test(q) && q.length >= 1) {
        setAcQuery(q);
        setAcOpen(true);
        setSelectedIndex(0);
        return;
      }
    }
    setAcOpen(false);
  };

  const handleSelectEmoji = (insertVal: string) => {
    setTextValue(insertVal);
    onChange(parseEmojiInput(insertVal));
    setAcOpen(false);
    setPickerOpen(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setTextValue("");
    onChange(undefined);
    setAcOpen(false);
  };

  return (
    <div className={`block relative ${className}`}>
      {label && (
        <span className="mb-1 flex items-baseline justify-between gap-2">
          <span className="field-label !mb-0">{label}</span>
        </span>
      )}
      <div className="relative w-full flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={textValue}
          placeholder={placeholder}
          onChange={handleInputChange}
          onBlur={() => {
            if (closeAutocompleteTimeoutRef.current) clearTimeout(closeAutocompleteTimeoutRef.current);
            closeAutocompleteTimeoutRef.current = setTimeout(() => {
              setAcOpen(false);
              closeAutocompleteTimeoutRef.current = null;
            }, 200);
          }}
          onKeyDown={(e) => {
            if (!acOpen || filteredEmojis.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedIndex((prev) => (prev + 1) % filteredEmojis.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedIndex((prev) => (prev - 1 + filteredEmojis.length) % filteredEmojis.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              const selected = filteredEmojis[selectedIndex];
              if (selected) handleSelectEmoji(selected.insert);
            } else if (e.key === "Escape") {
              setAcOpen(false);
            }
          }}
          className="field w-full pr-16 bg-[#1e1f22] text-[#dbdee1] border-[#111214] focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {textValue && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[#949ba4] hover:text-white p-1 rounded"
              title="Clear Emoji"
            >
              <X size={12} />
            </button>
          )}
          <button
            ref={pickerButtonRef}
            type="button"
            onClick={() => setPickerOpen((current) => !current)}
            className={`p-1 rounded transition-colors ${
              pickerOpen
                ? "bg-[#5865f2] text-white shadow-sm"
                : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c] bg-[#2b2d31]/80 border border-[#1e1f22]"
            }`}
            title="Open Rich Emoji Picker"
          >
            <Smile size={14} />
          </button>
        </div>

        {/* RichPicker Popover */}
        {pickerOpen && (
          <RichPicker
            initialTab="emojis"
            onInsert={(val) => {
              handleSelectEmoji(val);
            }}
            onClose={() => setPickerOpen(false)}
            anchor={pickerButtonRef.current}
          />
        )}

        {/* Inline :emoji Autocomplete Popover */}
        {acOpen && filteredEmojis.length > 0 && typeof document !== "undefined" && createPortal(
          <div
            className="fixed bg-[#1e1f22] border border-[#35373c] rounded-md shadow-2xl overflow-hidden py-1"
            style={autocompleteStyle}
          >
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#949ba4] border-b border-[#2b2d31] flex items-center justify-between">
              <span>Emojis ({filteredEmojis.length})</span>
              <span className="text-[9px] font-normal lowercase">Press Enter or Tab</span>
            </div>
            <div className="overflow-y-auto custom-scrollbar p-1" style={{ maxHeight: Math.max(40, Number(autocompleteStyle.maxHeight ?? 200) - 36) }}>
              {filteredEmojis.map((item, idx) => (
                <button
                  ref={idx === selectedIndex ? selectedOptionRef : undefined}
                  key={item.key}
                  type="button"
                  role="option"
                  aria-selected={idx === selectedIndex}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                    idx === selectedIndex
                      ? "bg-[#5865f2] text-white"
                      : "text-[#dbdee1] hover:bg-[#2b2d31]"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectEmoji(item.insert);
                  }}
                >
                  <span className="shrink-0 flex items-center justify-center w-5 h-5">
                    {item.display}
                  </span>
                  <span className="font-mono text-xs truncate">:{item.name}:</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
      </div>
      {hint && <span className="mt-1 block text-[11px] text-[#949ba4]">{hint}</span>}
    </div>
  );
};

export default EmojiPickerField;
