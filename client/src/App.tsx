import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Plus,
  Edit3,
  Send,
  Download,
  Upload,
  ShieldCheck,
  AlertCircle,
  X,
  Eye,
  Clock,
  Lock,
} from "lucide-react";
import { Button } from "./components/ui/Button";
import { CultMorphSurface, SkiperDynamicStatusPill } from "./components/ui/CultSkiperPrimitives";
import { Modal } from "./components/ui/Modal";
import { Header, HOHO_LOGO_URL } from "./components/layout/Header";
import { SplitPane } from "./components/layout/SplitPane";
import { MessageEditor } from "./components/editor/MessageEditor";
import { MessagePreview } from "./components/preview/MessagePreview";
import { PropertyPanel } from "./components/editor/PropertyPanel";
import { ServerBotAccessModal } from "./components/layout/ServerBotAccessModal";
import { useMessageStore } from "./store/messageStore";
import { useActionStore } from "./store/actionStore";
import { useTemplateStore } from "./store/templateStore";
import { useGlobalStore } from "./store/globalStore";
import { useTemplates } from "./hooks/useTemplates";
import { downloadJson, parseImportedJson, toQueryData } from "./utils/exportImport";
import { copyTextToClipboard } from "./utils/clipboard";
import { NotFoundPage } from "./pages/NotFoundPage";
import api from "./api/client";
import { AnimatePresence, motion } from "motion/react";
import { Checkbox } from "./components/ui/Field";
import { DateTimePickerPopover } from "./components/ui/DateTimePickerPopover";
import { getServerNow } from "./store/globalStore";
import { updatePageSeo } from "./utils/seo";
import gsap from "gsap";
import { Toaster as SileoToaster } from "sileo";
import { CountUpNumber, MagneticButton, ShinyText, SpotlightCard, SplitTextReveal } from "./components/reactbits/ReactBitsPrimitives";
import { ThreeHeroCanvas } from "./components/reactbits/ThreeHeroCanvas";

const DocsPage = React.lazy(() => import("./pages/DocsPage").then((module) => ({ default: module.DocsPage })));
const PrivacyPage = React.lazy(() => import("./pages/PrivacyPage").then((module) => ({ default: module.PrivacyPage })));

const JsonModal = React.lazy(() => import("./components/editor/JsonModal").then((module) => ({ default: module.JsonModal })));
const BotDispatchModal = React.lazy(() => import("./components/send/BotDispatchModal").then((module) => ({ default: module.BotDispatchModal })));

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_not_configured: "Discord login is not configured on the server. Please contact an administrator.",
  oauth_redirect_misconfigured: "The Discord callback URL is misconfigured. Please contact an administrator.",
  oauth_denied: "Discord authorization was cancelled or denied. You can try again.",
  invalid_oauth_state: "The login session expired or could not be verified. Please try again.",
  token_exchange_timeout: "Discord took too long to complete login. Please try again.",
  oauth_credentials_rejected: "Discord rejected the application credentials. Please contact an administrator.",
  token_exchange_failed: "Discord could not complete login. Please try again later.",
  token_exchange_invalid_response: "Discord returned an invalid login response. Please try again.",
  fetch_user_timeout: "Discord profile lookup timed out. Please try again.",
};

const HoHoLogoMark: React.FC<{ className?: string }> = ({ className = "h-8 w-8" }) => (
  <img
    src={HOHO_LOGO_URL}
    alt="HoHo Manager"
    width={36}
    height={36}
    decoding="async"
    fetchPriority="high"
    className={`${className} rounded-xl object-cover bg-[#1e1f22] border border-[#35373c] shadow-md shrink-0`}
  />
);

