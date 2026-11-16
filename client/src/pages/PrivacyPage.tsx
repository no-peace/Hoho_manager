import React, { useEffect } from "react";
import { ShieldCheck, Lock, Clock, Database } from "lucide-react";
import { PublicPageHeader } from "../components/layout/PublicPageHeader";
import { updatePageSeo } from "../utils/seo";
import { SplitTextReveal, SpotlightCard } from "../components/reactbits/ReactBitsPrimitives";

export const PrivacyPage: React.FC = () => {
  useEffect(() => {
    updatePageSeo({
      title: "Privacy & Data Policy — HoHo Manager",
      description: "How HoHo Manager uses Discord OAuth2, protects sessions, and handles saved message backups.",
      path: "/privacy",
      schemaType: "TechArticle",
    });
  }, []);

  return (
    <div className="h-dvh w-full overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar bg-[#0B0D12] text-[#F1F3F9] font-sans">
      <PublicPageHeader activePage="privacy" />
      <main id="main-content" className="mx-auto max-w-4xl space-y-8 px-4 py-6 pb-16 sm:px-8 sm:py-10">

        <section className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#23a55a]/30 bg-[#23a55a]/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#34D399]">
            <ShieldCheck size={13} /> Privacy &amp; Data Policy
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            <SplitTextReveal text="Privacy & Data Handling" />
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#A1A8B8]">
            HoHo Manager uses Discord sign-in to identify your account and check server membership. This page describes the data handling implemented by the application.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="space-y-2 rounded-xl border border-[#272D3A] bg-[#161A23] p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A78BFA]">
              <Lock size={14} /> Discord OAuth2 &amp; Sessions
            </h2>
            <p className="text-xs leading-relaxed text-[#A1A8B8]">
              Sign-in requests the Discord <code className="text-white">identify</code> and <code className="text-white">guilds</code> scopes. The OAuth access token is used only during the server-side sign-in callback to retrieve your Discord profile and server list. It is not written to the application database or retained in the session; the application instead issues a signed, HttpOnly session cookie with a 24-hour lifetime.
            </p>
          </section>

          <SpotlightCard className="space-y-2 rounded-xl border border-[#272D3A] bg-[#161A23] p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#34D399]">
              <Database size={14} /> Account &amp; Workspace Data
            </h2>
            <p className="text-xs leading-relaxed text-[#A1A8B8]">
              The server stores the Discord account details needed to identify users and enforce staff permissions. Saved message templates and tracking records are stored by the application for workspace features. Custom bot-profile token management is not currently available in the active send workflow.
            </p>
          </SpotlightCard>

          <SpotlightCard className="space-y-2 rounded-xl border border-[#272D3A] bg-[#161A23] p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f0b232]">
              <Clock size={14} /> Backup Retention
            </h2>
            <p className="text-xs leading-relaxed text-[#A1A8B8]">
              New saved backups default to a 14-day expiry. The backup interface allows an expiry date to be changed or disabled. Tracked messages can also be assigned an expiry or left without one.
            </p>
          </SpotlightCard>

          <SpotlightCard className="space-y-2 rounded-xl border border-[#272D3A] bg-[#161A23] p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A78BFA]">
              <ShieldCheck size={14} /> Access &amp; Security
            </h2>
            <p className="text-xs leading-relaxed text-[#A1A8B8]">
              Staff permissions are checked by the server. Session cookies are HttpOnly and are not readable by frontend JavaScript. HoHo Manager does not require advertising or analytics cookies for its core workspace.
            </p>
          </SpotlightCard>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#272D3A] pt-6 text-xs text-[#A1A8B8]">
          <span>HoHo Hub • HoHo Manager</span>
          <nav aria-label="Footer links" className="flex flex-wrap items-center gap-4">
            <a href="/" className="transition-colors hover:text-white">Studio</a>
            <a href="/docs" className="transition-colors hover:text-white">Docs</a>
            <a href="https://discord.gg/hohohub" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Discord Support</a>
          </nav>
        </footer>
      </main>
    </div>
  );
};

export default PrivacyPage;