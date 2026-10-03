import React, { useState, useEffect, useRef } from "react";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
import api from "../../api/client";

export type SelectType = "guild" | "channel" | "role" | "member";

interface Props {
  type: SelectType;
  value: string | string[]; // Can be array if multiple
  onChange: (value: string | string[]) => void;
  guildId?: string; // required for channel, role, member
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
            res.members.map((m) => ({
              id: m.user.id,
              name: m.nick || m.user.username,
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

  const toggleSelection = (id: string) => {
    if (multiple) {
      const valArr = Array.isArray(value) ? value : [];
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
    if (/^\d{17,20}$/.test(search)) {
      toggleSelection(search);
      setSearch("");
    }
  };

  const valArr = Array.isArray(value) ? value : (value ? [value] : []);
  const displayValue = valArr.length === 0 
    ? placeholder 
    : (multiple ? `${valArr.length} selected` : valArr[0]); // We could resolve names if we wanted

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        className="w-full bg-[#1e1f22] border border-[#111214] rounded px-3 py-1.5 text-xs text-[#dbdee1] cursor-pointer flex justify-between items-center"
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">{displayValue}</span>
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-[#2b2d31] border border-[#1e1f22] rounded shadow-lg max-h-60 flex flex-col">
          <div className="p-2 shrink-0">
            <input
              type="text"
              className="w-full bg-[#1e1f22] text-[#dbdee1] text-xs px-2 py-1.5 rounded outline-none border border-[#111214] focus:border-[#5865f2]"
              placeholder="Search or enter ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualId();
              }}
            />
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {filteredOptions.length === 0 && search.length > 0 && /^\d{17,20}$/.test(search) ? (
              <div
                className="px-2 py-1.5 text-xs text-[#dbdee1] hover:bg-[#35373c] cursor-pointer rounded"
                onClick={handleManualId}
              >
                Use ID: {search}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = valArr.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className={`px-2 py-1.5 text-xs rounded cursor-pointer ${
                      isSelected ? "bg-[#5865f2] text-white" : "text-[#dbdee1] hover:bg-[#35373c]"
                    }`}
                    onClick={() => toggleSelection(opt.id)}
                  >
                    {opt.name}
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
