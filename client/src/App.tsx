import React, { useState, useEffect } from "react";
import {
  Plus,
  Send,
  Edit3,
  Trash2,
  Code,
  Share2,
  FolderOpen,
  ShieldCheck,
  KeyRound,
  Webhook,
  Server,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Layers,
  Sparkles,
  Lock,
  Clock,
  Eye,
  EyeOff,
  X,
  Info,
  Zap,
} from "lucide-react";
import { Header } from "./components/layout/Header";
import { SplitPane } from "./components/layout/SplitPane";
import { MessageEditor } from "./components/editor/MessageEditor";
import { MessagePreview } from "./components/preview/MessagePreview";
import { PropertyPanel } from "./components/editor/PropertyPanel";
//import { TemplatesModal } from "./components/layout/TemplatesModal"; no file like that
import { JsonModal } from "./components/editor/JsonModal";
//import { ShareModal } from "./components/layout/ShareModal"; no file like that
import { BotDispatchModal } from "./components/send/BotDispatchModal";
import { AllowedMentionsModal } from "./components/editor/AllowedMentionsModal";
import { FlagsModal } from "./components/editor/FlagsModal";
import { Modal } from "./components/ui/Modal";
import { Button } from "./components/ui/Button";
import { useMessageStore } from "./store/messageStore";
import { useProfileStore } from "./store/profileStore";
import { useGlobalStore } from "./store/globalStore";
import { useDiscordCacheStore } from "./store/discordCacheStore";
import { useTemplateStore } from "./store/templateStore";
import { useTemplates } from "./hooks/useTemplates";
import { SEND_MODES } from "./utils/constants";
import { downloadJson, parseImportedJson, fromQueryData } from "./utils/exportImport";
import { DocsPage } from "./pages/DocsPage";
import api from "./api/client";


const HoHoLogoMark: React.FC<{ className?: string }> = ({ className = "h-8 w-8" }) => (
  <div className={`${className} rounded-xl bg-gradient-to-br from-[#5865f2] to-[#23a55a] p-[1px] shadow-md shrink-0 flex items-center justify-center`}>
    <div className="h-full w-full rounded-[11px] bg-[#1e1f22] flex items-center justify-center font-extrabold text-xs text-[#5865f2]">
      HoHo
    </div>
  </div>
);

