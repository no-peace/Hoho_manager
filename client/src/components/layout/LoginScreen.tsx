import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Clock, Lock, ShieldCheck, X } from "lucide-react";
import gsap from "gsap";
import { HoHoLogoMark } from "./HoHoLogoMark";
import { PublicPageHeader } from "./PublicPageHeader";
import { SkiperDynamicStatusPill } from "../ui/CultSkiperPrimitives";
import { ShinyText, SpotlightCard, SplitTextReveal } from "../reactbits/ReactBitsPrimitives";
const ThreeHeroCanvas = React.lazy(() =>
  import("../reactbits/ThreeHeroCanvas").then((module) => ({ default: module.ThreeHeroCanvas })),
);

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_not_configured: "Discord login is not configured on the server. Please contact an administrator.",
  oauth_redirect_misconfigured: "The Discord callback URL is misconfigured. Please contact an administrator.",
  oauth_denied: "Discord authorization was cancelled or denied. You can try again.",
  invalid_oauth_state: "The login session expired or could not be verified. Please try again.",
  token_exchange_timeout: "Discord took too long to complete login. Please try again.",
  oauth_credentials_rejected: "Discord rejected the application credentials. Please contact an administrator.",
  token_exchange_failed: "Discord could not complete login. Please try again later.",
  token_exchange_invalid_response: "Discord returned an invalid login response. Please try again.",
  fetch_user_timeout: "Discord profile lookup timed out. Please try again.",
  fetch_user_failed: "Discord could not verify your profile. Please try signing in again.",
};

export { HoHoLogoMark };

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

export const LoginScreen: React.FC<{ authError?: string | null }> = ({ authError }) => {
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
    <div data-testid="login-screen-scroll-root" className="relative h-dvh w-full overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar bg-[#18191c] text-[#dbdee1] flex flex-col justify-between p-3.5 sm:p-6 lg:p-8 select-none">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden"><React.Suspense fallback={null}><ThreeHeroCanvas /></React.Suspense></div>
      <PublicPageHeader activePage="studio" />

      <main className="relative z-10 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-start lg:items-center my-2 lg:my-auto py-2 sm:py-6">
        <SpotlightCard className="lg:col-span-5 min-w-0 bg-[#2b2d31]/95 border border-[#26282d] rounded-xl p-4 sm:p-8 shadow-xl space-y-5 sm:space-y-6">
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
            <div role="alert" className="p-3 rounded-lg bg-[#da373c]/15 border border-[#da373c]/40 text-xs text-[#f28b8b] flex items-center gap-2">
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

        <SpotlightCard className="lg:col-span-7 min-w-0 bg-[#2b2d31]/95 border border-[#26282d] rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="bg-[#1e1f22] px-4 py-2.5 border-b border-[#111214] flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#949ba4]">
              #announcements  Preview
            </span>
            <div role="tablist" aria-label="Preview showcase modes" className="flex items-center gap-1 bg-[#111214] p-1 rounded-lg overflow-x-auto no-scrollbar max-w-full">
              {DEMO_SHOWCASES.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={activeShowcase === idx}
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

          <div className="p-3 sm:p-6 bg-[#313338] space-y-4">
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
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a href="/docs" className="hover:text-white transition-colors">Docs</a>
          <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="https://discord.gg/hohohub" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">HoHo Hub Discord</a>
        </div>
        <span className="sm:hidden">Discord OAuth2 sign-in</span>
      </footer>

    </div>
  );
};

export default LoginScreen;
