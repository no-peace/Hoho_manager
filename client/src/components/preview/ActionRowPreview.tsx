import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ExternalLink, Check, SlidersHorizontal } from "lucide-react";
import type { ComponentNode, SelectOption } from "@dmb/shared";
import { ButtonStyle, ComponentType } from "@dmb/shared";
import { useUserPlaceholderPreview } from "./UserPlaceholderPreviewContent";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
import { useGlobalStore } from "../../store/globalStore";
import { useMessageStore } from "../../store/messageStore";

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
            "user.username": username,
            "user.id": userId,
            "server.name": guild?.name || "HoHo Server",
            "server.id": guild?.id || selectedGuildId || "987654321",
          };
          return map[key] ?? match;
        })
      : rawLabel,
  );

  return (
    <div
      data-preview-component-id={button._id}
      className="inline-flex rounded-lg hover:ring-2 hover:ring-[#818CF8]/70"
    >
      <button
        type="button"
        disabled={button.disabled}
        className={[
          "inline-flex h-8 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97]",
          BUTTON_CLASSES[button.style ?? ButtonStyle.Primary] ?? BUTTON_CLASSES[ButtonStyle.Primary],
          button.disabled ? "cursor-not-allowed opacity-50 pointer-events-none" : "",
        ].join(" ")}
      >
        {emojiNode}
        {isLink && <ExternalLink size={14} className="shrink-0" />}
        <span className="truncate max-w-[200px]">{resolvedLabel}</span>
      </button>
    </div>
  );
};

export interface SelectPreviewProps {
  select: ComponentNode;
}

export const SelectPreview: React.FC<SelectPreviewProps> = ({ select }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  // Cache store for real server entities if available
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  // Select only this guild's arrays. Cache updates for other guilds should not
  // rerender every select menu in the current preview.
  const cachedChannels = useDiscordCacheStore((state) =>
    selectedGuildId ? state.channels[selectedGuildId] : undefined,
  );
  const cachedRoles = useDiscordCacheStore((state) =>
    selectedGuildId ? state.roles[selectedGuildId] : undefined,
  );

  const maxValues = select.max_values ?? 1;
  const isMulti = maxValues > 1;

  // Resolve options based on select component type
  const availableOptions: SelectOption[] = useMemo(() => {
    if (select.type === ComponentType.StringSelect) {
      return select.options ?? [];
    }

    if (select.type === ComponentType.ChannelSelect) {
      const guildChannels = cachedChannels ?? [];
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
      const guildRoles = cachedRoles ?? [];
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

  // Keep the portaled menu aligned to its trigger, including nested scroll containers.
  useEffect(() => {
    if (!isOpen) {
      setDropdownPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 8;
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - margin);
      const spaceAbove = Math.max(0, rect.top - margin);
      const openUpwards = spaceBelow < 240 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(96, Math.min(250, openUpwards ? spaceAbove : spaceBelow));
      const top = openUpwards
        ? Math.max(margin, rect.top - maxHeight - 6)
        : Math.max(margin, Math.min(window.innerHeight - maxHeight - margin, rect.bottom + 6));
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - rect.width - margin));
      const width = Math.min(rect.width, window.innerWidth - margin * 2);
      setDropdownPosition({ top, left, width, maxHeight });
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && portalRef.current?.contains(target)) return;
      updatePosition();
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  // Dismiss dropdown on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        !portalRef.current?.contains(e.target as Node)
      ) {
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
    <div className="flex w-full max-w-[440px] items-center gap-1">
      <div className="relative min-w-0 flex-1" ref={containerRef} data-preview-component-id={select._id} data-preview-interactive="true" data-preview-select="true">
      {/* Trigger Bar */}
      <button
        type="button"
        disabled={select.disabled}
        onClick={() => !select.disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded border bg-[#1e1f22] px-3 text-sm transition-colors text-left ${select.disabled ? "pointer-events-none" : ""} ${
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
            <span className="px-1.5 py-0.5 rounded bg-[#2b2d31] text-[0.625rem] text-[#949ba4] font-mono">
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

      </div>
      <button
        type="button"
        aria-label="Configure select menu"
        title="Configure select menu"
        data-preview-component-id={select._id}
        onClick={() => { if (select._id) useMessageStore.getState().select({ kind: "component", id: select._id }); }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#A1A8B8] transition-colors hover:bg-[#3f4147] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8]"
      >
        <SlidersHorizontal size={14} />
      </button>
      {/* Dropdown Options Popup */}
      {isOpen && dropdownPosition && createPortal(
        <div
          ref={portalRef}
          role="listbox"
          aria-multiselectable={isMulti}
          className="flex flex-col overflow-hidden rounded-md border border-[#1e1f22] bg-[#2b2d31] py-1.5 shadow-2xl"
          style={{
            position: "fixed",
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            maxHeight: dropdownPosition.maxHeight,
            zIndex: 99999,
          }}
        >
          {isMulti && (
            <div className="px-3 py-1.5 mb-1 border-b border-[#1e1f22] flex items-center justify-between text-[0.6875rem] text-[#949ba4] font-medium select-none">
              <span>Select up to {maxValues} options</span>
              <span className="font-mono tabular-nums">{selectedValues.length}/{maxValues} selected</span>
            </div>
          )}

          <div className="min-h-0 max-h-52 overflow-y-auto space-y-0.5 px-1 custom-scrollbar">
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
                          <div className="truncate text-[0.6875rem] text-[#949ba4]">
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
      , document.body)}
    </div>
  );
};

export interface ActionRowPreviewProps {
  component: ComponentNode;
}

export const ActionRowPreview = React.memo(({ component }: ActionRowPreviewProps) => (
  <div data-preview-component-id={component._id} className="flex flex-wrap items-center gap-2">
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
