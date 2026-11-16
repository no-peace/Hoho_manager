import React from "react";
import { HoHoLogoMark } from "./HoHoLogoMark";
import { UI_THEME_CONFIG } from "../../config/uiThemeConfig";

export type PublicPage = "studio" | "docs" | "privacy";

export const PublicPageHeader: React.FC<{ activePage: PublicPage }> = ({ activePage }) => {
  const links: Array<{ page: PublicPage; label: string; href: string }> = [
    { page: "studio", label: "Studio", href: "/" },
    { page: "docs", label: "Documentation", href: "/docs" },
    { page: "privacy", label: "Privacy", href: "/privacy" },
  ];

  return (
    <header className={UI_THEME_CONFIG.surfaces.publicHeader}>
      <a href="/" className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        <HoHoLogoMark alt="" className="h-8 w-8" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight text-[#F1F3F9]">HoHo Manager</span>
          <span className="hidden text-[10px] leading-tight text-[#6F788A] sm:block">Discord Bot Message &amp; Components V2 Builder</span>
        </span>
      </a>
      <nav aria-label="Public navigation" className={UI_THEME_CONFIG.surfaces.publicNav}>
        {links.map(({ page, label, href }) => (
          <a
            key={page}
            href={href}
            aria-current={activePage === page ? "page" : undefined}
            className={`${UI_THEME_CONFIG.surfaces.publicNavItem} ${activePage === page ? UI_THEME_CONFIG.surfaces.publicNavActive : UI_THEME_CONFIG.surfaces.publicNavIdle}`}
          >
            {label}
          </a>
        ))}
      </nav>
      {activePage !== "studio" && (
        <a href="/" className="hidden shrink-0 items-center gap-1.5 rounded-md border border-[#272D3A] bg-[#1D2230] px-3 py-2 text-[11px] font-medium text-[#F1F3F9] transition-colors hover:border-[#818CF8]/50 hover:bg-[#252B3A] sm:inline-flex">
          Back to Studio
        </a>
      )}
    </header>
  );
};

export default PublicPageHeader;
