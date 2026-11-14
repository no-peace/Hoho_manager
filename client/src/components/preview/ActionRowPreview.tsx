import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, ExternalLink, Check } from "lucide-react";
import type { ComponentNode, SelectOption } from "@dmb/shared";
import { ButtonStyle, ComponentType } from "@dmb/shared";
import { useUserPlaceholderPreview } from "./UserPlaceholderPreviewContent";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
import { useGlobalStore } from "../../store/globalStore";

/**
 * Preview of an action row's controls.
 *
 * Buttons render with Discord's real colours so the preview communicates what a
 * click will *feel* like – a red "Danger" button reads very differently from a
 * blurple primary one, and that matters during design.
 */

const BUTTON_CLASSES: Record<number, string> = {
  [ButtonStyle.Primary]: "bg-[#5865f2] hover:bg-[#4752c4] text-white",
  [ButtonStyle.Secondary]: "bg-[#4e5058] hover:bg-[#6d6f78] text-white",
  [ButtonStyle.Success]: "bg-[#248046] hover:bg-[#1a6334] text-white",
  [ButtonStyle.Danger]: "bg-[#da373c] hover:bg-[#a12828] text-white",
  [ButtonStyle.Link]: "bg-[#4e5058] hover:bg-[#6d6f78] text-white",
  [ButtonStyle.Premium]: "bg-[#4e5058] text-white",
};

const SELECT_TYPES: readonly number[] = [
  ComponentType.StringSelect,
  ComponentType.UserSelect,
  ComponentType.RoleSelect,
  ComponentType.ChannelSelect,
  ComponentType.MentionableSelect,
];

