import { Check, Keyboard, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, useEffect, useMemo } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { getUserIdPlaceholderSuggestions } from "../../utils/userPlaceholderAutocomplete";
import { UI_THEME_CONFIG } from "../../config/uiThemeConfig";

export const VARIABLES = [
  { group: "User / Clicker" },
  { tag: "{user.mention}", label: "@ada", desc: "Mentions the user who clicked" },
  { tag: "{user.name}", label: "ada", desc: "The user's exact username" },
  { tag: "{user.displayname}", label: "Ada L.", desc: "Server nickname or global name" },
  { tag: "{user.id}", label: "123456789", desc: "The user's numeric ID" },
  { tag: "{user.avatar}", label: "https://...", desc: "Link to user's profile picture" },
  { tag: "{user.roles}", label: "@Role1 @Role2", desc: "All roles the clicker holds" },
  { tag: "{user.clantag}", label: "HOHO", desc: "Prefix tag inside [TAG] or (TAG)" },
  { tag: "{user.created}", label: "Oct 24, 2019", desc: "When the account was created" },
  { tag: "{user.created.relative}", label: "5 years ago", desc: "Account age (Relative)" },
  { tag: "{user.joined}", label: "2 years ago", desc: "When they joined the server (Relative)" },
  { tag: "{user.joined.date}", label: "Jun 15, 2024", desc: "Server join date (Short date)" },

  { group: "Server, Channel & Bot" },
  { tag: "{server.id}", label: "987654321", desc: "ID of the current server" },
  { tag: "{server.name}", label: "HoHo Hub", desc: "Name of the current server" },
  { tag: "{server.icon}", label: "https://...", desc: "Server icon URL" },
  { tag: "{channel.mention}", label: "#general", desc: "Mentions the current channel" },
  { tag: "{channel.id}", label: "456789123", desc: "ID of the current channel" },
  { tag: "{bot.mention}", label: "@Bot", desc: "Mentions the bot" },
  { tag: "{bot.id}", label: "11223344", desc: "The bot's ID" },
  { tag: "{message.id}", label: "129384756", desc: "ID of the message with the button" },
  { tag: "{message.url}", label: "https://discord.com/...", desc: "Jump link to the message" },

  { group: "Time & Date" },
  { tag: "{now}", label: "12:00 PM", desc: "Short time (<t:unix:t>)" },
  { tag: "{now.time}", label: "12:00:00 PM", desc: "Long time with seconds (<t:unix:T>)" },
  { tag: "{now.date}", label: "11/10/2026", desc: "Short date (<t:unix:d>)" },
  { tag: "{now.longdate}", label: "November 10, 2026", desc: "Long date (<t:unix:D>)" },
  { tag: "{now.short}", label: "Nov 10, 2026 12:00 PM", desc: "Short date & time (<t:unix:f>)" },
  { tag: "{now.long}", label: "Tuesday, Nov 10, 2026", desc: "Long date & time (<t:unix:F>)" },
  { tag: "{now.relative}", label: "2 mins ago", desc: "Relative time (<t:unix:R>)" },
  { tag: "{now.unix}", label: "1698144000", desc: "Raw Unix timestamp number" },

  { group: "Select Menus & Modals" },
  { tag: "{selected}", label: "option_1, option_2", desc: "Values chosen in a Select Menu" },
  { tag: "{selected.0}", label: "option_1", desc: "First value chosen in a Select Menu" },
  { tag: "{input.field_1}", label: "Answer", desc: "Modal input value by Custom ID" },
  { tag: "{modal.field_1}", label: "Answer", desc: "Modal input value alias" },
];

interface FieldShellProps { label?: ReactNode; hint?: ReactNode; counterValue?: string; limit?: number; className?: string; children: ReactNode; }

const FieldShell = ({ label, hint, counterValue = "", limit, className = "", children }: FieldShellProps) => (
  <div className={`block ${className}`}>
    {(label !== undefined || limit !== undefined) && (
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="field-label !mb-0">{label}</span>
        {limit !== undefined && <span className={`text-[11px] italic tabular-nums font-medium ${counterValue.length > limit ? "text-[#da373c]" : counterValue.length / limit >= 0.9 ? "text-[#faa61a]" : "text-[#949ba4]"}`}>{counterValue.length}/{limit}</span>}
      </span>
    )}
    {children}
    {hint && <span className="mt-1 block text-[11px] text-[#949ba4]">{hint}</span>}
  </div>
);

