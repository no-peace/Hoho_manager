import React, { useEffect } from "react";
import { NotFoundPage } from "./pages/NotFoundPage";
import { HoHoLogoMark, LoginScreen } from "./components/layout/LoginScreen";
import { StudioLayout } from "./components/layout/StudioLayout";
import { StudioModals, ToastAndConfirmHost } from "./components/layout/StudioModals";
import { useStudioRoute } from "./components/layout/StudioRouter";
import { useGlobalStore } from "./store/globalStore";
import { useActionStore } from "./store/actionStore";
import api from "./api/client";

const DocsPage = React.lazy(() =>
  import("./pages/DocsPage").then((module) => ({ default: module.DocsPage })),
);
const PrivacyPage = React.lazy(() =>
  import("./pages/PrivacyPage").then((module) => ({ default: module.PrivacyPage })),
);

const SessionAuthLoader: React.FC = () => (
  <div className="h-dvh w-full bg-[#1e1f22] text-[#dbdee1] flex flex-col items-center justify-center gap-3 select-none font-sans">
    <HoHoLogoMark className="h-11 w-11 rounded-xl border border-[#35373c] shadow-md" />
    <div className="flex items-center gap-2">
      <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#5865f2]" aria-hidden="true" />
      <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#5865f2]" aria-hidden="true" />
      <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#5865f2]" aria-hidden="true" />
      <span className="ml-1 text-xs font-medium text-[#949ba4]">Verifying Discord session…</span>
    </div>
  </div>
);

export const App: React.FC = () => {
  const { route } = useStudioRoute();
  const currentUser = useGlobalStore((state) => state.currentUser);
  const authLoading = useGlobalStore((state) => state.authLoading);
  const fetchCurrentUser = useGlobalStore((state) => state.fetchCurrentUser);
  const setConfigModalOpen = useGlobalStore((state) => state.setConfigModalOpen);
  const fetchActionTypes = useActionStore((state) => state.fetchActionTypes);

  useEffect(() => {
    void (async () => {
      const user = await fetchCurrentUser();
      if (!user) return;

      void fetchActionTypes();

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
        // Custom Bot mode fallback
      }
    })();
  }, [fetchActionTypes, fetchCurrentUser, setConfigModalOpen]);

  if (route === "docs") {
    return (
      <>
        <React.Suspense fallback={null}>
          <DocsPage />
        </React.Suspense>
        <ToastAndConfirmHost />
      </>
    );
  }

  if (route === "privacy") {
    return (
      <>
        <React.Suspense fallback={null}>
          <PrivacyPage />
        </React.Suspense>
        <ToastAndConfirmHost />
      </>
    );
  }

  if (route === "not_found") {
    return (
      <>
        <NotFoundPage />
        <ToastAndConfirmHost />
      </>
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
        <ToastAndConfirmHost />
      </>
    );
  }

  return (
    <>
      <StudioLayout />
      <StudioModals />
    </>
  );
};

export default App;
