import React from "react";

export const HOHO_LOGO_URL = "/hoho_logo.svg";

export const HoHoLogoMark: React.FC<{ className?: string }> = ({ className = "h-8 w-8" }) => (
  <img
    src={HOHO_LOGO_URL}
    alt="HoHo Manager"
    width={36}
    height={36}
    decoding="async"
    fetchPriority="high"
    className={`${className} rounded-xl object-cover bg-[#1e1f22] border border-[#35373c] shadow-md shrink-0`}
  />
);

export default HoHoLogoMark;
