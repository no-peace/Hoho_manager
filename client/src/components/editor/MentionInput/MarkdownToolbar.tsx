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
    className="flex items-center gap-0.5 px-2 py-1 bg-[#18191c]/80 border-b border-[#232428] rounded-t-lg text-[#949ba4] overflow-x-auto select-none custom-scrollbar"
    role="toolbar"
    aria-label="Markdown formatting"
  >
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("**", "**", "bold text")} title="Bold (**text**) • Ctrl+B" aria-label="Bold" className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors"><Bold size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("*", "*", "italic text")} title="Italic (*text*) • Ctrl+I" aria-label="Italic" className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors"><Italic size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("__", "__", "underlined text")} title="Underline (__text__) • Ctrl+U" aria-label="Underline" className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors"><Underline size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("~~", "~~", "strikethrough text")} title="Strikethrough (~~text~~)" aria-label="Strikethrough" className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors"><Strikethrough size={13} strokeWidth={2.5} /></button>
    <div className="w-px h-3.5 bg-[#35373c] mx-0.5 shrink-0" />
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("`", "`", "code")} title="Inline Code (`text`) • Ctrl+E" aria-label="Inline Code" className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors"><Code size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("```\n", "\n```", "code block")} title="Code Block" aria-label="Code Block" className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors"><FileCode size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("||", "||", "spoiler")} title="Spoiler (||text||)" aria-label="Spoiler" className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors"><EyeOff size={13} strokeWidth={2.5} /></button>
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("> ", "", "quote", true)} title="Quote (> text)" aria-label="Quote" className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors"><Quote size={13} strokeWidth={2.5} /></button>
    <div className="w-px h-3.5 bg-[#35373c] mx-0.5 shrink-0" />
    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat(`<t:${Math.floor(Date.now() / 1000)}:R>`, "", "")} title="Relative Timestamp (<t:epoch:R>)" aria-label="Relative Timestamp" className="px-1.5 h-6 rounded flex items-center gap-1 text-[11px] font-mono hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors"><Clock size={12} /><span className="hidden sm:inline text-[10px]">time:R</span></button>
  </div>
);

export default MarkdownToolbar;
