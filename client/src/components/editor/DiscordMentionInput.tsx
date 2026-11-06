import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Hash,
  Volume2,
  Megaphone,
  Keyboard,
  Cpu,
  Sliders,
  AlertTriangle,
} from "lucide-react";
import { RichPicker } from "./RichPicker";
import { useGlobalStore } from "../../store/globalStore";
import { useDiscordCacheStore, type WeaoExploitItem } from "../../store/discordCacheStore";
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

type AutocompleteType =
  | "user"
  | "channel"
  | "emoji"
  | "exploit_name"
  | "exploit_field"
  | null;

interface AutocompleteItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  replacement: string;
  /** When true, selecting this item keeps the dropdown open for the next chained step (e.g. `{exploit.Delta.`). */
  keepOpen?: boolean;
  disabled?: boolean;
}

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

interface ExploitFieldOption {
  key: string;
  label: string;
  getPreview: (exp?: WeaoExploitItem) => string;
}

const EXPLOIT_FIELD_OPTIONS: readonly ExploitFieldOption[] = [
  {
    key: "status",
    label: "Status Badge (🟢 Updated / 🔴 Outdated)",
    getPreview: (e) => (e ? (e.updateStatus ? "🟢 Updated" : "🔴 Outdated") : "🟢 Updated"),
  },
  {
    key: "circle",
    label: "Status Circle Only (🟢 / 🔴)",
    getPreview: (e) => (e ? (e.updateStatus ? "🟢" : "🔴") : "🟢"),
  },
  {
    key: "statusText",
    label: "Status Text Only (Updated / Outdated)",
    getPreview: (e) => (e ? (e.updateStatus ? "Updated" : "Outdated") : "Updated"),
  },
  {
    key: "sunc",
    label: "sUNC Percentage",
    getPreview: (e) =>
      typeof e?.suncPercentage === "number" ? `${e.suncPercentage}%` : "100%",
  },
  {
    key: "unc",
    label: "UNC Percentage",
    getPreview: (e) =>
      typeof e?.uncPercentage === "number" ? `${e.uncPercentage}%` : "99%",
  },
  {
    key: "version",
    label: "Exploit Version",
    getPreview: (e) => e?.version || "v1.0.0",
  },
  {
    key: "rbxversion",
    label: "Target Roblox Version",
    getPreview: (e) => e?.rbxversion || "version-latest",
  },
  {
    key: "updatedDate",
    label: "Last Updated Timestamp (UTC)",
    getPreview: (e) => e?.updatedDate || "Recently",
  },
  {
    key: "detected",
    label: "Detection Status",
    getPreview: (e) => (e ? (e.detected ? "⚠️ Detected" : "🛡️ Undetected") : "🛡️ Undetected"),
  },
  {
    key: "free",
    label: "Pricing / Cost",
    getPreview: (e) => (e ? (e.free ? "Free" : e.cost || "Paid") : "Free / Paid"),
  },
  {
    key: "platform",
    label: "Operating System / Platform",
    getPreview: (e) => e?.platform || "Windows",
  },
  {
    key: "decompiler",
    label: "Decompiler Support",
    getPreview: (e) => (e ? (e.decompiler ? "✅" : "❌") : "✅"),
  },
  {
    key: "multiInject",
    label: "Multi-Inject Support",
    getPreview: (e) => (e ? (e.multiInject ? "✅" : "❌") : "✅"),
  },
  {
    key: "keysystem",
    label: "Key System Requirement",
    getPreview: (e) => (e ? (e.keysystem ? "🔑 Key System" : "🔓 Keyless") : "🔑 / 🔓"),
  },
  {
    key: "suncPassed",
    label: "sUNC Passed Tests Count (Live Scrap)",
    getPreview: (e) => (e?.sunc?.suncScrap ? "Fetched from /api/sunc" : "N/A"),
  },
  {
    key: "suncFailed",
    label: "sUNC Failed Tests Count (Live Scrap)",
    getPreview: (e) => (e?.sunc?.suncScrap ? "Fetched from /api/sunc" : "N/A"),
  },
  {
    key: "suncTime",
    label: "sUNC Benchmark Duration (Seconds)",
    getPreview: (e) => (e?.sunc?.suncScrap ? "Fetched from /api/sunc" : "N/A"),
  },
  {
    key: "websitelink",
    label: "Official Website URL",
    getPreview: (e) => e?.websitelink || "https://...",
  },
  {
    key: "discordlink",
    label: "Official Discord Invite URL",
    getPreview: (e) => e?.discordlink || "https://discord.gg/...",
  },
  {
    key: "purchaselink",
    label: "Official Purchase Link",
    getPreview: (e) => e?.purchaselink || "https://...",
  },
];