const asText = (value: unknown): string => typeof value === "string" ? value : value == null ? "" : String(value);

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
  limit?: number;
  variables?: boolean;
}

import { RichPicker } from "../editor/RichPicker";
import { UNICODE_EMOJI_LIST } from "../../utils/unicodeEmojis";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
import { useGlobalStore } from "../../store/globalStore";

const InlineRichPickerTrigger = ({ onInsert }: { onInsert: (tag: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<"top" | "bottom">("top");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const above = Math.max(0, rect.top - top - 12);
      const below = Math.max(0, top + height - rect.bottom - 12);
      setPos(above > below ? "top" : "bottom");
    }
    const handleOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={wrapRef} className="absolute right-2 top-1.5 z-20">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`p-1 rounded transition-colors ${
          open
            ? "bg-[#5865f2] text-white shadow-sm"
            : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c] bg-[#2b2d31]/80 border border-[#1e1f22]"
        }`}
        title="Quick Mentions, Timestamps & Emojis"
      >
        <Keyboard size={14} />
      </button>
      {open && (
        <RichPicker
          onInsert={(val) => {
            onInsert(val);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          position={pos}
        />
      )}
    </div>
  );
};

const ACTUAL_VARIABLES = VARIABLES.filter(
  (v): v is { tag: string; label: string; desc: string } => typeof (v as any).tag === "string",
);

const getAutocompleteVariables = (query: string) => {
  const idSuggestions = getUserIdPlaceholderSuggestions(query);

  // null means this is an ordinary variable query.
  // An empty array means it is an ID query with no matching field.
  if (idSuggestions !== null) return idSuggestions;

  const q = query.toLowerCase().replace(/^\{+/, "");

  return ACTUAL_VARIABLES.filter(
    (v) =>
      !q ||
      v.tag.toLowerCase().includes(q) ||
      v.desc.toLowerCase().includes(q) ||
      v.label.toLowerCase().includes(q),
  ).slice(0, 8);
};

interface VariableAutocompleteProps {
  query: string;
  onSelect: (tag: string) => void;
  onClose: () => void;
  dropdownPos?: "top" | "bottom";
  selectedIndex?: number;
}

const VariableAutocompletePopover = ({
  query,
  onSelect,
  dropdownPos = "bottom",
  selectedIndex = 0,
}: VariableAutocompleteProps) => {
  const filtered = useMemo(
    () => getAutocompleteVariables(query),
    [query],
  );
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedOptionRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex, filtered]);

  if (filtered.length === 0) return null;

  return (
    <div
      className={`absolute left-0 z-50 w-72 bg-[#1e1f22] border border-[#35373c] rounded-md shadow-2xl overflow-hidden py-1 ${
        dropdownPos === "top" ? "bottom-full mb-1" : "top-full mt-1"
      }`}
    >
      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#949ba4] border-b border-[#2b2d31] flex items-center justify-between">
        <span>Variables ({filtered.length})</span>
        <span className="text-[9px] font-normal lowercase">Press Enter or Tab</span>
      </div>
      <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
        {filtered.map((item, idx) => (
          <button
            ref={idx === selectedIndex ? selectedOptionRef : undefined}
            key={item.tag}
            type="button"
            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
              idx === selectedIndex
                ? "bg-[#5865f2] text-white"
                : "text-[#dbdee1] hover:bg-[#2b2d31]"
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item.tag);
            }}
          >
            <div className="min-w-0 flex-1">
              <span className="font-mono font-semibold text-xs">{(item as any).displayTag ?? item.tag}</span>
              <p
                className={`text-[10px] truncate ${
                  idx === selectedIndex ? "text-[#dee0fc]" : "text-[#949ba4]"
                }`}
              >
                {item.desc}
              </p>
            </div>
            <span
              className={`text-[10px] font-mono px-1 rounded ml-1 shrink-0 ${
                idx === selectedIndex ? "bg-[#4752c4]" : "bg-[#2b2d31] text-[#949ba4]"
              }`}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface EmojiAutocompleteProps {
  query: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  dropdownPos?: "top" | "bottom";
  selectedIndex?: number;
}

const EmojiAutocompletePopover = ({
  query,
  onSelect,
  dropdownPos = "bottom",
  selectedIndex = 0,
}: EmojiAutocompleteProps) => {
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const emojisByGuild = useDiscordCacheStore((state) => state.emojis);
  const guildEmojis = (selectedGuildId && emojisByGuild[selectedGuildId]) || [];

  const q = query.toLowerCase().replace(/^:/, "").replace(/:$/, "");
  const filtered = useMemo(() => {
    const list: Array<{ key: string; name: string; display: ReactNode; insert: string }> = [];
    for (const g of guildEmojis) {
      if (!q || g.name.toLowerCase().includes(q)) {
        list.push({
          key: g.id,
          name: g.name,
          display: (
            <img
              src={`https://cdn.discordapp.com/emojis/${g.id}.${g.animated ? "gif" : "png"}?size=32`}
              alt={g.name}
              className="w-4 h-4 object-contain inline-block"
            />
          ),
          insert: `<${g.animated ? "a" : ""}:${g.name}:${g.id}>`,
        });
      }
      if (list.length >= 6) break;
    }
    for (const u of UNICODE_EMOJI_LIST) {
      if (!q || u.name.toLowerCase().includes(q) || u.keywords.some((k) => k.toLowerCase().includes(q))) {
        list.push({
          key: u.name,
          name: u.name,
          display: <span className="text-base">{u.char}</span>,
          insert: u.char,
        });
      }
      if (list.length >= 12) break;
    }
    return list;
  }, [q, guildEmojis]);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedOptionRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex, filtered]);

  if (filtered.length === 0) return null;

  return (
    <div
      className={`absolute left-0 z-50 w-64 bg-[#1e1f22] border border-[#35373c] rounded-md shadow-2xl overflow-hidden py-1 ${
        dropdownPos === "top" ? "bottom-full mb-1" : "top-full mt-1"
      }`}
    >
      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#949ba4] border-b border-[#2b2d31] flex items-center justify-between">
        <span>Emojis ({filtered.length})</span>
        <span className="text-[9px] font-normal lowercase">Press Enter or Tab</span>
      </div>
      <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
        {filtered.map((item, idx) => (
          <button
            ref={idx === selectedIndex ? selectedOptionRef : undefined}
            key={item.key}
            type="button"
            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
              idx === selectedIndex
                ? "bg-[#5865f2] text-white"
                : "text-[#dbdee1] hover:bg-[#2b2d31]"
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item.insert);
            }}
          >
            <span className="shrink-0 flex items-center justify-center w-5 h-5">
              {item.display}
            </span>
            <span className="font-mono text-xs truncate">:{item.name}:</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export const TextField = ({ label, hint, limit, variables = true, className, ...props }: TextFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const showVars = Boolean(variables) && !props.disabled && (!props.type || props.type === "text");
  const [acState, setAcState] = useState<{ open: boolean; query: string; start: number; end: number } | null>(null);
  const [emojiAcState, setEmojiAcState] = useState<{ open: boolean; query: string; start: number; end: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const getDropdownPos = (): "top" | "bottom" => {
    if (!inputRef.current) return "bottom";
    const rect = inputRef.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const height = viewport?.height ?? window.innerHeight;
    const above = Math.max(0, rect.top - top - 12);
    const below = Math.max(0, top + height - rect.bottom - 12);
    return above > below ? "top" : "bottom";
  };

  const checkInlineVariable = (val: string, cursor: number) => {
    const textBefore = val.slice(0, cursor);
    if (showVars) {
      const lastOpen = textBefore.lastIndexOf("{");
      if (lastOpen !== -1) {
        const token = textBefore.slice(lastOpen);
        if (!/[}\n\r]/.test(token)) {
          const q = token.replace(/^\{+/, "");
          if (!/\s/.test(q)) {
            setAcState({ open: true, query: q, start: lastOpen, end: cursor });
            setEmojiAcState(null);
            setSelectedIndex(0);
            return;
          }
        }
      }
    }

    const colonIdx = textBefore.lastIndexOf(":");
    if (colonIdx !== -1) {
      const token = textBefore.slice(colonIdx);
      if (!/\s/.test(token) && token.length >= 1) {
        setEmojiAcState({ open: true, query: token.slice(1), start: colonIdx, end: cursor });
        setAcState(null);
        setSelectedIndex(0);
        return;
      }
    }

    setAcState(null);
    setEmojiAcState(null);
  };

  const handleInsertVariable = (tag: string) => {
    const input = inputRef.current;
    if (!input || !props.onChange) return;
    const currentVal = asText(props.value);
    const start = acState?.open ? acState.start : (input.selectionStart ?? currentVal.length);
    const end = acState?.open ? acState.end : (input.selectionEnd ?? currentVal.length);
    const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);
    setAcState(null);
    const e = { target: { value: newVal } } as any;
    props.onChange(e);
    setTimeout(() => {
      try {
        input.focus();
        input.setSelectionRange(start + tag.length, start + tag.length);
      } catch {}
    }, 0);
  };

  const handleInsertEmoji = (emojiChar: string) => {
    const input = inputRef.current;
    if (!input || !props.onChange) return;
    const currentVal = asText(props.value);
    const start = emojiAcState?.open ? emojiAcState.start : (input.selectionStart ?? currentVal.length);
    const end = emojiAcState?.open ? emojiAcState.end : (input.selectionEnd ?? currentVal.length);
    const newVal = currentVal.substring(0, start) + emojiChar + currentVal.substring(end);
    setEmojiAcState(null);
    const e = { target: { value: newVal } } as any;
    props.onChange(e);
    setTimeout(() => {
      try {
        input.focus();
        input.setSelectionRange(start + emojiChar.length, start + emojiChar.length);
      } catch {}
    }, 0);
  };

  return (
    <FieldShell label={label ?? (limit !== undefined ? label : undefined)} hint={hint} limit={limit} counterValue={asText(props.value)} className={className}>
      <div className="relative w-full">
        <input
          ref={inputRef}
          className={`field w-full ${showVars ? "pr-10" : "pr-3"} bg-[#1e1f22] text-[#dbdee1] border-[#111214] focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]`}
          {...props}
          onChange={(e) => {
            props.onChange?.(e);
            checkInlineVariable(e.target.value, e.target.selectionEnd ?? e.target.value.length);
          }}
          onKeyDown={(e) => {
            props.onKeyDown?.(e);
            if (acState?.open) {
              const filtered = getAutocompleteVariables(acState.query);
              if (filtered.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev + 1) % filtered.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const target = filtered[selectedIndex] || filtered[0];
                  if (target) handleInsertVariable(target.tag);
                  return;
                }
              }
              if (e.key === "Escape") {
                setAcState(null);
                return;
              }
            }

            if (emojiAcState?.open) {
              const q = emojiAcState.query.toLowerCase().replace(/^:/, "").replace(/:$/, "");
              const filtered = UNICODE_EMOJI_LIST.filter(
                (u) =>
                  !q ||
                  u.name.toLowerCase().includes(q) ||
                  u.keywords.some((k) => k.toLowerCase().includes(q)),
              ).slice(0, 12);
              if (filtered.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev + 1) % filtered.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const target = filtered[selectedIndex] || filtered[0];
                  if (target) handleInsertEmoji(target.char);
                  return;
                }
              }
              if (e.key === "Escape") {
                setEmojiAcState(null);
                return;
              }
            }
          }}
          onKeyUp={(e) => {
            props.onKeyUp?.(e);
            const input = inputRef.current;
            if (input) checkInlineVariable(input.value, input.selectionEnd ?? input.value.length);
          }}
          onBlur={(e) => {
            props.onBlur?.(e);
            setTimeout(() => {
              setAcState(null);
              setEmojiAcState(null);
            }, 200);
          }}
        />
        {showVars && <InlineRichPickerTrigger onInsert={handleInsertVariable} />}
        {showVars && acState?.open && (
          <VariableAutocompletePopover
            query={acState.query}
            dropdownPos={getDropdownPos()}
            selectedIndex={selectedIndex}
            onSelect={handleInsertVariable}
            onClose={() => setAcState(null)}
          />
        )}
        {emojiAcState?.open && (
          <EmojiAutocompletePopover
            query={emojiAcState.query}
            dropdownPos={getDropdownPos()}
            selectedIndex={selectedIndex}
            onSelect={handleInsertEmoji}
            onClose={() => setEmojiAcState(null)}
          />
        )}
      </div>
    </FieldShell>
  );
};

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; hint?: ReactNode; limit?: number; variables?: boolean; }

