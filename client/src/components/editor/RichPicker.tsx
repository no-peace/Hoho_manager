import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Hash,
  Shield,
  User,
  Clock,
  Plus,
  Search,
  X,
  Volume2,
  Megaphone,
} from "lucide-react";
import { VARIABLES } from "../ui/Field";
import { getServerNow ,useGlobalStore } from "../../store/globalStore";
import { DateTimePickerPopover } from "../ui/DateTimePickerPopover";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
import api from "../../api/client";
import { UNICODE_EMOJI_CATEGORIES as COMMON_UNICODE_EMOJIS } from "../../utils/unicodeEmojis";
import { calculateFloatingPosition } from "../../utils/floatingPosition";

export interface RichPickerProps {
  onInsert: (text: string) => void;
  onClose: () => void;
  guildId?: string | null;
  position?: "top" | "bottom";
  anchor?: HTMLElement | null;
  initialTab?: TabType;
}

type TabType = "mentions" | "time" | "emojis" | "variables";
type MentionFilter = "all" | "channels" | "roles" | "members";

interface CustomEmoji {
  id: string;
  name: string;
  animated?: boolean;
}

const EMPTY_CHANNELS: { id: string; name: string; type: number; parent_id?: string | null }[] = [];
const EMPTY_ROLES: { id: string; name: string; color: number }[] = [];
const CUSTOM_EMOJI_STORAGE_KEY = "hoho_custom_external_emojis";

