import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Bot,
  Plus,
  Edit3,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Button } from "./components/ui/Button";
import { Modal } from "./components/ui/Modal";
import { Header, getDiscordAvatarUrl } from "./components/layout/Header";
import { SplitPane } from "./components/layout/SplitPane";
import { MessageEditor } from "./components/editor/MessageEditor";
import { MessagePreview } from "./components/preview/MessagePreview";
import { PropertyPanel } from "./components/editor/PropertyPanel";
import { DocsPage } from "./pages/DocsPage";
import { JsonModal } from "./components/editor/JsonModal";
import { BotDispatchModal } from "./components/send/BotDispatchModal";
import { useMessageStore } from "./store/messageStore";
import { useActionStore } from "./store/actionStore";
import { useTemplateStore } from "./store/templateStore";
import { useGlobalStore } from "./store/globalStore";
import { useProfileStore } from "./store/profileStore";
import { useTemplates } from "./hooks/useTemplates";
import { downloadJson, parseImportedJson } from "./utils/exportImport";
import { copyTextToClipboard } from "./utils/clipboard";
import { NotFoundPage } from "./pages/NotFoundPage";
import api from "./api/client";

const HOHO_LOGO_URL =
  "https://github.com/acsu123/HohoV2/blob/main/BloxFruit/keysystem/hoho_logo.png?raw=true";