export const renderButtonEmoji = (emoji: any) => {
  if (!emoji) return null;
  if (typeof emoji === "string") {
    const match = emoji.match(/^<(a?):(\w+):(\d+)>$/);
    if (match) {
      const [, animated, name, id] = match;
      return (
        <img
          src={`https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=24&quality=lossless`}
          alt={name}
          className="h-4 w-4 object-contain inline-block shrink-0"
        />
      );
    }
    return <span className="inline-block shrink-0">{emoji}</span>;
  }
  if (typeof emoji === "object") {
    if (emoji.id) {
      return (
        <img
          src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "webp"}?size=24&quality=lossless`}
          alt={emoji.name || ""}
          className="h-4 w-4 object-contain inline-block shrink-0"
        />
      );
    }
    if (emoji.name) {
      const match = String(emoji.name).match(/^<(a?):(\w+):(\d+)>$/);
      if (match) {
        const [, animated, name, id] = match;
        return (
          <img
            src={`https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=24&quality=lossless`}
            alt={name}
            className="h-4 w-4 object-contain inline-block shrink-0"
          />
        );
      }
      return <span className="inline-block shrink-0">{emoji.name}</span>;
    }
  }
  return null;
};

export const ButtonPreview = ({ button }: { button: ComponentNode }) => {
  const isLink = button.style === ButtonStyle.Link;
  const emojiNode = renderButtonEmoji((button as any).emoji);
  const currentUser = useGlobalStore((state) => state.currentUser);
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const guilds = useDiscordCacheStore((state) => state.guilds);
  const { resolveUserPlaceholders } = useUserPlaceholderPreview();
  const rawLabel = button.label ?? (isLink ? "Link" : "Button");
  const resolvedLabel = resolveUserPlaceholders(
    rawLabel.includes("{")
      ? rawLabel.replace(/\{{1,2}\s*([a-zA-Z0-9_.$]+)\s*\}{1,2}/g, (match, rawKey: string) => {
          const key = rawKey.trim().toLowerCase();
          const username = currentUser?.username || "User";
                const userId = currentUser?.id || "123456789012345678";
          const guild = guilds?.find((g) => g.id === selectedGuildId) ?? guilds?.[0];
          const map: Record<string, string> = {
            "user.tag": username,
            "user.id": userId,
            "user.clantag": "HOHO",
            "server.name": guild?.name || "HoHo Server",
            "server.id": guild?.id || selectedGuildId || "987654321",
          };
          return map[key] ?? match;
        })
      : rawLabel,
  );

  return (
    <button
      type="button"
      disabled={button.disabled}
      className={[
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97]",
        BUTTON_CLASSES[button.style ?? ButtonStyle.Primary] ?? BUTTON_CLASSES[ButtonStyle.Primary],
        button.disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {emojiNode}
      {isLink && <ExternalLink size={14} className="shrink-0" />}
      <span className="truncate max-w-[200px]">{resolvedLabel}</span>
    </button>
  );
};

export interface SelectPreviewProps {
  select: ComponentNode;
}

export const SelectPreview: React.FC<SelectPreviewProps> = ({ select }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [openUpwards, setOpenUpwards] = useState(false);

  // Cache store for real server entities if available
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const cachedChannels = useDiscordCacheStore((state) => state.channels);
  const cachedRoles = useDiscordCacheStore((state) => state.roles);

  const maxValues = select.max_values ?? 1;
  const isMulti = maxValues > 1;

  // Resolve options based on select component type
  const availableOptions: SelectOption[] = useMemo(() => {
    if (select.type === ComponentType.StringSelect) {
      return select.options ?? [];
    }

    if (select.type === ComponentType.ChannelSelect) {
      const guildChannels = (selectedGuildId && cachedChannels[selectedGuildId]) || [];
      if (guildChannels.length > 0) {
        return guildChannels.slice(0, 10).map((c) => ({
          label: c.name,
          value: c.id,
          description: c.type === 2 ? "Voice Channel" : c.type === 5 ? "Announcement" : "Text Channel",
          emoji: { name: c.type === 2 ? "🔊" : c.type === 5 ? "📢" : "#" },
        }));
      }
      return [
        { label: "general", value: "chan_general", description: "Text Channel", emoji: { name: "#" } },
        { label: "announcements", value: "chan_announcements", description: "Announcement Channel", emoji: { name: "📢" } },
        { label: "Community Lounge", value: "chan_lounge", description: "Voice Channel", emoji: { name: "🔊" } },
      ];
    }

    if (select.type === ComponentType.RoleSelect) {
      const guildRoles = (selectedGuildId && cachedRoles[selectedGuildId]) || [];
      if (guildRoles.length > 0) {
        return guildRoles.slice(0, 10).map((r) => ({
          label: r.name,
          value: r.id,
          description: "Server Role",
          emoji: { name: "🛡️" },
        }));
      }
      return [
        { label: "Admin", value: "role_admin", description: "Server Administrator", emoji: { name: "🛡️" } },
        { label: "Moderator", value: "role_mod", description: "Community Moderator", emoji: { name: "⚔️" } },
        { label: "Member", value: "role_member", description: "Verified Member", emoji: { name: "👤" } },
      ];
    }

    if (select.type === ComponentType.UserSelect) {
      return [
        { label: "HoHo Bot", value: "user_bot", description: "Discord Bot (Verified)", emoji: { name: "🤖" } },
        { label: "Server Owner", value: "user_owner", description: "Server Founder", emoji: { name: "👑" } },
        { label: "Community Member", value: "user_member", description: "Active Contributor", emoji: { name: "👤" } },
      ];
    }

    if (select.type === ComponentType.MentionableSelect) {
      return [
        { label: "Admin", value: "role_admin", description: "Role", emoji: { name: "🛡️" } },
        { label: "HoHo Bot", value: "user_bot", description: "User", emoji: { name: "🤖" } },
        { label: "Community Member", value: "user_member", description: "User", emoji: { name: "👤" } },
      ];
    }

    return select.options ?? [];
  }, [select.type, select.options, selectedGuildId, cachedChannels, cachedRoles]);

  // Initial selection derived from default: true
  const [selectedValues, setSelectedValues] = useState<string[]>(() => {
    return availableOptions.filter((opt) => opt.default).map((opt) => opt.value);
  });

  // Re-sync default selections if options change
  useEffect(() => {
    const defaults = availableOptions.filter((opt) => opt.default).map((opt) => opt.value);
    if (defaults.length > 0) {
      setSelectedValues((prev) => (prev.length === 0 ? defaults : prev));
    }
  }, [availableOptions]);

  // Viewport boundary check when opening
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpwards(spaceBelow < 260 && rect.top > 260);
    }
  }, [isOpen]);

  // Dismiss dropdown on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleOptionClick = (value: string) => {
    if (isMulti) {
      setSelectedValues((prev) => {
        if (prev.includes(value)) {
          return prev.filter((v) => v !== value);
        }
        if (prev.length < maxValues) {
          return [...prev, value];
        }
        return prev;
      });
    } else {
      setSelectedValues([value]);
      setIsOpen(false);
    }
  };

  // Derive trigger presentation text and emoji
  const selectedOptions = availableOptions.filter((o) => selectedValues.includes(o.value));
  const hasSelection = selectedOptions.length > 0;

  const defaultPlaceholder =
    select.type === ComponentType.UserSelect
      ? "Select users"
      : select.type === ComponentType.RoleSelect
        ? "Select roles"
        : select.type === ComponentType.ChannelSelect
          ? "Select channels"
          : select.type === ComponentType.MentionableSelect
            ? "Select users or roles"
            : "Make a selection";

  const placeholderText = select.placeholder || defaultPlaceholder;

  return (
    <div className="relative w-full max-w-[400px]" ref={containerRef}>
      {/* Trigger Bar */}
      <button
        type="button"
        disabled={select.disabled}
        onClick={() => !select.disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded border bg-[#1e1f22] px-3 text-sm transition-colors text-left ${
          select.disabled
            ? "border-[#3f4147] opacity-50 cursor-not-allowed text-[#949ba4]"
            : "border-[#3f4147] hover:border-[#4e5058] cursor-pointer"
        } ${isOpen ? "border-[#5865f2] ring-1 ring-[#5865f2]" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasSelection ? (
            <>
              {renderButtonEmoji(selectedOptions[0]?.emoji)}
              <span className="truncate min-w-0 flex-1 text-[#dbdee1] font-medium">
                {selectedOptions.map((o) => o.label).join(", ")}
              </span>
            </>
          ) : (
            <span className="truncate min-w-0 flex-1 text-[#949ba4]">{placeholderText}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isMulti && hasSelection && (
            <span className="px-1.5 py-0.5 rounded bg-[#2b2d31] text-[10px] text-[#949ba4] font-mono">
              {selectedValues.length}/{maxValues}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-[#949ba4] transition-transform duration-200 ${
              isOpen ? "rotate-180 text-white" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Options Popup */}
      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable={isMulti}
          className={`absolute left-0 w-full rounded-md bg-[#2b2d31] border border-[#1e1f22] shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
            openUpwards ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
          style={{ maxHeight: "250px" }}
        >
          {isMulti && (
            <div className="px-3 py-1.5 mb-1 border-b border-[#1e1f22] flex items-center justify-between text-[11px] text-[#949ba4] font-medium select-none">
              <span>Select up to {maxValues} options</span>
              <span className="font-mono tabular-nums">{selectedValues.length}/{maxValues} selected</span>
            </div>
          )}

          <div className="overflow-y-auto max-h-52 space-y-0.5 px-1 custom-scrollbar">
            {availableOptions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#949ba4] italic text-center">
                No options configured. Add options in the Component Editor.
              </div>
            ) : (
              availableOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleOptionClick(opt.value)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded text-sm cursor-pointer transition-colors select-none ${
                      isSelected
                        ? "bg-[#35373c] text-white"
                        : "text-[#dbdee1] hover:bg-[#35373c]/60 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {renderButtonEmoji(opt.emoji)}
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate font-medium text-xs sm:text-sm ${
                            isSelected ? "text-white font-semibold" : "text-[#dbdee1]"
                          }`}
                        >
                          {opt.label}
                        </div>
                        {opt.description && (
                          <div className="truncate text-[11px] text-[#949ba4]">
                            {opt.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Indicator: Checkbox (multi) or Checkmark (single) */}
                    {isMulti ? (
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 transition-colors ${
                          isSelected
                            ? "bg-[#5865f2] border-[#5865f2] text-white"
                            : "border-[#4e5058] bg-[#1e1f22]"
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    ) : (
                      isSelected && (
                        <Check size={16} className="text-[#5865f2] shrink-0 ml-2" strokeWidth={2.5} />
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export interface ActionRowPreviewProps {
  component: ComponentNode;
}

export const ActionRowPreview = React.memo(({ component }: ActionRowPreviewProps) => (
  <div className="flex flex-wrap items-center gap-2">
    {(component.components ?? []).map((child) =>
      SELECT_TYPES.includes(child.type) ? (
        <SelectPreview key={child._id} select={child} />
      ) : (
        <ButtonPreview key={child._id} button={child} />
      ),
    )}
  </div>
));

export default ActionRowPreview;
