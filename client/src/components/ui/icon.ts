import type { ComponentType, SVGProps } from "react";

/**
 * The shape of an icon component (anything from `lucide-react`).
 *
 * Declared structurally rather than importing `LucideIcon` by name, so a major
 * version of the icon library that renames its exported type cannot break the
 * build.
 */
export type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number | string }
>;
