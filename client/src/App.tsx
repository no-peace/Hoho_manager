import React, { useEffect } from "react";
import { NotFoundPage } from "./pages/NotFoundPage";
import { LoginScreen } from "./components/layout/LoginScreen";
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

const RouteSkeleton: React.FC = () => (
  <div className="min-h-[100dvh] w-full bg-[#18191c] p-6 text-[#dbdee1] font-sans">
    <div className="mx-auto flex min-h-[80dvh] max-w-5xl flex-col justify-center gap-6 animate-pulse">
      <div className="h-10 w-52 rounded-lg bg-[#2b2d31]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-2xl bg-[#232428]" />
        <div className="h-64 rounded-2xl bg-[#232428]" />
      </div>
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
        <React.Suspense fallback={<RouteSkeleton />}>
          <DocsPage />
        </React.Suspense>
        <ToastAndConfirmHost />
      </>
    );
  }

  if (route === "privacy") {
    return (
      <>
        <React.Suspense fallback={<RouteSkeleton />}>
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
    return <RouteSkeleton />;
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