export const TextArea = ({ label, hint, limit, rows = 4, variables = true, className, ...props }: TextAreaProps) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const showVars = Boolean(variables) && !props.disabled;
  const [acState, setAcState] = useState<{ open: boolean; query: string; start: number; end: number } | null>(null);
  const [emojiAcState, setEmojiAcState] = useState<{ open: boolean; query: string; start: number; end: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const getDropdownPos = (): "top" | "bottom" => {
    if (!textAreaRef.current) return "bottom";
    const rect = textAreaRef.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const height = viewport?.height ?? window.innerHeight;
    const above = Math.max(0, rect.top - top - 12);
    const below = Math.max(0, top + height - rect.bottom - 12);
    return above > below ? "top" : "bottom";
  };

  const checkInlineVariable = (val: string, cursor: number) => {
    const textBefore = val.slice(0, cursor);
    if (showVars) {
      const lastOpen = textBefore.lastIndexOf("{");
      if (lastOpen !== -1) {
        const token = textBefore.slice(lastOpen);
        if (!/[}\n\r]/.test(token)) {
          const q = token.replace(/^\{+/, "");
          if (!/\s/.test(q)) {
            setAcState({ open: true, query: q, start: lastOpen, end: cursor });
            setEmojiAcState(null);
            setSelectedIndex(0);
            return;
          }
        }
      }
    }

    const colonIdx = textBefore.lastIndexOf(":");
    if (colonIdx !== -1) {
      const token = textBefore.slice(colonIdx);
      if (!/\s/.test(token) && token.length >= 1) {
        setEmojiAcState({ open: true, query: token.slice(1), start: colonIdx, end: cursor });
        setAcState(null);
        setSelectedIndex(0);
        return;
      }
    }

    setAcState(null);
    setEmojiAcState(null);
  };

  const handleInsertVariable = (tag: string) => {
    const input = textAreaRef.current;
    if (!input || !props.onChange) return;
    const currentVal = asText(props.value);
    const start = acState?.open ? acState.start : (input.selectionStart ?? currentVal.length);
    const end = acState?.open ? acState.end : (input.selectionEnd ?? currentVal.length);
    const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);
    setAcState(null);
    const e = { target: { value: newVal } } as any;
    props.onChange(e);
    setTimeout(() => {
      try {
        input.focus();
        input.setSelectionRange(start + tag.length, start + tag.length);
      } catch {}
    }, 0);
  };

  const handleInsertEmoji = (emojiChar: string) => {
    const input = textAreaRef.current;
    if (!input || !props.onChange) return;
    const currentVal = asText(props.value);
    const start = emojiAcState?.open ? emojiAcState.start : (input.selectionStart ?? currentVal.length);
    const end = emojiAcState?.open ? emojiAcState.end : (input.selectionEnd ?? currentVal.length);
    const newVal = currentVal.substring(0, start) + emojiChar + currentVal.substring(end);
    setEmojiAcState(null);
    const e = { target: { value: newVal } } as any;
    props.onChange(e);
    setTimeout(() => {
      try {
        input.focus();
        input.setSelectionRange(start + emojiChar.length, start + emojiChar.length);
      } catch {}
    }, 0);
  };

  return (
    <FieldShell label={label} hint={hint} limit={limit} counterValue={asText(props.value)} className={className}>
      <div className="relative w-full">
        <textarea
          ref={textAreaRef}
          rows={rows}
          className="field resize-y w-full pr-10 bg-[#1e1f22] text-[#dbdee1] border-[#111214] focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2] py-2"
          {...props}
          onChange={(e) => {
            props.onChange?.(e);
            checkInlineVariable(e.target.value, e.target.selectionEnd ?? e.target.value.length);
          }}
          onKeyDown={(e) => {
            props.onKeyDown?.(e);
            if (acState?.open) {
              const filtered = getAutocompleteVariables(acState.query);
              if (filtered.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev + 1) % filtered.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const target = filtered[selectedIndex] || filtered[0];
                  if (target) handleInsertVariable(target.tag);
                  return;
                }
              }
              if (e.key === "Escape") {
                setAcState(null);
                return;
              }
            }

            if (emojiAcState?.open) {
              const q = emojiAcState.query.toLowerCase().replace(/^:/, "").replace(/:$/, "");
              const filtered = UNICODE_EMOJI_LIST.filter(
                (u) =>
                  !q ||
                  u.name.toLowerCase().includes(q) ||
                  u.keywords.some((k) => k.toLowerCase().includes(q)),
              ).slice(0, 12);
              if (filtered.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev + 1) % filtered.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const target = filtered[selectedIndex] || filtered[0];
                  if (target) handleInsertEmoji(target.char);
                  return;
                }
              }
              if (e.key === "Escape") {
                setEmojiAcState(null);
                return;
              }
            }
          }}
          onKeyUp={(e) => {
            props.onKeyUp?.(e);
            const input = textAreaRef.current;
            if (input) checkInlineVariable(input.value, input.selectionEnd ?? input.value.length);
          }}
          onBlur={(e) => {
            props.onBlur?.(e);
            setTimeout(() => {
              setAcState(null);
              setEmojiAcState(null);
            }, 200);
          }}
        />
        {showVars && <InlineRichPickerTrigger onInsert={handleInsertVariable} />}
        {showVars && acState?.open && (
          <VariableAutocompletePopover
            query={acState.query}
            dropdownPos={getDropdownPos()}
            selectedIndex={selectedIndex}
            onSelect={handleInsertVariable}
            onClose={() => setAcState(null)}
          />
        )}
        {emojiAcState?.open && (
          <EmojiAutocompletePopover
            query={emojiAcState.query}
            dropdownPos={getDropdownPos()}
            selectedIndex={selectedIndex}
            onSelect={handleInsertEmoji}
            onClose={() => setEmojiAcState(null)}
          />
        )}
      </div>
    </FieldShell>
  );
};

