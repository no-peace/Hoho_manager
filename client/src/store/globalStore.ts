import { create } from "zustand";

export interface BotIdentity {
  id: string;
  username: string;
  avatar: string | null;
}

export interface CurrentUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar: string | null;
  avatarUrl?: string;
  role?: string;
  isAdmin?: boolean;
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
  setCurrentUser: (user: CurrentUser | null) => void;
  setAuthLoading: (loading: boolean) => void;
  fetchCurrentUser: () => Promise<CurrentUser | null>;
  logout: () => Promise<void>;
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
            selectedGuildId: typeof parsed.selectedGuildId === "string" ? parsed.selectedGuildId : null,
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
    setSelectedGuildId: (id) =>
      set((state) => {
        const updated = { selectedGuildId: id };
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ selectedGuildId: id, isSidebarOpen: state.isSidebarOpen })
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
              JSON.stringify({ selectedGuildId: state.selectedGuildId, isSidebarOpen: open })
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
              JSON.stringify({ selectedGuildId: state.selectedGuildId, isSidebarOpen: open })
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
              JSON.stringify({ selectedGuildId: state.selectedGuildId, isSidebarOpen: next })
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
    authLoading: false,
    setCurrentUser: (user) => set({ currentUser: user }),
    setAuthLoading: (loading) => set({ authLoading: loading }),
    fetchCurrentUser: async () => {
      set({ authLoading: true });
      try {
        const { default: api } = await import("../api/client");
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
        const { default: api } = await import("../api/client");
        await api.auth.logout();
      } catch {
        // Ignore network errors on logout
      } finally {
        set({ currentUser: null });
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("staff_id");
        }
      }
    },
  };
});