/* ── Global In-App Toast & Confirmation Host (Sileo Physics Toaster + Accessible Status Host) ── */
const ToastAndConfirmHost: React.FC = () => {
  const { toasts, confirmDialog, closeConfirm } = useGlobalStore();
  const [confirmBusy, setConfirmBusy] = useState(false);

  return (
    <>
      <SileoToaster
        position="bottom-right"
        theme="dark"
        options={{
          fill: "#18191c",
          roundness: 14,
        }}
      />
      <div role="status" aria-live="polite" className="sr-only">
        {toasts.map((toast) => (
          <span key={toast.id}>{toast.message}</span>
        ))}
      </div>

      {confirmDialog.open && (
        <Modal
          open={confirmDialog.open}
          onClose={() => !confirmBusy && closeConfirm()}
          title={confirmDialog.title}
          width="max-w-md"
          zIndex="z-[9999]"
          footer={
            <>
              <Button variant="ghost" disabled={confirmBusy} onClick={closeConfirm}>
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
          <p className="text-xs text-[#dbdee1] leading-relaxed">{confirmDialog.message}</p>
        </Modal>
      )}
    </>
  );
};

/* ── Unified Backups & Tracking Modal ── */
const BackupsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { templates, saveCurrent, loadTemplate, refresh } = useTemplates();
  const [filter, setFilter] = useState<"all" | "tracked" | "templates">("all");
  const [templateName, setTemplateName] = useState("");
  const [trackOnSave, setTrackOnSave] = useState(false);
  const [expiryEnabled, setExpiryEnabled] = useState(true);
  const [scheduledExpiry, setScheduledExpiry] = useState<string | null>(
    () => new Date(getServerNow().getTime() + 14 * 86_400_000).toISOString(),
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTracked, setEditTracked] = useState(false);
  const [editExpiresAt, setEditExpiresAt] = useState<string | null>(null);
  const [trackedList, setTrackedList] = useState<any[]>([]);
  const [loadingTracked, setLoadingTracked] = useState(false);
  const currentName = useTemplateStore((state) => state.currentName);
  const setCurrentName = useTemplateStore((state) => state.setCurrentName);
  const remove = useTemplateStore((state) => state.remove);
  const { showToast, openConfirm } = useGlobalStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshTracked = async () => {
    setLoadingTracked(true);
    try {
      const response = await api.tracking.list();
      setTrackedList(response.messages ?? []);
    } catch (error: any) {
      showToast(error?.message || "Failed to load tracked messages", "error");
      setTrackedList([]);
    } finally {
      setLoadingTracked(false);
    }
  };

  useEffect(() => {
    if (open) void refreshTracked();
  }, [open]);

  if (!open) return null;

  const resolveNewExpiry = (): string | null => {
    if (!expiryEnabled) return null;
    const expiry = scheduledExpiry
      ? new Date(scheduledExpiry)
      : new Date(getServerNow().getTime() + 14 * 86_400_000);
    if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= getServerNow().getTime()) {
      throw new Error("Expiry date must be in the future.");
    }
    return expiry.toISOString();
  };

  const handleSave = async () => {
    try {
      const expiresAt = resolveNewExpiry();
      if (templateName.trim()) setCurrentName(templateName.trim());
      await saveCurrent(expiresAt, trackOnSave);
      setTemplateName("");
      await refresh();
      showToast("Backup saved successfully", "success");
    } catch (error: any) {
      showToast(error?.message || "Failed to save backup", "error");
    }
  };

  const beginEditTemplate = (item: any) => {
    setEditingKey(`template-${item.id}`);
    setEditName(item.name);
    setEditTracked(Boolean(item.is_tracked || item.trackingRecord));
    setEditExpiresAt(item.expires_at ? new Date(item.expires_at).toISOString() : null);
  };

  const beginEditTracked = (item: any) => {
    setEditingKey(`tracked-${item.id}`);
    setEditName(item.name || `Message ${item.messageId}`);
    setEditTracked(true);
    setEditExpiresAt(item.expiresAt ? new Date(item.expiresAt).toISOString() : null);
  };

  const saveItemEdit = async (item: any, kind: "template" | "tracked") => {
    try {
      if (editExpiresAt) {
        const expiry = new Date(editExpiresAt);
        if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= getServerNow().getTime()) {
          throw new Error("Expiry date must be in the future.");
        }
      }
      if (kind === "template") {
        await api.templates.update(item.id, {
          name: editName.trim() || "Untitled Backup",
          expiresAt: editExpiresAt,
          isTracked: editTracked,
        });
        await refresh();
        if (item.trackingRecord) {
          if (editTracked) {
            await api.tracking.update(item.trackingRecord.id, {
              name: editName.trim() || null,
              expiresAt: editExpiresAt,
              track: true,
            });
          } else {
            await api.tracking.untrack(item.trackingRecord.id);
          }
          await refreshTracked();
        }
      } else {
        await api.tracking.update(item.id, {
          name: editName.trim() || null,
          expiresAt: editExpiresAt,
          track: editTracked,
        });
        await refreshTracked();
      }
      setEditingKey(null);
      showToast("Backup settings updated", "success");
    } catch (error: any) {
      showToast(error?.message || "Failed to update backup", "error");
    }
  };

  const handleUntrack = async (id: number) => {
    try {
      await api.tracking.untrack(id);
      setTrackedList((current) => current.filter((item) => item.id !== id));
      showToast("Stopped tracking message", "info");
    } catch (error: any) {
      showToast(error?.message || "Failed to stop tracking", "error");
    }
  };

  const handleLoad = (id: number) => {
    openConfirm({
      title: "Load Saved Template",
      message: "Load this template? Current unsaved changes will be overwritten.",
      confirmLabel: "Load Template",
      onConfirm: async () => {
        await loadTemplate(id);
        showToast("Template loaded into studio", "success");
        onClose();
      },
    });
  };

  const handleDeleteTemplate = (id: number) => {
    openConfirm({
      title: "Delete Backup",
      message: "This permanently deletes the saved template. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        await remove(id);
        showToast("Backup deleted", "info");
      },
    });
  };

  const handleExportJson = () => {
    const store = useMessageStore.getState();
    const queryData = toQueryData(store.messages, store.targets, store.mode);
    downloadJson(queryData, `${currentName.trim() || "hoho-messages"}.json`);
    showToast("Exported JSON file", "info");
  };

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const document = parseImportedJson(text);
      useMessageStore.getState().load({
        data: document,
        targets: document?.targets,
        mode: document?.mode,
      });
      setCurrentName(file.name.replace(/\.json$/i, ""));
      showToast("Imported JSON file into studio", "success");
      onClose();
    } catch (error: any) {
      showToast(error?.message || "Invalid JSON file format", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const trackedByTemplate = new Map<number, any>(
    trackedList
      .filter((item) => Number.isFinite(Number(item.templateId)) && Number(item.templateId) > 0)
      .map((item) => [Number(item.templateId), item]),
  );
  const items = [
    ...templates.map((item) => {
      const linkedTracking = trackedByTemplate.get(item.id);
      return {
        kind: "template" as const,
        key: `template-${item.id}`,
        id: item.id,
        name: item.name,
        isTracked: Boolean(item.is_tracked || linkedTracking),
        expiresAt: linkedTracking?.expiresAt ?? item.expires_at ?? null,
        updatedAt: item.updated_at,
        source: { ...item, trackingRecord: linkedTracking },
      };
    }),
    ...trackedList
      .filter((item) => !Number.isFinite(Number(item.templateId)) || Number(item.templateId) <= 0)
      .map((item) => ({
        kind: "tracked" as const,
        key: `tracked-${item.id}`,
        id: item.id,
        name: item.name || `Message ${item.messageId}`,
        isTracked: true,
        expiresAt: item.expiresAt ?? null,
        updatedAt: item.updatedAt ?? item.createdAt,
        source: item,
      })),
  ];
  const visibleItems = items.filter((item) => {
    if (filter === "tracked") return item.isTracked;
    if (filter === "templates") return item.kind === "template";
    return true;
  });

  return (
    <Modal open={open} onClose={onClose} title="Backups & Tracking" width="max-w-2xl">
      <section className="space-y-3 rounded-xl border border-[#26282d] bg-[#18191c] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Template / Tracked Backup name..."
            className="min-w-0 flex-1 rounded-lg border border-[#26282d] bg-[#232428] px-3 py-2 text-xs text-[#f2f3f5] outline-none focus:border-[#5865f2]"
          />
          <Button size="sm" variant="primary" onClick={() => void handleSave()}>
            Save Backup
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox
            checked={trackOnSave}
            onChange={setTrackOnSave}
            label="Track Message"
            className="text-xs"
          />
          <Checkbox
            checked={expiryEnabled}
            onChange={setExpiryEnabled}
            label="Custom Expiry Date"
            className="text-xs"
          />
          {expiryEnabled && (
            <DateTimePickerPopover
              value={scheduledExpiry}
              onChange={setScheduledExpiry}
              placeholder="14-day default expiry"
            />
          )}
        </div>
        <p className="text-[10px] text-[#949ba4]">
          Tracking keeps dynamic user and exploit placeholders synchronized. New backups expire after 14 days by default.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-[#26282d] bg-[#1e1f22] p-1">
          {([
            ["all", `All · ${items.length}`],
            ["tracked", `Tracked Only · ${items.filter((item) => item.isTracked).length}`],
            ["templates", `Saved Templates · ${templates.length}`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${filter === value ? "bg-[#5865f2] text-white" : "text-[#949ba4] hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" icon={Download} onClick={handleExportJson}>
            Export
          </Button>
          <Button size="sm" variant="secondary" icon={Upload} onClick={() => fileInputRef.current?.click()}>
            Import
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".json,application/json"
            onChange={(event) => void handleImportJson(event)}
          />
        </div>
      </div>

      <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
        {loadingTracked ? (
          <p className="py-8 text-center text-xs text-[#949ba4]">Loading tracked messages…</p>
        ) : visibleItems.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#949ba4]">
            No items in this view yet. Save a template or enable tracking when dispatching a message.
          </p>
        ) : visibleItems.map((item) => (
          <article key={item.key} className="space-y-2 rounded-lg border border-[#26282d] bg-[#1e1f22] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-xs font-semibold text-[#f2f3f5]">{item.name}</p>
                  <span className="rounded border border-[#35373c] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#949ba4]">
                    {item.kind === "template" ? "Saved template" : "Tracked message"}
                  </span>
                  {item.isTracked && <span className="rounded border border-[#5865f2]/40 px-1.5 py-0.5 text-[9px] text-[#aab0ff]">Tracking on</span>}
                </div>
                <p className="mt-1 truncate text-[10px] text-[#949ba4]">
                  {item.kind === "template"
                    ? `Updated ${new Date(item.updatedAt).toLocaleString()}`
                    : `Channel ${item.source.channelId} · Message ${item.source.messageId}`}
                  {" · "}
                  {item.expiresAt ? `Expires ${new Date(item.expiresAt).toLocaleString()}` : "No expiry"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {item.kind === "template" && (
                  <Button size="sm" variant="ghost" onClick={() => handleLoad(item.id)}>
                    Load
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => item.kind === "template" ? beginEditTemplate(item.source) : beginEditTracked(item.source)}
                  className="rounded-md p-2 text-[#949ba4] hover:bg-[#2b2d31] hover:text-white"
                  title="Edit backup settings"
                >
                  <Edit3 size={13} />
                </button>
                {item.kind === "template" ? (
                  <button type="button" onClick={() => handleDeleteTemplate(item.id)} className="rounded-md p-2 text-[#949ba4] hover:bg-[#da373c]/15 hover:text-[#f28b8b]" title="Delete backup">×</button>
                ) : (
                  <button type="button" onClick={() => void handleUntrack(item.id)} className="rounded-md px-2 py-1 text-[10px] text-[#f28b8b] hover:bg-[#da373c]/15">Untrack</button>
                )}
              </div>
            </div>

            <AnimatePresence>
              {editingKey === item.key && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -4 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: "top left" }}
                  className="space-y-3 border-t border-[#2b2d31] pt-3"
                >
                  <input
                    type="text"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    placeholder="Backup name"
                    className="w-full rounded-lg border border-[#35373c] bg-[#232428] px-3 py-2 text-xs text-[#f2f3f5] outline-none focus:border-[#5865f2]"
                  />
                  <div className="flex flex-wrap items-center gap-4">
                    <Checkbox checked={editTracked} onChange={setEditTracked} label="Track Message" className="text-xs" />
                    <DateTimePickerPopover
                      value={editExpiresAt}
                      onChange={setEditExpiresAt}
                      placeholder="No expiry"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>Cancel</Button>
                    <Button size="sm" variant="primary" onClick={() => void saveItemEdit(item.source, item.kind)}>Save Changes</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </article>
        ))}
      </div>
    </Modal>
  );
};

/* ── Interactive, Dynamic Login & Live Discord Studio Showcase (Bot-Only) ── */
const DEMO_SHOWCASES = [
  {
    id: "v2",
    tabLabel: "Components V2",
    badge: "IS_COMPONENTS_V2 (32768)",
    title: "Release v4.2  Layout Containers & Sections",
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
      "Insert @mentions, #channels, custom server emojis, WEAO status variables, and dynamic Discord timestamps (<t:unix:R>).",
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
      "Attach multi-step role checks, ephemeral replies, DM notifications, and 5-input Discord Modals to any bot message button.",
    buttons: [
      { label: "Submit Application", style: "bg-[#5865f2] text-white" },
      { label: "Claim Role", style: "bg-[#23a55a] text-white" },
    ],
  },
] as const;

const LoginScreen: React.FC<{ authError?: string | null }> = ({ authError }) => {
  const [activeShowcase, setActiveShowcase] = useState<number>(0);
  const [clickedBtn, setClickedBtn] = useState<string | null>(null);
  const showcaseCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveShowcase((prev) => (prev + 1) % DEMO_SHOWCASES.length);
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const element = showcaseCardRef.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { duration: 0.35, ease: "power3.out" } });
      tl.fromTo("[data-showcase-badge]", { y: 8, opacity: 0 }, { y: 0, opacity: 1 }, 0);
      tl.fromTo("[data-showcase-title]", { y: 10, opacity: 0 }, { y: 0, opacity: 1 }, "<0.05");
      tl.fromTo("[data-showcase-actions]", { y: 8, opacity: 0 }, { y: 0, opacity: 1 }, "<0.05");
    }, element);
    return () => ctx.revert();
  }, [activeShowcase]);

  const currentDemo = DEMO_SHOWCASES[activeShowcase];

  return (
    <div className="relative min-h-[100dvh] w-full bg-[#18191c] text-[#dbdee1] flex flex-col justify-between p-3 sm:p-8 pb-4 select-none overflow-x-hidden">
      <ThreeHeroCanvas />
      <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HoHoLogoMark className="h-9 w-9" />
          <div>
            <span className="text-base font-bold text-white tracking-tight block leading-none">
              HoHo Manager
            </span>
            <span className="text-[11px] text-[#b5bac1]">
              Discord Bot Message &amp; Components V2 Builder
            </span>
          </div>
        </div>
        <nav aria-label="Public navigation" className="flex items-center gap-2">
          <a href="/docs" className="text-xs font-semibold text-[#dbdee1] hover:text-white bg-[#2b2d31]/90 hover:bg-[#35373c] border border-[#35373c] px-3.5 py-2 rounded-lg active:scale-[0.97] transition-all">Documentation</a>
        </nav>
      </header>

      <main className="relative z-10 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto py-8">
        <SpotlightCard className="lg:col-span-5 bg-[#2b2d31] border border-[#111214] rounded-xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-2">
            <span className="inline-block px-2 py-0.5 rounded bg-[#5865f2]/15 border border-[#5865f2]/30 text-[#dee0fc] text-[11px] font-semibold uppercase tracking-wider">
              <ShinyText text="COMPONENTS V2 & DYNAMIC TRACKING" />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              <SplitTextReveal text="HoHo Manager Studio" />
            </h1>
            <p className="text-xs sm:text-sm text-[#949ba4] leading-relaxed">
              Sign in with Discord to verify your account, shared servers, and staff access before opening the message studio.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-[#da373c]/15 border border-[#da373c]/40 text-xs text-[#f28b8b] flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{AUTH_ERROR_MESSAGES[authError] ?? "Login could not be completed. Please try again."}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              window.location.href = "/api/auth/discord/login";
            }}
            className="w-full py-2.5 px-4 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.08-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" />
            </svg>
            <span>Login with Discord</span>
          </button>

          <div className="space-y-2.5 pt-2 border-t border-[#1e1f22]">
            <div className="flex items-start gap-2.5 text-xs text-[#b5bac1]">
              <ShieldCheck size={15} className="text-[#57f287] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Mutual-Guild & Role Check:</strong>{" "}
                Verifies shared servers and active staff permissions on every request.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#b5bac1]">
              <Clock size={15} className="text-[#5865f2] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">24-Hour Session Expiry:</strong>{" "}
                Sessions automatically expire every 24 hours.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#b5bac1]">
              <Lock size={15} className="text-[#f0b232] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Workspace Backups:</strong>{" "}
                Save, restore, import, and export message configurations from the studio.
              </span>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="lg:col-span-7 bg-[#2b2d31] border border-[#111214] rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="bg-[#1e1f22] px-4 py-2.5 border-b border-[#111214] flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#949ba4]">
              #announcements  Preview
            </span>
            <div className="flex items-center gap-1 bg-[#111214] p-1 rounded-lg">
              {DEMO_SHOWCASES.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveShowcase(idx);
                    setClickedBtn(null);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${activeShowcase === idx
                    ? "bg-[#5865f2] text-white"
                    : "text-[#949ba4] hover:text-white"
                    }`}
                >
                  {item.tabLabel}
                </button>
              ))}
            </div>
          </div>

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

                <div
                  ref={showcaseCardRef}
                  className="rounded-lg bg-[#2b2d31] border border-[#1e1f22] p-4 space-y-3 transition-all"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor: currentDemo.accent,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span data-showcase-badge className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1e1f22] text-[#dee0fc]">
                      {currentDemo.badge}
                    </span>
                    <SkiperDynamicStatusPill badge="Bot Dispatch" accentColor="#57f287" />
                  </div>

                  <h3 data-showcase-title className="text-base font-bold text-white">{currentDemo.title}</h3>
                  <p className="text-xs text-[#dbdee1] leading-relaxed">
                    {currentDemo.description}
                  </p>

                  <div data-showcase-actions className="flex flex-wrap items-center gap-2 pt-1">
                    {currentDemo.buttons.map((b) => (
                      <button
                        key={b.label}
                        type="button"
                        onClick={() => setClickedBtn(b.label)}
                        className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors ${b.style}`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {clickedBtn && (
                    <div className="mt-2 p-2.5 rounded bg-[#1e1f22] border border-[#35373c] text-[11px] text-[#dbdee1] flex items-center justify-between">
                      <span>
                        Action triggered: <strong>{clickedBtn}</strong>
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
        </SpotlightCard>
      </main>

      <footer className="relative z-10 max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#b5bac1] border-t border-[#26282d] pt-4">
        <span>HoHo Manager • Discord Bot Message &amp; Components V2 Studio</span>
        <span>Discord OAuth2 sign-in (profile and server access)</span>
      </footer>
    </div>
  );
};

/* ── Main Studio Application (1aa39ecf Layout Restored) ────────────────── */
export const App: React.FC = () => {
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [botModalMode, setBotModalMode] = useState<"send" | "edit">("send");
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");

  const currentUser = useGlobalStore((state) => state.currentUser);
  const authLoading = useGlobalStore((state) => state.authLoading);
  const fetchCurrentUser = useGlobalStore((state) => state.fetchCurrentUser);
  const configModalOpen = useGlobalStore((state) => state.configModalOpen);
  const setConfigModalOpen = useGlobalStore((state) => state.setConfigModalOpen);
  const showToast = useGlobalStore((state) => state.showToast);
  const openConfirm = useGlobalStore((state) => state.openConfirm);

  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/bots/webhook",
  );
  const [authError, setAuthError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("error");
    return value && Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, value) ? value : null;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("error")) return;
    const value = params.get("error");
    setAuthError(value && Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, value) ? value : null);
    params.delete("error");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, []);

  useEffect(() => {
    updatePageSeo(currentPath === "/docs"
      ? { title: "HoHo Manager Docs — Variables & Dynamic Tracking", description: "Complete reference for HoHo Manager dynamic variables, tracking, and interactive flows.", path: "/docs", schemaType: "TechArticle" }
      : { title: "HoHo Manager — Discord Bot Studio", description: "Visual Discord Bot Message, Embed, Components V2, and Dynamic Placeholder Studio for HoHo Hub.", path: "/", schemaType: "SoftwareApplication" });
  }, [currentPath]);

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

  const openBotModal = (actionMode: "send" | "edit" = "send") => {
    setBotModalMode(actionMode);
    setBotModalOpen(true);
  };

  const handleShare = async () => {
    const payload = useMessageStore.getState().getPayload();
    const text = JSON.stringify(payload, null, 2);
    const copied = await copyTextToClipboard(text);
    if (copied) {
      showToast("Message JSON payload copied to clipboard!", "success");
    }
  };

  const handleClearAll = () => {
    openConfirm({
      title: "Clear All Messages",
      message: "Clear all messages and start fresh?",
      confirmLabel: "Clear All",
      danger: true,
      onConfirm: () => {
        useMessageStore.getState().reset();
        useActionStore.getState().reset();
        useTemplateStore.getState().detach();
        showToast("Cleared all messages.", "info");
      },
    });
  };

  if (currentPath === "/docs") {
    return (
      <>
        <React.Suspense fallback={<div className="min-h-screen bg-[#18191c] p-6"><div className="mx-auto max-w-5xl space-y-4 animate-pulse"><div className="h-8 w-48 rounded bg-[#2b2d31]" /><div className="h-28 rounded-xl bg-[#232428]" /><div className="h-48 rounded-xl bg-[#232428]" /></div></div>}><DocsPage /></React.Suspense>
        <ToastAndConfirmHost />
      </>
    );
  }

  if (currentPath === "/privacy") {
    return (
      <>
        <React.Suspense fallback={<div className="min-h-screen bg-[#18191c] p-6"><div className="mx-auto max-w-4xl space-y-4 animate-pulse"><div className="h-8 w-56 rounded bg-[#2b2d31]" /><div className="h-36 rounded-xl bg-[#232428]" /><div className="h-28 rounded-xl bg-[#232428]" /></div></div>}><PrivacyPage /></React.Suspense>
        <ToastAndConfirmHost />
      </>
    );
  }

  const isStudioRoute =
    currentPath === "/" ||
    currentPath === "" ||
    currentPath === "/bots/webhook" ||
    currentPath === "/studio";

  if (!isStudioRoute) {
    return (
      <>
        <NotFoundPage />
        <ToastAndConfirmHost />
      </>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#18191c] p-6 text-[#dbdee1] font-sans">
        <div className="mx-auto flex min-h-[80dvh] max-w-5xl flex-col justify-center gap-6 animate-pulse">
          <div className="h-10 w-52 rounded-lg bg-[#2b2d31]" />
          <div className="grid gap-4 lg:grid-cols-2"><div className="h-64 rounded-2xl bg-[#232428]" /><div className="h-64 rounded-2xl bg-[#232428]" /></div>
        </div>
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

  return (
    <div className="flex h-dvh flex-col bg-[#313338] text-[#dbdee1] font-sans overflow-hidden">
      <Header
        onOpenBackups={() => setBackupsOpen(true)}
        onOpenJson={() => setJsonModalOpen(true)}
        onShare={handleShare}
        onClearAll={handleClearAll}
        onOpenSend={openBotModal}
      />

      {/* Banner if user has no default bot access and is in Custom Bot Mode */}
      {!currentUser.hasDefaultBotAccess && !currentUser.isAdmin && (
        <div className="bg-[#f0b232]/15 border-b border-[#f0b232]/30 px-3 py-1 flex items-center justify-between text-[11px] shrink-0">
          <span className="text-[#dbdee1] truncate">
            <strong className="text-[#f0b232]">Custom Bot Mode:</strong> Use your own Bot Profile to dispatch messages.
          </span>
          <button
            type="button"
            onClick={() => setConfigModalOpen(true)}
            className="px-2 py-0.5 rounded bg-[#f0b232] text-[#111214] font-bold hover:bg-[#f0b232]/90 transition-colors shrink-0 ml-2"
          >
            Configure Bot
          </button>
        </div>
      )}

      <main className="flex min-h-0 flex-1 overflow-hidden relative">
        <div className="flex min-h-0 flex-1">
          <SplitPane
            initialRatio={0.48}
            minRatio={0.3}
            maxRatio={0.7}
            mobileActivePane={mobileView === "editor" ? "left" : "right"}
            left={
              <div className="flex flex-col h-full bg-[#2b2d31] border-r border-[#1e1f22] w-full min-w-0 overflow-y-auto xl:overflow-hidden custom-scrollbar">

                {/* Multi-Message Workspace */}
                <div className="flex-1 xl:overflow-y-auto p-2.5 sm:p-3 space-y-3 custom-scrollbar">
                  {displayMessages.map((_, idx) => (
                    <MessageEditor key={idx} index={idx} />
                  ))}

                  <CultMorphSurface
                    layoutId="cult-add-message-surface"
                    triggerLabel={<>Add Message (<CountUpNumber value={displayMessages.length} suffix="/10" />)</>}
                    triggerIcon={<Plus size={15} />}
                    title="Choose message type"
                    disabled={displayMessages.length >= 10}
                    className="pb-4"
                  >
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={displayMessages.length >= 10}
                        onClick={() => addMessage({ flags: 0 })}
                        className="w-full rounded-lg bg-[#2b2d31] hover:bg-[#35373c] border border-[#1e1f22] hover:border-[#5865f2] p-3 text-left transition-all flex items-start gap-3 disabled:opacity-40"
                      >
                        <span className="p-2 rounded bg-[#1e1f22] text-[#dbdee1] font-mono text-xs font-bold shrink-0">TXT</span>
                        <span><span className="block text-xs font-bold text-white">Standard Message (Classic)</span><span className="block text-[11px] text-[#949ba4] mt-0.5">Classic message with content, embeds, attachments, and action rows.</span></span>
                      </button>
                      <button
                        type="button"
                        disabled={displayMessages.length >= 10}
                        onClick={() => addMessage({ flags: 32768, components: [{ _id: Math.random().toString(36).slice(2, 10), type: 10, content: "" }] })}
                        className="w-full rounded-lg bg-[#2b2d31] hover:bg-[#35373c] border border-[#1e1f22] hover:border-[#5865f2] p-3 text-left transition-all flex items-start gap-3 disabled:opacity-40"
                      >
                        <span className="p-2 rounded bg-[#5865f2]/20 text-[#949cf7] font-mono text-xs font-bold shrink-0">V2</span>
                        <span><span className="block text-xs font-bold text-white">Components V2 Message</span><span className="block text-[11px] text-[#949ba4] mt-0.5">Build layouts with containers, text blocks, galleries, files, separators, and action rows.</span></span>
                      </button>
                    </div>
                  </CultMorphSurface>
                </div>
              </div>
            }
            right={
              <div className="flex flex-col h-full bg-[#313338] w-full min-w-0">
                <MessagePreview />
              </div>
            }
          />
        </div>

        {/* Selected Component Property & Flow Builder Panel */}
        <PropertyPanel />
      </main>

      {/* Mobile / Tablet Bottom Navigation Bar (< 1280px) */}
      <nav
        aria-label="Mobile workspace navigation"
        className="xl:hidden flex items-center bg-[#18191c]/95 backdrop-blur-md border-t border-[#26282d] shrink-0 px-3 py-2 gap-2 z-30 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <button
          type="button"
          onClick={() => setMobileView("editor")}
          aria-pressed={mobileView === "editor"}
          className="relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-[#b5bac1] transition-colors active:scale-[0.98] select-none"
        >
          {mobileView === "editor" && (
            <motion.span
              layoutId="mobileWorkspaceTab"
              className="absolute inset-0 rounded-lg bg-[#5865f2]"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <Edit3 size={14} className="relative z-10" />
          <span className={`relative z-10 ${mobileView === "editor" ? "text-white" : ""}`}>Editor</span>
          <span className={`relative z-10 text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-mono ${mobileView === "editor" ? "text-white" : ""}`}>
            <CountUpNumber value={displayMessages.length} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileView("preview")}
          aria-pressed={mobileView === "preview"}
          className="relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-[#b5bac1] transition-colors active:scale-[0.98] select-none"
        >
          {mobileView === "preview" && (
            <motion.span
              layoutId="mobileWorkspaceTab"
              className="absolute inset-0 rounded-lg bg-[#5865f2]"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <Eye size={14} className="relative z-10" />
          <span className={`relative z-10 ${mobileView === "preview" ? "text-white" : ""}`}>Preview</span>
        </button>
        <MagneticButton className="shrink-0">
          <button
            type="button"
            onClick={() => openBotModal("send")}
            className="px-4 py-2.5 rounded-lg bg-[#248046] hover:bg-[#1a6334] text-white text-xs font-bold transition-colors active:scale-[0.98] flex items-center gap-1.5 select-none"
          >
            <Send size={13} />
            <span>Dispatch</span>
          </button>
        </MagneticButton>
      </nav>

      <React.Suspense fallback={null}><JsonModal open={jsonModalOpen} onClose={() => setJsonModalOpen(false)} /></React.Suspense>
      <BackupsModal open={backupsOpen} onClose={() => setBackupsOpen(false)} />
      <ServerBotAccessModal open={configModalOpen} onClose={() => setConfigModalOpen(false)} />
      <React.Suspense fallback={null}><BotDispatchModal
        open={botModalOpen}
        onClose={() => setBotModalOpen(false)}
        initialMode={botModalMode}
      /></React.Suspense>
      <ToastAndConfirmHost />
    </div>
  );
};

export default App;