import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
import api from "../../api/client";

export type SelectType = "guild" | "channel" | "role" | "member";

interface Props {
  type: SelectType;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  guildId?: string;
  multiple?: boolean;
  placeholder?: string;
  className?: string;
}

export const SearchableDiscordSelect: React.FC<Props> = ({
  type,
  value,
  onChange,
  guildId,
  multiple = false,
  placeholder = "Select...",
  className = "",
}) => {
  const { guilds, channels, roles, fetchGuilds, fetchChannels, fetchRoles } = useDiscordCacheStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [memberResults, setMemberResults] = useState<{ id: string; name: string }[]>([]);
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
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target) && portalRef.current && !portalRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (type === "guild") fetchGuilds();
    else if (guildId) {
      if (type === "channel") fetchChannels(guildId);
      if (type === "role") fetchRoles(guildId);
    }
  }, [open, type, guildId, fetchGuilds, fetchChannels, fetchRoles]);

  useEffect(() => {
    if (type === "member" && open && guildId && search.length >= 2) {
      const timeout = setTimeout(async () => {
        try {
          const res = await api.discord.searchMembers(guildId, search);
          setMemberResults(
            (res.members || []).map((m: any) => ({
              id: String(m.id || m.user?.id || ""),
              name: m.nickname
                ? `${m.nickname} (${m.username})`
                : m.global_name
                ? `${m.global_name} (${m.username})`
                : (m.username || m.id || ""),
            }))
          );
        } catch {
          // ignore
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [search, type, open, guildId]);

  let options: { id: string; name: string }[] = [];
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

  const toggleSelection = (id: string) => {
    if (multiple) {
      const valArr = Array.isArray(value) ? value : (value ? [value] : []);
      if (valArr.includes(id)) {
        onChange(valArr.filter((v) => v !== id));
      } else {
        onChange([...valArr, id]);
      }
    } else {
      onChange(id);
      setOpen(false);
    }
  };

  const handleManualId = () => {
    const trimmed = search.trim();
    if (/^\d{17,20}$/.test(trimmed)) {
      toggleSelection(trimmed);
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
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {valArr.map((id) => {
            const matched = options.find((o) => o.id === id);
            const label = matched ? matched.name : id;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 bg-[#2b2d31] border border-[#1e1f22] text-[#dbdee1] px-2 py-0.5 rounded text-xs"
              >
                <span className="truncate max-w-[200px]" title={label}>{label}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelection(id);
                  }}
                  className="text-[#949ba4] hover:text-[#da373c] ml-1 font-bold text-xs focus-visible:outline-none"
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
        className="w-full bg-[#1e1f22] border border-[#111214] rounded px-3 py-1.5 text-xs text-[#dbdee1] cursor-pointer flex justify-between items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2]"
        onClick={() => setOpen(!open)}
        tabIndex={0}
        role="combobox"
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <span className="truncate text-[#dbdee1]">{displayValue}</span>
        <span className="text-[10px] text-[#949ba4] ml-2">▼</span>
      </div>

      {open && dropdownRect && createPortal(
        <div
          ref ={portalRef}
          style={{
            position: "fixed",
            top: dropdownRect.bottom + 4,
            left: dropdownRect.left,
            width: Math.max(dropdownRect.width, 220),
            zIndex: 99999,
          }}
          className="bg-[#2b2d31] border border-[#1e1f22] rounded shadow-2xl max-h-64 flex flex-col"
        >
          <div className="p-2 shrink-0 border-b border-[#1e1f22]">
            <input
              type="text"
              className="w-full bg-[#1e1f22] text-[#dbdee1] text-xs px-2 py-1.5 rounded outline-none border border-[#111214] focus:border-[#5865f2]"
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
            <div className="p-2 text-[11px] text-[#949ba4] italic border-b border-[#35373c] bg-[#1e1f22]/50">
              Select a server in the header to search by name, or enter a 17-20 digit user ID.
            </div>
          )}

          <div className="overflow-y-auto flex-1 p-1">
            {isSnowflake && (
              <div
                className="px-2 py-1.5 text-xs text-[#5865f2] hover:bg-[#35373c] cursor-pointer rounded font-medium flex items-center justify-between border-b border-[#35373c]/50 mb-1"
                onClick={handleManualId}
              >
                <span>Use ID: {search.trim()}</span>
                <span className="text-[10px] text-[#949ba4] bg-[#1e1f22] px-1 rounded">Press Enter</span>
              </div>
            )}

            {filteredOptions.length === 0 && !isSnowflake ? (
              <div className="px-2 py-3 text-xs text-[#949ba4] text-center italic">
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
                    className={`px-2 py-1.5 text-xs rounded cursor-pointer flex items-center justify-between ${
                      isSelected ? "bg-[#5865f2] text-white" : "text-[#dbdee1] hover:bg-[#35373c]"
                    }`}
                    onClick={() => toggleSelection(opt.id)}
                  >
                    <span className="truncate">{opt.name}</span>
                    {multiple && isSelected && <span className="text-xs font-bold ml-1">✓</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
