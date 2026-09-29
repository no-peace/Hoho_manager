import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { IconComponent } from "./icon";

/**
 * Button.
 *
 * One component with variants rather than several near-identical ones, so the
 * look stays consistent everywhere. The styling mirrors Discohook's own Button:
 * rounded-lg, ~32px tall, a hairline light border, and blurple as the only
 * saturated accent.
 */

const BASE =
  "relative inline-flex items-center justify-center gap-1.5 border border-white/[0.08] rounded-lg font-medium transition shrink-0 disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS = {
  primary: "bg-blurple-500 hover:bg-blurple-600 active:bg-blurple-700 text-white",
  secondary:
    "bg-[#97979f1f] hover:bg-[#97979f33] active:bg-[#50505a4d] text-[#ebebed] border-[#97979f0a]",
  success: "bg-[#00863a] hover:bg-[#047e37] active:bg-[#057332] text-white",
  danger: "bg-[#d22d39] hover:bg-[#b42831] active:bg-[#a4232c] text-white",
  ghost: "border-transparent bg-transparent text-ink-muted hover:bg-hover hover:text-ink",
  outline: "border-line bg-transparent text-ink hover:bg-hover",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

const SIZES = {
  sm: "h-7 px-2.5 text-xs min-w-[44px]",
  md: "h-8 px-4 text-sm min-w-[60px]",
  lg: "h-9 px-5 text-sm min-w-[60px]",
} as const;

export type ButtonSize = keyof typeof SIZES;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: IconComponent;
  children?: ReactNode;
}

export const Button = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  className = "",
  type = "button",
  ...props
}: ButtonProps) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={[BASE, VARIANTS[variant], SIZES[size], className].join(" ")}
    {...props}
  >
    {loading ? (
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
    ) : (
      Icon && <Icon size={size === "sm" ? 13 : 15} aria-hidden="true" />
    )}
    {children}
  </button>
);

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconComponent;
  label: string;
  variant?: ButtonVariant;
  size?: number;
}

/** Square icon-only button, for toolbars and list rows. */
export const IconButton = ({
  icon: Icon,
  label,
  variant = "ghost",
  size = 15,
  className = "",
  ...props
}: IconButtonProps) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    className={[
      "inline-flex items-center justify-center rounded-lg p-1.5 transition-colors",
      "disabled:cursor-not-allowed disabled:opacity-40",
      VARIANTS[variant],
      className,
    ].join(" ")}
    {...props}
  >
    <Icon size={size} aria-hidden="true" />
  </button>
);

export default Button;
