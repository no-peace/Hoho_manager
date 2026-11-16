import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
import api from "../../api/client";

export type SelectType = "guild" | "channel" | "role" | "member";

export interface SelectOption {
  id: string;
  name: string;
  avatar?: string | null;
  username?: string;
  global_name?: string | null;
}

interface Props {
  type: SelectType;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  onSelectOption?: (option: SelectOption) => void;
  guildId?: string;
  multiple?: boolean;
  placeholder?: string;
  className?: string;
}

export const SearchableDiscordSelect: React.FC<Props> = ({
  type,
  value,
  onChange,
  onSelectOption,
  guildId,
  multiple = false,
  placeholder = "Select...",
  className = "",
}) => {
  const { guilds, channels, roles, fetchGuilds, fetchChannels, fetchRoles } = useDiscordCacheStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [memberResults, setMemberResults] = useState<SelectOption[]>([]);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const updateRect = () => {
    if (containerRef.current) {
      setDropdownRect(containerRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => {
    if (!open) return;
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open]);

  useEffect(() => {
    if (open && containerRef.current) {
      setDropdownRect(containerRef.current.getBoundingClientRect());
    }
  }, [open]);

  const portalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target) && portalRef.current && !portalRef.current.contains(target)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (type === "guild") fetchGuilds();
    else if (guildId) {
      if (type === "channel") fetchChannels(guildId);
      if (type === "role") fetchRoles(guildId);
    }
  }, [open, type, guildId, fetchGuilds, fetchChannels, fetchRoles]);

  useEffect(() => {
    if (type !== "member" || !open || !guildId || search.trim().length < 2) {
      setMemberResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const res = await api.discord.searchMembers(guildId, search.trim());
        if (cancelled) return;
        setMemberResults(
          (res.members || []).map((m: any) => ({
            id: String(m.id || m.user?.id || ""),
            name: m.nickname
              ? `${m.nickname} (${m.username})`
              : m.global_name
              ? `${m.global_name} (${m.username})`
              : (m.username || m.id || ""),
            avatar: m.avatar || m.user?.avatar || null,
            username: m.username || m.user?.username || "",
            global_name: m.global_name || m.user?.global_name || null,
          })),
        );
      } catch {
        if (!cancelled) setMemberResults([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, type, open, guildId]);

  let options: SelectOption[] = [];
  if (type === "guild" && guilds) {
    options = guilds.map((g) => ({ id: g.id, name: g.name }));
  } else if (type === "channel" && guildId && channels[guildId]) {
    options = channels[guildId].map((c) => ({ id: c.id, name: c.name }));
  } else if (type === "role" && guildId && roles[guildId]) {
    options = roles[guildId].map((r) => ({ id: r.id, name: r.name }));
  } else if (type === "member") {
    options = memberResults;
  }

  const filteredOptions = options.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.id.includes(search)
  );

  const isSnowflake = /^\d{17,20}$/.test(search.trim());

  const toggleSelection = (id: string, opt?: SelectOption) => {
    if (multiple) {
      const valArr = Array.isArray(value) ? value : (value ? [value] : []);
      if (valArr.includes(id)) {
        onChange(valArr.filter((v) => v !== id));
      } else {
        onChange([...valArr, id]);
        if (opt && onSelectOption) onSelectOption(opt);
      }
    } else {
      onChange(id);
      if (opt && onSelectOption) onSelectOption(opt);
      setOpen(false);
    }
  };

  const handleManualId = () => {
    const trimmed = search.trim();
    if (/^\d{17,20}$/.test(trimmed)) {
      toggleSelection(trimmed, { id: trimmed, name: trimmed });
      setSearch("");
    }
  };

  const valArr = Array.isArray(value) ? value : (value ? [value] : []);
  const displayValue = valArr.length === 0
    ? placeholder
    : (multiple ? `${valArr.length} selected` : (options.find((o) => o.id === valArr[0])?.name || valArr[0]));

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Multi-select chips with remove buttons */}
      {multiple && valArr.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5 min-w-0">
          {valArr.map((id) => {
            const matched = options.find((o) => o.id === id);
            const label = matched ? matched.name : id;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 bg-[#161A23] border border-[#1D2230] text-[#F1F3F9] px-2 py-0.5 rounded text-xs max-w-full min-w-0"
              >
                <span className="truncate min-w-0 max-w-[180px]" title={label}>{label}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelection(id);
                  }}
                  className="text-[#A1A8B8] hover:text-[#F87171] ml-1 font-bold text-xs focus-visible:outline-none shrink-0"
                  aria-label={`Remove ${label}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Main Trigger Button */}
      <div
        className="w-full min-w-0 bg-[#1D2230] border border-[#272D3A] rounded px-3 py-1.5 text-xs text-[#F1F3F9] cursor-pointer flex justify-between items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8]"
        onClick={() => setOpen(!open)}
        tabIndex={0}
        role="combobox"
        aria-label={placeholder || `Select ${type}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <span className="truncate min-w-0 flex-1 text-[#F1F3F9]">{displayValue}</span>
        <span className="text-[10px] text-[#A1A8B8] shrink-0 ml-2">▼</span>
      </div>

      {open && dropdownRect && createPortal(
        (() => {
          const DROPDOWN_HEIGHT = 260;
          const isMobile = window.innerWidth < 640;
          const spaceBelow = Math.max(0, window.innerHeight - Math.max(dropdownRect.bottom, 8) - 12);
          const spaceAbove = Math.min(Math.max(0, dropdownRect.top - 8), Math.max(0, window.innerHeight - 16));
          const placeAbove = spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow;
          const dropdownWidth = isMobile ? Math.max(0, window.innerWidth - 24) : Math.min(Math.max(dropdownRect.width, 220), window.innerWidth - 16);
          const maxLeft = Math.max(8, window.innerWidth - dropdownWidth - 8);
          const dropdownLeft = isMobile ? 12 : Math.max(8, Math.min(dropdownRect.left, maxLeft));
          const calculatedMaxHeight = isMobile
            ? Math.min(520, Math.max(120, window.innerHeight - 32))
            : Math.min(DROPDOWN_HEIGHT, placeAbove ? spaceAbove : spaceBelow);
          const maxTop = Math.max(8, window.innerHeight - 8 - calculatedMaxHeight);
          const calculatedTop = isMobile
            ? Math.max(16, window.innerHeight - calculatedMaxHeight - 16)
            : placeAbove
              ? Math.max(8, Math.min(maxTop, dropdownRect.top - calculatedMaxHeight))
              : Math.max(8, Math.min(maxTop, dropdownRect.bottom + 4));

          return (
            <>
              {isMobile && (
                <div className="fixed inset-0 z-[9998] bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
              )}
              <div
                ref={portalRef}
                style={{
                  position: "fixed",
                  top: calculatedTop,
                  left: dropdownLeft,
                  width: dropdownWidth,
                  maxHeight: calculatedMaxHeight,
                  zIndex: 10000,
                }}
                className={`bg-[#161A23] border border-[#272D3A] ${isMobile ? "rounded-[12px]" : "rounded-lg"} shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
              >
              <div className="p-2 shrink-0 bg-[#10131A] border-b border-[#272D3A]">
                <input
                  type="text"
                  aria-label={type === "member" ? "Search username or enter 17-20 digit ID" : `Search ${type} options`}
                  className="w-full bg-[#1D2230] text-[#F1F3F9] text-xs px-2 py-1.5 rounded outline-none border border-[#272D3A] focus:border-[#818CF8]"
                  placeholder={type === "member" ? "Search username or enter 17-20 digit ID..." : "Search..."}
                  value={search}
                  autoFocus
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleManualId(); }
                    if (e.key === "Escape") setOpen(false);
                  }}
                />
              </div>

              {!guildId && type === "member" && (
                <div className="p-2 text-[11px] text-[#A1A8B8] italic border-b border-[#252B3A] bg-[#1D2230]/50">
                  Select a server in the header to search by name, or enter a 17-20 digit user ID.
                </div>
              )}

              <div className="overflow-y-auto flex-1 p-1">
                {isSnowflake && (
                  <div
                    className="px-2 py-1.5 text-xs text-[#818CF8] hover:bg-[#252B3A] cursor-pointer rounded font-medium flex items-center justify-between border-b border-[#252B3A]/50 mb-1"
                    onClick={handleManualId}
                  >
                    <span>Use ID: {search.trim()}</span>
                    <span className="text-[10px] text-[#A1A8B8] bg-[#1D2230] px-1 rounded">Press Enter</span>
                  </div>
                )}

                {filteredOptions.length === 0 && !isSnowflake ? (
                  <div className="px-2 py-3 text-xs text-[#A1A8B8] text-center italic">
                    {type === "member" && search.length < 2 && guildId
                      ? "Type at least 2 characters to search..."
                      : "No options found"}
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = valArr.includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        className={`px-2 py-1.5 text-xs rounded cursor-pointer flex items-center justify-between gap-2 min-w-0 ${
                          isSelected ? "bg-[#818CF8]/15 text-[#F1F3F9] border border-[#818CF8]/25" : "text-[#F1F3F9] hover:bg-[#252B3A]"
                        }`}
                        onClick={() => toggleSelection(opt.id, opt)}
                        title={opt.name}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {type === "member" && (
                            opt.avatar ? (
                              <img
                                src={`https://cdn.discordapp.com/avatars/${opt.id}/${opt.avatar}.webp?size=24`}
                                alt=""
                                className="w-5 h-5 rounded-full object-cover shrink-0 bg-[#1D2230]"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-[#818CF8] flex items-center justify-center text-[10px] text-[#0B0D12] font-semibold shrink-0">
                                {opt.name.charAt(0).toUpperCase()}
                              </div>
                            )
                          )}
                          <span className="truncate min-w-0 flex-1">{opt.name}</span>
                        </div>
                        {isSelected && <span className="text-xs font-bold shrink-0 ml-1">✓</span>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            </>
          );
        })(),
        document.body
      )}
    </div>
  );
};
