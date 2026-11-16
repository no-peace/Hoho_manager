import React from "react";
import { HoHoLogoMark } from "./HoHoLogoMark";

export type PublicPage = "studio" | "docs" | "privacy";

export const PublicPageHeader: React.FC<{ activePage: PublicPage }> = ({ activePage }) => {
  const links: Array<{ page: PublicPage; label: string; href: string }> = [
    { page: "studio", label: "Studio", href: "/" },
    { page: "docs", label: "Docs", href: "/docs" },
    { page: "privacy", label: "Privacy", href: "/privacy" },
  ];

  return (
    <header className="sticky top-0 z-50 flex min-h-14 items-center justify-between gap-1.5 border-b border-[#26282d] bg-[#18191c]/90 px-2 py-2 backdrop-blur-md sm:gap-3 sm:px-6">
      <a href="/" className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        <HoHoLogoMark alt="" className="h-8 w-8" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold leading-tight text-white">HoHo Manager</span>
          <span className="hidden text-[10px] leading-tight text-[#949ba4] sm:block">Discord Bot Message &amp; Components V2 Builder</span>
        </span>
      </a>
      <nav aria-label="Public navigation" className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        {links.map(({ page, label, href }) => (
          <a
            key={page}
            href={href}
            aria-current={activePage === page ? "page" : undefined}
            className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-[background-color,border-color,color] duration-150 sm:px-3 sm:py-2 sm:text-xs ${
              activePage === page
                ? "border-[#5865f2]/40 bg-[#5865f2]/15 text-white"
                : "border-transparent text-[#b5bac1] hover:border-[#26282d] hover:bg-[#232428] hover:text-white"
            }`}
          >
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
};

export default PublicPageHeader;
