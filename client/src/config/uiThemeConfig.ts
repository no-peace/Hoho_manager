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
    bgObsidian: "#0B0D12",
    bgCarbon: "#10131A",
    bgChrome: "#10131A",
    bgSlate: "#161A23",
    bgPanel: "#161A23",
    bgCanvas: "#0B0D12",
    bgHover: "#252B3A",
    borderSubtle: "#202531",
    borderDefault: "#272D3A",
    borderStrong: "#343C4E",
    textStrong: "#F1F3F9",
    textPrimary: "#F1F3F9",
    textSecondary: "#A1A8B8",
    textMuted: "#6F788A",
    accentBlurple: "#818CF8",
    accentBlurpleHover: "#6366F1",
    accentBlurpleText: "#A5B4FC",
    statusSuccess: "#34D399",
    statusSuccessBright: "#34D399",
    statusWarning: "#FBBF24",
    statusDanger: "#F87171",
    statusDangerText: "#FCA5A5",
  },

  /**
   * 2. Button Configuration (Change here -> updates all <Button> & <IconButton> instances)
   * Incorporates:
   * - Solid Drawing in 3D (1px top inner specular highlight)
   * - Fitts's Law & Bigger Hit Areas (min-height & expanded touch target on icon buttons)
   * - Snappy Timing (75ms press scale to 0.97, never tween while held)
   */
  button: {
    base: "relative inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-[transform,background-color,color,opacity] duration-150 ease-out shrink-0 select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0D12]",
    variants: {
      primary: "bg-[#818CF8] hover:bg-[#6366F1] active:bg-[#4F46E5] text-[#0B0D12] font-semibold border border-[#818CF8]/70 shadow-sm",
      secondary: "bg-[#1D2230] hover:bg-[#252B3A] active:bg-[#2C3344] text-[#F1F3F9] border border-[#272D3A]",
      success: "bg-[#34D399]/15 hover:bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/30",
      danger: "bg-[#F87171]/12 hover:bg-[#F87171]/20 active:bg-[#F87171]/25 text-[#F87171] border border-[#F87171]/30",
      ghost: "border border-transparent bg-transparent text-[#A1A8B8] hover:bg-[#252B3A]/70 hover:text-[#F1F3F9]",
      outline: "border border-[#272D3A] bg-transparent text-[#F1F3F9] hover:bg-[#1D2230] hover:border-[#818CF8]/50",
    },
    sizes: {
      xs: "h-7 px-2.5 text-xs rounded-md",
      sm: "h-8 px-3 text-[0.8125rem] rounded-[7px]",
      md: "h-9 px-4 text-[0.84375rem] rounded-[8px]",
      lg: "h-10 px-5 text-sm rounded-[8px]",
    },
    iconButtonBase:
      "relative inline-flex items-center justify-center rounded-lg p-1.5 transition-[transform,background-color,border-color,color,opacity] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8] after:content-[''] after:absolute after:-inset-1.5",
  },

  /**
   * 3. Form Fields & Inputs Configuration (Change here -> updates TextField, TextArea, Select, Checkbox)
   */
  field: {
    label: "mb-1.5 block text-[0.78125rem] font-medium text-[#A1A8B8] select-none",
    input: "w-full h-9 rounded-[8px] border border-[#272D3A] bg-[#1D2230] px-3 text-[0.84375rem] text-[#F1F3F9] placeholder:text-[#6F788A] outline-none transition-colors duration-150 focus:border-[#818CF8] focus:ring-2 focus:ring-[#818CF8]/20 disabled:opacity-50",
    textarea: "w-full rounded-[8px] border border-[#272D3A] bg-[#1D2230] px-3 py-2 text-[0.84375rem] text-[#F1F3F9] placeholder:text-[#6F788A] outline-none transition-colors duration-150 focus:border-[#818CF8] focus:ring-2 focus:ring-[#818CF8]/20 custom-scrollbar",
    selectTrigger: "flex w-full h-9 items-center justify-between rounded-[8px] border border-[#272D3A] bg-[#1D2230] px-3 text-[0.84375rem] text-[#F1F3F9] transition-colors hover:border-[#343C4E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8] disabled:opacity-50",
    selectListbox: "overflow-y-auto rounded-[10px] border border-[#272D3A] bg-[#161A23] p-1 shadow-xl custom-scrollbar",
    checkboxBoxChecked: "border-[#818CF8] bg-[#818CF8] text-[#0B0D12]",
    checkboxBoxUnchecked: "border-[#343C4E] bg-[#1D2230] text-transparent group-hover:border-[#818CF8]/60",
  },

  /**
   * 4. Surfaces, Cards & Modals Configuration (Staging the Focus + Solid Drawing in 3D)
   */
  surfaces: {
    toolbarGroup: "inline-flex items-center gap-1 rounded-lg bg-[#10131A] p-1 border border-[#272D3A]",
    sectionCard: "rounded-[10px] bg-[#161A23] border border-[#272D3A] p-4 space-y-3",
    accordionHeader: "flex items-center justify-between h-10 px-3 bg-[#1D2230] select-none",
    emptyState: "rounded-[10px] border border-dashed border-[#272D3A] bg-[#161A23]/60 p-6 text-center text-xs text-[#A1A8B8]",
    kbd: "inline-flex items-center justify-center rounded border border-[#343C4E] bg-[#10131A] px-1.5 py-0.5 font-mono text-[0.625rem] font-medium text-[#A1A8B8]",
    appShell: "flex h-dvh flex-col bg-[#0B0D12] text-[#F1F3F9] font-sans overflow-hidden",
    headerBar: "sticky top-0 left-0 z-20 bg-[#10131A]/95 backdrop-blur-md border-b border-[#272D3A] w-full px-3 sm:px-4 h-14 flex items-center justify-between font-sans shrink-0",
    publicHeader: "sticky top-0 z-50 flex min-h-14 items-center justify-between gap-2 border-b border-[#272D3A] bg-[#10131A]/90 px-3 py-2 backdrop-blur-md sm:gap-3 sm:px-6",
    publicNav: "flex shrink-0 items-center gap-1 sm:gap-1.5",
    publicNavItem: "rounded-md border px-2 py-1.5 text-[0.6875rem] font-medium transition-colors duration-150 sm:px-3 sm:py-2 sm:text-xs",
    publicNavActive: "border-[#818CF8]/40 bg-[#818CF8]/15 text-[#F1F3F9]",
    publicNavIdle: "border-transparent text-[#A1A8B8] hover:border-[#272D3A] hover:bg-[#252B3A] hover:text-[#F1F3F9]",
    studioHeaderBar: "sticky top-0 left-0 z-20 bg-[#10131A]/95 backdrop-blur-md border-b border-[#272D3A] w-full px-3 sm:px-4 h-14 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 font-sans shrink-0",
    inspectorBackdrop: "fixed inset-0 z-40 bg-[#0B0D12]/75 backdrop-blur-[2px] min-[1200px]:hidden",
    inspectorPanel: "fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col rounded-t-[12px] border-t border-[#272D3A] bg-[#161A23] shadow-2xl min-[1200px]:static min-[1200px]:z-10 min-[1200px]:max-h-none min-[1200px]:w-[27.5rem] min-[1200px]:shrink-0 min-[1200px]:rounded-none min-[1200px]:border-t-0 min-[1200px]:border-l min-[1200px]:border-[#272D3A] min-[1200px]:shadow-none",
    inspectorHeader: "flex items-center justify-between border-b border-[#202531] bg-[#10131A] px-5 py-4 shrink-0",
    inspectorBody: "min-h-0 flex-1 space-y-5 overflow-y-auto p-5 pb-[env(safe-area-inset-bottom)] custom-scrollbar",
    docsTableCard: "bg-[#161A23] border border-[#272D3A] rounded-[10px] overflow-hidden shadow-sm mb-12",
    docsTableHeader: "px-5 py-3 border-b border-[#202531] bg-[#10131A] flex items-center justify-between",
    docsVariableCard: "rounded-[8px] border border-[#272D3A] bg-[#1D2230] p-3",
    docsCopyButton: "inline-flex max-w-full min-h-8 items-center justify-start gap-2 rounded-md border border-[#272D3A] bg-[#1D2230] px-2 py-1.5 text-left text-[#A5B4FC] hover:text-[#F1F3F9] hover:border-[#818CF8]/60 transition-colors",
    editorCardActive: "rounded-[10px] bg-[#161A23] border border-[#818CF8] shadow-[0_0_0_1px_rgba(129,140,248,0.18)] transition-[border-color,box-shadow,opacity] duration-150 ease-out",
    editorCardInactive: "rounded-[10px] bg-[#161A23] border border-[#272D3A] hover:border-[#343C4E] transition-[border-color,box-shadow,opacity] duration-150 ease-out",
    editorSubSection: "rounded-[8px] border border-[#202531] bg-[#1D2230] overflow-hidden",
    modalBackdrop: "fixed inset-0 flex items-end justify-center bg-[#0B0D12]/75 backdrop-blur-[2px] p-0 sm:items-center sm:p-4",
    modalPanel: "w-full rounded-t-[12px] sm:rounded-[12px] bg-[#161A23] border border-[#272D3A] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] mt-auto sm:my-auto outline-none",
    modalHeader: "flex items-center justify-between px-5 py-4 border-b border-[#202531] bg-[#161A23] shrink-0",
    modalFooter: "px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3 border-t border-[#202531] bg-[#10131A] flex justify-end gap-2.5 shrink-0",
    badgeBlurple: "rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium bg-[#818CF8]/15 text-[#A5B4FC] border border-[#818CF8]/30",
    badgeNeutral: "rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium bg-[#1D2230] text-[#A1A8B8] border border-[#272D3A]",
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
