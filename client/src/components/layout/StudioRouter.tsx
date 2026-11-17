import { useEffect, useState } from "react";
import { updatePageSeo } from "../../utils/seo";

export type StudioRouteKind = "studio" | "design" | "docs" | "privacy" | "not_found";

export const resolveStudioRoute = (pathname: string): StudioRouteKind => {
  if (pathname === "/design") return "design";
  if (pathname === "/docs") return "docs";
  if (pathname === "/privacy") return "privacy";
  if (
    pathname === "/" ||
    pathname === "" ||
    pathname === "/bots/webhook" ||
    pathname === "/studio"
  ) {
    return "studio";
  }
  return "not_found";
};

export const navigateTo = (path: string): void => {
  if (typeof window === "undefined") return;
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export const useStudioRoute = () => {
  const [pathname, setPathname] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/",
  );

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const route = resolveStudioRoute(pathname);
    if (route === "design") {
      updatePageSeo({
        title: "Design Lab — HoHo Manager",
        description: "Build responsive website layouts and reusable UI with the HoHo Manager visual design editor.",
        path: "/design",
        schemaType: "SoftwareApplication",
      });
    } else if (route === "docs") {
      updatePageSeo({
        title: "HoHo Manager Docs — Variables & Dynamic Tracking",
        description:
          "Complete reference for HoHo Manager dynamic variables, tracking, and interactive flows.",
        path: "/docs",
        schemaType: "TechArticle",
      });
    } else if (route === "privacy") {
      updatePageSeo({
        title: "Privacy & Data Policy — HoHo Manager",
        description:
          "How HoHo Manager uses Discord OAuth2, protects sessions, and handles saved message backups.",
        path: "/privacy",
        schemaType: "TechArticle",
      });
    } else {
      updatePageSeo({
        title: "HoHo Manager — Discord Bot Studio",
        description:
          "Visual Discord Bot Message, Embed, Components V2, and Dynamic Placeholder Studio for HoHo Hub.",
        path: "/",
        schemaType: "SoftwareApplication",
      });
    }
  }, [pathname]);

  return {
    pathname,
    route: resolveStudioRoute(pathname),
    navigateTo,
  };
};