/* ── Global In-App Toast & Confirmation Host (No Native Browser Alerts) ─── */
const ToastAndConfirmHost: React.FC = () => {
  const { toasts, dismissToast, confirmDialog, closeConfirm } = useGlobalStore();
  const [confirmBusy, setConfirmBusy] = useState(false);

  return (
    <>
      {/* Bottom-Right Non-Blocking Toasts */}
      <div className="fixed bottom-4 right-4 z-[100000] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((t) => {
          const styles =
            t.variant === "success"
              ? "border-[#23a55a]/60 bg-[#111214]/95 text-[#57f287]"
              : t.variant === "error"
                ? "border-[#da373c]/60 bg-[#111214]/95 text-[#f28b8b]"
                : t.variant === "warning"
                  ? "border-[#f0b232]/60 bg-[#111214]/95 text-[#f0b232]"
                  : "border-[#5865f2]/60 bg-[#111214]/95 text-[#dee0fc]";
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-150 ${styles}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {t.variant === "success" ? (
                  <CheckCircle2 size={15} className="shrink-0" />
                ) : t.variant === "error" || t.variant === "warning" ? (
                  <AlertCircle size={15} className="shrink-0" />
                ) : (
                  <Info size={15} className="shrink-0" />
                )}
                <span className="text-[#f2f3f5] leading-snug">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-[#949ba4] hover:text-white shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Custom In-App Confirmation Dialog */}
      {confirmDialog.open && (
        <Modal
          open={confirmDialog.open}
          onClose={() => !confirmBusy && closeConfirm()}
          title={confirmDialog.title}
          width="max-w-md"
          footer={
            <>
              <Button
                variant="ghost"
                disabled={confirmBusy}
                onClick={closeConfirm}
              >
                Cancel
              </Button>
              <Button
                variant={confirmDialog.danger ? "danger" : "primary"}
                loading={confirmBusy}
                onClick={async () => {
                  if (!confirmDialog.onConfirm) {
                    closeConfirm();
                    return;
                  }
                  setConfirmBusy(true);
                  try {
                    await confirmDialog.onConfirm();
                  } finally {
                    setConfirmBusy(false);
                    closeConfirm();
                  }
                }}
              >
                {confirmDialog.confirmLabel || "Confirm"}
              </Button>
            </>
          }
        >
          <p className="text-xs text-[#dbdee1] leading-relaxed">
            {confirmDialog.message}
          </p>
        </Modal>
      )}
    </>
  );
};

/* ── Custom Bot & Webhook Configuration Modal (Anti-Phishing Safe Inputs) ── */
const BotConfigModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { currentUser, fetchCurrentUser, showToast } = useGlobalStore();
  const { fetchProfiles, setWebhookUrl, setSendMode, setBotProfileId } = useProfileStore();

  const [tab, setTab] = useState<"bot" | "webhook">("bot");
  const [botName, setBotName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [showBotToken, setShowBotToken] = useState(false);
  const [appId, setAppId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDefaultBotAccess = Boolean(
    currentUser?.hasDefaultBotAccess || currentUser?.isAdmin,
  );
  const mutualGuilds = currentUser?.mutualGuilds ?? [];

  const handleSaveBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botName.trim() || !botToken.trim()) {
      setError("Bot Name and Bot Token are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.profiles.createBot({
        name: botName.trim(),
        token: botToken.trim(),
        applicationId: appId.trim() || undefined,
        publicKey: publicKey.trim() || undefined,
      });
      await fetchProfiles();
      await fetchCurrentUser();
      if (res?.profile?.id) {
        setSendMode(SEND_MODES.BOT);
        setBotProfileId(res.profile.id);
      }
      setBotName("");
      setBotToken("");
      setAppId("");
      setPublicKey("");
      showToast("Custom bot profile connected!", "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save custom bot");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whUrl.trim().startsWith("https://discord.com/api/webhooks/")) {
      setError("Please enter a valid Discord Webhook URL.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.profiles.createWebhook({
        name: whName.trim() || "My Webhook",
        url: whUrl.trim(),
      });
      await fetchProfiles();
      await fetchCurrentUser();
      setSendMode(SEND_MODES.WEBHOOK);
      setWebhookUrl(whUrl.trim());
      setWhName("");
      setWhUrl("");
      showToast("Webhook saved and selected!", "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save webhook");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bot & Webhook Configuration"
      width="max-w-lg"
    >
      <div className="space-y-4">
        <div
          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
            hasDefaultBotAccess
              ? "bg-[#23a55a]/10 border-[#23a55a]/30 text-[#dbdee1]"
              : "bg-[#f0b232]/10 border-[#f0b232]/30 text-[#dbdee1]"
          }`}
        >
          {hasDefaultBotAccess ? (
            <CheckCircle2 size={16} className="text-[#57f287] shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={16} className="text-[#f0b232] shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-bold text-white">
              {hasDefaultBotAccess
                ? "You have access to the Server Default Bot!"
                : "No Mutual Server / Default Bot Access Found"}
            </p>
            <p className="text-[#b5bac1] leading-relaxed">
              {hasDefaultBotAccess
                ? `You share ${mutualGuilds.length} server(s) with the default bot and have staff/admin permissions. You can also add your own custom bots or webhooks below.`
                : "You can still use the full HoHo Manager studio by connecting your own Discord Bot Token or Discord Webhook URL below."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#1e1f22] rounded-lg border border-[#111214]">
          <button
            type="button"
            onClick={() => {
              setTab("bot");
              setError(null);
            }}
            className={`py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              tab === "bot"
                ? "bg-[#5865f2] text-white"
                : "text-[#949ba4] hover:text-white"
            }`}
          >
            <KeyRound size={13} /> Add Custom Bot Token
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("webhook");
              setError(null);
            }}
            className={`py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              tab === "webhook"
                ? "bg-[#5865f2] text-white"
                : "text-[#949ba4] hover:text-white"
            }`}
          >
            <Webhook size={13} /> Add Webhook URL
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded bg-[#da373c]/15 border border-[#da373c]/40 text-xs text-[#f28b8b]">
            {error}
          </div>
        )}

        {tab === "bot" ? (
          <form onSubmit={handleSaveBot} className="space-y-3" autoComplete="off">
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#949ba4] mb-1">
                Bot Label / Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., My Community Bot"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] rounded px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#949ba4] mb-1">
                Bot API Token (Encrypted AES-256-GCM) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  data-1p-ignore="true"
                  data-lpignore="true"
                  placeholder="Paste Developer Portal Bot Token"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  style={
                    !showBotToken
                      ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties)
                      : undefined
                  }
                  className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] rounded px-3 py-2 pr-9 text-xs text-white outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowBotToken(!showBotToken)}
                  className="absolute right-2.5 top-2 text-[#949ba4] hover:text-white"
                  title={showBotToken ? "Hide token" : "Show token"}
                >
                  {showBotToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-[10px] text-[#949ba4] mt-1">
                Your token is encrypted before storage and scoped strictly to your Discord user ID.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#949ba4] mb-1">
                  Application ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="123456789012345678"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] rounded px-3 py-1.5 text-xs text-white outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#949ba4] mb-1">
                  Public Key (Optional)
                </label>
                <input
                  type="text"
                  placeholder="ed25519 public key"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] rounded px-3 py-1.5 text-xs text-white outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e1f22]">
              <Button variant="ghost" type="button" onClick={onClose}>
                Skip for Now
              </Button>
              <Button variant="primary" type="submit" loading={saving}>
                Save Custom Bot
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveWebhook} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#949ba4] mb-1">
                Webhook Label
              </label>
              <input
                type="text"
                placeholder="e.g., #announcements Webhook"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] rounded px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#949ba4] mb-1">
                Discord Webhook URL *
              </label>
              <input
                type="url"
                required
                placeholder="https://discord.com/api/webhooks/..."
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
                className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] rounded px-3 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e1f22]">
              <Button variant="ghost" type="button" onClick={onClose}>
                Skip for Now
              </Button>
              <Button variant="primary" type="submit" loading={saving}>
                Save Webhook
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

/* ── Interactive, Dynamic Login & Live Discord Studio Showcase ─────────── */
const DEMO_SHOWCASES = [
  {
    id: "v2",
    tabLabel: "Components V2",
    badge: "IS_COMPONENTS_V2 (32768)",
    title: "Release v4.2 — Layout Containers & Sections",
    accent: "#5865f2",
    description:
      "Build nested V2 Containers, Thumbnails, Media Galleries, Separators, and interactive Action Rows.",
    buttons: [
      { label: "Read Changelog", style: "bg-[#5865f2] text-white" },
      { label: "Verify Role", style: "bg-[#23a55a] text-white" },
    ],
  },
  {
    id: "status",
    tabLabel: "Live Status & Variables",
    badge: "DYNAMIC PLACEHOLDERS",
    title: "Automated Status Cards & Timestamps",
    accent: "#23a55a",
    description:
      "Insert @mentions, #channels, custom server emojis, and dynamic Discord timestamps (<t:unix:R>) with 1 click.",
    buttons: [
      { label: "Check Status", style: "bg-[#35373c] text-[#dbdee1]" },
      { label: "Open Support Ticket", style: "bg-[#5865f2] text-white" },
    ],
  },
  {
    id: "flows",
    tabLabel: "Button & Modal Flows",
    badge: "INTERACTIVE ACTIONS",
    title: "No-Code Button & Modal Workflows",
    accent: "#f0b232",
    description:
      "Attach multi-step role checks, ephemeral replies, DM notifications, and 5-input Discord Modals to any button.",
    buttons: [
      { label: "Submit Application", style: "bg-[#5865f2] text-white" },
      { label: "Claim Reward", style: "bg-[#23a55a] text-white" },
    ],
  },
] as const;

const LoginScreen: React.FC<{ authError?: string | null }> = ({ authError }) => {
  const [activeShowcase, setActiveShowcase] = useState<number>(0);
  const [clickedBtn, setClickedBtn] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveShowcase((prev) => (prev + 1) % DEMO_SHOWCASES.length);
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  const currentDemo = DEMO_SHOWCASES[activeShowcase];

  return (
    <div className="min-h-screen w-full bg-[#111214] text-[#dbdee1] flex flex-col justify-between relative overflow-hidden p-4 sm:p-8 select-none">
      {/* Subtle Ambient Glows */}
      <div className="pointer-events-none fixed -top-32 -left-32 w-96 h-96 rounded-full bg-[#5865f2]/15 blur-[120px]" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#23a55a]/10 blur-[120px]" />

      {/* Top Navigation Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <HoHoLogoMark className="h-9 w-9" />
          <div>
            <span className="text-base font-extrabold text-white tracking-tight block leading-none">
              HoHo Manager
            </span>
            <span className="text-[11px] text-[#949ba4]">
              Discord Message, Webhook & Components V2 Studio
            </span>
          </div>
        </div>
        <a
          href="/docs"
          className="text-xs font-semibold text-[#dbdee1] hover:text-white bg-[#1e1f22] hover:bg-[#2b2d31] border border-[#2b2d31] px-3.5 py-2 rounded-xl transition-colors"
        >
          Documentation →
        </a>
      </div>

      {/* Main 2-Column Hero & Interactive Preview */}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto py-8 z-10">
        {/* Left Column: Auth Card & Security Architecture */}
        <div className="lg:col-span-5 bg-[#1e1f22]/90 backdrop-blur-md border border-[#2b2d31] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5865f2]/15 border border-[#5865f2]/30 text-[#99a2ff] text-[11px] font-bold">
              <Sparkles size={12} /> OAuth2 Verified Workspace
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sign in to launch the studio
            </h1>
            <p className="text-xs sm:text-sm text-[#949ba4] leading-relaxed">
              Authenticate with Discord to verify mutual servers and staff roles, or connect your own custom bot token and webhooks in isolated mode.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-[#da373c]/15 border border-[#da373c]/40 text-xs text-[#f28b8b] flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>Authentication error: {authError}. Please try signing in again.</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              window.location.href = "/api/auth/discord/login";
            }}
            className="w-full py-3 px-4 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#5865f2]/25 transition-all cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.08-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02z" />
            </svg>
            <span>Continue with Discord</span>
          </button>

          <div className="space-y-2.5 pt-2 border-t border-[#2b2d31]">
            <div className="flex items-start gap-2.5 text-xs text-[#b5bac1]">
              <ShieldCheck size={15} className="text-[#57f287] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Live Mutual-Guild & Role Check:</strong>{" "}
                Verifies shared servers and active staff permissions on every request.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#b5bac1]">
              <Clock size={15} className="text-[#5865f2] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">24-Hour Session Expiry:</strong>{" "}
                Signed HTTP-only sessions automatically rotate every 24 hours.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#b5bac1]">
              <Lock size={15} className="text-[#f0b232] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Bring Your Own Bot or Webhook:</strong>{" "}
                No shared server? Connect your own encrypted bot token after login.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Live Discord Sandbox Preview */}
        <div className="lg:col-span-7 bg-[#2b2d31] border border-[#1e1f22] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Interactive Showcase Tabs */}
          <div className="bg-[#1e1f22] px-4 py-3 border-b border-[#111214] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#da373c]/80" />
              <span className="w-3 h-3 rounded-full bg-[#f0b232]/80" />
              <span className="w-3 h-3 rounded-full bg-[#23a55a]/80" />
              <span className="ml-2 text-xs font-bold text-[#949ba4]">
                #announcements — Live Interactive Preview
              </span>
            </div>
            <div className="flex items-center gap-1 bg-[#111214] p-1 rounded-lg">
              {DEMO_SHOWCASES.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveShowcase(idx);
                    setClickedBtn(null);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    activeShowcase === idx
                      ? "bg-[#5865f2] text-white"
                      : "text-[#949ba4] hover:text-white"
                  }`}
                >
                  {item.tabLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Simulated Discord Message Canvas */}
          <div className="p-6 bg-[#313338] space-y-4">
            <div className="flex items-start gap-3.5">
              <HoHoLogoMark className="h-10 w-10" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">HoHo Bot</span>
                  <span className="rounded bg-[#5865f2] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    APP
                  </span>
                  <span className="text-xs text-[#949ba4]">Today at 12:00 PM</span>
                </div>

                {/* Simulated V2 Container Card */}
                <div
                  className="rounded-xl bg-[#2b2d31] border border-[#1e1f22] p-4 space-y-3 transition-all"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor: currentDemo.accent,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1e1f22] text-[#99a2ff]">
                      {currentDemo.badge}
                    </span>
                    <span className="text-[11px] text-[#57f287] flex items-center gap-1 font-semibold">
                      <Zap size={12} /> Ready to Dispatch
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white">{currentDemo.title}</h3>
                  <p className="text-xs text-[#dbdee1] leading-relaxed">
                    {currentDemo.description}
                  </p>

                  {/* Interactive Demo Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {currentDemo.buttons.map((b) => (
                      <button
                        key={b.label}
                        type="button"
                        onClick={() => setClickedBtn(b.label)}
                        className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-transform active:scale-95 ${b.style}`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {clickedBtn && (
                    <div className="mt-2 p-2.5 rounded-lg bg-[#1e1f22] border border-[#5865f2]/40 text-[11px] text-[#dee0fc] flex items-center justify-between">
                      <span>
                        ⚡ Ephemeral Action Preview: Triggered{" "}
                        <strong>&ldquo;{clickedBtn}&rdquo;</strong> workflow!
                      </span>
                      <button
                        type="button"
                        onClick={() => setClickedBtn(null)}
                        className="text-[#949ba4] hover:text-white"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Attribution (Helps Google Safe Browsing Verification) */}
      <div className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#949ba4] border-t border-[#1e1f22] pt-4 z-10">
        <span>HoHo Manager — Independent Discord Webhook & Bot Message Builder Utility</span>
        <span>Uses Official Discord OAuth2 (`identify`, `guilds`) — Never asks for your Discord account password</span>
      </div>
    </div>
  );
};

const BackupsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { templates, saveCurrent, loadTemplate } = useTemplates();
  const [templateName, setTemplateName] = useState("");
  const currentName = useTemplateStore((state) => state.currentName);
  const setCurrentName = useTemplateStore((state) => state.setCurrentName);
  const remove = useTemplateStore((state) => state.remove);
  const { showToast, openConfirm } = useGlobalStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleSave = async () => {
    if (templateName.trim()) {
      setCurrentName(templateName.trim());
    }
    try {
      await saveCurrent();
      setTemplateName("");
      showToast("Template saved to backups!", "success");
    } catch (e: any) {
      showToast(e?.message || "Failed to save template", "error");
    }
  };

  const handleLoad = (id: number) => {
    openConfirm({
      title: "Load Template",
      message: "Load this template? Current unsaved changes in the editor will be overwritten.",
      confirmLabel: "Load Template",
      onConfirm: async () => {
        await loadTemplate(id);
        showToast("Template loaded into studio!", "success");
        onClose();
      },
    });
  };

  const handleExportJson = () => {
    const payload = useMessageStore.getState().getPayload();
    downloadJson(payload, `${currentName.trim() || "hoho-message"}.json`);
    showToast("Exported message JSON file", "info");
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const document = parseImportedJson(text);
      useMessageStore.getState().load({ data: document });
      setCurrentName(file.name.replace(/\.json$/i, ""));
      showToast("Imported JSON into studio!", "success");
      onClose();
    } catch (err: any) {
      showToast(err?.message || "Invalid JSON file format.", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Saved Templates & Backups" width="max-w-md">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-[#1e1f22] border border-[#111214] text-[#dbdee1] text-xs px-2.5 py-1.5 rounded outline-none focus:border-[#5865f2]"
            placeholder="Template / Backup name..."
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <Button size="sm" variant="primary" onClick={() => void handleSave()}>
            Save
          </Button>
        </div>

        <div className="flex gap-2 pt-2 border-t border-[#1e1f22]">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExportJson}
            className="flex-1 text-xs"
          >
            Export JSON
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 text-xs"
          >
            Import JSON
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".json,application/json"
            onChange={(e) => void handleImportJson(e)}
          />
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
            Saved Templates ({templates.length})
          </p>
          {templates.length === 0 ? (
            <p className="text-xs text-[#949ba4] py-4 text-center">
              No saved templates yet. Name your template above and click Save.
            </p>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between p-2 rounded bg-[#1e1f22] border border-[#111214] hover:border-[#35373c]"
              >
                <div className="min-w-0 flex-1 mr-2">
                  <p className="text-xs font-semibold text-[#dbdee1] truncate">{tpl.name}</p>
                  <p className="text-[10px] text-[#949ba4]">
                    Updated {new Date(tpl.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleLoad(tpl.id)}
                    className="text-xs text-[#5865f2] hover:bg-[#5865f2]/10"
                  >
                    Load
                  </Button>
                  <button
                    type="button"
                    onClick={() => remove(tpl.id)}
                    className="p-1 text-[#949ba4] hover:text-[#f28b8b] hover:bg-[#da373c]/20 rounded"
                    title="Delete backup"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};

export function App() {
  const isDocsRoute =
    typeof window !== "undefined" && window.location.pathname.startsWith("/docs");

  const messages = useMessageStore((state) => state.messages);
  const addMessage = useMessageStore((state) => state.addMessage);
  const reset = useMessageStore((state) => state.reset);
  const load = useMessageStore((state) => state.load);
  const getPayload = useMessageStore((state) => state.getPayload);
  const attachedFiles = useMessageStore((state) => state.attachedFiles);

  const sendMode = useProfileStore((state) => state.sendMode);
  const setSendMode = useProfileStore((state) => state.setSendMode);
  const webhookUrl = useProfileStore((state) => state.webhookUrl);
  const setWebhookUrl = useProfileStore((state) => state.setWebhookUrl);
  const threadId = useProfileStore((state) => state.threadId);
  const setThreadId = useProfileStore((state) => state.setThreadId);
  const fetchProfiles = useProfileStore((state) => state.fetchProfiles);

  const {
    currentUser,
    authLoading,
    fetchCurrentUser,
    configModalOpen,
    setConfigModalOpen,
    selectedGuildId,
    setSelectedGuildId,
    setBotIdentity,
    showToast,
    openConfirm,
  } = useGlobalStore();

  const fetchGuilds = useDiscordCacheStore((state) => state.fetchGuilds);
  const guilds = useDiscordCacheStore((state) => state.guilds);

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [botDispatchOpen, setBotDispatchOpen] = useState(false);
  const [botDispatchMode, setBotDispatchMode] = useState<"send" | "edit">("send");
  const [allowedMentionsOpen, setAllowedMentionsOpen] = useState(false);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("auth_error");
      if (err) setAuthError(err);

      const sharedData = params.get("data");
      if (sharedData) {
        try {
          const decoded = JSON.parse(atob(decodeURIComponent(sharedData)));
          const hydrated = fromQueryData(decoded);
          load({ data: hydrated });
        } catch {
          // Ignore malformed share param
        }
      }
    }

    void (async () => {
      const user = await fetchCurrentUser();
      if (user) {
        await fetchProfiles();
        if (user.hasDefaultBotAccess || user.isAdmin) {
          await fetchGuilds();
        }
        const dismissed = sessionStorage.getItem("hoho_config_prompt_shown");
        if ((user.isFirstLogin || user.needsBotConfig) && !dismissed) {
          sessionStorage.setItem("hoho_config_prompt_shown", "1");
          setConfigModalOpen(true);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedGuildId && guilds && guilds.length > 0) {
      setSelectedGuildId(guilds[0].id);
    }
  }, [guilds, selectedGuildId, setSelectedGuildId]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.hasDefaultBotAccess || currentUser.isAdmin) {
      api.discord
        .identity()
        .then((info) => {
          if (info?.id) {
            setBotIdentity({
              id: info.id,
              username: info.username || "HoHo Bot",
              avatar: info.avatar,
            });
          }
        })
        .catch(() => {});
    } else {
      setSendMode(SEND_MODES.BOT);
    }
  }, [currentUser, setBotIdentity, setSendMode]);

  if (isDocsRoute) {
    return (
      <>
        <DocsPage />
        <ToastAndConfirmHost />
      </>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center text-[#949ba4] text-sm font-semibold">
        Verifying your daily Discord session…
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginScreen authError={authError} />
        <ToastAndConfirmHost />
      </>
    );
  }

  const canUseDefaultBot = Boolean(
    currentUser.isAdmin || currentUser.hasDefaultBotAccess,
  );

  const handleSendWebhook = async () => {
    if (!webhookUrl.trim()) {
      showToast("Please enter a Discord Webhook URL first.", "warning");
      return;
    }
    setIsSendingWebhook(true);
    try {
      const payload = getPayload();
      const targetUrl = new URL(webhookUrl.trim());
      targetUrl.searchParams.set("wait", "true");
      if (threadId.trim()) {
        targetUrl.searchParams.set("thread_id", threadId.trim());
      }

      let res: Response;
      if (attachedFiles.length > 0) {
        const form = new FormData();
        form.append("payload_json", JSON.stringify(payload));
        attachedFiles.forEach((f, idx) => {
          if (f.file) {
            form.append(`files[${idx}]`, f.file, f.spoiler ? `SPOILER_${f.name}` : f.name);
          }
        });
        res = await fetch(targetUrl.toString(), { method: "POST", body: form });
      } else {
        res = await fetch(targetUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Webhook error (${res.status}): ${errText}`);
      }
      showToast("Message sent to Discord via Webhook!", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send webhook", "error");
    } finally {
      setIsSendingWebhook(false);
    }
  };

  const editorColumn = (
    <div className="p-3 sm:p-5 space-y-4 max-w-4xl mx-auto">
      {/* Studio Transport & Delivery Card */}
      <div className="rounded-xl bg-[#2b2d31] border border-[#1e1f22] p-3.5 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg bg-[#1e1f22] p-1 border border-[#111214]">
            <button
              type="button"
              onClick={() => setSendMode(SEND_MODES.WEBHOOK)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                sendMode === SEND_MODES.WEBHOOK
                  ? "bg-[#5865f2] text-white"
                  : "text-[#949ba4] hover:text-white"
              }`}
            >
              <Webhook size={13} /> Webhook Mode
            </button>
            <button
              type="button"
              onClick={() => setSendMode(SEND_MODES.BOT)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                sendMode === SEND_MODES.BOT
                  ? "bg-[#5865f2] text-white"
                  : "text-[#949ba4] hover:text-white"
              }`}
            >
              <Server size={13} /> Bot Mode
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {sendMode === SEND_MODES.BOT ? (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  icon={Send}
                  onClick={() => {
                    setBotDispatchMode("send");
                    setBotDispatchOpen(true);
                  }}
                >
                  Send via Bot
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Edit3}
                  onClick={() => {
                    setBotDispatchMode("edit");
                    setBotDispatchOpen(true);
                  }}
                >
                  Edit Msg
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="primary"
                icon={Send}
                loading={isSendingWebhook}
                onClick={handleSendWebhook}
              >
                Send Webhook
              </Button>
            )}
          </div>
        </div>

        {sendMode === SEND_MODES.WEBHOOK ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="sm:col-span-2 bg-[#1e1f22] border border-[#232428] focus:border-[#5865f2] rounded-lg px-3 py-1.5 text-xs text-white outline-none font-mono"
            />
            <input
              type="text"
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              placeholder="Optional Thread ID"
              className="bg-[#1e1f22] border border-[#232428] focus:border-[#5865f2] rounded-lg px-3 py-1.5 text-xs text-white outline-none font-mono"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between bg-[#1e1f22] px-3 py-2 rounded-lg border border-[#232428] text-xs">
            <span className="text-[#b5bac1]">
              {canUseDefaultBot
                ? "Connected to Server Default Bot (or select a Custom Bot inside Dispatch)"
                : "Using Custom Bot Mode — add or manage your Bot Token in Bot Config"}
            </span>
            <button
              type="button"
              onClick={() => setConfigModalOpen(true)}
              className="text-[#5865f2] hover:underline font-semibold shrink-0 ml-2"
            >
              Configure Bot
            </button>
          </div>
        )}

        {/* Quick Global Utility Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1e1f22]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="px-2.5 py-1 rounded-md bg-[#35373c] hover:bg-[#404249] text-xs font-semibold text-[#dbdee1] hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <FolderOpen size={12} /> Backups / Templates
            </button>
            <button
              type="button"
              onClick={() => setAllowedMentionsOpen(true)}
              className="px-2.5 py-1 rounded-md bg-[#35373c] hover:bg-[#404249] text-xs font-semibold text-[#dbdee1] hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Sliders size={12} /> Mentions
            </button>
            <button
              type="button"
              onClick={() => setFlagsOpen(true)}
              className="px-2.5 py-1 rounded-md bg-[#35373c] hover:bg-[#404249] text-xs font-semibold text-[#dbdee1] hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Layers size={12} /> Flags
            </button>
            <button
              type="button"
              onClick={() => setJsonOpen(true)}
              className="px-2.5 py-1 rounded-md bg-[#35373c] hover:bg-[#404249] text-xs font-semibold text-[#dbdee1] hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Code size={12} /> JSON Data
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="px-2.5 py-1 rounded-md bg-[#35373c] hover:bg-[#404249] text-xs font-semibold text-[#dbdee1] hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Share2 size={12} /> Share Link
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              openConfirm({
                title: "Clear All Messages",
                message:
                  "Are you sure you want to clear all messages and reset the studio workspace?",
                confirmLabel: "Clear Workspace",
                danger: true,
                onConfirm: () => {
                  reset();
                  showToast("Workspace reset to a clean message.", "info");
                },
              });
            }}
            className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#f28b8b] hover:bg-[#da373c]/15 flex items-center gap-1 transition-colors"
          >
            <Trash2 size={12} /> Clear All
          </button>
        </div>
      </div>

      {/* Multi-Message List */}
      <div className="space-y-3.5">
        {messages.map((_, idx) => (
          <MessageEditor key={idx} index={idx} />
        ))}
      </div>

      {/* + Add Message Button */}
      <div className="flex items-center justify-between pt-1 pb-6">
        <Button
          size="sm"
          variant="secondary"
          icon={Plus}
          disabled={messages.length >= 10}
          onClick={() => {
            addMessage();
            showToast(`Added Message ${messages.length + 1}`, "info");
          }}
        >
          Add Message ({messages.length}/10)
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#313338] text-[#dbdee1] antialiased">
      <Header onOpenBackups={() => setTemplatesOpen(true)} />
      <SplitPane
        left={editorColumn}
        //center={<MessagePreview />}
        right={
          <>
            <MessagePreview />
            <PropertyPanel />
          </>
        }
      />

      <BackupsModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <JsonModal open={jsonOpen} onClose={() => setJsonOpen(false)} />
      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share Message Link"
        width="max-w-md"
      >
        <div className="space-y-3 text-xs">
          <p className="text-[#949ba4]">
            Copy a shareable link or the raw JSON payload for your current message:
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              className="flex-1"
              onClick={() => {
                const payload = getPayload();
                const encoded = encodeURIComponent(btoa(JSON.stringify(payload)));
                navigator.clipboard.writeText(`${window.location.origin}/?data=${encoded}`);
                showToast("Shareable URL copied to clipboard!", "success");
                setShareOpen(false);
              }}
            >
              Copy Share URL
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                const payload = getPayload();
                navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                showToast("Message JSON copied to clipboard!", "success");
                setShareOpen(false);
              }}
            >
              Copy JSON
            </Button>
          </div>
        </div>
      </Modal>
      <BotDispatchModal
        open={botDispatchOpen}
        onClose={() => setBotDispatchOpen(false)}
        initialMode={botDispatchMode}
      />
      <AllowedMentionsModal
        open={allowedMentionsOpen}
        onClose={() => setAllowedMentionsOpen(false)}
      />
      <FlagsModal open={flagsOpen} onClose={() => setFlagsOpen(false)} />
      <BotConfigModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
      />
      <ToastAndConfirmHost />
    </div>
  );
}

export default App;