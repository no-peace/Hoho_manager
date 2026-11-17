import React, { useEffect } from "react";
const NotFoundPage = React.lazy(() =>
  import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);
import { LoginScreen } from "./components/layout/LoginScreen";
import { HoHoLogoMark } from "./components/layout/HoHoLogoMark";
import { useStudioRoute } from "./components/layout/StudioRouter";
import { useGlobalStore } from "./store/globalStore";
import api from "./api/client";
import { designApi } from "./api/design";
import { applyUiTheme, loadUserThemeCache, refreshUserThemeLibraryExpiry } from "./utils/puckTheme";
import { publishedThemeTokens } from "./config/puck/publishedTheme";
import "./config/puck/publishedTheme.css";

const DesignLabPage = React.lazy(() =>
  import("./pages/DesignLabPage").then((module) => ({ default: module.DesignLabPage })),
);

const DocsPage = React.lazy(() =>
  import("./pages/DocsPage").then((module) => ({ default: module.DocsPage })),
);
const PrivacyPage = React.lazy(() =>
  import("./pages/PrivacyPage").then((module) => ({ default: module.PrivacyPage })),
);

const StudioLayout = React.lazy(() =>
  import("./components/layout/StudioLayout").then((module) => ({ default: module.StudioLayout })),
);
const StudioModals = React.lazy(() =>
  import("./components/layout/StudioModals").then((module) => ({ default: module.StudioModals })),
);

const AppLoadingScreen: React.FC<{ label?: string }> = ({ label = "Loading HoHo Manager…" }) => (
  <div
    className="app-loading-screen"
    role="status"
    aria-live="polite"
    aria-label={label}
  >
    <div className="app-loading-mark">
      <HoHoLogoMark className="h-14 w-14 object-contain" alt="HoHo Manager logo" />
    </div>
    <span className="app-loading-label">{label}</span>
    <span className="app-loading-indicator" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  </div>
);

const SessionAuthLoader: React.FC = () => (
  <AppLoadingScreen label="Verifying Discord session…" />
);

export const App: React.FC = () => {
  const { route } = useStudioRoute();
  const currentUser = useGlobalStore((state) => state.currentUser);
  const authLoading = useGlobalStore((state) => state.authLoading);
  const fetchCurrentUser = useGlobalStore((state) => state.fetchCurrentUser);
  const setConfigModalOpen = useGlobalStore((state) => state.setConfigModalOpen);

  useEffect(() => {
    let active = true;
    const refreshTheme = async (refreshUserCacheExpiry = false) => {
      try {
        const response = await designApi.defaultTheme();
        if (!active) return;
        const serverTheme = response.theme?.theme || publishedThemeTokens;
        applyUiTheme(serverTheme);
        const themeCacheId = currentUser?.id || "guest";
        const cached = loadUserThemeCache(themeCacheId, refreshUserCacheExpiry);
        if (cached) applyUiTheme(cached.theme);
        if (refreshUserCacheExpiry) refreshUserThemeLibraryExpiry(themeCacheId);
      } catch {
        if (active) {
          const themeCacheId = currentUser?.id || "guest";
          const cached = loadUserThemeCache(themeCacheId, refreshUserCacheExpiry);
          if (cached) applyUiTheme(cached.theme);
          if (refreshUserCacheExpiry) refreshUserThemeLibraryExpiry(themeCacheId);
        }
      }
    };
    applyUiTheme(publishedThemeTokens);
    void refreshTheme(true);
    const handleFocus = () => { if (document.visibilityState === "visible") void refreshTheme(false); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    void (async () => {
      const user = await fetchCurrentUser();
      if (!user) return;

      const { useActionStore } = await import("./store/actionStore");
      void useActionStore.getState().fetchActionTypes();

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
      }
    })();
  }, [fetchCurrentUser, setConfigModalOpen]);

  if (route === "docs") {
    return (
      <>
        <React.Suspense fallback={<AppLoadingScreen />}>
          <DocsPage />
        </React.Suspense>
      </>
    );
  }

  if (route === "privacy") {
    return (
      <>
        <React.Suspense fallback={<AppLoadingScreen />}>
          <PrivacyPage />
        </React.Suspense>
      </>
    );
  }

  if (route === "not_found") {
    return (
      <React.Suspense fallback={<AppLoadingScreen />}>
        <NotFoundPage />
      </React.Suspense>
    );
  }

  if (authLoading) {
    return <SessionAuthLoader />;
  }

  if (route === "design") {
    return (
      <React.Suspense fallback={<AppLoadingScreen label="Loading Design Lab…" />}>
        <DesignLabPage />
      </React.Suspense>
    );
  }

  if (!currentUser) {
    const authError =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("error")
        : null;
    return (
      <>
        <LoginScreen authError={authError} />
      </>
    );
  }

  return (
    <React.Suspense fallback={<AppLoadingScreen />}>
      <StudioLayout />
      <StudioModals />
    </React.Suspense>
  );
};

export default App;
