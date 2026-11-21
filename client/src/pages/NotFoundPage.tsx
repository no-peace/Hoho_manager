import React from "react";
import { StudioLink } from "../components/layout/StudioRouter";
import { ArrowLeft, BookOpen, ShieldCheck, Terminal } from "lucide-react";
import { HOHO_LOGO_URL } from "../components/layout/HoHoLogoMark";

export const NotFoundPage: React.FC = () => {
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "/unknown";

  return (
    <div className="h-dvh w-full overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar bg-[#1D2230] text-[#F1F3F9] flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      <div className="relative isolate overflow-hidden w-full max-w-md space-y-5 rounded-[12px] border border-[#272D3A] bg-[#161A23] p-6 text-center shadow-xl sm:p-8">
        <img
          src={HOHO_LOGO_URL}
          alt="HoHo Manager"
          width={64}
          height={64}
          decoding="async"
          className="relative mx-auto h-16 w-16 rounded-xl border border-[#818CF8]/50 object-cover shadow-lg"
        />

        <div className="space-y-1.5">
          <div className="inline-block items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F87171]/10 border border-[#F87171]/30 text-[#F87171] text-[11px] font-bold uppercase tracking-wider">
            Error 404 • Route Not Found
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Lost in the Grand Line?
          </h1>
          <p className="text-xs sm:text-sm text-[#A1A8B8] max-w-md mx-auto leading-relaxed">
            The page you requested does not exist in HoHo Manager Studio or may have been moved.
          </p>
        </div>

        <div className="bg-[#1D2230] border border-[#10131A] rounded-lg px-3.5 py-2.5 flex items-center justify-between text-left font-mono text-xs">
          <span className="flex items-center gap-2 text-[#A1A8B8] truncate">
            <Terminal size={14} className="text-[#818CF8] shrink-0" />
            <span className="truncate">{currentPath}</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161A23] text-[#f0b232] shrink-0 ml-2">
            HTTP 404
          </span>
        </div>

        <nav aria-label="Helpful pages" className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <StudioLink to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#818CF8] hover:bg-[#6366F1] text-white text-xs font-bold active:scale-[0.97] transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out shadow-sm"
          >
            <ArrowLeft size={15} /> Back to Message Studio
          </StudioLink>
          <StudioLink to="/docs"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#252B3A] hover:bg-[#404249] text-[#F1F3F9] hover:text-white text-xs font-semibold active:scale-[0.97] transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out"
          >
            <BookOpen size={15} /> View Documentation
          </StudioLink>
        <StudioLink to="/privacy"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#252B3A] hover:bg-[#404249] text-[#F1F3F9] hover:text-white text-xs font-semibold active:scale-[0.97] transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out"
          >
            <ShieldCheck size={15} /> Privacy Policy
          </StudioLink>
        </nav>
      </div>
    </div>
  );
};

export default NotFoundPage;