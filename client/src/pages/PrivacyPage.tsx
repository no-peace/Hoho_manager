import React, { useEffect } from "react";
import { ArrowLeft, ShieldCheck, Lock, Clock, Database, BookOpen } from "lucide-react";
import { updatePageSeo } from "../utils/seo";
import { SpotlightCard, SplitTextReveal } from "../components/reactbits/ReactBitsPrimitives";

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
    <div className="min-h-screen bg-[#18191c] px-4 py-6 text-[#dbdee1] font-sans sm:px-8 sm:py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#26282d] pb-4">
          <a href="/" className="inline-flex items-center gap-2 rounded-lg border border-[#26282d] bg-[#232428] px-3 py-2 text-xs font-bold text-[#b5bac1] transition-all hover:text-white active:scale-[0.97]">
            <ArrowLeft size={14} /> Back to Studio
          </a>
          <a href="/docs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#949cf7] transition-colors hover:text-white">
            <BookOpen size={14} /> Documentation
          </a>
        </header>

        <section className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#23a55a]/30 bg-[#23a55a]/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#57f287]">
            <ShieldCheck size={13} /> Privacy &amp; Data Policy
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            <SplitTextReveal text="Privacy & Data Handling" />
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#b5bac1]">
            HoHo Manager uses Discord sign-in to identify your account and check server membership. This page describes the data handling implemented by the application.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SpotlightCard className="space-y-2 rounded-xl border border-[#26282d] bg-[#232428] p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#949cf7]">
              <Lock size={14} /> Discord OAuth2 &amp; Sessions
            </h2>
            <p className="text-xs leading-relaxed text-[#b5bac1]">
              Sign-in requests the Discord <code className="text-white">identify</code> and <code className="text-white">guilds</code> scopes. The OAuth access token is used by the server during sign-in to retrieve your profile and server list. The application then issues a signed, HttpOnly session cookie with a 24-hour lifetime.
            </p>
          </SpotlightCard>

          <SpotlightCard className="space-y-2 rounded-xl border border-[#26282d] bg-[#232428] p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#57f287]">
              <Database size={14} /> Account &amp; Workspace Data
            </h2>
            <p className="text-xs leading-relaxed text-[#b5bac1]">
              The server stores the Discord account details needed to identify users and enforce staff permissions. Saved message templates and tracking records are stored by the application for workspace features. Custom bot-profile token management is not currently available in the active send workflow.
            </p>
          </SpotlightCard>

          <SpotlightCard className="space-y-2 rounded-xl border border-[#26282d] bg-[#232428] p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f0b232]">
              <Clock size={14} /> Backup Retention
            </h2>
            <p className="text-xs leading-relaxed text-[#b5bac1]">
              New saved backups default to a 14-day expiry. The backup interface allows an expiry date to be changed or disabled. Tracked messages can also be assigned an expiry or left without one.
            </p>
          </SpotlightCard>

          <SpotlightCard className="space-y-2 rounded-xl border border-[#26282d] bg-[#232428] p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#949cf7]">
              <ShieldCheck size={14} /> Access &amp; Security
            </h2>
            <p className="text-xs leading-relaxed text-[#b5bac1]">
              Staff permissions are checked by the server. Session cookies are HttpOnly and are not readable by frontend JavaScript. HoHo Manager does not require advertising or analytics cookies for its core workspace.
            </p>
          </SpotlightCard>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#26282d] pt-6 text-xs text-[#949ba4]">
          <span>HoHo Hub • HoHo Manager</span>
          <nav aria-label="Footer links" className="flex flex-wrap items-center gap-4">
            <a href="/" className="transition-colors hover:text-white">Studio</a>
            <a href="/docs" className="transition-colors hover:text-white">Docs</a>
            <a href="https://discord.gg/hohohub" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Discord Support</a>
          </nav>
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPage;
