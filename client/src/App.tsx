import React, { useEffect } from "react";
const NotFoundPage = React.lazy(() =>
  import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);
import { LoginScreen } from "./components/layout/LoginScreen";
import { HoHoLogoMark } from "./components/layout/HoHoLogoMark";
import { useStudioRoute } from "./components/layout/StudioRouter";
import { useGlobalStore } from "./store/globalStore";
import api from "./api/client";
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
    try {
      const legacyDesignKeys = [
        /^hoho:user-theme-library:v1:/i,
        /^hoho:app-layout-draft:v1:/i,
        /^hoho-manager:puck-design:v1:/i,
      ];
      for (const key of Object.keys(window.localStorage)) {
        if (legacyDesignKeys.some((pattern) => pattern.test(key))) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
  }, []);


  useEffect(() => {
    if (route !== "studio") return;
    let cancelled = false;
    void (async () => {
      const user = await fetchCurrentUser();
      if (!user || cancelled) return;

      const { useActionStore } = await import("./store/actionStore");
      void useActionStore.getState().fetchActionTypes();

      const params = new URLSearchParams(window.location.search);
      if (params.get("setup") === "1" || user.isFirstLogin || user.needsBotConfig) {
        setConfigModalOpen(true);
      }
      const handledParams = ["login", "setup", "error"];
      for (const key of handledParams) params.delete(key);
      const remainingQuery = params.toString();
      if (handledParams.some((key) => new URLSearchParams(window.location.search).has(key))) {
        window.history.replaceState({}, "", `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ""}${window.location.hash}`);
      }

      try {
        const res = await api.discord.identity();
        if (!cancelled && res && res.id) {
          useGlobalStore.getState().setBotIdentity({
            id: res.id,
            username: res.username || "HoHo Bot",
            avatar: res.avatar,
          });
        }
      } catch {
      }
    })();
    return () => { cancelled = true; };
  }, [route, fetchCurrentUser, setConfigModalOpen]);

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
