import React, { useEffect, useState } from "react";
import { Activity, AlertCircle, ArrowRight, Blocks, Clock, Lock, ShieldCheck, Workflow, X } from "lucide-react";
import { HoHoLogoMark } from "./HoHoLogoMark";
import { PublicPageHeader } from "./PublicPageHeader";

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
      { label: "Claim Role", style: "bg-[#16803c] text-white" },
    ],
  },
] as const;

export const LoginScreen: React.FC<{ authError?: string | null }> = ({ authError }) => {
  const [activeShowcase, setActiveShowcase] = useState<number>(0);
  const [clickedBtn, setClickedBtn] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveShowcase((previous) => (previous + 1) % DEMO_SHOWCASES.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  const currentDemo = DEMO_SHOWCASES[activeShowcase];

  return (
    <div
      data-testid="login-screen-scroll-root"
      className="relative isolate h-dvh w-full overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar bg-[#0B0D12] text-[#F1F3F9] flex flex-col select-none"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.035]" style={{
          backgroundImage: "linear-gradient(rgba(161,168,184,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(161,168,184,.35) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
        <div className="absolute inset-x-0 top-0 h-[560px]" style={{
          backgroundImage: "radial-gradient(circle at 50% 0%, rgba(129, 140, 248, 0.09), transparent 62%)",
        }} />
      </div>

      <PublicPageHeader activePage="studio" />

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-12 lg:gap-8 lg:px-8">
        <section className="min-w-0 space-y-6 lg:col-span-7">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <HoHoLogoMark className="h-12 w-12 rounded-[10px] border border-[#272D3A] shadow-lg" />
              <div className="space-y-1">
                <div className="text-sm font-semibold tracking-tight text-[#F1F3F9]">HoHo Manager</div>
                <span className="inline-flex rounded-md border border-[#818CF8]/30 bg-[#818CF8]/10 px-2 py-0.5 font-mono text-[10px] font-medium text-[#A5B4FC]">
                  v2.4 Studio
                </span>
              </div>
            </div>

            <div className="max-w-2xl space-y-3">
              <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] text-[#F1F3F9] sm:text-[40px]">
                Build Discord messages with precision.
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-[#A1A8B8] sm:text-[15px]">
                A focused workspace for Components V2, interactive message flows, and live status-driven updates.
                Design once, inspect the Discord output, and dispatch with confidence.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                { icon: Blocks, title: "Components V2 Visual Studio", detail: "Compose containers, sections, media and action rows." },
                { icon: Workflow, title: "Multi-Step Interaction Flows", detail: "Build button, select and modal workflows." },
                { icon: Activity, title: "Live WEAO & Tracking Sync", detail: "Keep status cards and tracked messages current." },
              ].map(({ icon: Icon, title, detail }) => (
                <div key={title} className="flex min-w-0 items-start gap-3 rounded-[10px] border border-[#202531] bg-[#10131A]/80 p-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#818CF8]/10 text-[#A5B4FC]">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-semibold text-[#F1F3F9]">{title}</div>
                    <p className="text-[11px] leading-relaxed text-[#6F788A]">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <section className="overflow-hidden rounded-[10px] border border-[#272D3A] bg-[#161A23] shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#202531] bg-[#10131A] px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#F1F3F9]">
                <span className="h-2 w-2 rounded-full bg-[#34D399]" aria-hidden="true" />
                Live Discord Preview
              </div>
              <div role="tablist" aria-label="Preview showcase modes" className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[8px] border border-[#272D3A] bg-[#0B0D12] p-1 no-scrollbar">
                {DEMO_SHOWCASES.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={activeShowcase === index}
                    onClick={() => {
                      setActiveShowcase(index);
                      setClickedBtn(null);
                    }}
                    className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-colors ${activeShowcase === index
                      ? "bg-[#818CF8]/15 text-[#F1F3F9]"
                      : "text-[#6F788A] hover:bg-[#252B3A] hover:text-[#F1F3F9]"
                    }`}
                  >
                    {item.tabLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#313338] p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <HoHoLogoMark className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[#f2f3f5]">HoHo Bot</span>
                    <span className="rounded bg-[#5865f2] px-1.5 py-0.5 text-[10px] font-semibold text-white">APP</span>
                    <span className="text-[11px] text-[#949ba4]">Today at 12:00 PM</span>
                  </div>
                  <div
                    className="space-y-3 rounded-[8px] border border-[#1e1f22] bg-[#2b2d31] p-3 sm:p-4"
                    style={{ borderLeftWidth: 4, borderLeftColor: currentDemo.accent }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span data-showcase-badge className="rounded bg-[#1e1f22] px-2 py-1 font-mono text-[9px] font-medium text-[#dbdee1]">
                        {currentDemo.badge}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#3f4147] bg-[#1e1f22] px-2 py-1 text-[9px] font-medium text-[#dbdee1]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" aria-hidden="true" />
                        Bot Dispatch
                      </span>
                    </div>
                    <h2 data-showcase-title className="text-sm font-semibold text-[#f2f3f5]">{currentDemo.title}</h2>
                    <p className="text-xs leading-relaxed text-[#dbdee1]">{currentDemo.description}</p>
                    <div data-showcase-actions className="flex flex-wrap items-center gap-2 pt-1">
                      {currentDemo.buttons.map((button) => (
                        <button
                          key={button.label}
                          type="button"
                          onClick={() => setClickedBtn(button.label)}
                          className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${button.style}`}
                        >
                          {button.label}
                        </button>
                      ))}
                    </div>
                    {clickedBtn && (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-[#3f4147] bg-[#1e1f22] p-2.5 text-[11px] text-[#dbdee1]">
                        <span>Action triggered: <strong>{clickedBtn}</strong></span>
                        <button type="button" onClick={() => setClickedBtn(null)} className="text-[#949ba4] hover:text-white" aria-label="Dismiss action feedback">
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>

        <aside className="min-w-0 lg:col-span-5">
          <div className="rounded-[12px] border border-[#272D3A] bg-[#161A23] p-5 shadow-2xl sm:p-7">
            <div className="mb-6 space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[#34D399]/25 bg-[#34D399]/10 px-2 py-1 text-[10px] font-medium text-[#34D399]">
                <ShieldCheck size={12} aria-hidden="true" /> SECURE DISCORD AUTHENTICATION
              </span>
              <h2 className="text-xl font-semibold tracking-tight text-[#F1F3F9]">Continue to your workspace</h2>
              <p className="text-xs leading-relaxed text-[#A1A8B8]">
                Sign in with Discord to verify your account, shared servers, and staff access before opening the message studio.
              </p>
            </div>

            {authError && (
              <div role="alert" className="mb-4 flex items-start gap-2 rounded-[8px] border border-[#F87171]/30 bg-[#F87171]/10 p-3 text-xs leading-relaxed text-[#FCA5A5]">
                <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{AUTH_ERROR_MESSAGES[authError] ?? "Login could not be completed. Please try again."}</span>
              </div>
            )}

            <button
              type="button"
              aria-label="Login with Discord"
              disabled={isRedirecting}
              onClick={() => {
                setIsRedirecting(true);
                window.location.href = "/api/auth/discord/login";
              }}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[8px] border border-[#818CF8]/70 bg-[#818CF8] px-4 text-sm font-semibold text-[#0B0D12] shadow-sm transition-colors hover:bg-[#6366F1] active:bg-[#4F46E5] disabled:cursor-wait disabled:opacity-70"
            >
              {isRedirecting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              ) : (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.08-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" />
                </svg>
              )}
              <span>{isRedirecting ? "Redirecting to Discord…" : "Continue with Discord"}</span>
              {!isRedirecting && <ArrowRight size={15} aria-hidden="true" />}
            </button>

            <div className="mt-5 space-y-3 border-t border-[#202531] pt-4">
              <div className="flex items-start gap-2.5 text-xs leading-relaxed text-[#A1A8B8]">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#34D399]" aria-hidden="true" />
                <span><strong className="font-medium text-[#F1F3F9]">Mutual-guild & role checks.</strong> Staff permissions are verified by the server on protected requests.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs leading-relaxed text-[#A1A8B8]">
                <Clock size={15} className="mt-0.5 shrink-0 text-[#60A5FA]" aria-hidden="true" />
                <span><strong className="font-medium text-[#F1F3F9]">24-hour session expiry.</strong> Sessions expire automatically and use a secure HttpOnly cookie.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs leading-relaxed text-[#A1A8B8]">
                <Lock size={15} className="mt-0.5 shrink-0 text-[#A78BFA]" aria-hidden="true" />
                <span><strong className="font-medium text-[#F1F3F9]">Workspace backups.</strong> Save, restore, import, and export message configurations.</span>
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] text-[#6F788A]">
              By continuing, you authorize HoHo Manager to verify your Discord identity and mutual servers.
            </p>
          </div>
        </aside>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-[#202531] px-4 py-4 text-[11px] text-[#6F788A] sm:px-6 lg:px-8">
        <span>HoHo Manager · Discord Components V2 Studio</span>
        <div className="flex flex-wrap items-center gap-4">
          <a href="/docs" className="transition-colors hover:text-[#F1F3F9]">Documentation</a>
          <a href="/privacy" className="transition-colors hover:text-[#F1F3F9]">Privacy Policy</a>
          <a href="https://discord.gg/hohohub" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#F1F3F9]">HoHo Hub Discord</a>
        </div>
      </footer>
    </div>
  );
};

export default LoginScreen;