export interface SelectOption_ { value: string; label: string; }
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  hint?: ReactNode;
  options: readonly SelectOption_[];
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}
export const Select = ({ label, hint, options, className, value, defaultValue, onChange, disabled, name, required }: SelectProps) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === (value ?? defaultValue))));
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedValue = String(value ?? defaultValue ?? options[0]?.value ?? "");
  const selected = options.find((option) => option.value === selectedValue);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const choose = (nextValue: string) => {
    onChange?.({ target: { value: nextValue, name } } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };
  return (
    <FieldShell label={label} hint={hint} className={className}>
      <div ref={rootRef} className="relative">
        <button type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={`select-options-${name ?? "field"}`}
          disabled={disabled} onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(options.length - 1, index + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.max(0, index - 1)); }
            if (event.key === "Enter" && open) { event.preventDefault(); if (options[activeIndex]) choose(options[activeIndex].value); }
            if (event.key === "Escape") setOpen(false);
          }}
          className={UI_THEME_CONFIG.field.selectTrigger}>
          <span>{selected?.label ?? "Select an option"}</span>
          <ChevronDown size={14} className={"text-[#949ba4] transition-transform duration-150 " + (open ? "rotate-180 text-white" : "")} />
        </button>
        <AnimatePresence>
          {open && <motion.div id={`select-options-${name ?? "field"}`} role="listbox"
            initial={UI_THEME_CONFIG.motion.popoverPoses.initial}
            animate={UI_THEME_CONFIG.motion.popoverPoses.animate}
            exit={UI_THEME_CONFIG.motion.popoverPoses.exit}
            style={{ transformOrigin: "top center" }}
            className={UI_THEME_CONFIG.field.selectListbox}>
            {options.map((option, index) => <motion.button key={option.value} type="button" role="option" aria-selected={option.value === selectedValue}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.15, delay: Math.min(index * UI_THEME_CONFIG.motion.durations.staggerStep, UI_THEME_CONFIG.motion.durations.maxStaggerDelay), ease: UI_THEME_CONFIG.motion.easeOut } }}
              onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option.value)}
              className={"w-full rounded-md px-2.5 py-2 text-left text-xs active:scale-[0.97] transition-transform " + (option.value === selectedValue ? "bg-[#5865f2] text-white font-semibold" : index === activeIndex ? "bg-[#2b2d31] text-white" : "text-[#dbdee1] hover:bg-[#232428]")}>
              {option.label}
            </motion.button>)}
          </motion.div>}
        </AnimatePresence>
        {required && <input type="hidden" name={name} value={selectedValue} />}
      </div>
    </FieldShell>
  );
};

export interface CheckboxProps { label?: ReactNode; checked?: boolean; onChange: (checked: boolean) => void; className?: string; disabled?: boolean; }
export const Checkbox = ({ label, checked, onChange, className = "", disabled = false }: CheckboxProps) => (
  <button type="button" role="checkbox" aria-checked={Boolean(checked)} disabled={disabled}
    onClick={() => onChange(!checked)}
    className={"group inline-flex min-h-[28px] items-center gap-2 text-left text-sm font-normal text-[#dbdee1] active:scale-[0.97] transition-transform disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer select-none " + className}>
    <motion.span
      animate={{
        scaleX: [...UI_THEME_CONFIG.motion.squashStretch.scaleX],
        scaleY: [...UI_THEME_CONFIG.motion.squashStretch.scaleY],
      }}
      transition={{ duration: 0.2, ease: UI_THEME_CONFIG.motion.easeInOut }}
      key={String(Boolean(checked))}
      className={"flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors " + (checked ? UI_THEME_CONFIG.field.checkboxBoxChecked : UI_THEME_CONFIG.field.checkboxBoxUnchecked)}>
      <Check size={12} aria-hidden="true" />
    </motion.span>
    {label}
  </button>
);
export default TextField;