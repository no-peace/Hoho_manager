import { create } from "zustand";
import { api }  from "../api/client";

export interface BotIdentity {
  id: string;
  username: string;
  avatar: string | null;
}

export interface MutualGuildInfo {
  id: string;
  name: string;
  icon: string | null;
  roles: string[];
  isOwner?: boolean;
}

export interface StaffMentionPermissions {
  can_mention_everyone: boolean;
  can_mention_here: boolean;
  can_mention_roles: boolean;
  allowed_role_mention_ids: string[];
  can_use_webhooks?: boolean;
  can_override_profile?: boolean;
  can_attach_files?: boolean;
  can_use_components_v2?: boolean;
  can_use_weao_exploits?: boolean;
  allowed_guild_ids?: string[];
}

export interface CurrentUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar: string | null;
  avatarUrl?: string;
  role?: string;
  isAdmin?: boolean;
  hasDefaultBotAccess?: boolean;
  isFirstLogin?: boolean;
  mutualGuilds?: MutualGuildInfo[];
  customBotCount?: number;
  customWebhookCount?: number;
  needsBotConfig?: boolean;
  staffPermissions?: StaffMentionPermissions | null;
}

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: (() => void | Promise<void>) | null;
}

interface GlobalState {
  selectedGuildId: string | null;
  setSelectedGuildId: (id: string | null) => void;
  botIdentity: BotIdentity | null;
  setBotIdentity: (identity: BotIdentity | null) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  currentUser: CurrentUser | null;
  authLoading: boolean;
  configModalOpen: boolean;
  setConfigModalOpen: (open: boolean) => void;
  setCurrentUser: (user: CurrentUser | null) => void;
  setAuthLoading: (loading: boolean) => void;
  fetchCurrentUser: () => Promise<CurrentUser | null>;
  serverTimeOffsetMs: number;
  syncServerTime: () => Promise<void>;
  logout: () => Promise<void>;

  // In-App Toast & Confirmation Modal System (Replaces window.alert / window.confirm)
  toasts: ToastItem[];
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
  confirmDialog: ConfirmDialogState;
  openConfirm: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
  }) => void;
  closeConfirm: () => void;
}

const STORAGE_KEY = "hoho_global_state";
const BOT_IDENTITY_CACHE_KEY = "bot_identity_cache";

const loadInitialState = (): { selectedGuildId: string | null; isSidebarOpen: boolean } => {
  const isNarrow = typeof window !== "undefined" && window.innerWidth <= 1100;
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return {
            selectedGuildId:
              typeof parsed.selectedGuildId === "string" ? parsed.selectedGuildId : null,
            isSidebarOpen: isNarrow ? false : Boolean(parsed.isSidebarOpen),
          };
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  return { selectedGuildId: null, isSidebarOpen: false };
};

const loadInitialBotIdentity = (): BotIdentity | null => {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(BOT_IDENTITY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return {
            id: String(parsed.id || ""),
            username: String(parsed.username || parsed.name || ""),
            avatar: parsed.avatar ?? null,
          };
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
};

export const useGlobalStore = create<GlobalState>((set) => {
  const initial = loadInitialState();
  return {
    selectedGuildId: initial.selectedGuildId,
    isSidebarOpen: initial.isSidebarOpen,
    botIdentity: loadInitialBotIdentity(),
    configModalOpen: false,
    setConfigModalOpen: (open) => set({ configModalOpen: open }),
    setSelectedGuildId: (id) =>
      set((state) => {
        const updated = { selectedGuildId: id };
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ selectedGuildId: id, isSidebarOpen: state.isSidebarOpen }),
            );
          }
        } catch {
          // Ignore storage write errors
        }
        return updated;
      }),
    setIsSidebarOpen: (open) =>
      set((state) => {
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ selectedGuildId: state.selectedGuildId, isSidebarOpen: open }),
            );
          }
        } catch {
          // Ignore storage write errors
        }
        return { isSidebarOpen: open };
      }),
    setSidebarOpen: (open) =>
      set((state) => {
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ selectedGuildId: state.selectedGuildId, isSidebarOpen: open }),
            );
          }
        } catch {
          // Ignore storage write errors
        }
        return { isSidebarOpen: open };
      }),
    toggleSidebar: () =>
      set((state) => {
        const next = !state.isSidebarOpen;
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ selectedGuildId: state.selectedGuildId, isSidebarOpen: next }),
            );
          }
        } catch {
          // Ignore storage write errors
        }
        return { isSidebarOpen: next };
      }),
    setBotIdentity: (identity) =>
      set(() => {
        try {
          if (typeof localStorage !== "undefined") {
            if (identity) {
              localStorage.setItem(BOT_IDENTITY_CACHE_KEY, JSON.stringify(identity));
            } else {
              localStorage.removeItem(BOT_IDENTITY_CACHE_KEY);
            }
          }
        } catch {
          // Ignore storage write errors
        }
        return { botIdentity: identity };
      }),
    currentUser: null,
    authLoading: true,
    serverTimeOffsetMs: 0,
    syncServerTime: async () => {
      try {
        const response = await fetch("/api/health");
        if (!response.ok) return;
        const json = await response.json();
        if (typeof json.time === "string") {
          set({ serverTimeOffsetMs: new Date(json.time).getTime() - Date.now() });
        }
      } catch {
        // Keep the last known server clock offset when offline.
      }
    },
    setCurrentUser: (user) => set({ currentUser: user }),
    setAuthLoading: (loading) => set({ authLoading: loading }),
    fetchCurrentUser: async () => {
      set({ authLoading: true });
      try {
        try {
          const health = await fetch("/api/health");
          if (health.ok) {
            const json = await health.json();
            if (typeof json.time === "string") {
              set({ serverTimeOffsetMs: new Date(json.time).getTime() - Date.now() });
            }
          }
        } catch {
          // Authentication can still proceed when health is temporarily unavailable.
        }
        const res = await api.auth.me();
        const user = res?.user ?? null;
        set({ currentUser: user, authLoading: false });
        return user;
      } catch {
        set({ currentUser: null, authLoading: false });
        return null;
      }
    },
    logout: async () => {
      try {
        await api.auth.logout();
      } catch {
        // Ignore network errors on logout
      } finally {
        set({ currentUser: null, configModalOpen: false });
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("staff_id");
        }
      }
    },

    toasts: [],
    showToast: (message, variant = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      set((state) => ({
        toasts: [...state.toasts.slice(-4), { id, message, variant }],
      }));
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, 4000);
    },
    dismissToast: (id) =>
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      })),

    confirmDialog: {
      open: false,
      title: "",
      message: "",
      confirmLabel: "Confirm",
      danger: false,
      onConfirm: null,
    },
    openConfirm: ({ title, message, confirmLabel = "Confirm", danger = false, onConfirm }) =>
      set({
        confirmDialog: {
          open: true,
          title,
          message,
          confirmLabel,
          danger,
          onConfirm,
        },
      }),
    closeConfirm: () =>
      set((state) => ({
        confirmDialog: { ...state.confirmDialog, open: false, onConfirm: null },
      })),
  };
});

export const getServerNow = (): Date =>
  new Date(Date.now() + useGlobalStore.getState().serverTimeOffsetMs);
