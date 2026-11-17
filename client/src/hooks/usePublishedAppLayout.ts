import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultDesktopLayoutData, defaultMobileLayoutData } from "../config/puck/defaultAppLayouts";
import {
  getAppLayoutCssVariables,
  resolveAppLayoutData,
  type ResolvedAppLayout,
} from "../utils/puckAppLayout";
import { appLayoutApi, type PublishedAppLayout } from "../utils/appLayoutApi";

const builtInLayout = resolveAppLayoutData(defaultDesktopLayoutData, defaultMobileLayoutData);
const REFRESH_COOLDOWN_MS = 30_000;

interface RuntimeState {
  layout: ResolvedAppLayout;
  loaded: boolean;
  fallback: boolean;
  error: string | null;
  publishedRecord: PublishedAppLayout | null;
}

const initialState: RuntimeState = {
  layout: builtInLayout,
  loaded: false,
  fallback: true,
  error: null,
  publishedRecord: null,
};

export const usePublishedAppLayout = () => {
  const [state, setState] = useState<RuntimeState>(initialState);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 1200px)").matches,
  );
  const lastAttemptRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async (force = false): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;
    const now = Date.now();
    if (!force && now - lastAttemptRef.current < REFRESH_COOLDOWN_MS) return;
    lastAttemptRef.current = now;

    const task = (async () => {
      try {
        const response = await appLayoutApi.getPublished();
        if (!response.layout) {
          setState({
            layout: builtInLayout,
            loaded: true,
            fallback: true,
            error: null,
            publishedRecord: null,
          });
          return;
        }
        if (response.layout.schemaVersion !== 1) throw new Error("The published layout version is not supported.");
        const resolved = resolveAppLayoutData(response.layout.desktop, response.layout.mobile);
        setState({
          layout: resolved,
          loaded: true,
          fallback: Boolean(response.fallback),
          error: null,
          publishedRecord: response.layout,
        });
      } catch (error) {
        setState((current) => ({
          ...current,
          loaded: true,
          fallback: current.publishedRecord === null,
          error: error instanceof Error ? error.message : "Could not refresh the published layout.",
        }));
      }
    })();
    inFlightRef.current = task;
    try {
      await task;
    } finally {
      inFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1200px)");
    const updateMode = () => setIsDesktop(media.matches);
    updateMode();
    media.addEventListener("change", updateMode);
    return () => media.removeEventListener("change", updateMode);
  }, []);

  useEffect(() => {
    void refresh(true);
    const refreshWhenActive = () => { void refresh(false); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshWhenActive();
    };
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("pageshow", refreshWhenActive);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("pageshow", refreshWhenActive);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const cssVariables = useMemo(() => getAppLayoutCssVariables(state.layout), [state.layout]);
  const activeLayout = isDesktop ? state.layout.desktop : state.layout.mobile;

  return {
    layout: state.layout,
    activeLayout,
    isDesktop,
    cssVariables,
    isLoaded: state.loaded,
    isFallback: state.fallback,
    error: state.error,
    publishedRecord: state.publishedRecord,
    refresh,
  };
};
