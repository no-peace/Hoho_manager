import React, { useState, useRef, useEffect } from "react";
import {
  FolderOpen,
  PanelLeft,
  Sparkles,
  ShieldAlert,
  Settings,
  BookOpen,
  ChevronDown,
  LogOut,
  Copy,
  Check,
  Shield,
  ScrollText,
  Key,
} from "lucide-react";

import { SearchableDiscordSelect } from "../ui/SearchableDiscordSelect";
import { Modal } from "../ui/Modal";
import { SettingsModal } from "./SettingsModal";
import { AuditLogsModal } from "./AuditLogsModal";
import { SessionsModal } from "./SessionsModal";
import { useMessageStore } from "../../store/messageStore";
import { useGlobalStore } from "../../store/globalStore";
import { EDITOR_MODES } from "../../utils/constants";
import { AccessPanel } from "./AccessPanel";

export const getDiscordAvatarUrl = (user: { id: string; avatar?: string | null }, size: number = 64): string => {
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
  }
  try {
    const index = (BigInt(user.id) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
};

const DiscordIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.08-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" />
  </svg>
);

interface HeaderProps {
  onOpenBackups?: () => void;
}

const ModeToggle: React.FC = () => {
  const mode = useMessageStore((state) => state.mode);
  const setMode = useMessageStore((state) => state.setMode);

  return (
    <div
      className="flex items-center rounded-lg bg-[#1e1f22] p-0.5 border border-[#111214]"
      role="tablist"
      aria-label="Editor mode"
    >
      {[
        { id: EDITOR_MODES.CLASSIC, label: "Classic" },
        { id: EDITOR_MODES.V2, label: "Components V2" },
      ].map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={mode === option.id}
          onClick={() => setMode(option.id)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2] ${
            mode === option.id
              ? "bg-[#5865f2] text-white shadow-sm"
              : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]/50"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({ onOpenBackups }) => {
  const [accessOpen, setAccessOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [auditLogsOpen, setAuditLogsOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { selectedGuildId, setSelectedGuildId, currentUser, logout, toggleSidebar } = useGlobalStore();

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [userMenuOpen]);

  const handleCopyId = (id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleStaffClick = () => {
    // If Shift is pressed or dev clicks, allow manual staff ID entry
    const current = localStorage.getItem("staff_id");
    if (current) {
      if (confirm(`Log out of manual Staff ID ${current}?`)) {
        localStorage.removeItem("staff_id");
        window.location.reload();
      }
    } else {
      const id = prompt("Enter your Discord User ID to authenticate as Staff (manual fallback):");
      if (id && /^\d{17,20}$/.test(id)) {
        localStorage.setItem("staff_id", id);
        window.location.reload();
      } else if (id) {
        alert("Invalid Discord ID format. Must be 17-20 digits.");
      }
    }
  };

  const staffId = typeof localStorage !== "undefined" ? localStorage.getItem("staff_id") : null;

  return (
    <>
      <header className="sticky top-0 left-0 z-20 bg-[#1E1F22] border-b-2 border-[#1E1F22] shadow-md w-full px-4 h-12 flex items-center justify-between font-sans shrink-0">
        {/* Left: Logo + Toolbox/Drawer button (PanelLeft) + HoHo Manager */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#35373c] bg-[#2b2d31] hover:bg-[#35373c] text-[#949ba4] hover:text-white transition-colors"
            title="Toggle Toolbox (Ctrl+B)"
            aria-label="Toggle Toolbox (Ctrl+B)"
          >
            <PanelLeft size={16} />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5865f2] text-white shadow-sm">
            <Sparkles size={18} />
          </div>
          <span className="text-[15px] font-bold text-white tracking-wide mr-1 hidden sm:inline">
            HoHo Manager
          </span>
        </div>

        {/* Center: ModeToggle pill tabs, Server Select dropdown, Settings button, Backups/History button */}
        <div className="flex items-center gap-2.5">
          <ModeToggle />

          <div className="w-44 sm:w-48 relative">
            <SearchableDiscordSelect
              type="guild"
              value={selectedGuildId || ""}
              onChange={(val) => setSelectedGuildId(val as string)}
              placeholder="Select Server..."
            />
          </div>

          <button
            type="button"
            onClick={() => setAuditLogsOpen(true)}
            className="text-xs flex items-center gap-1.5 font-semibold text-[#dbdee1] hover:text-white border border-[#35373c] bg-[#2b2d31] hover:bg-[#35373c] px-2.5 py-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2]"
            title="Audit Logs"
          >
            <ScrollText size={14} className="text-[#949ba4]" />
            <span className="hidden lg:inline">Audit Logs</span>
          </button>

          <button
            type="button"
            onClick={() => setSessionsOpen(true)}
            className="text-xs flex items-center gap-1.5 font-semibold text-[#dbdee1] hover:text-white border border-[#35373c] bg-[#2b2d31] hover:bg-[#35373c] px-2.5 py-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2]"
            title="Active Sessions"
          >
            <Key size={14} className="text-[#949ba4]" />
            <span className="hidden lg:inline">Sessions</span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-xs flex items-center gap-1.5 font-semibold text-[#dbdee1] hover:text-white border border-[#35373c] bg-[#2b2d31] hover:bg-[#35373c] px-2.5 py-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2]"
            title="Settings"
          >
            <Settings size={14} className="text-[#949ba4]" />
            <span className="hidden md:inline">Settings</span>
          </button>

          {onOpenBackups && (
            <button
              type="button"
              onClick={onOpenBackups}
              className="text-xs flex items-center gap-1.5 font-semibold text-[#dbdee1] hover:text-white border border-[#35373c] bg-[#2b2d31] hover:bg-[#35373c] px-2.5 py-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2]"
              title="Saved Templates & Backups"
            >
              <FolderOpen size={14} className="text-[#949ba4]" />
              <span className="hidden md:inline">Backups</span>
            </button>
          )}
        </div>

        {/* Right: User Profile / Discord Login */}
        <div className="flex items-center gap-2">
          {import.meta.env.VITE_ADMIN_API_KEY && (
            <button
              type="button"
              onClick={() => setAccessOpen(true)}
              className="text-xs flex items-center gap-1.5 font-semibold text-[#f0b232] hover:text-[#f0b232]/80 border border-[#f0b232]/30 bg-[#f0b232]/10 px-2.5 py-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2]"
              title="Staff Access Controls"
            >
              <ShieldAlert size={14} />
              <span className="hidden sm:inline">Staff Access</span>
            </button>
          )}

          {currentUser ? (
            /* Authenticated User Menu */
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border border-[#35373c] bg-[#2b2d31] hover:bg-[#35373c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2]"
                title={`Logged in as ${currentUser.username}`}
              >
                <img
                  src={getDiscordAvatarUrl(currentUser, 48)}
                  alt={currentUser.username}
                  className="w-6 h-6 rounded-full object-cover bg-[#1e1f22]"
                />
                <span className="text-xs font-semibold text-[#dbdee1] max-w-[100px] truncate hidden sm:inline">
                  {currentUser.global_name || currentUser.username}
                </span>
                <ChevronDown size={13} className="text-[#949ba4]" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-9 w-64 rounded-lg bg-[#1e1f22] border border-[#111214] shadow-2xl p-3 z-50 text-[#dbdee1] space-y-3">
                  {/* User Profile Header */}
                  <div className="flex items-center gap-3 border-b border-[#2b2d31] pb-3">
                    <img
                      src={getDiscordAvatarUrl(currentUser, 64)}
                      alt={currentUser.username}
                      className="w-10 h-10 rounded-full object-cover bg-[#2b2d31] border border-[#35373c]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {currentUser.global_name || currentUser.username}
                      </div>
                      <div className="text-xs text-[#949ba4] truncate">
                        @{currentUser.username}
                      </div>
                      {currentUser.isAdmin && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f0b232] bg-[#f0b232]/10 px-1.5 py-0.2 rounded">
                          Head Admin
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Snowflake ID Pill with Copy */}
                  <div className="flex items-center justify-between bg-[#2b2d31] px-2.5 py-1.5 rounded text-xs">
                    <span className="font-mono text-[#949ba4] truncate text-[11px]">
                      {currentUser.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(currentUser.id)}
                      className="text-[#949ba4] hover:text-white p-0.5 transition-colors"
                      title="Copy Discord ID"
                    >
                      {copiedId ? <Check size={13} className="text-[#57f287]" /> : <Copy size={13} />}
                    </button>
                  </div>

                  {/* Quick Action Links */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); setAuditLogsOpen(true); }}
                      className="w-full text-left text-xs font-semibold px-2 py-1.5 rounded hover:bg-[#2b2d31] flex items-center gap-2 text-[#dbdee1] transition-colors"
                    >
                      <ScrollText size={14} className="text-[#949ba4]" />
                      <span>Audit Logs</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); setSessionsOpen(true); }}
                      className="w-full text-left text-xs font-semibold px-2 py-1.5 rounded hover:bg-[#2b2d31] flex items-center gap-2 text-[#dbdee1] transition-colors"
                    >
                      <Key size={14} className="text-[#949ba4]" />
                      <span>Active Sessions</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); setAccessOpen(true); }}
                      className="w-full text-left text-xs font-semibold px-2 py-1.5 rounded hover:bg-[#2b2d31] flex items-center gap-2 text-[#dbdee1] transition-colors"
                    >
                      <Shield size={14} className="text-[#949ba4]" />
                      <span>Staff Access</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); setSettingsOpen(true); }}
                      className="w-full text-left text-xs font-semibold px-2 py-1.5 rounded hover:bg-[#2b2d31] flex items-center gap-2 text-[#dbdee1] transition-colors"
                    >
                      <Settings size={14} className="text-[#949ba4]" />
                      <span>Settings</span>
                    </button>
                  </div>

                  {/* Log Out Button */}
                  <div className="border-t border-[#2b2d31] pt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setUserMenuOpen(false);
                        await logout();
                      }}
                      className="w-full text-left text-xs font-semibold px-2 py-1.5 rounded text-[#f28b8b] hover:bg-[#da373c]/15 flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={14} />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Unauthenticated: Login with Discord Button */
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { window.location.href = "/api/auth/discord/login"; }}
                className="text-xs flex items-center gap-1.5 font-semibold bg-[#5865f2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white px-3 py-1.5 rounded transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2]"
                title="Login with Discord"
              >
                <DiscordIcon size={14} />
                <span className="hidden sm:inline">Login with Discord</span>
                <span className="sm:hidden">Login</span>
              </button>

              {/* Dev manual fallback (or if manual staffId already stored) */}
              {staffId && (
                <button
                  type="button"
                  onClick={handleStaffClick}
                  className="text-xs flex items-center gap-1 font-semibold px-2 py-1.5 rounded text-[#5865f2] border border-[#5865f2]/40 bg-[#5865f2]/10 hover:bg-[#5865f2]/20 transition-colors"
                  title={`Manual Staff ID: ${staffId}`}
                >
                  <span>Staff: {staffId.slice(-4)}</span>
                </button>
              )}
            </div>
          )}

          <a
            href="/docs"
            className="text-xs font-semibold text-[#949ba4] hover:text-white border border-[#35373c] bg-[#2b2d31] hover:bg-[#35373c] px-2.5 py-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2] hidden sm:flex items-center gap-1"
            title="Documentation"
          >
            <BookOpen size={13} />
            <span>Docs</span>
          </a>
        </div>
      </header>

      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Audit Logs Modal */}
      <AuditLogsModal open={auditLogsOpen} onClose={() => setAuditLogsOpen(false)} guildId={selectedGuildId} />

      {/* Sessions Modal */}
      <SessionsModal open={sessionsOpen} onClose={() => setSessionsOpen(false)} guildId={selectedGuildId} />

      {/* Staff Access Modal */}
      <Modal open={accessOpen} onClose={() => setAccessOpen(false)} title="Staff Access Controls" width="max-w-4xl">
        <AccessPanel />
      </Modal>
    </>
  );
};

export default Header;
