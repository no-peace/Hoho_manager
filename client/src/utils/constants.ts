/**
 * Client-side constants.
 *
 * Everything structural (component ids, limits, flags) comes from the shared
 * package so the frontend and backend can never disagree about the wire format.
 * Only presentation concerns are declared here.
 */
export * from "@dmb/shared";

/** Circular, sortable, collision-resistant enough for editor keys. */
export const uid = (): string => Math.random().toString(36).slice(2, 10);

export interface ColorPreset {
  name: string;
  value: number;
}

/** Embed accent presets shown in the colour picker. */
export const EMBED_COLOR_PRESETS: readonly ColorPreset[] = [
  { name: "Blurple", value: 0x5865f2 },
  { name: "Green", value: 0x57f287 },
  { name: "Yellow", value: 0xfee75c },
  { name: "Red", value: 0xed4245 },
  { name: "Fuchsia", value: 0xeb459e },
  { name: "Aqua", value: 0x1abc9c },
  { name: "Orange", value: 0xe67e22 },
  { name: "Dark", value: 0x2b2d31 },
];

export const DEFAULT_EMBED_COLOR = 0x5865f2;

/**
 * How a message is delivered.
 * - `webhook` may be sent straight from the browser.
 * - `bot` must go through `/api/send` so the token stays server-side.
 */
export const SEND_MODES = {
  WEBHOOK: "webhook",
  BOT: "bot",
} as const;

export type SendModeValue = (typeof SEND_MODES)[keyof typeof SEND_MODES];

/** Editor surface modes. V2 is the modern default; classic is the legacy path. */
export const EDITOR_MODES = {
  CLASSIC: "classic",
  V2: "v2",
} as const;

export type EditorMode = (typeof EDITOR_MODES)[keyof typeof EDITOR_MODES];

/** Human labels for button styles, used by the property panel. */
export const BUTTON_STYLE_LABELS: Record<number, string> = {
  1: "Primary (blurple)",
  2: "Secondary (grey)",
  3: "Success (green)",
  4: "Danger (red)",
  5: "Link",
  6: "Premium",
};
