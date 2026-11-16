import React from "react";
import { HoHoLogoMark } from "./HoHoLogoMark";
import { UI_THEME_CONFIG } from "../../config/uiThemeConfig";

export type PublicPage = "studio" | "docs" | "privacy";

export const PublicPageHeader: React.FC<{ activePage: PublicPage }> = ({ activePage }) => {
  const links: Array<{ page: PublicPage; label: string; href: string }> = [
    { page: "studio", label: "Studio", href: "/" },
    { page: "docs", label: "Docs", href: "/docs" },
    { page: "privacy", label: "Privacy", href: "/privacy" },
  ];

  return (
    <header className={UI_THEME_CONFIG.surfaces.publicHeader}>
      <a href="/" className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        <HoHoLogoMark alt="" className="h-8 w-8" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold leading-tight text-white">HoHo Manager</span>
          <span className="hidden text-[10px] leading-tight text-[#949ba4] sm:block">Discord Bot Message &amp; Components V2 Builder</span>
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
    </header>
  );
};

export default PublicPageHeader;
