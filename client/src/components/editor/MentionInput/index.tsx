import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAutocompleteMenu } from "../../../hooks/useAutocompleteMenu";
import { MarkdownToolbar } from "./MarkdownToolbar";
import {
  Hash,
  Volume2,
  Megaphone,
  Keyboard,
  Cpu,
  Sliders,
  AlertTriangle,
  Code,
} from "lucide-react";
import { RichPicker } from "../RichPicker";
import { VARIABLES } from "../../ui/Field";
import { useGlobalStore } from "../../../store/globalStore";
import { useDiscordCacheStore } from "../../../store/discordCacheStore";
import api from "../../../api/client";
import { getUserIdPlaceholderSuggestions } from "../../../utils/userPlaceholderAutocomplete";
import {
  COMMON_EMOJIS_LIST,
  EXPLOIT_FIELD_OPTIONS,
  type AutocompleteItem,
} from "../../../utils/mentionParser";
import { AutocompletePopover } from "./AutocompletePopover";
import { VariableMenu } from "./VariableMenu";
import { EmojiMenu } from "./EmojiMenu";

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
  /** Controls toolbar visibility (defaults to true) */
  showToolbar?: boolean;
}

const EMPTY_CHANNELS: { id: string; name: string; type: number; parent_id?: string | null }[] = [];
const EMPTY_ROLES: { id: string; name: string; color: number }[] = [];

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
  showToolbar = true,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [showRichPicker, setShowRichPicker] = useState(false);
  const pickerContainerRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<"top" | "bottom">("top");

  // Autocomplete state
  const {
    acType, setAcType, acQuery, setAcQuery, acExploitTarget, setAcExploitTarget,
    acCursorStart, setAcCursorStart, acCursorEnd, setAcCursorEnd,
    selectedIndex, setSelectedIndex,
  } = useAutocompleteMenu();

  useEffect(() => {
    if ((acType || showRichPicker) && textareaRef.current) {
      const rect = textareaRef.current.getBoundingClientRect();
      setDropdownPosition(rect.top < 430 ? "bottom" : "top");
    }
  }, [acType, showRichPicker]);

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
  const currentUser = useGlobalStore((state) => state.currentUser);

  // Unrestricted if Head Admin or using a Custom Bot profile
  const isUnrestrictedMentions = Boolean(currentUser?.isAdmin);
  const staffPerms = currentUser?.staffPermissions;

  const canPingEveryone = isUnrestrictedMentions || Boolean(staffPerms?.can_mention_everyone);
  const canPingHere = isUnrestrictedMentions || Boolean(staffPerms?.can_mention_here);

  const mentionableRoles = useMemo(() => {
    if (isUnrestrictedMentions) return guildRoles;
    if (!staffPerms) return EMPTY_ROLES;
    if (staffPerms.can_mention_roles) return guildRoles;
    const allowedIds = staffPerms.allowed_role_mention_ids ?? [];
    if (allowedIds.includes("*")) return guildRoles;
    return guildRoles.filter((r) => allowedIds.includes(r.id));
  }, [guildRoles, isUnrestrictedMentions, staffPerms]);

  const emojisMap = useDiscordCacheStore((state) => state.emojis);
  const fetchEmojis = useDiscordCacheStore((state) => state.fetchEmojis);
  const serverEmojis = (effectiveGuildId && emojisMap[effectiveGuildId]) || [];

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
      fetchEmojis(effectiveGuildId);
    }
  }, [effectiveGuildId, fetchChannels, fetchRoles, fetchEmojis]);

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

      // 1A. Check `{` for Dynamic Variables (`{user.*`, `{now.*`, etc.) & WEAO (`{exploit.<Name>.<Field>`)
      const openBraceIdx = textBeforeCursor.lastIndexOf("{");
      if (openBraceIdx !== -1) {
        const tokenSinceBrace = textBeforeCursor.slice(openBraceIdx);
        // Only active if there is no `}` or newline between `{` and cursor
        if (!/[}\n\r]/.test(tokenSinceBrace)) {
          const lowerToken = tokenSinceBrace.toLowerCase();

          // Once `{exploit.` is present -> Stage 1 (Exploit Name) or Stage 2 (Exploit Field)
          if (lowerToken.startsWith("{exploit.")) {
            const afterPrefix = tokenSinceBrace.slice("{exploit.".length);

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

            const lastDotIdx = afterPrefix.lastIndexOf(".");
            if (lastDotIdx > 0) {
              const candidateName = afterPrefix.slice(0, lastDotIdx);
              const fieldPart = afterPrefix.slice(lastDotIdx + 1);
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

            setAcType("exploit_name");
            setAcExploitTarget("");
            setAcQuery(afterPrefix);
            setAcCursorStart(openBraceIdx);
            setAcCursorEnd(cursorPos);
            setSelectedIndex(0);
            return;
          }

          // Any other `{...` token (including `{`, `{u`, `{user.`, `{ex`, `{now`)
          const varQuery = tokenSinceBrace.slice(1);
          if (!/\s/.test(varQuery)) {
            setAcType("variable");
            setAcExploitTarget("");
            setAcQuery(varQuery);
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

    if (acType === "variable") {
      const items: AutocompleteItem[] = [];
      const idSuggestions = getUserIdPlaceholderSuggestions(q);

      if (idSuggestions !== null) {
        return idSuggestions.slice(0, 20).map((suggestion) => ({
          id: `var_${suggestion.tag}`,
          title: suggestion.displayTag,
          subtitle: `${suggestion.label} • ID …${suggestion.userId.slice(-4)}`,
          icon: <Code size={13} className="text-[#5865f2] shrink-0" />,
          replacement: suggestion.tag,
          keepOpen: false,
        }));
      }

      if (!q || "exploit.".includes(q) || "weao".includes(q)) {
        items.push({
          id: "var_weao_chain",
          title: "{exploit.<Name>.<Field>}",
          subtitle: "Live WEAO Exploit Status, sUNC, Version…",
          icon: <Cpu size={13} className="text-[#57f287] shrink-0" />,
          replacement: "{exploit.",
          keepOpen: true,
        });
      }

      VARIABLES.forEach((v) => {
        if (!v.tag) return;
        const cleanTag = v.tag.slice(1, -1).toLowerCase();
        if (
          !q ||
          cleanTag.includes(q) ||
          v.tag.toLowerCase().includes(q) ||
          (v.desc && v.desc.toLowerCase().includes(q))
        ) {
          items.push({
            id: `var_${v.tag}`,
            title: v.tag,
            subtitle: `${v.label}  ${v.desc}`,
            icon: <Code size={13} className="text-[#5865f2] shrink-0" />,
            replacement: v.tag,
            keepOpen: false,
          });
        }
      });

      return items.slice(0, 20);
    }

    // WEAO Exploit Name Picker (`{exploit.<Name>.`)
    if (acType === "exploit_name") {
      if (weaoExploits.length === 0) {
        return [
          {
            id: "weao_loading_or_err",
            title: weaoError
              ? "⚠️ WEAO API unreachable  type exploit name manually"
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
        subtitle: `${opt.getPreview(matchedExploit)}  ${opt.label}`,
        icon: <Sliders size={12} className="text-[#5865f2] shrink-0" />,
        replacement: `{exploit.${canonicalTitle}.${opt.key}}`,
        keepOpen: false,
      }));
    }

    if (acType === "user") {
      const items: AutocompleteItem[] = [];

      if (canPingEveryone && (!q || "@everyone".includes(q))) {
        items.push({
          id: "everyone",
          title: "@everyone",
          subtitle: "Notify all members",
          icon: <span className="w-2.5 h-2.5 rounded-full bg-[#f28b8b]" />,
          replacement: "@everyone",
        });
      }
      if (canPingHere && (!q || "@here".includes(q))) {
        items.push({
          id: "here",
          title: "@here",
          subtitle: "Notify online members",
          icon: <span className="w-2.5 h-2.5 rounded-full bg-[#f28b8b]" />,
          replacement: "@here",
        });
      }

      mentionableRoles
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
    mentionableRoles,
    canPingEveryone,
    canPingHere,
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

  const formatSelection = useCallback(
    (
      prefix: string,
      suffix: string = prefix,
      defaultText: string = "",
      isLinePrefix: boolean = false,
    ) => {
      const textarea = textareaRef.current;
      if (!textarea || disabled) return;

      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;
      const currentValue = textarea.value ?? "";
      const selectedText = currentValue.slice(start, end);

      let replacement = "";
      let newStart = start;
      let newEnd = end;

      if (isLinePrefix) {
        if (selectedText.length > 0) {
          const lines = selectedText.split("\n");
          const allQuoted = lines.every((l) => l.startsWith(prefix));
          if (allQuoted) {
            // Toggle un-quote
            replacement = lines.map((l) => l.slice(prefix.length)).join("\n");
            newStart = start;
            newEnd = start + replacement.length;
          } else {
            // Quote all lines
            replacement = lines.map((l) => `${prefix}${l}`).join("\n");
            newStart = start;
            newEnd = start + replacement.length;
          }
        } else {
          replacement = `${prefix}${defaultText}`;
          newStart = start + prefix.length;
          newEnd = newStart + defaultText.length;
        }
      } else {
        if (selectedText.length > 0) {
          // Toggle unwrap if already wrapped
          const isWrapped =
            selectedText.startsWith(prefix) &&
            selectedText.endsWith(suffix) &&
            selectedText.length >= prefix.length + suffix.length;

          if (isWrapped) {
            replacement = selectedText.slice(prefix.length, selectedText.length - suffix.length);
            newStart = start;
            newEnd = start + replacement.length;
          } else {
            replacement = `${prefix}${selectedText}${suffix}`;
            newStart = start + prefix.length;
            newEnd = newStart + selectedText.length;
          }
        } else {
          replacement = `${prefix}${defaultText}${suffix}`;
          if (defaultText.length > 0) {
            newStart = start + prefix.length;
            newEnd = newStart + defaultText.length;
          } else {
            newStart = start + prefix.length;
            newEnd = newStart;
          }
        }
      }

      // Focus textarea and replace range with native undo stack preservation
      textarea.focus();
      textarea.setSelectionRange(start, end);

      let insertSuccess = false;
      try {
        insertSuccess = document.execCommand("insertText", false, replacement);
      } catch {
        insertSuccess = false;
      }

      if (!insertSuccess) {
        // Fallback for virtual DOM / non-execCommand environments
        const before = currentValue.slice(0, start);
        const after = currentValue.slice(end);
        const nextValue = before + replacement + after;
        onChange(nextValue);
      }

      // Restore caret / text selection
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newStart, newEnd);
        }
      });
    },
    [disabled, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        formatSelection("**", "**", "bold text");
        return;
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        formatSelection("*", "*", "italic text");
        return;
      }
      if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        formatSelection("__", "__", "underlined text");
        return;
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        formatSelection("`", "`", "code");
        return;
      }
    }

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
    if (acType === "variable") {
      return (
        <span className="flex items-center gap-1.5">
          <Code size={11} className="text-[#5865f2]" />
          <span>Variables</span>
        </span>
      );
    }
    if (acType === "exploit_name") {
      return (
        <span className="flex items-center gap-1.5">
          <Cpu size={11} className="text-[#5865f2]" />
          <span>WEAO</span>
          {weaoMeta?.rateLimited && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-[#f0b232]/20 text-[#f0b232]">
              Cached (429 Cooldown)
            </span>
          )}
        </span>
      );
    }
    if (acType === "exploit_field") {
      return (
        <span className="flex items-center gap-1.5">
          <Sliders size={11} className="text-[#57f287]" />
          <span>{acExploitTarget} Properties</span>
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

      {/* Integrated Editor Box with Attached Toolbar Ribbon */}
      <div className="relative w-full rounded-lg border border-[#232428] hover:border-[#35373c] focus-within:border-[#5865f2] bg-[#1e1f22] transition-colors">
        {showToolbar && (
          <MarkdownToolbar onFormat={(prefix, suffix, defaultText, isLinePrefix) =>
            formatSelection(prefix, suffix, defaultText, isLinePrefix)
          } />
        )}

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
          className="w-full block bg-transparent text-[#dbdee1] placeholder-[#949ba4] text-sm p-3 pb-8 pr-12 focus:outline-none resize-y leading-relaxed font-sans border-0"
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
              position={dropdownPosition}
            />
          )}
        </div>

        {/* Inline Autocomplete Dropdown Popup */}
        {acType && acItems.length > 0 && (
          acType === "variable" ? (
            <VariableMenu
              items={acItems}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
              onApply={applyReplacement}
              dropdownPosition={dropdownPosition}
            />
          ) : acType === "emoji" ? (
            <EmojiMenu
              items={acItems}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
              onApply={applyReplacement}
              dropdownPosition={dropdownPosition}
            />
          ) : (
            <AutocompletePopover
              headerLabel={getHeaderLabel()}
              items={acItems}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
              onApply={applyReplacement}
              dropdownPosition={dropdownPosition}
            />
          )
        )}
      </div>
    </div>
  );
};

export const DiscordMentionInput = React.memo(DiscordMentionInputComponent);
export default DiscordMentionInput;