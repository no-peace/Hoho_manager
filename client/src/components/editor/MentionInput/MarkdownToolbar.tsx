import React from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  FileCode,
  EyeOff,
  Quote,
  Clock,
} from "lucide-react";

export interface MarkdownToolbarProps {
  onFormat: (
    prefix: string,
    suffix?: string,
    defaultText?: string,
    isLinePrefix?: boolean,
  ) => void;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onFormat }) => (
  <div
    className="flex items-center gap-0.5 rounded-t-[8px] border-b border-[#272D3A] bg-[#10131A] px-2 py-1.5 text-[#A1A8B8] overflow-x-auto no-scrollbar select-none"
    role="toolbar"
    aria-label="Markdown formatting"
  >
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("**", "**", "bold text")} title="Bold (**text**) • Ctrl+B" aria-label="Bold" className="h-7 w-7 rounded-[6px] text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Bold size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("*", "*", "italic text")} title="Italic (*text*) • Ctrl+I" aria-label="Italic" className="h-7 w-7 rounded-[6px] text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Italic size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("__", "__", "underlined text")} title="Underline (__text__) • Ctrl+U" aria-label="Underline" className="h-7 w-7 rounded-[6px] text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Underline size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("~~", "~~", "strikethrough text")} title="Strikethrough (~~text~~)" aria-label="Strikethrough" className="h-7 w-7 rounded-[6px] text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Strikethrough size={13} strokeWidth={2.5} /></button>
    <div className="mx-1 h-4 w-px shrink-0 bg-[#272D3A]" />
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("`", "`", "code")} title="Inline Code (`text`) • Ctrl+E" aria-label="Inline Code" className="h-7 w-7 rounded-[6px] text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Code size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("```\n", "\n```", "code block")} title="Code Block" aria-label="Code Block" className="h-7 w-7 rounded-[6px] text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><FileCode size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("||", "||", "spoiler")} title="Spoiler (||text||)" aria-label="Spoiler" className="h-7 w-7 rounded-[6px] text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><EyeOff size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("> ", "", "quote", true)} title="Quote (> text)" aria-label="Quote" className="h-7 w-7 rounded-[6px] text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Quote size={13} strokeWidth={2.5} /></button>
    <div className="w-px h-3.5 bg-[#35373c] mx-0.5 shrink-0" />
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat(`<t:${Math.floor(Date.now() / 1000)}:R>`, "", "")} title="Relative Timestamp (<t:epoch:R>)" aria-label="Relative Timestamp" className="inline-flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[11px] font-mono text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Clock size={12} /><span className="hidden sm:inline text-[10px]">time:R</span></button>
  </div>
);

export default MarkdownToolbar;
