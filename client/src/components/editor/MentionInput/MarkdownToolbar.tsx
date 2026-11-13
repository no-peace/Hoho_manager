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
    className="flex items-center gap-0.5 bg-[#18191c] border-b border-[#232428] px-2 py-1 rounded-t-lg text-[#b5bac1] overflow-x-auto no-scrollbar select-none"
    role="toolbar"
    aria-label="Markdown formatting"
  >
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("**", "**", "bold text")} title="Bold (**text**) • Ctrl+B" aria-label="Bold" className="p-1.5 rounded-md text-[#b5bac1] hover:text-white hover:bg-[#2b2d31] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Bold size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("*", "*", "italic text")} title="Italic (*text*) • Ctrl+I" aria-label="Italic" className="p-1.5 rounded-md text-[#b5bac1] hover:text-white hover:bg-[#2b2d31] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Italic size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("__", "__", "underlined text")} title="Underline (__text__) • Ctrl+U" aria-label="Underline" className="p-1.5 rounded-md text-[#b5bac1] hover:text-white hover:bg-[#2b2d31] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Underline size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("~~", "~~", "strikethrough text")} title="Strikethrough (~~text~~)" aria-label="Strikethrough" className="p-1.5 rounded-md text-[#b5bac1] hover:text-white hover:bg-[#2b2d31] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Strikethrough size={13} strokeWidth={2.5} /></button>
    <div className="w-px h-3.5 bg-[#35373c] mx-0.5 shrink-0" />
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("`", "`", "code")} title="Inline Code (`text`) • Ctrl+E" aria-label="Inline Code" className="p-1.5 rounded-md text-[#b5bac1] hover:text-white hover:bg-[#2b2d31] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Code size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("```\n", "\n```", "code block")} title="Code Block" aria-label="Code Block" className="p-1.5 rounded-md text-[#b5bac1] hover:text-white hover:bg-[#2b2d31] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><FileCode size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("||", "||", "spoiler")} title="Spoiler (||text||)" aria-label="Spoiler" className="p-1.5 rounded-md text-[#b5bac1] hover:text-white hover:bg-[#2b2d31] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><EyeOff size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("> ", "", "quote", true)} title="Quote (> text)" aria-label="Quote" className="p-1.5 rounded-md text-[#b5bac1] hover:text-white hover:bg-[#2b2d31] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Quote size={13} strokeWidth={2.5} /></button>
    <div className="w-px h-3.5 bg-[#35373c] mx-0.5 shrink-0" />
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat(`<t:${Math.floor(Date.now() / 1000)}:R>`, "", "")} title="Relative Timestamp (<t:epoch:R>)" aria-label="Relative Timestamp" className="px-1.5 py-1 rounded-md text-[11px] font-mono text-[#b5bac1] hover:text-white hover:bg-[#2b2d31] active:scale-[0.95] transition-[transform,background-color,color] duration-150"><Clock size={12} /><span className="hidden sm:inline text-[10px]">time:R</span></button>
  </div>
);

export default MarkdownToolbar;