// Post-Login Bot & Workspace Configuration Modal
const WorkspaceConfigModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const currentUser = useGlobalStore((s) => s.currentUser);
  const fetchCurrentUser = useGlobalStore((s) => s.fetchCurrentUser);
  const { botProfiles, fetchProfiles, setBotProfileId, botProfileId } = useProfileStore();

  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      void fetchProfiles();
      setError(null);
      setSuccessMsg(null);
    }
  }, [open, fetchProfiles]);

  if (!open || !currentUser) return null;

  const hasDefaultAccess = Boolean(currentUser.hasDefaultBotAccess || currentUser.isAdmin);
  const mutualGuilds = currentUser.mutualGuilds ?? [];

  const handleSaveCustomBot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSaving(true);
    try {
      const res = await api.profiles.createBot({
        name: name.trim(),
        token: token.trim(),
        applicationId: applicationId.trim(),
        publicKey: publicKey.trim(),
      });
      await fetchProfiles();
      await fetchCurrentUser();
      if (res?.profile?.id) {
        setBotProfileId(res.profile.id);
        localStorage.setItem("bot_selected_profile", String(res.profile.id));
        const identity = await api.discord.identity(res.profile.id).catch(() => null);
        if (identity?.id) {
          useGlobalStore.getState().setBotIdentity({
            id: identity.id,
            username: identity.username || res.profile.name,
            avatar: identity.avatar,
          });
        }
      }
      setName("");
      setToken("");
      setApplicationId("");
      setPublicKey("");
      setSuccessMsg("Custom Bot verified with Discord, encrypted, and set as your active bot!");
    } catch (err: any) {
      setError(err?.message || "Discord rejected those bot credentials. Check your Token, Application ID, and Public Key.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveBot = async (id: number) => {
    try {
      await api.profiles.removeBot(id);
      if (botProfileId === id) {
        setBotProfileId(null);
      }
      await fetchProfiles();
      await fetchCurrentUser();
    } catch (err: any) {
      alert(err?.message || "Failed to remove bot profile");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Workspace & Bot Configuration" width="max-w-xl">
      <div className="space-y-4 text-xs text-[#dbdee1]">
        {/* User & Mutual Server Verification Banner */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#1e1f22] border border-[#111214]">
          <div className="flex items-center gap-3">
            <img
              src={getDiscordAvatarUrl(currentUser, 64)}
              alt={currentUser.username}
              className="w-10 h-10 rounded-full object-cover border border-[#35373c]"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {currentUser.global_name || currentUser.username}
                </span>
                {hasDefaultAccess ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#23a559]/20 text-[#57f287] text-[10px] font-bold uppercase">
                    <ShieldCheck size={11} /> Default Bot Authorized
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f0b232]/20 text-[#f0b232] text-[10px] font-bold uppercase">
                    <KeyRound size={11} /> Custom Bot Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#949ba4] mt-0.5">
                Session active (expires in 24h) • {mutualGuilds.length} common server(s) with Default Bot
              </p>
            </div>
          </div>
        </div>

        {/* Status Explanation */}
        {!hasDefaultAccess ? (
          <div className="p-3 rounded-lg bg-[#f0b232]/10 border border-[#f0b232]/30 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-[#f0b232] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-white">
                {mutualGuilds.length === 0
                  ? "No Common Server Found with HoHo Default Bot"
                  : "No Staff / Admin Role Found in Common Server"}
              </p>
              <p className="text-[11px] text-[#dbdee1] leading-relaxed">
                You can still use the full HoHo Manager studio! To send or edit Discord messages, add your own Bot Token below (encrypted with AES-256-GCM and scoped strictly to your account).
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-[#23a559]/10 border border-[#23a559]/30 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-[#57f287] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Verified Server & Role Access</p>
              <p className="text-[11px] text-[#dbdee1]">
                You can use the Server Default Bot{mutualGuilds.length > 0 ? ` across ${mutualGuilds.map((g) => g.name).join(", ")}` : ""}, or optionally add your own custom Bot Profile below.
              </p>
            </div>
          </div>
        )}

        {/* Custom Bot Configuration Form */}
        <form onSubmit={(e) => void handleSaveCustomBot(e)} className="space-y-3 bg-[#1e1f22] p-3.5 rounded-lg border border-[#111214]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#b5bac1]">
            Add Your Own Discord Bot Token
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#949ba4] mb-1">Bot Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Custom Bot"
                className="w-full bg-[#2b2d31] border border-[#111214] rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#5865f2]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#949ba4] mb-1">Application ID (Client ID)</label>
              <input
                type="text"
                required
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                placeholder="123456789012345678"
                className="w-full bg-[#2b2d31] border border-[#111214] rounded px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-[#5865f2]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#949ba4] mb-1">Bot Token (from Discord Dev Portal → Bot)</label>
            <input
              type="password"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="MTI..."
              className="w-full bg-[#2b2d31] border border-[#111214] rounded px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-[#5865f2]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#949ba4] mb-1">Public Key (64-char hex from General Information)</label>
            <input
              type="text"
              required
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="a1b2c3..."
              className="w-full bg-[#2b2d31] border border-[#111214] rounded px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-[#5865f2]"
            />
          </div>

          {error && <p className="text-[11px] text-[#f28b8b] font-medium">{error}</p>}
          {successMsg && <p className="text-[11px] text-[#57f287] font-medium">{successMsg}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="submit" size="sm" variant="primary" loading={saving}>
              Verify & Save Bot
            </Button>
          </div>
        </form>

        {/* Saved Custom Bots for this User */}
        {botProfiles.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
              Your Configured Bots ({botProfiles.length})
            </p>
            {botProfiles.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded bg-[#1e1f22] border border-[#111214]"
              >
                <div className="flex items-center gap-2">
                  <Bot size={15} className="text-[#57f287]" />
                  <div>
                    <p className="text-xs font-bold text-white">{p.name}</p>
                    <p className="text-[10px] text-[#949ba4] font-mono">App ID: {p.application_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBotProfileId(p.id);
                      localStorage.setItem("bot_selected_profile", String(p.id));
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-semibold ${
                      botProfileId === p.id
                        ? "bg-[#23a559] text-white"
                        : "bg-[#2b2d31] text-[#dbdee1] hover:bg-[#35373c]"
                    }`}
                  >
                    {botProfileId === p.id ? "Active" : "Use Bot"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemoveBot(p.id)}
                    className="p-1 text-[#949ba4] hover:text-[#f28b8b]"
                    title="Delete custom bot"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-[#1e1f22]">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Continue to Studio
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Backups Modal
const BackupsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { templates, saveCurrent, loadTemplate } = useTemplates();
  const [templateName, setTemplateName] = useState("");
  const currentName = useTemplateStore((state) => state.currentName);
  const setCurrentName = useTemplateStore((state) => state.setCurrentName);
  const remove = useTemplateStore((state) => state.remove);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleSave = async () => {
    if (templateName.trim()) {
      setCurrentName(templateName.trim());
    }
    try {
      await saveCurrent();
      setTemplateName("");
    } catch (e: any) {
      alert(e?.message || "Failed to save template");
    }
  };

  const handleLoad = async (id: number) => {
    if (confirm("Load this template? Current unsaved changes will be overwritten.")) {
      await loadTemplate(id);
      onClose();
    }
  };

  const handleExportJson = () => {
    const payload = useMessageStore.getState().getPayload();
    downloadJson(payload, `${currentName.trim() || "discohook-message"}.json`);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const document = parseImportedJson(text);
      useMessageStore.getState().load({ data: document });
      setCurrentName(file.name.replace(/\.json$/i, ""));
      onClose();
    } catch (err: any) {
      alert(err?.message || "Invalid JSON file format.");
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
            icon={Download}
            onClick={handleExportJson}
            className="flex-1 text-xs"
          >
            Export JSON
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={Upload}
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
                    onClick={() => void handleLoad(tpl.id)}
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

export const App: React.FC = () => {
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [botModalMode, setBotModalMode] = useState<"send" | "edit">("send");
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");
  const [addMsgMenuOpen, setAddMsgMenuOpen] = useState(false);

  const currentUser = useGlobalStore((state) => state.currentUser);
  const authLoading = useGlobalStore((state) => state.authLoading);
  const fetchCurrentUser = useGlobalStore((state) => state.fetchCurrentUser);
  const configModalOpen = useGlobalStore((state) => state.configModalOpen);
  const setConfigModalOpen = useGlobalStore((state) => state.setConfigModalOpen);

  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/bots/webhook",
  );

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const fetchActionTypes = useActionStore((state) => state.fetchActionTypes);

  useEffect(() => {
    void (async () => {
      const user = await fetchCurrentUser();
      if (!user) return;

      fetchActionTypes();

      // Open config modal automatically if first login, setup=1 query param, or no default bot access & no custom bot saved yet
      const params = new URLSearchParams(window.location.search);
      if (params.get("setup") === "1" || user.isFirstLogin || user.needsBotConfig) {
        setConfigModalOpen(true);
      }
      if (params.has("login") || params.has("setup") || params.has("error")) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      try {
        const res = await api.discord.identity();
        if (res && res.id) {
          useGlobalStore.getState().setBotIdentity({
            id: res.id,
            username: res.username || "HoHo Bot",
            avatar: res.avatar,
          });
        }
      } catch {
        // User may be in Custom Bot mode without default bot access
      }
    })();
  }, [fetchActionTypes, fetchCurrentUser, setConfigModalOpen]);

  const messages = useMessageStore((state) => state.messages);
  const data = useMessageStore((state) => state.data);
  const displayMessages = useMemo(
    () => (messages && messages.length > 0 ? messages : [data]),
    [messages, data],
  );

  const addMessage = useMessageStore((state) => state.addMessage);

  const openBotModal = (actionMode: "send" | "edit") => {
    setBotModalMode(actionMode);
    setBotModalOpen(true);
  };

  const handleShare = async () => {
    const payload = useMessageStore.getState().getPayload();
    const text = JSON.stringify(payload, null, 2);
    const copied = await copyTextToClipboard(text);
    if (copied) alert("Message JSON payload copied to clipboard.");
  };

  const handleClearAll = () => {
    if (confirm("Clear all messages and start fresh?")) {
      useMessageStore.getState().reset();
      useActionStore.getState().reset();
      useTemplateStore.getState().detach();
    }
  };

  if (currentPath === "/docs") {
    return <DocsPage />;
  }

  const isStudioRoute =
    currentPath === "/" ||
    currentPath === "" ||
    currentPath === "/bots/webhook" ||
    currentPath === "/studio";

  if (!isStudioRoute) {
    return <NotFoundPage />;
  }

  // Mandatory Login Gate: require Discord OAuth login before studio loads
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#1e1f22] text-[#dbdee1] font-sans">
        <div className="flex flex-col items-center gap-3">
          <img src={HOHO_LOGO_URL} alt="HoHo Manager" className="w-12 h-12 rounded-xl animate-pulse" />
          <p className="text-xs font-semibold text-[#949ba4]">Verifying Discord session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    const authError =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("error")
        : null;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#1e1f22] text-[#dbdee1] font-sans p-4">
        <div className="w-full max-w-md rounded-2xl bg-[#2b2d31] border border-[#111214] shadow-2xl p-6 space-y-5 text-center">
          <div className="flex flex-col items-center gap-2">
            <img
              src={HOHO_LOGO_URL}
              alt="HoHo Manager"
              className="w-16 h-16 rounded-2xl object-cover border border-[#35373c] shadow-md"
            />
            <h1 className="text-xl font-bold text-white mt-1">HoHo Manager Studio</h1>
            <p className="text-xs text-[#949ba4] max-w-xs">
              Sign in with Discord to verify your mutual servers and roles. Sessions expire every 24 hours for security.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-[#da373c]/15 border border-[#da373c]/40 text-xs text-[#f28b8b]">
              Login failed: {authError}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              window.location.href = "/api/auth/discord/login";
            }}
            className="w-full py-3 px-4 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.08-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" />
            </svg>
            <span>Login with Discord</span>
          </button>

          <div className="pt-3 border-t border-[#1e1f22] text-[11px] text-[#949ba4] space-y-1">
            <p>• Checks mutual servers & staff roles with the default bot</p>
            <p>• No shared server? Bring your own Bot Token after login</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#313338] text-[#dbdee1] font-sans overflow-hidden">
      <Header onOpenBackups={() => setBackupsOpen(true)} />

      {/* Banner if user has no default bot access and hasn't configured a custom bot yet */}
      {!currentUser.hasDefaultBotAccess && !currentUser.isAdmin && (
        <div className="bg-[#f0b232]/15 border-b border-[#f0b232]/30 px-4 py-1.5 flex items-center justify-between text-xs">
          <span className="text-[#dbdee1]">
            <strong className="text-[#f0b232]">Custom Bot Mode:</strong> You don't share an authorized server/role with the default bot. Use your own Bot Profile to dispatch messages.
          </span>
          <button
            type="button"
            onClick={() => setConfigModalOpen(true)}
            className="px-2.5 py-0.5 rounded bg-[#f0b232] text-[#111214] font-bold hover:bg-[#f0b232]/90 transition-colors"
          >
            Configure Bot Token
          </button>
        </div>
      )}

      {/* Mobile Switcher (< 768px) */}
      <div className="md:hidden flex bg-[#2b2d31] border-b border-[#1e1f22] shrink-0 p-1.5 gap-1">
        <button
          type="button"
          onClick={() => setMobileView("editor")}
          className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
            mobileView === "editor" ? "bg-[#5865f2] text-white" : "bg-[#35373c] text-[#b5bac1]"
          }`}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() => setMobileView("preview")}
          className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
            mobileView === "preview" ? "bg-[#5865f2] text-white" : "bg-[#35373c] text-[#b5bac1]"
          }`}
        >
          Preview
        </button>
      </div>

      <main className="flex min-h-0 flex-1 overflow-hidden relative">
        <div className="flex min-h-0 flex-1">
          <SplitPane
            initialRatio={0.48}
            minRatio={0.3}
            maxRatio={0.7}
            left={
              <div
                className={`${
                  mobileView === "editor" ? "flex" : "hidden"
                } md:flex flex-col h-full bg-[#2b2d31] border-r border-[#1e1f22] w-full min-w-0`}
              >
                {/* Top Action Bar */}
                <div className="p-3 bg-[#232428] border-b border-[#1e1f22] shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleShare}
                        className="text-xs"
                      >
                        Share
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setBackupsOpen(true)}
                        className="text-xs"
                      >
                        Backups
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setJsonModalOpen(true)}
                        className="text-xs"
                      >
                        JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfigModalOpen(true)}
                        className="text-xs text-[#5865f2] hover:bg-[#5865f2]/15"
                      >
                        Bot Config
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleClearAll}
                        className="text-xs text-[#f28b8b] hover:bg-[#da373c]/20"
                      >
                        Clear All
                      </Button>
                    </div>

                    {/* Bot Token Dispatch Only */}
                    <div className="inline-flex rounded-lg overflow-hidden border border-[#1a6334] shadow-sm">
                      <button
                        type="button"
                        onClick={() => openBotModal("send")}
                        className="bg-[#248046] hover:bg-[#1a6334] text-white px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 border-r border-[#1a6334]"
                      >
                        <Bot size={13} /> Bot Send
                      </button>
                      <button
                        type="button"
                        onClick={() => openBotModal("edit")}
                        className="bg-[#1a6334] hover:bg-[#144f28] text-white px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1"
                        title="Edit message via bot token"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                    </div>
                  </div>
                </div>

                {/* Multi-Message Workspace (Discohook layout) */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {displayMessages.map((_, idx) => (
                    <MessageEditor key={idx} index={idx} />
                  ))}

                  <div className="relative mt-2">
                    <button
                      type="button"
                      onClick={() => setAddMsgMenuOpen((prev) => !prev)}
                      disabled={displayMessages.length >= 10}
                      className="w-full py-2.5 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-40"
                    >
                      <Plus size={15} /> Add Message ({displayMessages.length}/10)
                    </button>

                    {addMsgMenuOpen && (
                      <div className="mt-2 rounded-lg bg-[#232428] border border-[#1e1f22] p-2 space-y-2 shadow-2xl">
                        <button
                          type="button"
                          onClick={() => {
                            addMessage({ flags: 0 });
                            setAddMsgMenuOpen(false);
                          }}
                          className="w-full rounded-lg bg-[#2b2d31] hover:bg-[#35373c] border border-[#1e1f22] hover:border-[#5865f2] p-3 text-left transition-all flex items-start gap-3"
                        >
                          <div className="p-2 rounded bg-[#1e1f22] text-[#dbdee1] font-mono text-xs font-bold shrink-0">
                            TXT
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Standard Message (Classic)</p>
                            <p className="text-[11px] text-[#949ba4] mt-0.5">
                              Classic message with content, embeds, attachments, and action rows.
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            addMessage({
                              flags: 32768,
                              components: [
                                {
                                  _id: Math.random().toString(36).slice(2, 10),
                                  type: 10,
                                  content: "",
                                },
                              ],
                            });
                            setAddMsgMenuOpen(false);
                          }}
                          className="relative w-full rounded-lg bg-[#2b2d31] hover:bg-[#35373c] border border-[#1e1f22] hover:border-[#5865f2] p-3 text-left transition-all flex items-start gap-3"
                        >
                          <div className="p-2 rounded bg-[#5865f2]/20 text-[#5865f2] font-mono text-xs font-bold shrink-0">
                            V2
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-white">Components V2 Message</p>
                              <span className="rounded-full bg-[#5865f2] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                New
                              </span>
                            </div>
                            <p className="text-[11px] text-[#949ba4] mt-0.5">
                              Build rich layouts with containers, text blocks, galleries, files, separators, and action rows.
                            </p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            }
            right={
              <div
                className={`${
                  mobileView === "preview" ? "flex" : "hidden"
                } md:flex flex-col h-full bg-[#313338] w-full min-w-0`}
              >
                <MessagePreview />
              </div>
            }
          />
        </div>

        {/* Selected Component Property & Flow Builder Panel */}
        <PropertyPanel />
      </main>

      <JsonModal open={jsonModalOpen} onClose={() => setJsonModalOpen(false)} />
      <BackupsModal open={backupsOpen} onClose={() => setBackupsOpen(false)} />
      <WorkspaceConfigModal open={configModalOpen} onClose={() => setConfigModalOpen(false)} />
      <BotDispatchModal
        open={botModalOpen}
        onClose={() => setBotModalOpen(false)}
        initialMode={botModalMode}
      />
    </div>
  );
};

export default App;