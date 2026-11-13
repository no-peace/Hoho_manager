import React, { useState, useRef, useEffect } from "react";
import {
  Settings,
  BookOpen,
  ChevronDown,
  LogOut,
  Copy,
  Check,
  Shield,
  ArrowLeft,
  KeyRound,
  Archive,
  FileJson,
  Share2,
  Trash2,
  Send,
} from "lucide-react";
import { SearchableDiscordSelect } from "../ui/SearchableDiscordSelect";
import { Modal } from "../ui/Modal";
import { AnimatedMorphIcon } from "../ui/CultSkiperPrimitives";
import { useGlobalStore } from "../../store/globalStore";

const AccessPanel = React.lazy(() => import("./AccessPanel").then((module) => ({ default: module.AccessPanel })));
const SettingsModal = React.lazy(() => import("./SettingsModal").then((module) => ({ default: module.SettingsModal })));

export const HOHO_LOGO_URL = "/hoho_logo.svg";

export const getDiscordAvatarUrl = (
  user: { id: string; avatar?: string | null },
  size: number = 64,
): string => {
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

export interface HeaderProps {
  onOpenBackups?: () => void;
  onOpenJson?: () => void;
  onShare?: () => void;
  onClearAll?: () => void;
  onOpenSend?: (mode: "send" | "edit") => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenBackups, onOpenJson, onShare, onClearAll, onOpenSend }) => {
  const [accessOpen, setAccessOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const {
    selectedGuildId,
    setSelectedGuildId,
    currentUser,
    logout,
    setConfigModalOpen,
    showToast,
  } = useGlobalStore();

  const isSubRoute =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/bots/") || window.location.pathname !== "/");

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
      showToast("Discord ID copied to clipboard", "info");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const isAdmin = Boolean(currentUser?.isAdmin);
  const hasDefaultBotAccess = Boolean(currentUser?.hasDefaultBotAccess || isAdmin);

  return (
    <>
      <header className="sticky top-0 left-0 z-20 bg-[#1E1F22] border-b border-[#111214] shadow-md w-full px-4 h-12 flex items-center justify-between font-sans shrink-0">
        {/* Left: Dashboard Back link + HoHo Emblem + HoHo Manager title */}
        <div className="flex items-center gap-2.5">
          {isSubRoute && (
            <a
              href="/"
              className="flex items-center gap-1 text-xs font-semibold text-[#949ba4] hover:text-white bg-[#2b2d31] hover:bg-[#35373c] border border-[#35373c] px-2 py-1 rounded transition-colors mr-1"
              title="Return to Dashboard"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Dashboard</span>
            </a>
          )}
          <a
            href="/"
            className="flex items-center gap-2.5 group focus:outline-none shrink-0"
            title="HoHo Manager"
          >
            <img
              src={HOHO_LOGO_URL}
              width={32}
              height={32}
              decoding="async"
              fetchPriority="high"
              className="h-8 w-8 rounded-lg object-cover bg-[#1e1f22] border border-[#35373c] shadow-sm group-hover:scale-105 transition-transform shrink-0"
            />
            <h1 className="text-[15px] font-bold text-white tracking-wide mr-1 hidden sm:inline m-0">
              HoHo Manager
            </h1>
          </a>
        </div>

        {/* Center: Server Select dropdown, Settings/Bot Config button, Backups button */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {hasDefaultBotAccess && (
            <div className="w-32 sm:w-48 relative shrink">
              <SearchableDiscordSelect
                type="guild"
                value={selectedGuildId || ""}
                onChange={(val) => setSelectedGuildId(val as string)}
                placeholder="Select Server..."
              />
            </div>
          )}

          <div className="flex items-center gap-1">
            {onOpenBackups && (
              <button type="button" onClick={onOpenBackups} title="Backups & saved messages" aria-label="Backups and saved messages" className="inline-flex items-center gap-1.5 rounded-lg border border-[#35373c] bg-[#2b2d31] px-2 py-1.5 text-xs font-semibold text-[#dbdee1] transition-all hover:bg-[#35373c] active:scale-[0.97]">
                <Archive size={14} /><span className="hidden xl:inline">Backups</span>
              </button>
            )}
            {onOpenJson && (
              <button type="button" onClick={onOpenJson} title="Import or export JSON" aria-label="Import or export JSON" className="inline-flex items-center gap-1.5 rounded-lg border border-[#35373c] bg-[#2b2d31] px-2 py-1.5 text-xs font-semibold text-[#dbdee1] transition-all hover:bg-[#35373c] active:scale-[0.97]">
                <FileJson size={14} /><span className="hidden xl:inline">JSON</span>
              </button>
            )}
            {onShare && (
              <button type="button" onClick={() => void onShare()} title="Copy message JSON" aria-label="Copy message JSON" className="rounded-lg border border-[#35373c] bg-[#2b2d31] p-1.5 text-[#dbdee1] transition-all hover:bg-[#35373c] active:scale-[0.97]">
                <Share2 size={14} />
              </button>
            )}
            {onClearAll && (
              <button type="button" onClick={onClearAll} title="Clear all messages" aria-label="Clear all messages" className="rounded-lg border border-[#35373c] bg-[#2b2d31] p-1.5 text-[#f28b8b] transition-all hover:bg-[#da373c]/15 active:scale-[0.97]">
                <Trash2 size={14} />
              </button>
            )}
            {onOpenSend && (
              <button type="button" onClick={() => onOpenSend("send")} title="Dispatch message" aria-label="Dispatch message" className="rounded-lg border border-[#248046] bg-[#248046] p-1.5 text-white transition-all hover:bg-[#1a6334] active:scale-[0.97]">
                <Send size={14} />
              </button>
            )}
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="text-xs flex items-center gap-1.5 font-semibold text-[#dbdee1] hover:text-white border border-[#35373c] bg-[#2b2d31] hover:bg-[#35373c] active:scale-[0.98] px-2.5 py-1.5 rounded-lg transition-all select-none"
              title="Head Admin Settings"
            >
              <Settings size={14} className="text-[#949ba4]" />
              <span className="hidden md:inline">Settings</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfigModalOpen(true)}
              className="text-xs flex items-center gap-1.5 font-semibold text-[#dbdee1] hover:text-white border border-[#35373c] bg-[#2b2d31] hover:bg-[#35373c] active:scale-[0.98] px-2.5 py-1.5 rounded-lg transition-all select-none"
              title="Bot access status"
            >
              <KeyRound size={14} className="text-[#f0b232]" />
              <span className="hidden md:inline">Bot Access</span>
            </button>
          )}
        </div>

        {/* Right: Staff Access + Authenticated User Profile + Docs */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAccessOpen(true)}
              className="text-xs flex items-center gap-1.5 font-semibold text-[#f0b232] hover:text-[#f0b232]/80 border border-[#f0b232]/30 bg-[#f0b232]/10 active:scale-[0.98] px-2.5 py-1.5 rounded-lg transition-all select-none"
              title="Staff Access Controls"
            >
              <Shield size={14} />
              <span className="hidden lg:inline">Staff Access</span>
            </button>
          )}

          {currentUser && (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 bg-[#2b2d31] hover:bg-[#35373c] active:scale-[0.98] border border-[#35373c] rounded-full pl-1 pr-2.5 py-1 transition-all select-none"
                title="Account & Session Info"
              >
                <img
                  src={currentUser.avatarUrl || getDiscordAvatarUrl(currentUser, 64)}
                  alt={currentUser.username}
                  width={24}
                  height={24}
                  decoding="async"
                  className="h-6 w-6 rounded-full object-cover bg-[#5865f2]"
                />
                <span className="text-xs font-semibold text-[#f2f3f5] max-w-[110px] truncate hidden sm:inline">
                  {currentUser.global_name || currentUser.username}
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    hasDefaultBotAccess ? "bg-[#23a55a]" : "bg-[#f0b232]"
                  }`}
                />
                <ChevronDown size={12} className="text-[#949ba4]" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#111214] border border-[#2b2d31] shadow-2xl p-3 z-50 text-xs space-y-2.5">
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#2b2d31]">
                    <img
                      src={currentUser.avatarUrl || getDiscordAvatarUrl(currentUser, 64)}
                      alt={currentUser.username}
                      className="h-10 w-10 rounded-full object-cover bg-[#5865f2] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white truncate text-sm">
                        {currentUser.global_name || currentUser.username}
                      </p>
                      <p className="text-[11px] text-[#949ba4] truncate">
                        @{currentUser.username}
                      </p>
                      <span
                        className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          isAdmin
                            ? "bg-[#f0b232]/15 text-[#f0b232] border border-[#f0b232]/30"
                            : hasDefaultBotAccess
                              ? "bg-[#23a55a]/15 text-[#57f287] border border-[#23a55a]/30"
                              : "bg-[#5865f2]/15 text-[#dee0fc] border border-[#5865f2]/30"
                        }`}
                      >
                        {isAdmin
                          ? "Head Admin"
                          : hasDefaultBotAccess
                            ? "Authorized Staff"
                            : "Custom Bot Mode"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-[#1e1f22] px-2.5 py-1.5 rounded-lg border border-[#2b2d31]">
                    <span className="text-[11px] text-[#949ba4]">Discord ID:</span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(currentUser.id)}
                      className="flex items-center gap-1 font-mono text-[11px] text-[#dbdee1] hover:text-white"
                    >
                      <span>{currentUser.id}</span>
                      <AnimatedMorphIcon
                        active={copiedId}
                        activeIcon={<Check size={12} className="text-[#57f287]" />}
                        inactiveIcon={<Copy size={12} className="text-[#949ba4]" />}
                      />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setConfigModalOpen(true);
                      }}
                      className="w-full text-left text-xs font-semibold px-2 py-1.5 rounded hover:bg-[#2b2d31] flex items-center gap-2 text-[#dbdee1] transition-colors"
                    >
                      <KeyRound size={14} className="text-[#f0b232]" />
                      <span>Bot Access</span>
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setAccessOpen(true);
                          }}
                          className="w-full text-left text-xs font-semibold px-2 py-1.5 rounded hover:bg-[#2b2d31] flex items-center gap-2 text-[#dbdee1] transition-colors"
                        >
                          <Shield size={14} className="text-[#949ba4]" />
                          <span>Staff Access</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setSettingsOpen(true);
                          }}
                          className="w-full text-left text-xs font-semibold px-2 py-1.5 rounded hover:bg-[#2b2d31] flex items-center gap-2 text-[#dbdee1] transition-colors"
                        >
                          <Settings size={14} className="text-[#949ba4]" />
                          <span>Head Admin Settings</span>
                        </button>
                      </>
                    )}
                  </div>

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
          )}

          <a
            href="/docs"
            className="text-xs font-semibold text-[#949ba4] hover:text-white border border-[#35373c] bg-[#2b2d31] hover:bg-[#35373c] px-2.5 py-1.5 rounded transition-colors hidden sm:flex items-center gap-1"
            title="Documentation"
          >
            <BookOpen size={13} />
            <span>Docs</span>
          </a>
        </div>
      </header>
      
      {isAdmin && (
        <React.Suspense
          fallback={
            <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Head Admin Settings" width="max-w-md">
              <p className="p-4 text-center text-xs text-[#949ba4]">Loading settings...</p>
            </Modal>
          }
        >
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </React.Suspense>
      )}

      {isAdmin && (
        <Modal
          open={accessOpen}
          onClose={() => setAccessOpen(false)}
          title="Staff Access Controls"
          width="max-w-4xl"
        >
          <React.Suspense fallback={<div className="p-6 text-center text-xs text-[#949ba4]">Loading staff access...</div>}>
            <AccessPanel />
          </React.Suspense>
        </Modal>
      )}
    </>
  );
};

export default Header;