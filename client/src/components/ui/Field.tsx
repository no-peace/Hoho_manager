import { Check, Keyboard, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, useEffect, useMemo } from "react";
import type { ChangeEvent, CSSProperties, InputHTMLAttributes, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { getUserIdPlaceholderSuggestions } from "../../utils/userPlaceholderAutocomplete";
import { detectAutocompleteToken } from "../../utils/mentionParser";
import { UI_THEME_CONFIG } from "../../config/uiThemeConfig";
import { calculateFloatingPosition } from "../../utils/floatingPosition";

export const VARIABLES = [
  { group: "User / Clicker" },
  { tag: "{user.mention}", label: "@ada", desc: "Mentions the user who clicked" },
  { tag: "{user.name}", label: "ada", desc: "The user's server nickname, falling back to username" },
  { tag: "{user.username}", label: "ada_123", desc: "The user's Discord username (unique handle)" },
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
  { tag: "{server.icon_hash}", label: "a_...", desc: "Raw Discord server icon hash" },
  { tag: "{server.icon_url}", label: "https://...", desc: "Server icon CDN URL alias" },
  { tag: "{server.owner_id}", label: "123456789", desc: "ID of the server owner" },
  { tag: "{server.description}", label: "A community server", desc: "Server description, if set" },
  { tag: "{server.banner}", label: "banner_hash", desc: "Raw server banner hash" },
  { tag: "{server.banner_url}", label: "https://...", desc: "Server banner CDN URL" },
  { tag: "{server.splash}", label: "splash_hash", desc: "Raw invite splash hash" },
  { tag: "{server.splash_url}", label: "https://...", desc: "Invite splash CDN URL" },
  { tag: "{server.discovery_splash}", label: "discovery_hash", desc: "Raw discovery splash hash" },
  { tag: "{server.discovery_splash_url}", label: "https://...", desc: "Discovery splash CDN URL" },
  { tag: "{server.afk_channel_id}", label: "123456789", desc: "ID of the AFK voice channel" },
  { tag: "{server.afk_timeout}", label: "300", desc: "AFK timeout in seconds" },
  { tag: "{server.region}", label: "deprecated", desc: "Legacy server voice region field; deprecated by Discord" },
  { tag: "{server.widget_enabled}", label: "true", desc: "Whether the server widget is enabled" },
  { tag: "{server.widget_channel_id}", label: "123456789", desc: "Server widget invite channel ID" },
  { tag: "{server.verification_level}", label: "2", desc: "Server verification level (0–4)" },
  { tag: "{server.default_message_notifications}", label: "1", desc: "Default notification level (0–1)" },
  { tag: "{server.explicit_content_filter}", label: "2", desc: "Explicit content filter level (0–2)" },
  { tag: "{server.roles}", label: "[{...}]", desc: "All server roles as JSON; indexed fields are also available" },
  { tag: "{server.emojis}", label: "[{...}]", desc: "Custom server emojis as JSON" },
  { tag: "{server.features}", label: "COMMUNITY, VERIFIED", desc: "Enabled Discord server features" },
  { tag: "{server.mfa_level}", label: "1", desc: "Required MFA level for moderation" },
  { tag: "{server.application_id}", label: "123456789", desc: "Application ID that created the server, if any" },
  { tag: "{server.system_channel_id}", label: "123456789", desc: "System messages channel ID" },
  { tag: "{server.system_channel_flags}", label: "0", desc: "System channel notification flags bitfield" },
  { tag: "{server.rules_channel_id}", label: "123456789", desc: "Community rules channel ID" },
  { tag: "{server.max_presences}", label: "null", desc: "Maximum presences, when provided by Discord" },
  { tag: "{server.max_members}", label: "250000", desc: "Maximum server member capacity" },
  { tag: "{server.vanity_url_code}", label: "hohohub", desc: "Server vanity invite code" },
  { tag: "{server.premium_tier}", label: "3", desc: "Server boost tier (0–3)" },
  { tag: "{server.premium_subscription_count}", label: "42", desc: "Current server boost count" },
  { tag: "{server.preferred_locale}", label: "en-US", desc: "Server preferred locale" },
  { tag: "{server.public_updates_channel_id}", label: "123456789", desc: "Community public updates channel ID" },
  { tag: "{server.max_video_channel_users}", label: "25", desc: "Maximum users in video channels" },
  { tag: "{server.max_stage_video_channel_users}", label: "50", desc: "Maximum users in stage video channels" },
  { tag: "{server.approximate_member_count}", label: "12000", desc: "Approximate member count (with_counts)" },
  { tag: "{server.approximate_presence_count}", label: "850", desc: "Approximate online presence count (with_counts)" },
  { tag: "{server.welcome_screen}", label: "{...}", desc: "Welcome screen object as JSON; nested fields are available" },
  { tag: "{server.nsfw_level}", label: "0", desc: "Server age-restriction level (0–3)" },
  { tag: "{server.stickers}", label: "[{...}]", desc: "Custom server stickers as JSON" },
  { tag: "{server.premium_progress_bar_enabled}", label: "true", desc: "Whether the boost progress bar is enabled" },
  { tag: "{server.safety_alerts_channel_id}", label: "123456789", desc: "Safety alerts channel ID" },
  { tag: "{server.incidents_data}", label: "{...}", desc: "Server incident state as JSON; nested fields are available" },
  { tag: "{channel.mention}", label: "#general", desc: "Mentions the current channel" },
  { tag: "{channel.id}", label: "456789123", desc: "ID of the current channel" },
  { tag: "{bot.mention}", label: "@Bot", desc: "Mentions the bot" },
  { tag: "{bot.id}", label: "11223344", desc: "The bot's ID" },
  { tag: "{message.id}", label: "129384756", desc: "ID of the message with the button" },
  { tag: "{message.url}", label: "https://discord.com/...", desc: "Jump link to the message" },

  { group: "Time & Date" },
  { tag: "{now}", label: "12:00 PM", desc: "Short time (<t:unix:t>)" },
  { tag: "{now.time}", label: "12:00:00 PM", desc: "Long time with seconds (<t:unix:T>)" },
  { tag: "{now.short_time}", label: "12:00 PM", desc: "Short time (<t:unix:t>)" },
  { tag: "{now.date}", label: "November 10, 2026", desc: "Long date (<t:unix:D>)" },
  { tag: "{now.short_date}", label: "11/10/2026", desc: "Short date (<t:unix:d>)" },
  { tag: "{now.longdate}", label: "November 10, 2026", desc: "Long date (<t:unix:D>)" },
  { tag: "{now.datetime}", label: "Tuesday, Nov 10, 2026", desc: "Long date and time (<t:unix:F>)" },
  { tag: "{now.short_datetime}", label: "Nov 10, 2026 12:00 PM", desc: "Short date and time (<t:unix:f>)" },
  { tag: "{now.short}", label: "Nov 10, 2026 12:00 PM", desc: "Short date & time (<t:unix:f>)" },
  { tag: "{now.long}", label: "Tuesday, Nov 10, 2026", desc: "Long date & time (<t:unix:F>)" },
  { tag: "{now.relative}", label: "2 mins ago", desc: "Relative time (<t:unix:R>)" },
  { tag: "{now.unix}", label: "1698144000", desc: "Raw Unix timestamp number" },
  { tag: "{now.iso}", label: "2026-11-10T12:00:00.000Z", desc: "ISO-8601 UTC timestamp" },
  { tag: "{timestamp}", label: "Tuesday, Nov 10, 2026", desc: "Long date and time (<t:unix:F>)" },

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
        {limit !== undefined && <span className={`text-[11px] italic tabular-nums font-medium ${counterValue.length > limit ? "text-[#F87171]" : counterValue.length / limit >= 0.9 ? "text-[#FBBF24]" : "text-[#6F788A]"}`}>{counterValue.length}/{limit}</span>}
      </span>
    )}
    {children}
    {hint && <span className="mt-1 block text-[11px] text-[#A1A8B8]">{hint}</span>}
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
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="absolute right-2 top-1.5 z-20">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`p-1 rounded transition-colors ${
          open
            ? "bg-[#818CF8]/15 text-[#F1F3F9] border border-[#818CF8]/25"
            : "text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A] bg-[#1D2230] border border-[#272D3A]"
        }`}
        title="Quick Mentions, Timestamps & Emojis"
      >
        <Keyboard size={14} />
      </button>
      {open && (
        <RichPicker
          anchor={buttonRef.current}
          onInsert={(val) => {
            onInsert(val);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
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

  const q = query.trim().toLowerCase().replace(/^\{+/, "");

  // This picker is also used by standalone TextField/TextArea controls,
  // so expose WEAO while its prefix is still being typed.
  const availableVariables = [
    ...ACTUAL_VARIABLES,
    {
      tag: "{exploit.",
      label: "WEAO",
      desc: "Live WEAO exploit status and properties",
    },
  ];

  return availableVariables
    .filter(
      (v) =>
        !q ||
        v.tag.toLowerCase().includes(q) ||
        v.desc.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q),
    )
    .slice(0, 50);
};

interface VariableAutocompleteProps {
  query: string;
  onSelect: (tag: string) => void;
  onClose: () => void;
  selectedIndex?: number;
  anchor?: HTMLElement | null;
}

const useFloatingMenuStyle = (anchor: HTMLElement | null | undefined, menuWidth: number): CSSProperties => {
  const [style, setStyle] = useState<CSSProperties>({});
  useEffect(() => {
    if (!anchor) return;
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const position = calculateFloatingPosition(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        {
          width: viewport?.width ?? window.innerWidth,
          height: viewport?.height ?? window.innerHeight,
          offsetTop: viewport?.offsetTop,
        },
        { menuWidth, maxMenuHeight: 260 },
      );
      setStyle({
        position: "fixed",
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
        zIndex: 10000,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [anchor, menuWidth]);
  return style;
};

const VariableAutocompletePopover = ({
  query,
  onSelect,
  selectedIndex = 0,
  anchor,
}: VariableAutocompleteProps) => {
  const floatingStyle = useFloatingMenuStyle(anchor, 288);
  const filtered = useMemo(
    () => getAutocompleteVariables(query),
    [query],
  );
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedOptionRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex, filtered]);

  if (filtered.length === 0) return null;

  return typeof document === "undefined" ? null : createPortal(
    <div
      className="fixed z-[10000] bg-[#161A23] border border-[#272D3A] rounded-[10px] shadow-xl overflow-hidden py-1"
      style={floatingStyle}
    >
      <div className="px-2.5 py-1.5 text-[10px] font-medium text-[#A1A8B8] border-b border-[#202531] flex items-center justify-between">
        <span>Variables ({filtered.length})</span>
        <span className="text-[9px] font-normal lowercase">Press Enter or Tab</span>
      </div>
      <div role="listbox" aria-label="Variable suggestions" className="overflow-y-auto custom-scrollbar p-1" style={{ maxHeight: Math.max(40, Number(floatingStyle.maxHeight ?? 220) - 36) }}>
        {filtered.map((item, idx) => (
          <button
            ref={idx === selectedIndex ? selectedOptionRef : undefined}
            key={item.tag}
            id={`field-variable-option-${idx}`}
            role="option"
            aria-selected={idx === selectedIndex}
            type="button"
            className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
              idx === selectedIndex
                ? "bg-[#818CF8]/15 text-[#F1F3F9] border-l-2 border-[#818CF8]"
                : "text-[#A1A8B8] hover:bg-[#252B3A] hover:text-[#F1F3F9]"
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item.tag);
            }}
          >
            <div className="min-w-0 flex-1">
              <span className="font-mono font-medium text-xs">{(item as any).displayTag ?? item.tag}</span>
              <p
                className={`text-[10px] truncate ${
                  idx === selectedIndex ? "text-[#E5E7F3]" : "text-[#6F788A]"
                }`}
              >
                {item.desc}
              </p>
            </div>
            <span
              className={`text-[10px] font-mono px-1 rounded ml-1 shrink-0 ${
                idx === selectedIndex ? "bg-[#6366F1]" : "bg-[#1D2230] text-[#6F788A]"
              }`}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
};

interface EmojiAutocompleteProps {
  query: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  selectedIndex?: number;
  anchor?: HTMLElement | null;
}

const EmojiAutocompletePopover = ({
  query,
  onSelect,
  selectedIndex = 0,
  anchor,
}: EmojiAutocompleteProps) => {
  const floatingStyle = useFloatingMenuStyle(anchor, 256);
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

  return typeof document === "undefined" ? null : createPortal(
    <div
      className="fixed z-[10000] bg-[#161A23] border border-[#272D3A] rounded-[10px] shadow-xl overflow-hidden py-1"
      style={floatingStyle}
    >
      <div className="px-2.5 py-1.5 text-[10px] font-medium text-[#A1A8B8] border-b border-[#202531] flex items-center justify-between">
        <span>Emojis ({filtered.length})</span>
        <span className="text-[9px] font-normal lowercase">Press Enter or Tab</span>
      </div>
      <div role="listbox" aria-label="Emoji suggestions" className="overflow-y-auto custom-scrollbar p-1" style={{ maxHeight: Math.max(40, Number(floatingStyle.maxHeight ?? 220) - 36) }}>
        {filtered.map((item, idx) => (
          <button
            ref={idx === selectedIndex ? selectedOptionRef : undefined}
            key={item.key}
            id={`field-emoji-option-${idx}`}
            role="option"
            aria-selected={idx === selectedIndex}
            type="button"
            className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors ${
              idx === selectedIndex
                ? "bg-[#818CF8]/15 text-[#F1F3F9] border-l-2 border-[#818CF8]"
                : "text-[#A1A8B8] hover:bg-[#252B3A] hover:text-[#F1F3F9]"
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
    </div>,
    document.body,
  );
};

type InlineAutocompleteState = {
  query: string;
  start: number;
  end: number;
};

const useFieldAutocomplete = <T extends HTMLInputElement | HTMLTextAreaElement>(
  inputRef: RefObject<T | null>,
  value: string,
  showVariables: boolean,
  onValueChange: (nextValue: string) => void,
) => {
  const [variableState, setVariableState] = useState<InlineAutocompleteState | null>(null);
  const [emojiState, setEmojiState] = useState<InlineAutocompleteState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const checkInlineAutocomplete = (nextValue: string, cursor: number) => {
    const detected = detectAutocompleteToken(nextValue, cursor);
    if (showVariables && (detected?.type === "variable" || detected?.type === "exploit_name")) {
      setVariableState({
        query: detected.type === "exploit_name" ? `exploit.${detected.query}` : detected.query,
        start: detected.start,
        end: detected.end,
      });
      setEmojiState(null);
      setSelectedIndex(0);
      return;
    }
    if (detected?.type === "emoji") {
      setEmojiState({ query: detected.query, start: detected.start, end: detected.end });
      setVariableState(null);
      setSelectedIndex(0);
      return;
    }
    setVariableState(null);
    setEmojiState(null);
  };

  const insert = (kind: "variable" | "emoji", text: string) => {
    const input = inputRef.current;
    if (!input) return;
    const state = kind === "variable" ? variableState : emojiState;
    const currentValue = input.value ?? value;
    const start = state?.start ?? input.selectionStart ?? currentValue.length;
    const end = state?.end ?? input.selectionEnd ?? currentValue.length;
    const nextValue = currentValue.slice(0, start) + text + currentValue.slice(end);
    setVariableState(null);
    setEmojiState(null);
    onValueChange(nextValue);
    setTimeout(() => {
      input.focus();
      try {
        input.setSelectionRange(start + text.length, start + text.length);
      } catch {
        // Some input types do not support text selection ranges.
      }
    }, 0);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<T>) => {
    if (variableState) {
      const options = getAutocompleteVariables(variableState.query);
      if (event.key === "ArrowDown" && options.length > 0) {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % options.length);
        return;
      }
      if (event.key === "ArrowUp" && options.length > 0) {
        event.preventDefault();
        setSelectedIndex((index) => (index - 1 + options.length) % options.length);
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && options.length > 0) {
        event.preventDefault();
        const selected = options[selectedIndex] ?? options[0];
        if (selected) insert("variable", selected.tag);
        return;
      }
      if (event.key === "Escape") {
        setVariableState(null);
        return;
      }
    }

    if (emojiState) {
      const query = emojiState.query.toLowerCase().replace(/^:/, "").replace(/:$/, "");
      const options = UNICODE_EMOJI_LIST.filter((emoji) =>
        !query ||
        emoji.name.toLowerCase().includes(query) ||
        emoji.keywords.some((keyword) => keyword.toLowerCase().includes(query)),
      ).slice(0, 12);
      if (event.key === "ArrowDown" && options.length > 0) {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % options.length);
        return;
      }
      if (event.key === "ArrowUp" && options.length > 0) {
        event.preventDefault();
        setSelectedIndex((index) => (index - 1 + options.length) % options.length);
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && options.length > 0) {
        event.preventDefault();
        const selected = options[selectedIndex] ?? options[0];
        if (selected) insert("emoji", selected.char);
        return;
      }
      if (event.key === "Escape") setEmojiState(null);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setVariableState(null);
      setEmojiState(null);
    }, 200);
  };

  return {
    variableState,
    emojiState,
    selectedIndex,
    setSelectedIndex,
    checkInlineAutocomplete,
    handleKeyDown,
    handleBlur,
    insertVariable: (tag: string) => insert("variable", tag),
    insertEmoji: (emoji: string) => insert("emoji", emoji),
    closeVariable: () => setVariableState(null),
    closeEmoji: () => setEmojiState(null),
  };
};

export const TextField = ({ label, hint, limit, variables = true, className, ...props }: TextFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const showVars = Boolean(variables) && !props.disabled && (!props.type || props.type === "text");
  const autocomplete = useFieldAutocomplete(
    inputRef,
    asText(props.value),
    showVars,
    (nextValue) => props.onChange?.({ target: { value: nextValue } } as any),
  );

  return (
    <FieldShell label={label ?? (limit !== undefined ? label : undefined)} hint={hint} limit={limit} counterValue={asText(props.value)} className={className}>
      <div className="relative w-full">
        <input
          ref={inputRef}
          className={`field w-full ${showVars ? "pr-10" : "pr-3"}`}
          {...props}
          onChange={(event) => {
            props.onChange?.(event);
            autocomplete.checkInlineAutocomplete(event.target.value, event.target.selectionEnd ?? event.target.value.length);
          }}
          onKeyDown={(event) => {
            props.onKeyDown?.(event);
            autocomplete.handleKeyDown(event);
          }}
          onKeyUp={(event) => {
            props.onKeyUp?.(event);
            const input = inputRef.current;
            if (input) autocomplete.checkInlineAutocomplete(input.value, input.selectionEnd ?? input.value.length);
          }}
          onBlur={(event) => {
            props.onBlur?.(event);
            autocomplete.handleBlur();
          }}
        />
        {showVars && <InlineRichPickerTrigger onInsert={autocomplete.insertVariable} />}
        {showVars && autocomplete.variableState && (
          <VariableAutocompletePopover
            query={autocomplete.variableState.query}
            selectedIndex={autocomplete.selectedIndex}
            onSelect={autocomplete.insertVariable}
            onClose={autocomplete.closeVariable}
            anchor={inputRef.current}
          />
        )}
        {autocomplete.emojiState && (
          <EmojiAutocompletePopover
            query={autocomplete.emojiState.query}
            selectedIndex={autocomplete.selectedIndex}
            onSelect={autocomplete.insertEmoji}
            onClose={autocomplete.closeEmoji}
            anchor={inputRef.current}
          />
        )}
      </div>
    </FieldShell>
  );
};

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: ReactNode;
  limit?: number;
  variables?: boolean;
}

export const TextArea = ({ label, hint, limit, rows = 4, variables = true, className, ...props }: TextAreaProps) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const showVars = Boolean(variables) && !props.disabled;
  const autocomplete = useFieldAutocomplete(
    textAreaRef,
    asText(props.value),
    showVars,
    (nextValue) => props.onChange?.({ target: { value: nextValue } } as any),
  );

  return (
    <FieldShell label={label} hint={hint} limit={limit} counterValue={asText(props.value)} className={className}>
      <div className="relative w-full">
        <textarea
          ref={textAreaRef}
          rows={rows}
          className="field resize-y w-full pr-10 py-2"
          {...props}
          onChange={(event) => {
            props.onChange?.(event);
            autocomplete.checkInlineAutocomplete(event.target.value, event.target.selectionEnd ?? event.target.value.length);
          }}
          onKeyDown={(event) => {
            props.onKeyDown?.(event);
            autocomplete.handleKeyDown(event);
          }}
          onKeyUp={(event) => {
            props.onKeyUp?.(event);
            const input = textAreaRef.current;
            if (input) autocomplete.checkInlineAutocomplete(input.value, input.selectionEnd ?? input.value.length);
          }}
          onBlur={(event) => {
            props.onBlur?.(event);
            autocomplete.handleBlur();
          }}
        />
        {showVars && <InlineRichPickerTrigger onInsert={autocomplete.insertVariable} />}
        {showVars && autocomplete.variableState && (
          <VariableAutocompletePopover
            query={autocomplete.variableState.query}
            selectedIndex={autocomplete.selectedIndex}
            onSelect={autocomplete.insertVariable}
            onClose={autocomplete.closeVariable}
            anchor={textAreaRef.current}
          />
        )}
        {autocomplete.emojiState && (
          <EmojiAutocompletePopover
            query={autocomplete.emojiState.query}
            selectedIndex={autocomplete.selectedIndex}
            onSelect={autocomplete.insertEmoji}
            onClose={autocomplete.closeEmoji}
            anchor={textAreaRef.current}
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const floatingStyle = useFloatingMenuStyle(open ? buttonRef.current : null, 280);
  const selectedValue = String(value ?? defaultValue ?? options[0]?.value ?? "");
  const selected = options.find((option) => option.value === selectedValue);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex]);

  const choose = (nextValue: string) => {
    onChange?.({ target: { value: nextValue, name } } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };
  return (
    <FieldShell label={label} hint={hint} className={className}>
      <div ref={rootRef} className="relative">
        <button ref={buttonRef} type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={`select-options-${name ?? "field"}`}
          disabled={disabled} onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(options.length - 1, index + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.max(0, index - 1)); }
            if (event.key === "Enter" && open) { event.preventDefault(); if (options[activeIndex]) choose(options[activeIndex].value); }
            if (event.key === "Escape") setOpen(false);
          }}
          className={UI_THEME_CONFIG.field.selectTrigger}>
          <span>{selected?.label ?? "Select an option"}</span>
          <ChevronDown size={14} className={"text-[#A1A8B8] transition-transform duration-150 " + (open ? "rotate-180 text-white" : "")} />
        </button>
        {open && typeof document !== "undefined" && createPortal(
          <AnimatePresence>
            <motion.div
              ref={menuRef}
              id={`select-options-${name ?? "field"}`}
              role="listbox"
              initial={UI_THEME_CONFIG.motion.popoverPoses.initial}
              animate={UI_THEME_CONFIG.motion.popoverPoses.animate}
              exit={UI_THEME_CONFIG.motion.popoverPoses.exit}
              style={{ ...floatingStyle, transformOrigin: "top center" }}
              className={`fixed z-[10000] ${UI_THEME_CONFIG.field.selectListbox}`}
            >
              {options.map((option, index) => (
                <motion.button
                  ref={(node) => { optionRefs.current[index] = node; }}
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === selectedValue}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.15, delay: Math.min(index * UI_THEME_CONFIG.motion.durations.staggerStep, UI_THEME_CONFIG.motion.durations.maxStaggerDelay), ease: UI_THEME_CONFIG.motion.easeOut } }}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option.value)}
                  className={"w-full rounded-md px-2.5 py-2 text-left text-xs active:scale-[0.97] transition-transform " + (option.value === selectedValue ? "bg-[#818CF8]/15 text-[#F1F3F9] font-semibold" : index === activeIndex ? "bg-[#252B3A] text-[#F1F3F9]" : "text-[#A1A8B8] hover:bg-[#1D2230]")}
                >
                  {option.label}
                </motion.button>
              ))}
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
        {required && <input type="hidden" name={name} value={selectedValue} />}
      </div>
    </FieldShell>
  );
};

export interface CheckboxProps { label?: ReactNode; checked?: boolean; onChange: (checked: boolean) => void; className?: string; disabled?: boolean; }
export const Checkbox = ({ label, checked, onChange, className = "", disabled = false }: CheckboxProps) => (
  <button type="button" role="checkbox" aria-checked={Boolean(checked)} disabled={disabled}
    onClick={() => onChange(!checked)}
    className={"group inline-flex min-h-[28px] items-center gap-2 text-left text-sm font-normal text-[#F1F3F9] active:scale-[0.98] transition-transform disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer select-none " + className}>
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