const DiscordMentionInputComponent: React.FC<DiscordMentionInputProps> = ({
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
  const pickerContainerRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<"top" | "bottom">("top");

  // Autocomplete state
  const [acType, setAcType] = useState<AutocompleteType>(null);
  const [acQuery, setAcQuery] = useState("");
  const [acExploitTarget, setAcExploitTarget] = useState("");
  const [acCursorStart, setAcCursorStart] = useState(-1);
  const [acCursorEnd, setAcCursorEnd] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (acType && textareaRef.current) {
      const rect = textareaRef.current.getBoundingClientRect();
      setDropdownPosition(rect.top < 260 ? "bottom" : "top");
    }
  }, [acType]);

  useEffect(() => {
    if (!showRichPicker) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        pickerContainerRef.current &&
        !pickerContainerRef.current.contains(e.target as Node)
      ) {
        setShowRichPicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showRichPicker]);

  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const effectiveGuildId = propGuildId || selectedGuildId;

  const channels = useDiscordCacheStore((state) => state.channels);
  const roles = useDiscordCacheStore((state) => state.roles);
  const weaoExploits = useDiscordCacheStore((state) => state.weaoExploits);
  const weaoMeta = useDiscordCacheStore((state) => state.weaoMeta);
  const weaoError = useDiscordCacheStore((state) => state.weaoError);
  const fetchChannels = useDiscordCacheStore((state) => state.fetchChannels);
  const fetchRoles = useDiscordCacheStore((state) => state.fetchRoles);
  const fetchWeaoExploits = useDiscordCacheStore((state) => state.fetchWeaoExploits);

  const guildChannels = (effectiveGuildId && channels[effectiveGuildId]) || EMPTY_CHANNELS;
  const guildRoles = (effectiveGuildId && roles[effectiveGuildId]) || EMPTY_ROLES;

  const [serverEmojis, setServerEmojis] = useState<
    Array<{ id: string; name: string; animated?: boolean }>
  >([]);

  const [memberResults, setMemberResults] = useState<
    Array<{
      id: string;
      username: string;
      global_name: string | null;
      nickname: string | null;
      avatar: string | null;
    }>
  >([]);

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

  // Pre-warm WEAO cache when user triggers exploit autocomplete
  useEffect(() => {
    if (acType === "exploit_name" || acType === "exploit_field") {
      void fetchWeaoExploits();
    }
  }, [acType, fetchWeaoExploits]);

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

  /**
   * Detect triggers:
   * 1. `{exploit.<Name>.<Field>` (2-step chained WEAO autocomplete)
   * 2. `@user` / `@role`
   * 3. `#channel`
   * 4. `:emoji:`
   */
  const checkAutocomplete = useCallback(
    (text: string, cursorPos: number) => {
      const textBeforeCursor = text.slice(0, cursorPos);

      // 1A. Check `{exploit.<anything>` (no closing brace yet on current line)
      const openBraceIdx = textBeforeCursor.lastIndexOf("{");
      if (openBraceIdx !== -1) {
        const tokenSinceBrace = textBeforeCursor.slice(openBraceIdx);
        // Only active if there is no `}` or newline between `{` and cursor
        if (!/[}\n\r]/.test(tokenSinceBrace)) {
          const lowerToken = tokenSinceBrace.toLowerCase();

          // If user is typing `{e`, `{ex`, `{exp`, `{exploit` before the first dot
          if (
            lowerToken.length >= 2 &&
            "{exploit.".startsWith(lowerToken) &&
            !lowerToken.startsWith("{exploit.")
          ) {
            setAcType("exploit_name");
            setAcExploitTarget("");
            setAcQuery("");
            setAcCursorStart(openBraceIdx);
            setAcCursorEnd(cursorPos);
            setSelectedIndex(0);
            return;
          }

          // Once `{exploit.` is present
          if (lowerToken.startsWith("{exploit.")) {
            const afterPrefix = tokenSinceBrace.slice("{exploit.".length);

            // Check if `afterPrefix` starts with a known exploit title + "."
            // Sort by length descending so e.g. "AWP.GG." matches before "AWP."
            const sortedKnown = [...weaoExploits].sort(
              (a, b) => b.title.length - a.title.length,
            );
            const matchedKnown = sortedKnown.find((exp) =>
              afterPrefix.toLowerCase().startsWith(`${exp.title.toLowerCase()}.`),
            );

            if (matchedKnown) {
              const fieldPart = afterPrefix.slice(matchedKnown.title.length + 1);
              if (!fieldPart.includes(".")) {
                setAcType("exploit_field");
                setAcExploitTarget(matchedKnown.title);
                setAcQuery(fieldPart);
                setAcCursorStart(openBraceIdx);
                setAcCursorEnd(cursorPos);
                setSelectedIndex(0);
                return;
              }
            }

            // Fallback if user typed a dot after an exploit name not yet in sortedKnown
            const lastDotIdx = afterPrefix.lastIndexOf(".");
            if (lastDotIdx > 0) {
              const candidateName = afterPrefix.slice(0, lastDotIdx);
              const fieldPart = afterPrefix.slice(lastDotIdx + 1);
              // Only treat as field stage if candidateName isn't a partial prefix of a dotted exploit name like "AWP.GG"
              const isPartialDottedExploit = sortedKnown.some(
                (exp) =>
                  exp.title.includes(".") &&
                  exp.title.toLowerCase().startsWith(`${candidateName.toLowerCase()}.`) &&
                  exp.title.toLowerCase() !== candidateName.toLowerCase(),
              );
              if (!isPartialDottedExploit) {
                setAcType("exploit_field");
                setAcExploitTarget(candidateName);
                setAcQuery(fieldPart);
                setAcCursorStart(openBraceIdx);
                setAcCursorEnd(cursorPos);
                setSelectedIndex(0);
                return;
              }
            }

            // Otherwise, still in Stage 1: selecting the exploit name!
            setAcType("exploit_name");
            setAcExploitTarget("");
            setAcQuery(afterPrefix);
            setAcCursorStart(openBraceIdx);
            setAcCursorEnd(cursorPos);
            setSelectedIndex(0);
            return;
          }
        }
      }

      // 2. Check @ mention
      const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
      if (mentionMatch) {
        const atIdx = textBeforeCursor.lastIndexOf("@");
        setAcType("user");
        setAcQuery(mentionMatch[1] ?? "");
        setAcCursorStart(atIdx);
        setAcCursorEnd(cursorPos);
        setSelectedIndex(0);
        return;
      }

      // 3. Check # channel
      const channelMatch = textBeforeCursor.match(/(?:^|\s)#([a-zA-Z0-9_-]*)$/);
      if (channelMatch) {
        const hashIdx = textBeforeCursor.lastIndexOf("#");
        setAcType("channel");
        setAcQuery(channelMatch[1] ?? "");
        setAcCursorStart(hashIdx);
        setAcCursorEnd(cursorPos);
        setSelectedIndex(0);
        return;
      }

      // 4. Check : emoji
      const emojiMatch = textBeforeCursor.match(/(?:^|\s):([a-zA-Z0-9_]{1,})$/);
      if (emojiMatch) {
        const colonIdx = textBeforeCursor.lastIndexOf(":");
        setAcType("emoji");
        setAcQuery(emojiMatch[1] ?? "");
        setAcCursorStart(colonIdx);
        setAcCursorEnd(cursorPos);
        setSelectedIndex(0);
        return;
      }

      setAcType(null);
      setAcQuery("");
    },
    [weaoExploits],
  );

  // Compute autocomplete items
  const acItems = useMemo<AutocompleteItem[]>(() => {
    const q = acQuery.toLowerCase().trim();

    // STAGE 1: WEAO Exploit Name Picker (`{exploit.<Name>.`)
    if (acType === "exploit_name") {
      if (weaoExploits.length === 0) {
        return [
          {
            id: "weao_loading_or_err",
            title: weaoError
              ? "⚠️ WEAO API unreachable — type exploit name manually"
              : "Loading live exploits from WEAO…",
            subtitle: weaoError || "Please wait",
            icon: <AlertTriangle size={13} className="text-[#f0b232] shrink-0" />,
            replacement: "{exploit.",
            keepOpen: true,
            disabled: true,
          },
        ];
      }

      return weaoExploits
        .filter((exp) => !q || exp.title.toLowerCase().includes(q))
        .slice(0, 25)
        .map((exp) => {
          const suncLabel =
            typeof exp.suncPercentage === "number" ? ` • ${exp.suncPercentage}% sUNC` : "";
          return {
            id: `weao_exp_${exp._id || exp.title}`,
            title: exp.title,
            subtitle: `${exp.version || "v?"} • ${exp.platform || "Windows"}${suncLabel}`,
            icon: (
              <span className="text-xs shrink-0" title={exp.updateStatus ? "Updated" : "Outdated"}>
                {exp.updateStatus ? "🟢" : "🔴"}
              </span>
            ),
            replacement: `{exploit.${exp.title}.`,
            keepOpen: true,
          };
        });
    }

    // STAGE 2: WEAO Exploit Property/Field Picker (`{exploit.<Name>.<Field>}`)
    if (acType === "exploit_field") {
      const matchedExploit =
        weaoExploits.find(
          (e) => e.title.toLowerCase() === acExploitTarget.toLowerCase(),
        ) ??
        weaoExploits.find((e) =>
          e.title.toLowerCase().includes(acExploitTarget.toLowerCase()),
        );
      const canonicalTitle = matchedExploit?.title || acExploitTarget;

      return EXPLOIT_FIELD_OPTIONS.filter(
        (opt) =>
          !q ||
          opt.key.toLowerCase().includes(q) ||
          opt.label.toLowerCase().includes(q),
      ).map((opt) => ({
        id: `weao_field_${opt.key}`,
        title: `.${opt.key}`,
        subtitle: `${opt.getPreview(matchedExploit)} — ${opt.label}`,
        icon: <Sliders size={12} className="text-[#5865f2] shrink-0" />,
        replacement: `{exploit.${canonicalTitle}.${opt.key}}`,
        keepOpen: false,
      }));
    }

    if (acType === "user") {
      const items: AutocompleteItem[] = [];

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

      guildRoles
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
      return guildChannels
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .slice(0, 15)
        .map((c) => ({
          id: c.id,
          title: `#${c.name}`,
          subtitle:
            c.type === 2 ? "Voice Channel" : c.type === 5 ? "Announcement" : "Text Channel",
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
  }, [
    acType,
    acQuery,
    acExploitTarget,
    weaoExploits,
    weaoError,
    guildRoles,
    memberResults,
    guildChannels,
    serverEmojis,
  ]);

  // Insert replacement into text (supports chained keepOpen transitions)
  const applyReplacement = useCallback(
    (item: AutocompleteItem) => {
      if (item.disabled || acCursorStart < 0 || acCursorEnd < 0) return;

      const before = value.slice(0, acCursorStart);
      const after = value.slice(acCursorEnd);
      const insertText = item.keepOpen
        ? item.replacement
        : item.replacement.endsWith(" ")
          ? item.replacement
          : `${item.replacement} `;
      const nextValue = before + insertText + after;
      const newPos = before.length + insertText.length;

      onChange(nextValue);

      if (item.keepOpen) {
        // Immediately transition to Step 2 (exploit_field) at the new cursor position
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPos, newPos);
          }
          checkAutocomplete(nextValue, newPos);
        }, 0);
      } else {
        setAcType(null);
        setAcQuery("");
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPos, newPos);
          }
        }, 0);
      }
    },
    [acCursorStart, acCursorEnd, value, onChange, checkAutocomplete],
  );

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
    [value, onChange],
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
        if (item && !item.disabled) {
          applyReplacement(item);
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
    if (
      e.key !== "ArrowUp" &&
      e.key !== "ArrowDown" &&
      e.key !== "Enter" &&
      e.key !== "Tab"
    ) {
      checkAutocomplete(e.currentTarget.value, e.currentTarget.selectionStart);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    checkAutocomplete(e.currentTarget.value, e.currentTarget.selectionStart);
  };

  const charCount = value?.length || 0;
  const isOverLimit = maxLength ? charCount > maxLength : false;

  const getHeaderLabel = () => {
    if (acType === "exploit_name") {
      return (
        <span className="flex items-center gap-1.5">
          <Cpu size={11} className="text-[#5865f2]" />
          <span>WEAO Exploits — Step 1/2</span>
          {weaoMeta?.rateLimited && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-[#f0b232]/20 text-[#f0b232]">
              ⚡ Cached (429 Cooldown)
            </span>
          )}
        </span>
      );
    }
    if (acType === "exploit_field") {
      return (
        <span className="flex items-center gap-1.5">
          <Sliders size={11} className="text-[#57f287]" />
          <span>{acExploitTarget} Properties — Step 2/2</span>
        </span>
      );
    }
    if (acType === "user") return <span>Matching Users & Roles</span>;
    if (acType === "channel") return <span>Matching Channels</span>;
    return <span>Matching Emojis</span>;
  };

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
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
        ) : (
          <div />
        )}
      </div>

      <div className="relative w-full">
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
          className="w-full block bg-[#1e1f22] text-[#dbdee1] placeholder-[#949ba4] text-sm p-3 pb-8 pr-12 rounded-lg border border-[#232428] hover:border-[#35373c] focus:border-[#5865f2] focus:outline-none transition-colors resize-y leading-relaxed font-sans"
          style={{ minHeight: `${rows * 26}px` }}
        />

        <div
          ref={pickerContainerRef}
          className="absolute right-6 bottom-2 z-10 flex items-center gap-1"
        >
          <button
            type="button"
            onClick={() => setShowRichPicker(!showRichPicker)}
            className={`p-1.5 rounded transition-colors ${
              showRichPicker
                ? "bg-[#5865f2] text-white shadow-sm"
                : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c] bg-[#2b2d31]/80 backdrop-blur-sm border border-[#1e1f22]"
            }`}
            title="Quick Mentions, Timestamps & Emojis"
          >
            <Keyboard size={15} />
          </button>

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
            className={`absolute left-0 w-80 sm:w-96 rounded-lg bg-[#2b2d31] border border-[#1e1f22] shadow-2xl overflow-hidden z-40 animate-in fade-in zoom-in-95 duration-75 ${
              dropdownPosition === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
            }`}
            style={{ maxHeight: "260px" }}
          >
            <div className="px-2.5 py-1.5 bg-[#1e1f22] text-[10px] font-bold uppercase tracking-wider text-[#949ba4] border-b border-[#313338] flex items-center justify-between">
              {getHeaderLabel()}
              <span className="text-[9px] lowercase font-normal text-[#949ba4]">
                tab or enter to select
              </span>
            </div>

            <div className="overflow-y-auto max-h-52 p-1 space-y-0.5 custom-scrollbar">
              {acItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.disabled}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => applyReplacement(item)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between gap-2 transition-colors ${
                      item.disabled
                        ? "opacity-70 cursor-default text-[#949ba4]"
                        : isSelected
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
                        className={`text-[10px] truncate shrink-0 max-w-[190px] ${
                          isSelected ? "text-white/85" : "text-[#949ba4]"
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

export const DiscordMentionInput = React.memo(DiscordMentionInputComponent);
export default DiscordMentionInput;