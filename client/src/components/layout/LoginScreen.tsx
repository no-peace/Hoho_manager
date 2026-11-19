import React, { useEffect, useState } from "react";
import { AlertCircle, Clock, Lock, ShieldCheck, X } from "lucide-react";
import { HoHoLogoMark } from "./HoHoLogoMark";
import { api } from "../../api/client";
import { PublicPageHeader } from "./PublicPageHeader";
import { SpotlightCard } from "../reactbits/ReactBitsPrimitives";

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
    accent: "#818CF8",
    description:
      "Build nested V2 Containers, Thumbnails, Media Galleries, Separators, and interactive Action Rows.",
    buttons: [
      { label: "Read Changelog", style: "bg-[#818CF8] text-[#10131A]" },
      { label: "Verify Role", style: "bg-[#16803c] text-white" },
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
      { label: "Check Status", style: "bg-[#252B3A] text-[#F1F3F9]" },
      { label: "Open Support Ticket", style: "bg-[#818CF8] text-[#10131A]" },
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
      { label: "Submit Application", style: "bg-[#818CF8] text-[#10131A]" },
      { label: "Claim Role", style: "bg-[#16803c] text-white" },
    ],
  },
] as const;

export const LoginScreen: React.FC<{ authError?: string | null }> = ({ authError }) => {
  const [activeShowcase, setActiveShowcase] = useState<number>(0);
  const [clickedBtn, setClickedBtn] = useState<string | null>(null);
  const [devLoginError, setDevLoginError] = useState<string | null>(null);
  const [devLoginLoading, setDevLoginLoading] = useState(false);

  useEffect(() => {
    // Keep the compact mobile login experience static; the tabs remain interactive.
    // Automatic showcase rotation is only useful on larger screens and can add
    // avoidable main-thread work during mobile rendering.
    const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isNarrowScreen = window.matchMedia("(max-width: 767px)").matches;
    if (isReducedMotion || isNarrowScreen) return;

    const timer = window.setInterval(() => {
      setActiveShowcase((prev) => (prev + 1) % DEMO_SHOWCASES.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  const currentDemo = DEMO_SHOWCASES[activeShowcase];

  return (
    <div data-testid="login-screen-scroll-root" className="hoho-studio-backdrop relative h-dvh w-full overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar text-[#F1F3F9] flex flex-col justify-between">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true"><div className="hoho-studio-grid-overlay absolute inset-0" /><div className="hoho-grid-beam-x top-[192px] left-0 opacity-60" /><div className="hoho-grid-beam-y left-[288px] top-0 opacity-60" /></div>
      <PublicPageHeader activePage="studio" />

      <div className="relative z-10 flex flex-1 flex-col justify-between px-3.5 py-5 sm:px-6 sm:py-8 lg:px-8">
      <main className="relative z-10 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-stretch lg:items-stretch my-2 lg:my-auto py-2 sm:py-6">
        <SpotlightCard className="lg:col-span-5 min-w-0 rounded-2xl h-full"><div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[#222734] bg-[#11141B]/95 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.55)] sm:p-7 space-y-5 sm:space-y-6"><div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#818CF8]/60 to-transparent" aria-hidden="true" />
          <div className="space-y-2">
            <span className="inline-block px-2 py-0.5 rounded bg-[#818CF8]/15 border border-[#818CF8]/30 text-[#dee0fc] text-[0.6875rem] font-semibold uppercase tracking-wider">
              COMPONENTS V2 & DYNAMIC TRACKING
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              HoHo Manager Studio
            </h1>
            <p className="text-xs sm:text-sm text-[#A1A8B8] leading-relaxed">
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
            className="w-full min-h-[46px] py-2.5 px-4 rounded-lg bg-[#5865F2] text-white hover:bg-[#4752C4] active:bg-[#3C45A5] font-semibold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.08-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" />
            </svg>
            <span>Login with Discord</span>
          </button>

          {import.meta.env.DEV && (
            <div className="space-y-2">
              <button
                type="button"
                disabled={devLoginLoading}
                onClick={async () => {
                  setDevLoginLoading(true);
                  setDevLoginError(null);
                  try {
                    await api.auth.devLogin();
                    window.location.reload();
                  } catch (error) {
                    setDevLoginError(error instanceof Error ? error.message : "Local developer login failed.");
                    setDevLoginLoading(false);
                  }
                }}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-lg border border-[#57f287]/40 bg-[#57f287]/10 hover:bg-[#57f287]/15 disabled:opacity-60 text-[#8ff0ad] font-semibold text-sm transition-colors cursor-pointer"
              >
                {devLoginLoading ? "Starting local session…" : "Continue as Local Developer"}
              </button>
              <p className="text-[0.6875rem] text-[#A1A8B8] text-center">
                Development-only test account. Discord login remains available above.
              </p>
              {devLoginError && (
                <p role="alert" className="text-xs text-[#f28b8b] text-center">{devLoginError}</p>
              )}
            </div>
          )}

          <div className="space-y-2.5 rounded-xl border border-[#1D2230] bg-[#0B0E14] divide-y divide-[#1D2230] px-3.5 py-1">
            <div className="flex items-start gap-2.5 text-xs text-[#b5bac1]">
              <ShieldCheck size={15} className="text-[#57f287] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Mutual-Guild & Role Check:</strong>{" "}
                Verifies shared servers and active staff permissions on every request.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#b5bac1]">
              <Clock size={15} className="text-[#818CF8] shrink-0 mt-0.5" />
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
        </div></SpotlightCard>

        <SpotlightCard className="lg:col-span-7 min-w-0 rounded-2xl h-full"><div className="relative flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-2xl border border-[#222734] bg-[#11141B]/95 shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
          <div className="bg-[#0B0E14] px-4 py-2.5 border-b border-[#1D2230] flex items-center justify-between gap-3 min-w-0">
            <span className="text-xs font-bold text-[#A1A8B8]">
              #announcements  Preview
            </span>
            <div role="tablist" aria-label="Preview showcase modes" className="flex items-center gap-1 bg-[#10131A] p-1 rounded-lg overflow-x-auto no-scrollbar max-w-full whitespace-nowrap shrink-0">
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
                  className={`px-2.5 py-1 rounded text-[0.6875rem] font-bold transition-colors whitespace-nowrap shrink-0 ${activeShowcase === idx
                    ? "bg-[#5865F2] text-white"
                    : "text-[#A1A8B8] hover:text-white"
                    }`}
                >
                  {item.tabLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-3 sm:p-6 bg-[#1B1E26] space-y-4">
            <div className="flex items-start gap-3.5">
              <HoHoLogoMark className="h-10 w-10" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">HoHo Bot</span>
                  <span className="rounded bg-[#818CF8] px-1.5 py-0.5 text-[0.625rem] font-bold text-[#10131A]">
                    APP
                  </span>
                  <span className="text-xs text-[#A1A8B8]">Today at 12:00 PM</span>
                </div>

                <div
                  className="rounded-lg bg-[#2B2D31] border border-[#3A3D44] p-4 space-y-3 transition-[border-color,background-color,box-shadow] duration-150 ease-out"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor: currentDemo.accent,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span data-showcase-badge className="text-[0.625rem] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1B1E26] text-[#A1A8B8] whitespace-nowrap shrink-0">
                      {currentDemo.badge}
                    </span>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#1B1E26] border border-[#3A3D44] text-[0.625rem] font-bold uppercase tracking-wider text-[#F1F3F9] whitespace-nowrap shrink-0"><span className="h-2 w-2 rounded-full bg-[#57f287]" aria-hidden="true" />Bot Dispatch</div>
                  </div>

                  <h2 data-showcase-title className="text-base font-bold text-white">{currentDemo.title}</h2>
                  <p className="text-xs text-[#F1F3F9] leading-relaxed">
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
                    <div className="mt-2 p-2.5 rounded bg-[#1B1E26] border border-[#5865F2]/40 text-[0.6875rem] text-[#F1F3F9] flex items-center justify-between" role="status" aria-live="polite">
                      <span>
                        Only you can see this · Triggered &quot;{clickedBtn}&quot; flow
                      </span>
                      <button
                        type="button"
                        onClick={() => setClickedBtn(null)}
                        className="text-[#A1A8B8] hover:text-white"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div><div className="flex items-center justify-between gap-3 border-t border-[#1D2230] bg-[#0B0E14] px-4 py-2.5 text-[0.6875rem] font-mono text-[#6F788A]"><span className="min-w-0 truncate">Components V2 · Action Flows · Dynamic Variables</span><span className="shrink-0 text-[#34D399]">● Ready</span></div></div></SpotlightCard>
      </main>

      <footer className="relative z-10 max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 text-[0.6875rem] text-[#b5bac1] border-t border-[#272D3A] pt-4">
        <span>HoHo Manager • Discord Bot Message &amp; Components V2 Studio</span>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a href="/docs" className="hover:text-white transition-colors">Docs</a>
          <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="https://discord.gg/hohohub" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">HoHo Hub Discord</a>
        </div>
        <span className="sm:hidden">Discord OAuth2 sign-in</span>
      </footer>
      </div>

    </div>
  );
};

export default LoginScreen;
