import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { IconComponent } from "./icon";
import { UI_THEME_CONFIG } from "../../config/uiThemeConfig";

/**
 * Button.
 *
 * One component with variants rather than several near-identical ones, so the
 * look stays consistent everywhere. The styling mirrors Discohook's own Button:
 * rounded-lg, ~32px tall, a hairline light border, and blurple as the only
 * saturated accent.
 */

const BASE = UI_THEME_CONFIG.button.base;
const VARIANTS = UI_THEME_CONFIG.button.variants;
export type ButtonVariant = keyof typeof VARIANTS;
const SIZES = UI_THEME_CONFIG.button.sizes;

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
      Icon && <Icon size={size === "xs" || size === "sm" ? 13 : 15} aria-hidden="true" />
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
      UI_THEME_CONFIG.button.iconButtonBase,
      VARIANTS[variant],
      className,
    ].join(" ")}
    {...props}
  >
    <Icon size={size} aria-hidden="true" />
  </button>
);

export default Button;
