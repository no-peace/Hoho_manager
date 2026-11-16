import React, { useEffect } from "react";
const NotFoundPage = React.lazy(() =>
  import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);
import { HoHoLogoMark, LoginScreen } from "./components/layout/LoginScreen";
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

const SessionAuthLoader: React.FC = () => (
  <div className="h-dvh w-full bg-[#0B0D12] text-[#F1F3F9] flex flex-col items-center justify-center gap-3 select-none font-sans">
    <HoHoLogoMark className="h-11 w-11 object-contain" />
    <div className="flex items-center gap-2">
      <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#818CF8]" aria-hidden="true" />
      <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#5865f2]" aria-hidden="true" />
      <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#5865f2]" aria-hidden="true" />
      <span className="ml-1 text-xs font-medium text-[#A1A8B8]">Verifying Discord session…</span>
    </div>
  </div>
);

export const App: React.FC = () => {
  const { route } = useStudioRoute();
  const currentUser = useGlobalStore((state) => state.currentUser);
  const authLoading = useGlobalStore((state) => state.authLoading);
  const fetchCurrentUser = useGlobalStore((state) => state.fetchCurrentUser);
  const setConfigModalOpen = useGlobalStore((state) => state.setConfigModalOpen);

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
        <React.Suspense fallback={null}>
          <DocsPage />
        </React.Suspense>
      </>
    );
  }

  if (route === "privacy") {
    return (
      <>
        <React.Suspense fallback={null}>
          <PrivacyPage />
        </React.Suspense>
      </>
    );
  }

  if (route === "not_found") {
    return (
      <React.Suspense fallback={null}>
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
    <React.Suspense fallback={null}>
      <StudioLayout />
      <StudioModals />
    </React.Suspense>
  );
};

export default App;