const RichPickerComponent: React.FC<RichPickerProps> = ({
  onInsert,
  onClose,
  guildId: propGuildId,
  anchor,
  initialTab = "mentions",
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const effectiveGuildId = propGuildId || selectedGuildId;

  // Cache store with direct 1:1 state property selectors
  const channels = useDiscordCacheStore((state) => state.channels);
  const roles = useDiscordCacheStore((state) => state.roles);
  const guildChannels = (effectiveGuildId && channels[effectiveGuildId]) || EMPTY_CHANNELS;
  const guildRoles = (effectiveGuildId && roles[effectiveGuildId]) || EMPTY_ROLES;
  const currentUser = useGlobalStore((state) => state.currentUser);

  const isUnrestrictedMentions = Boolean(currentUser?.isAdmin);
  const staffPerms = currentUser?.staffPermissions;
  const canPingEveryone = isUnrestrictedMentions || Boolean(staffPerms?.can_mention_everyone);
  const canPingHere = isUnrestrictedMentions || Boolean(staffPerms?.can_mention_here);

  const mentionableRoles = useMemo(() => {
    if (isUnrestrictedMentions) return guildRoles;
    if (!staffPerms) return EMPTY_ROLES;
    const allowedIds = staffPerms.allowed_role_mention_ids ?? [];
    if (staffPerms.can_mention_roles && (allowedIds.length === 0 || allowedIds.includes("*"))) {
      return guildRoles;
    }
    if (allowedIds.includes("*")) return guildRoles;
    return guildRoles.filter((r) => allowedIds.includes(r.id));
  }, [guildRoles, isUnrestrictedMentions, staffPerms]);

  const fetchChannels = useDiscordCacheStore((state) => state.fetchChannels);
  const fetchRoles = useDiscordCacheStore((state) => state.fetchRoles);
  const fetchEmojis = useDiscordCacheStore((state) => state.fetchEmojis);
  const emojisMap = useDiscordCacheStore((state) => state.emojis);
  const serverEmojis: CustomEmoji[] = (effectiveGuildId && emojisMap[effectiveGuildId]) || [];

  const [customSavedEmojis, setCustomSavedEmojis] = useState<CustomEmoji[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_EMOJI_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [addCustomModalOpen, setAddCustomModalOpen] = useState(false);
  const [newEmojiName, setNewEmojiName] = useState("");
  const [newEmojiId, setNewEmojiId] = useState("");
  const [newEmojiAnimated, setNewEmojiAnimated] = useState(false);

  // Mentions tab state
  const [mentionFilter, setMentionFilter] = useState<MentionFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [memberResults, setMemberResults] = useState<
    Array<{
      id: string;
      username: string;
      global_name: string | null;
      nickname: string | null;
      avatar: string | null;
    }>
  >([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);

  // Time tab state (use local YYYY-MM-DD to match local HH:mm)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = getServerNow();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [selectedTime, setSelectedTime] = useState(() => {
    const now = getServerNow();
    return now.toTimeString().split(" ")[0].slice(0, 5); // HH:mm
  });

  // Hovered emoji preview
  const [hoveredEmoji, setHoveredEmoji] = useState<{ name: string; icon: React.ReactNode } | null>(
    null
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [floatingStyle, setFloatingStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!anchor) return;
    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const placement = calculateFloatingPosition(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        { width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight, offsetTop: viewport?.offsetTop },
        { menuWidth: 384, maxMenuHeight: 420, minMenuHeight: 120, margin: 12, gap: 8 },
      );
      setFloatingStyle({ position: "fixed", top: placement.top, left: placement.left, width: placement.width, maxHeight: placement.maxHeight, zIndex: 60 });
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
  }, [anchor]);

  // Load guild data
  useEffect(() => {
    if (effectiveGuildId) {
      fetchChannels(effectiveGuildId);
      fetchRoles(effectiveGuildId);
      fetchEmojis(effectiveGuildId);
    }
  }, [effectiveGuildId, fetchChannels, fetchRoles, fetchEmojis]);

  // Member search debouncing
  useEffect(() => {
    if (!effectiveGuildId || !searchQuery.trim() || mentionFilter === "channels" || mentionFilter === "roles") {
      setMemberResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingMembers(true);
      try {
        const res = await api.discord.searchMembers(effectiveGuildId, searchQuery);
        setMemberResults(res.members || []);
      } catch {
        setMemberResults([]);
      } finally {
        setIsSearchingMembers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [effectiveGuildId, searchQuery, mentionFilter]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Insert handler with shiftKey check
  const handleInsert = (text: string, e?: React.MouseEvent) => {
    onInsert(text);
    if (!e?.shiftKey) {
      onClose();
    }
  };

  // Add custom emoji to local storage
  const handleSaveCustomEmoji = () => {
    if (!newEmojiName.trim() || !newEmojiId.trim()) return;
    const newEmoji: CustomEmoji = {
      name: newEmojiName.trim().replace(/^:|:$/g, ""),
      id: newEmojiId.trim(),
      animated: newEmojiAnimated,
    };
    const updated = [...customSavedEmojis, newEmoji];
    setCustomSavedEmojis(updated);
    try {
      localStorage.setItem(CUSTOM_EMOJI_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setNewEmojiName("");
    setNewEmojiId("");
    setNewEmojiAnimated(false);
    setAddCustomModalOpen(false);
  };

  // Filtered lists for mentions
  const q = searchQuery.toLowerCase().trim();
  const filteredChannels = useMemo(() => {
    if (!guildChannels) return [];
    return guildChannels.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [guildChannels, q]);

  const filteredRoles = useMemo(() => {
    if (!mentionableRoles) return [];
    return mentionableRoles.filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [mentionableRoles, q]);

  // Computed unix timestamp for time tab
  const computedUnix = useMemo(() => {
    try {
      const [year, month, day] = selectedDate.split("-").map(Number);
      const [hour, minute] = selectedTime.split(":").map(Number);
      const date = new Date(year, month - 1, day, hour, minute, 0);
      return Math.floor(date.getTime() / 1000);
    } catch {
      return Math.floor(Date.now() / 1000);
    }
  }, [selectedDate, selectedTime]);

  const timeFormats = [
    {
      format: "t",
      label: "Short Time",
      example: new Date(computedUnix * 1000).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    },
    {
      format: "T",
      label: "Long Time",
      example: new Date(computedUnix * 1000).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }),
    },
    {
      format: "f",
      label: "Short Date/Time",
      example: `${new Date(computedUnix * 1000).toLocaleDateString([], {
        month: "long",
        day: "numeric",
        year: "numeric",
      })} ${new Date(computedUnix * 1000).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`,
    },
    {
      format: "F",
      label: "Long Date/Time",
      example: `${new Date(computedUnix * 1000).toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })} ${new Date(computedUnix * 1000).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })}`,
    },
    {
      format: "d",
      label: "Short Date",
      example: new Date(computedUnix * 1000).toLocaleDateString(),
    },
    {
      format: "D",
      label: "Long Date",
      example: new Date(computedUnix * 1000).toLocaleDateString([], {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    },
    {
      format: "R",
      label: "Relative Time",
      example: "Relative (e.g. 2 hours ago / in 5 minutes)",
    },
  ];

  return typeof document === "undefined" ? null : createPortal(
    <div
      ref={containerRef}
      className="fixed rounded-lg bg-[#2b2d31] border border-[#26282d] shadow-2xl overflow-hidden flex flex-col text-[#dbdee1] animate-in fade-in zoom-in-95 duration-150"
      style={floatingStyle}
    >
      {/* Top Header & Tabs */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1e1f22] border-b border-[#313338]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("mentions")}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeTab === "mentions"
                ? "bg-[#35373c] text-white"
                : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#2b2d31]"
            }`}
          >
            Mentions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("time")}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeTab === "time"
                ? "bg-[#35373c] text-white"
                : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#2b2d31]"
            }`}
          >
            Time
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("emojis")}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeTab === "emojis"
                ? "bg-[#35373c] text-white"
                : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#2b2d31]"
            }`}
          >
            Emojis
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("variables")}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeTab === "variables"
                ? "bg-[#35373c] text-white"
                : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#2b2d31]"
            }`}
          >
            Variables
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-[#949ba4] hover:text-white rounded hover:bg-[#35373c] transition-colors"
          title="Close picker"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {/* TAB 1: MENTIONS */}
        {activeTab === "mentions" && (
          <div className="space-y-3">
            {/* Search and Filters */}
            <div className="space-y-1.5">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#949ba4]"
                />
                <input
                  type="text"
                  placeholder="Search channels, roles, users…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] placeholder-[#949ba4] pl-8 pr-3 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 text-[11px]">
                {(["all", "channels", "roles", "members"] as MentionFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setMentionFilter(f)}
                    className={`capitalize px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      mentionFilter === f
                        ? "bg-[#5865f2] text-white"
                        : "bg-[#1e1f22] text-[#949ba4] hover:text-white"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-[#949ba4] italic">
              Tip: Hold Shift to insert multiple items without closing.
            </p>

            {/* Channels */}
            {(mentionFilter === "all" || mentionFilter === "channels") && (
              <div>
                <div className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Hash size={11} /> Channels
                </div>
                {filteredChannels.length === 0 ? (
                  <p className="text-[11px] text-[#949ba4] py-1 italic">
                    {effectiveGuildId ? "No channels match" : "Select a server to view channels"}
                  </p>
                ) : (
                  <div className="space-y-0.5 max-h-36 overflow-y-auto">
                    {filteredChannels.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={(e) => handleInsert(`<#${c.id}>`, e)}
                        className="w-full text-left px-2 py-1 rounded text-xs text-[#dbdee1] hover:bg-[#35373c] hover:text-white flex items-center justify-between group transition-colors"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          {c.type === 2 ? (
                            <Volume2 size={13} className="text-[#949ba4] shrink-0" />
                          ) : c.type === 5 ? (
                            <Megaphone size={13} className="text-[#949ba4] shrink-0" />
                          ) : (
                            <Hash size={13} className="text-[#949ba4] shrink-0" />
                          )}
                          <span className="truncate">{c.name}</span>
                        </span>
                        <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100 font-mono">
                          &lt;#{c.id}&gt;
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Roles */}
            {(mentionFilter === "all" || mentionFilter === "roles") && (
              <div>
                <div className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Shield size={11} /> Roles
                </div>
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {/* Default special mentions */}
                  {canPingEveryone && (!q || "@everyone".includes(q)) && (
                    <button
                      type="button"
                      onClick={(e) => handleInsert("@everyone", e)}
                      className="w-full text-left px-2 py-1 rounded text-xs text-[#dbdee1] hover:bg-[#35373c] hover:text-white flex items-center justify-between group transition-colors"
                    >
                      <span className="flex items-center gap-1.5 font-semibold text-[#f28b8b]">
                        <span className="w-2 h-2 rounded-full bg-[#f28b8b]" />
                        @everyone
                      </span>
                      <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100 font-mono">
                        @everyone
                      </span>
                    </button>
                  )}
                  {canPingHere && (!q || "@here".includes(q)) && (
                    <button
                      type="button"
                      onClick={(e) => handleInsert("@here", e)}
                      className="w-full text-left px-2 py-1 rounded text-xs text-[#dbdee1] hover:bg-[#35373c] hover:text-white flex items-center justify-between group transition-colors"
                    >
                      <span className="flex items-center gap-1.5 font-semibold text-[#f28b8b]">
                        <span className="w-2 h-2 rounded-full bg-[#f28b8b]" />
                        @here
                      </span>
                      <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100 font-mono">
                        @here
                      </span>
                    </button>
                  )}

                  {filteredRoles.map((r) => {
                    const roleColor = r.color
                      ? `#${r.color.toString(16).padStart(6, "0")}`
                      : "#99aab5";
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={(e) => handleInsert(`<@&${r.id}>`, e)}
                        className="w-full text-left px-2 py-1 rounded text-xs text-[#dbdee1] hover:bg-[#35373c] hover:text-white flex items-center justify-between group transition-colors"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: roleColor }}
                          />
                          <span className="truncate">{r.name}</span>
                        </span>
                        <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100 font-mono">
                          &lt;@&amp;{r.id}&gt;
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Members (Live search) */}
            {(mentionFilter === "all" || mentionFilter === "members") && (
              <div>
                <div className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <User size={11} /> Members
                </div>
                {isSearchingMembers ? (
                  <p className="text-[11px] text-[#949ba4] py-1">Searching server members…</p>
                ) : memberResults.length === 0 ? (
                  <p className="text-[11px] text-[#949ba4] py-1 italic">
                    {searchQuery.trim()
                      ? "No members found"
                      : "Type a username in the search bar above"}
                  </p>
                ) : (
                  <div className="space-y-0.5 max-h-36 overflow-y-auto">
                    {memberResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={(e) => handleInsert(`<@${m.id}>`, e)}
                        className="w-full text-left px-2 py-1 rounded text-xs text-[#dbdee1] hover:bg-[#35373c] hover:text-white flex items-center justify-between group transition-colors"
                      >
                        <span className="flex items-center gap-2 truncate">
                          {m.avatar ? (
                            <img
                              src={`https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.webp?size=24`}
                              alt=""
                              className="w-5 h-5 rounded-full bg-[#1e1f22] shrink-0"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-[#5865f2] flex items-center justify-center text-[10px] text-white font-bold shrink-0">
                              {m.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">
                            <span className="font-semibold text-white">
                              {m.nickname || m.global_name || m.username}
                            </span>
                            <span className="text-[10px] text-[#949ba4] ml-1">@{m.username}</span>
                          </span>
                        </span>
                        <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100 font-mono">
                          &lt;@{m.id}&gt;
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TIME */}
        {activeTab === "time" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1">
              {[
                { label: "Now", offsetSec: 0 },
                { label: "+5m", offsetSec: 300 },
                { label: "+15m", offsetSec: 900 },
                { label: "+1h", offsetSec: 3600 },
                { label: "+24h", offsetSec: 86400 },
                { label: "+7d", offsetSec: 86400 * 7 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const target = new Date(Date.now() + preset.offsetSec * 1000);
                    const tzOffset = target.getTimezoneOffset() * 60000;
                    const localIso = new Date(target.getTime() - tzOffset).toISOString();
                    setSelectedDate(localIso.slice(0, 10));
                    setSelectedTime(localIso.slice(11, 16));
                  }}
                  className="px-2 py-0.5 rounded bg-[#1e1f22] hover:bg-[#5865f2] text-[10px] font-semibold text-[#dbdee1] hover:text-white border border-[#232428] transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#949ba4]">Date &amp; Time</label>
              <DateTimePickerPopover
                allowPastDates={true}
                value={new Date(`${selectedDate}T${selectedTime}:00`).toISOString()}
                onChange={(value) => {
                  const target = value ? new Date(value) : getServerNow();
                  const year = target.getFullYear();
                  const month = String(target.getMonth() + 1).padStart(2, "0");
                  const day = String(target.getDate()).padStart(2, "0");
                  setSelectedDate(`${year}-${month}-${day}`);
                  setSelectedTime(target.toTimeString().slice(0, 5));
                }}
              />
            </div>

            <div>
              <div className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1.5">
                Style Preview (Click to insert)
              </div>
              <div className="space-y-1">
                {timeFormats.map((tf) => (
                  <button
                    key={tf.format}
                    type="button"
                    onClick={(e) => handleInsert(`<t:${computedUnix}:${tf.format}>`, e)}
                    className="w-full text-left p-2 rounded bg-[#1e1f22] hover:bg-[#35373c] border border-transparent hover:border-[#4e5058] transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock size={13} className="text-[#949ba4] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">
                          {tf.example}
                        </div>
                        <div className="text-[10px] text-[#949ba4]">{tf.label}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#5865f2] font-mono opacity-0 group-hover:opacity-100 shrink-0 ml-2">
                      &lt;t:{computedUnix}:{tf.format}&gt;
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EMOJIS */}
        {activeTab === "emojis" && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#949ba4]"
              />
              <input
                type="text"
                placeholder="Find the perfect emoji…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] placeholder-[#949ba4] pl-8 pr-3 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
              />
            </div>

            {/* Custom Server & Saved Emojis */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1.5">
                <span>Custom Emojis</span>
                <button
                  type="button"
                  onClick={() => setAddCustomModalOpen(true)}
                  className="flex items-center gap-1 text-[#5865f2] hover:text-[#7983f5] font-semibold lowercase"
                >
                  <Plus size={11} /> add emoji
                </button>
              </div>

              {/* Grid of custom emojis */}
              <div className="grid grid-cols-8 gap-1.5 bg-[#1e1f22] p-2 rounded border border-[#232428] max-h-36 overflow-y-auto">
                {/* "+" tile */}
                <button
                  type="button"
                  onClick={() => setAddCustomModalOpen(true)}
                  className="w-8 h-8 rounded border border-dashed border-[#4e5058] hover:border-white text-[#949ba4] hover:text-white flex items-center justify-center transition-colors"
                  title="Add custom external emoji"
                >
                  <Plus size={14} />
                </button>

                {/* Server emojis */}
                {serverEmojis
                  .filter((e) => !q || e.name.toLowerCase().includes(q))
                  .map((e) => {
                    const tag = e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;
                    const src = `https://cdn.discordapp.com/emojis/${e.id}.${
                      e.animated ? "gif" : "webp"
                    }?size=32&quality=lossless`;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={(ev) => handleInsert(tag, ev)}
                        onMouseEnter={() =>
                          setHoveredEmoji({
                            name: `:${e.name}:`,
                            icon: <img src={src} alt="" className="w-5 h-5 object-contain" />,
                          })
                        }
                        onMouseLeave={() => setHoveredEmoji(null)}
                        className="w-8 h-8 rounded hover:bg-[#35373c] flex items-center justify-center transition-colors"
                        title={`:${e.name}:`}
                      >
                        <img src={src} alt={e.name} className="w-6 h-6 object-contain" />
                      </button>
                    );
                  })}

                {/* User saved custom emojis */}
                {customSavedEmojis
                  .filter((e) => !q || e.name.toLowerCase().includes(q))
                  .map((e) => {
                    const tag = e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;
                    const src = `https://cdn.discordapp.com/emojis/${e.id}.${
                      e.animated ? "gif" : "webp"
                    }?size=32&quality=lossless`;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={(ev) => handleInsert(tag, ev)}
                        onMouseEnter={() =>
                          setHoveredEmoji({
                            name: `:${e.name}:`,
                            icon: <img src={src} alt="" className="w-5 h-5 object-contain" />,
                          })
                        }
                        onMouseLeave={() => setHoveredEmoji(null)}
                        className="w-8 h-8 rounded hover:bg-[#35373c] flex items-center justify-center transition-colors relative"
                        title={`:${e.name}: (Saved)`}
                      >
                        <img src={src} alt={e.name} className="w-6 h-6 object-contain" />
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Unicode Emojis Categories */}
            {Object.entries(COMMON_UNICODE_EMOJIS).map(([catName, list]) => {
              const matched = list.filter(
                (e) => !q || e.name.toLowerCase().includes(q) || e.char.includes(q)
              );
              if (matched.length === 0) return null;
              return (
                <div key={catName}>
                  <div className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                    {catName}
                  </div>
                  <div className="grid grid-cols-8 gap-1 bg-[#1e1f22] p-1.5 rounded border border-[#232428]">
                    {matched.map((e) => (
                      <button
                        key={e.name}
                        type="button"
                        onClick={(ev) => handleInsert(e.char, ev)}
                        onMouseEnter={() =>
                          setHoveredEmoji({
                            name: `:${e.name}:`,
                            icon: <span className="text-lg">{e.char}</span>,
                          })
                        }
                        onMouseLeave={() => setHoveredEmoji(null)}
                        className="w-8 h-8 rounded hover:bg-[#35373c] flex items-center justify-center text-lg transition-colors"
                        title={`:${e.name}:`}
                      >
                        {e.char}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* TAB 4: VARIABLES */}
        {activeTab === "variables" && (
          <div className="space-y-2.5">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#949ba4]"
              />
              <input
                type="text"
                placeholder="Search {user.mention}, {now}, {selected}…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1e1f22] text-xs text-white pl-8 pr-3 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={(ev) => handleInsert("{exploit.", ev)}
                className="w-full text-left px-2.5 py-1.5 rounded bg-[#1e1f22] hover:bg-[#5865f2] group transition-colors border border-[#232428] flex items-center justify-between"
              >
                <span className="font-mono text-xs font-bold text-[#57f287] group-hover:text-white">
                  {"{exploit.<Name>.<Field>}"}
                </span>
                <span className="text-[10px] text-[#949ba4] group-hover:text-white/90">
                  Live WEAO Tag
                </span>
              </button>

              {VARIABLES.filter((v) => {
                if (!searchQuery.trim()) return true;
                if (v.group) return false;
                const sq = searchQuery.toLowerCase();
                return (
                  v.tag?.toLowerCase().includes(sq) ||
                  v.label?.toLowerCase().includes(sq) ||
                  v.desc?.toLowerCase().includes(sq)
                );
              }).map((v, i) =>
                v.group ? (
                  <div
                    key={`grp-${i}`}
                    className="pt-2 pb-0.5 px-1 text-[10px] font-bold uppercase tracking-wider text-[#949ba4] border-b border-[#1e1f22]"
                  >
                    {v.group}
                  </div>
                ) : (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={(ev) => handleInsert(v.tag!, ev)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-[#5865f2] group transition-colors flex flex-col"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-xs font-bold text-[#5865f2] group-hover:text-white">
                        {v.tag}
                      </span>
                      <span className="text-[10px] text-[#949ba4] group-hover:text-white/80">
                        {v.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#b5bac1] group-hover:text-white/90">
                      {v.desc}
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Hover Preview Bar for Emojis */}
      {activeTab === "emojis" && hoveredEmoji && (
        <div className="px-3 py-1.5 bg-[#111214] border-t border-[#1e1f22] flex items-center gap-2 text-xs">
          {hoveredEmoji.icon}
          <span className="font-mono text-[#dbdee1] font-semibold">{hoveredEmoji.name}</span>
        </div>
      )}
      
      {/* Add Custom Emoji Modal Overlay */}
      {addCustomModalOpen && (
        <div className="absolute inset-0 bg-[#1e1f22]/95 z-50 p-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Add External Custom Emoji
              </h4>
              <button
                type="button"
                onClick={() => setAddCustomModalOpen(false)}
                className="text-[#949ba4] hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] text-[#949ba4]">
              You can use emojis from any Discord server without joining it. Just provide the emoji
              name and numeric snowflake ID.
            </p>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-bold text-[#949ba4] uppercase mb-1">
                  Emoji Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. pepecool"
                  value={newEmojiName}
                  onChange={(e) => setNewEmojiName(e.target.value)}
                  className="w-full bg-[#2b2d31] text-xs text-white px-2.5 py-1.5 rounded border border-[#383a40] focus:border-[#5865f2] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#949ba4] uppercase mb-1">
                  Emoji Snowflake ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 102938475610293847"
                  value={newEmojiId}
                  onChange={(e) => setNewEmojiId(e.target.value)}
                  className="w-full bg-[#2b2d31] text-xs text-white px-2.5 py-1.5 rounded border border-[#383a40] focus:border-[#5865f2] focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-[#dbdee1] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newEmojiAnimated}
                  onChange={(e) => setNewEmojiAnimated(e.target.checked)}
                  className="rounded bg-[#2b2d31] border-[#383a40] text-[#5865f2] focus:ring-0"
                />
                Animated emoji (.gif)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#313338]">
            <button
              type="button"
              onClick={() => setAddCustomModalOpen(false)}
              className="px-3 py-1.5 text-xs text-[#949ba4] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCustomEmoji}
              disabled={!newEmojiName.trim() || !newEmojiId.trim()}
              className="px-3 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-xs font-semibold text-white transition-colors"
            >
              Save Emoji
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};

export const RichPicker = React.memo(RichPickerComponent);
export default RichPicker;