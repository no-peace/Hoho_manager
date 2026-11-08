import React, { useState, useRef, useEffect } from "react";
import {
  FolderOpen,
  ShieldAlert,
  Settings,
  BookOpen,
  ChevronDown,
  LogOut,
  Copy,
  Check,
  Shield,
  ArrowLeft,
  KeyRound,
  Code2,
  Share2,
  RotateCcw,
  Send,
  Edit3,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { SearchableDiscordSelect } from "../ui/SearchableDiscordSelect";
import { Modal } from "../ui/Modal";
import { SettingsModal } from "./SettingsModal";
import { useGlobalStore } from "../../store/globalStore";
import { useMessageStore } from "../../store/messageStore";
import { AccessPanel } from "./AccessPanel";

const HOHO_LOGO_URL =
  "https://github.com/acsu123/HohoV2/blob/main/BloxFruit/keysystem/hoho_logo.png?raw=true";

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

export const Header: React.FC<HeaderProps> = ({
  onOpenBackups,
  onOpenJson,
  onShare,
  onClearAll,
  onOpenSend,
}) => {
  const [accessOpen, setAccessOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { selectedGuildId, setSelectedGuildId, currentUser, logout, setConfigModalOpen } =
    useGlobalStore();

  const data = useMessageStore((state) => state.data);
  const mode = useMessageStore((state) => state.mode);
  const validationErrors = React.useMemo(
    () => useMessageStore.getState().getValidationErrors(),
    [data, mode],
  );

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
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const isAdmin = Boolean(currentUser?.isAdmin);
  const hasDefaultBotAccess = Boolean(currentUser?.hasDefaultBotAccess || isAdmin);

  return (
    <>
      <header className="sticky top-0 left-0 z-30 bg-[#18191c] border-b border-[#111214] w-full px-3 sm:px-4 h-13 flex items-center justify-between gap-2 font-sans shrink-0">
        {/* Left: Brand + Validation Status Pill */}
        <div className="flex items-center gap-2.5 min-w-0">
          {isSubRoute && (
            <a
              href="/"
              className="flex items-center gap-1 text-xs font-semibold text-[#949ba4] hover:text-white bg-[#232428] hover:bg-[#2b2d31] border border-[#2b2d31] px-2 py-1.5 rounded-lg transition-colors"
              title="Return to Studio"
            >
              <ArrowLeft size={13} />
            </a>
          )}
          <a
            href="/"
            className="flex items-center gap-2.5 group focus:outline-none shrink-0"
            title="HoHo Manager Studio"
          >
            <img
              src={HOHO_LOGO_URL}
              alt="HoHo Manager"
              className="h-8 w-8 rounded-lg object-cover bg-[#232428] border border-[#2b2d31] shadow-sm"
            />
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-bold text-white leading-tight tracking-tight">
                HoHo Studio
              </span>
              <span className="text-[10px] font-medium text-[#949ba4] leading-tight">
                Discord Message Builder
              </span>
            </div>
          </a>

          {/* Validation Badge (Desktop) */}
          <div className="hidden xl:flex items-center pl-2 border-l border-[#2b2d31]">
            {validationErrors.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#23a559]/10 border border-[#23a559]/25 text-[11px] font-semibold text-[#57f287]">
                <CheckCircle2 size={12} /> Ready
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#f0b232]/10 border border-[#f0b232]/30 text-[11px] font-semibold text-[#f0b232]"
                title={validationErrors.join("\n")}
              >
                <AlertCircle size={12} /> {validationErrors.length} issue{validationErrors.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Center: Server Selector & Unified Studio Toolbar (Desktop >= 1024px) */}
        <div className="hidden lg:flex items-center gap-1.5 bg-[#232428] p-1 rounded-lg border border-[#111214]">
          {hasDefaultBotAccess && (
            <div className="w-44 pr-1 border-r border-[#2b2d31]">
              <SearchableDiscordSelect
                type="guild"
                value={selectedGuildId || ""}
                onChange={(val) => setSelectedGuildId(val as string)}
                placeholder="Select Server..."
              />
            </div>
          )}

          {onOpenBackups && (
            <button
              type="button"
              onClick={onOpenBackups}
              className="h-7 px-2.5 rounded-md text-xs font-semibold text-[#dbdee1] hover:text-white hover:bg-[#2b2d31] flex items-center gap-1.5 transition-colors"
              title="Saved Templates & Backups"
            >
              <FolderOpen size={13} className="text-[#949ba4]" />
              <span>Templates</span>
            </button>
          )}

          {onOpenJson && (
            <button
              type="button"
              onClick={onOpenJson}
              className="h-7 px-2.5 rounded-md text-xs font-semibold text-[#dbdee1] hover:text-white hover:bg-[#2b2d31] flex items-center gap-1.5 transition-colors"
              title="Inspect or Edit Raw JSON Payload"
            >
              <Code2 size={13} className="text-[#949ba4]" />
              <span>JSON</span>
            </button>
          )}

          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="h-7 px-2.5 rounded-md text-xs font-semibold text-[#dbdee1] hover:text-white hover:bg-[#2b2d31] flex items-center gap-1.5 transition-colors"
              title="Copy JSON Payload to Clipboard"
            >
              <Share2 size={13} className="text-[#949ba4]" />
              <span>Copy</span>
            </button>
          )}

          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="h-7 px-2 rounded-md text-xs font-semibold text-[#f28b8b] hover:bg-[#da373c]/15 flex items-center gap-1 transition-colors"
              title="Reset Workspace"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right: Primary Publish Button + Admin/Bot Config + User Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop Publish / Edit Action Group */}
          {onOpenSend && (
            <div className="hidden sm:inline-flex rounded-lg overflow-hidden border border-[#1a6334] shadow-sm">
              <button
                type="button"
                onClick={() => onOpenSend("send")}
                className="bg-[#23a559] hover:bg-[#1d8a4a] text-white px-3 h-8 text-xs font-bold transition-colors flex items-center gap-1.5 border-r border-[#1a6334]"
              >
                <Send size={12} />
                <span>Publish</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenSend("edit")}
                className="bg-[#1e2622] hover:bg-[#27332d] text-[#57f287] px-2.5 h-8 text-xs font-semibold transition-colors flex items-center gap-1"
                title="Edit an existing bot message"
              >
                <Edit3 size={11} />
                <span>Edit</span>
              </button>
            </div>
          )}

          {isAdmin ? (
            <button
              type="button"
              onClick={() => setAccessOpen(true)}
              className="h-8 px-2.5 rounded-lg text-xs flex items-center gap-1.5 font-semibold text-[#f0b232] hover:bg-[#f0b232]/15 border border-[#f0b232]/30 bg-[#f0b232]/10 transition-colors"
              title="Staff Access Controls"
            >
              <ShieldAlert size={13} />
              <span className="hidden md:inline">Access</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfigModalOpen(true)}
              className="h-8 px-2.5 rounded-lg text-xs flex items-center gap-1.5 font-semibold text-[#dbdee1] hover:text-white border border-[#2b2d31] bg-[#232428] hover:bg-[#2b2d31] transition-colors"
              title="Configure Custom Bot Token"
            >
              <KeyRound size={13} className="text-[#f0b232]" />
              <span className="hidden md:inline">Bot Token</span>
            </button>
          )}

          <a
            href="/docs"
            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-[#949ba4] hover:text-white border border-[#2b2d31] bg-[#232428] hover:bg-[#2b2d31] transition-colors hidden md:flex items-center gap-1"
            title="Documentation"
          >
            <BookOpen size={13} />
            <span className="hidden xl:inline">Docs</span>
          </a>

          {currentUser && (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-full border border-[#2b2d31] bg-[#232428] hover:bg-[#2b2d31] transition-colors"
                title={`Logged in as ${currentUser.username}`}
              >
                <img
                  src={getDiscordAvatarUrl(currentUser, 48)}
                  alt={currentUser.username}
                  className="w-6 h-6 rounded-full object-cover bg-[#1e1f22]"
                />
                <span className="text-xs font-semibold text-[#dbdee1] max-w-[90px] truncate hidden sm:inline">
                  {currentUser.global_name || currentUser.username}
                </span>
                <ChevronDown size={13} className="text-[#949ba4]" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-10 w-64 rounded-xl bg-[#18191c] border border-[#2b2d31] shadow-2xl p-3 z-50 text-[#dbdee1] space-y-3">
                  <div className="flex items-center gap-3 border-b border-[#2b2d31] pb-3">
                    <img
                      src={getDiscordAvatarUrl(currentUser, 64)}
                      alt={currentUser.username}
                      className="w-10 h-10 rounded-full object-cover bg-[#232428] border border-[#35373c]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {currentUser.global_name || currentUser.username}
                      </div>
                      <div className="text-xs text-[#949ba4] truncate">
                        @{currentUser.username}
                      </div>
                      {isAdmin ? (
                        <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f0b232] bg-[#f0b232]/10 px-1.5 py-0.2 rounded">
                          Head Admin
                        </span>
                      ) : hasDefaultBotAccess ? (
                        <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#57f287] bg-[#57f287]/10 px-1.5 py-0.2 rounded">
                          Authorized Staff
                        </span>
                      ) : (
                        <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4] bg-[#2b2d31] px-1.5 py-0.2 rounded">
                          Custom Bot Mode
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-[#232428] px-2.5 py-1.5 rounded-lg text-xs">
                    <span className="font-mono text-[#949ba4] truncate text-[11px]">
                      {currentUser.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(currentUser.id)}
                      className="text-[#949ba4] hover:text-white p-0.5 transition-colors"
                      title="Copy Discord ID"
                    >
                      {copiedId ? (
                        <Check size={13} className="text-[#57f287]" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setConfigModalOpen(true);
                      }}
                      className="w-full text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#232428] flex items-center gap-2 text-[#dbdee1] transition-colors"
                    >
                      <KeyRound size={14} className="text-[#f0b232]" />
                      <span>Bot Configuration</span>
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setAccessOpen(true);
                          }}
                          className="w-full text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#232428] flex items-center gap-2 text-[#dbdee1] transition-colors"
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
                          className="w-full text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#232428] flex items-center gap-2 text-[#dbdee1] transition-colors"
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
                      className="w-full text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg text-[#f28b8b] hover:bg-[#da373c]/15 flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={14} />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {isAdmin && <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}

      {isAdmin && (
        <Modal
          open={accessOpen}
          onClose={() => setAccessOpen(false)}
          title="Staff Access Controls"
          width="max-w-4xl"
        >
          <AccessPanel />
        </Modal>
      )}
    </>
  );
};

export default Header;