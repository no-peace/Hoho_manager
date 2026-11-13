import React from "react";
import { ArrowLeft, BookOpen, ShieldCheck, Terminal } from "lucide-react";
import { HOHO_LOGO_URL } from "../components/layout/Header";
import { SpotlightCard } from "../components/reactbits/ReactBitsPrimitives";

export const NotFoundPage: React.FC = () => {
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "/unknown";

  return (
    <div className="min-h-screen bg-[#1e1f22] text-[#dbdee1] flex flex-col items-center justify-center p-6 select-none">
      {/* Ambient background glow */
      /*<div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-[#5865f2]/10 blur-3xl" />*/}
      <SpotlightCard className="w-full max-w-md space-y-5 rounded-2xl border border-[#35373c] bg-[#2b2d31] p-6 text-center shadow-xl sm:p-8">
        <img
          src={HOHO_LOGO_URL}
          alt="HoHo Manager"
          width={64}
          height={64}
          decoding="async"
          className="relative mx-auto h-16 w-16 rounded-xl border border-[#5865f2]/50 object-cover shadow-lg"
        />

        <div className="space-y-1.5">
          <div className="inline-block items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#da373c]/15 border border-[#da373c]/30 text-[#f28b8b] text-[11px] font-bold uppercase tracking-wider">
            Error 404 • Route Not Found
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Lost in the Grand Line?
          </h1>
          <p className="text-xs sm:text-sm text-[#949ba4] max-w-md mx-auto leading-relaxed">
            The page you requested does not exist in HoHo Manager Studio or may have been moved.
          </p>
        </div>

        <div className="bg-[#1e1f22] border border-[#111214] rounded-lg px-3.5 py-2.5 flex items-center justify-between text-left font-mono text-xs">
          <span className="flex items-center gap-2 text-[#949ba4] truncate">
            <Terminal size={14} className="text-[#5865f2] shrink-0" />
            <span className="truncate">{currentPath}</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2b2d31] text-[#f0b232] shrink-0 ml-2">
            HTTP 404
          </span>
        </div>

        <nav aria-label="Helpful pages" className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <a
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold active:scale-[0.97] transition-all shadow-sm"
          >
            <ArrowLeft size={15} /> Back to Message Studio
          </a>
          <a
            href="/docs"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#35373c] hover:bg-[#404249] text-[#dbdee1] hover:text-white text-xs font-semibold active:scale-[0.97] transition-all"
          >
            <BookOpen size={15} /> View Documentation
          </a>
        <a
            href="/privacy"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#35373c] hover:bg-[#404249] text-[#dbdee1] hover:text-white text-xs font-semibold active:scale-[0.97] transition-all"
          >
            <ShieldCheck size={15} /> Privacy Policy
          </a>
        </nav>
      </SpotlightCard>
    </div>
  );
};

export default NotFoundPage;