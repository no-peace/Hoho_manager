/**
 * HoHo Manager — Master UI/UX & Animation Configuration Engine
 *
 * Edit ANY token, button variant, input style, card surface, hit area, or
 * animation curve in this file to update the look and feel across the entire
 * application automatically.
 */

export const UI_THEME_CONFIG = {
  /**
   * 1. Core Color Tokens (Calibrated Discord Dark Studio Palette + WCAG AA Contrast)
   */
  colors: {
    bgObsidian: "#111214",
    bgCarbon: "#18191c",
    bgChrome: "#1e1f22",
    bgSlate: "#232428",
    bgPanel: "#2b2d31",
    bgCanvas: "#313338",
    bgHover: "#35373c",
    borderSubtle: "#1e1f22",
    borderDefault: "#26282d",
    borderStrong: "#35373c",
    textStrong: "#f2f3f5",
    textPrimary: "#dbdee1",
    textSecondary: "#b5bac1",
    textMuted: "#949ba4",
    accentBlurple: "#5865f2",
    accentBlurpleHover: "#4752c4",
    accentBlurpleText: "#949cf7", // 5.9:1 WCAG AA contrast on dark surfaces
    statusSuccess: "#23a55a",
    statusSuccessBright: "#57f287",
    statusWarning: "#f0b232",
    statusDanger: "#da373c",
    statusDangerText: "#f28b8b",
  },

  /**
   * 2. Button Configuration (Change here -> updates all <Button> & <IconButton> instances)
   * Incorporates:
   * - Solid Drawing in 3D (1px top inner specular highlight)
   * - Fitts's Law & Bigger Hit Areas (min-height & expanded touch target on icon buttons)
   * - Snappy Timing (75ms press scale to 0.97, never tween while held)
   */
  button: {
    base: "relative inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out shrink-0 select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2] focus-visible:ring-offset-1 focus-visible:ring-offset-[#18191c]",
    variants: {
      primary:
        "bg-[#5865f2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white border border-white/10 shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_2px_6px_rgba(0,0,0,0.28)]",
      secondary:
        "bg-[#2b2d31] hover:bg-[#35373c] active:bg-[#3f4147] text-[#dbdee1] hover:text-white border border-[#35373c] shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]",
      success:
        "bg-[#248046] hover:bg-[#1a6334] active:bg-[#15512a] text-white border border-white/10 shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_2px_6px_rgba(0,0,0,0.28)]",
      danger:
        "bg-[#da373c] hover:bg-[#b42831] active:bg-[#a12828] text-white border border-white/10 shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset]",
      ghost:
        "border border-transparent bg-transparent text-[#b5bac1] hover:bg-[#35373c]/70 hover:text-white",
      outline:
        "border border-[#35373c] bg-transparent text-[#dbdee1] hover:bg-[#2b2d31] hover:text-white",
    },
    sizes: {
      sm: "h-7 px-2.5 text-xs min-w-[44px]",
      md: "h-8 px-3.5 text-xs sm:text-sm min-w-[64px]",
      lg: "h-10 px-5 text-sm min-w-[80px]",
    },
    /** Fitts's Law: invisible 6px hit-area expansion around compact icon buttons */
    iconButtonBase:
      "relative inline-flex items-center justify-center rounded-lg p-1.5 transition-[transform,background-color,border-color,color,opacity] duration-150 ease-out active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2] after:content-[''] after:absolute after:-inset-1.5",
  },

  /**
   * 3. Form Fields & Inputs Configuration (Change here -> updates TextField, TextArea, Select, Checkbox)
   */
  field: {
    label:
      "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#949ba4] select-none",
    input:
      "w-full min-h-[36px] rounded-lg border border-[#111214] bg-[#1e1f22] px-3 py-1.5 text-xs sm:text-sm text-[#dbdee1] placeholder-[#949ba4] outline-none transition-colors duration-150 focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]/40 disabled:opacity-50",
    textarea:
      "w-full rounded-lg border border-[#111214] bg-[#1e1f22] px-3 py-2 text-xs sm:text-sm text-[#dbdee1] placeholder-[#949ba4] outline-none transition-colors duration-150 focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]/40 custom-scrollbar",
    selectTrigger:
      "flex w-full min-h-[36px] items-center justify-between rounded-lg border border-[#26282d] bg-[#18191c] px-3 py-2 text-xs text-[#f2f3f5] transition-colors hover:border-[#3f4147] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2] disabled:opacity-50",
    selectListbox:
      "absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[#26282d] bg-[#18191c] p-1 shadow-2xl custom-scrollbar",
    checkboxBoxChecked:
      "border-[#5865f2] bg-[#5865f2] text-white shadow-[0_0_8px_rgba(88,101,242,0.35)]",
    checkboxBoxUnchecked:
      "border-[#3f4147] bg-[#18191c] text-transparent group-hover:border-[#5865f2]/60",
  },

  /**
   * 4. Surfaces, Cards & Modals Configuration (Staging the Focus + Solid Drawing in 3D)
   */
  surfaces: {
    toolbarGroup: "inline-flex items-center gap-1 rounded-lg bg-[#111214] p-1 border border-[#26282d]",
    sectionCard: "rounded-xl bg-[#1e1f22] border border-[#26282d] p-3.5 space-y-3",
    accordionHeader: "flex items-center justify-between h-10 px-3 bg-[#232428] select-none",
    emptyState: "rounded-xl border border-dashed border-[#35373c] bg-[#1e1f22]/60 p-6 text-center text-xs text-[#949ba4]",
    kbd: "inline-flex items-center justify-center rounded border border-[#35373c] bg-[#111214] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#b5bac1] shadow-[0_1px_0_0_#26282d]",
    appShell: "flex h-dvh flex-col bg-[#313338] text-[#dbdee1] font-sans overflow-hidden",
    headerBar:
      "sticky top-0 left-0 z-20 bg-[#1e1f22]/95 backdrop-blur-md border-b border-[#111214] shadow-md w-full px-3 sm:px-4 h-12 flex items-center justify-between font-sans shrink-0",
    editorCardActive:
      "rounded-xl bg-[#292b2f] border border-[#5865f2] shadow-[0_0_0_1px_#5865f2,0_8px_24px_rgba(0,0,0,0.32)] transition-[border-color,box-shadow,opacity] duration-150 ease-out",
    editorCardInactive:
      "rounded-xl bg-[#292b2f] border border-[#1e1f22] hover:border-[#383a40] opacity-95 hover:opacity-100 transition-[border-color,box-shadow,opacity] duration-150 ease-out",
    editorSubSection:
      "rounded-lg border border-[#1e1f22] bg-[#232428] overflow-hidden",
    modalBackdrop:
      "fixed inset-0 flex items-end justify-center bg-black/75 backdrop-blur-sm p-0 sm:items-center sm:p-4",
    modalPanel:
      "w-full rounded-t-2xl sm:rounded-xl bg-[#313338] border border-[#26282d] border-t-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] mt-auto sm:my-auto outline-none",
    modalHeader:
      "flex items-center justify-between px-5 py-3.5 border-b border-[#1e1f22] bg-[#2b2d31] shrink-0",
    modalFooter:
      "px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3 border-t border-[#1e1f22] bg-[#2b2d31] flex justify-end gap-2.5 shrink-0",
    badgeBlurple:
      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#5865f2]/20 text-[#949cf7] border border-[#5865f2]/40",
    badgeNeutral:
      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#1e1f22] text-[#949ba4] border border-[#2b2d31]",
  },

  /**
   * 5. Disney 12 Principles & UX Motion Curves (Pose-to-Pose + Snappy Timing + Exaggerated Feedback)
   */
  motion: {
    easeOut: [0.16, 1, 0.3, 1] as [number, number, number, number],
    easeInOut: [0.45, 0, 0.55, 1] as [number, number, number, number],
    easeExit: [0.4, 0, 1, 1] as [number, number, number, number],
    durations: {
      press: 0.075,
      enter: 0.165,
      exit: 0.13, // 20% shorter exits
      move: 0.22,
      staggerStep: 0.03, // 30ms row stagger (Follow Through)
      maxStaggerDelay: 0.18,
    },
    /** Disney Principle #1: Squash & Stretch on toggles/checkboxes */
    squashStretch: {
      scaleX: [1, 1.15, 0.95, 1],
      scaleY: [1, 0.88, 1.05, 1],
    },
    /** Disney Principle #10: Exaggerated Feedback shake on validation errors */
    validationShake: {
      x: [0, -6, 6, -4, 4, 0],
      transition: { duration: 0.32 },
    },
    /** Popover / Modal Pose-to-Pose keyframes */
    popoverPoses: {
      initial: { opacity: 0, scale: 0.95, y: -4 },
      animate: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { duration: 0.165, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
      },
      exit: {
        opacity: 0,
        scale: 0.95,
        y: -4,
        transition: { duration: 0.13, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
      },
    },
  },
} as const;

export type UiButtonVariant = keyof typeof UI_THEME_CONFIG.button.variants;
export type UiButtonSize = keyof typeof UI_THEME_CONFIG.button.sizes;

export default UI_THEME_CONFIG;
