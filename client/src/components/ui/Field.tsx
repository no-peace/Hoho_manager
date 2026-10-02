import { Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const VARIABLES = [
  { group: "User / Clicker" },
  { tag: "{user.mention}", label: "@ada", desc: "Mentions the user who clicked" },
  { tag: "{user.name}", label: "ada", desc: "The user's exact username" },
  { tag: "{user.displayname}", label: "Ada L.", desc: "Server nickname or global name" },
  { tag: "{user.id}", label: "123456789", desc: "The user's numeric ID" },
  { tag: "{user.avatar}", label: "https://...", desc: "Link to user's profile picture" },
  { tag: "{user.created}", label: "Oct 24, 2015", desc: "When the account was created" },
  { tag: "{user.joined}", label: "2 years ago", desc: "When they joined the server" },
  
  { group: "Server" },
  { tag: "{server.name}", label: "Discohook", desc: "The server's name" },
  { tag: "{server.id}", label: "987654321", desc: "ID of the current server" },
  { tag: "{server.icon}", label: "https://...", desc: "The server's icon URL" },
  { tag: "{server.members}", label: "1542", desc: "Total server member count" },
  { tag: "{server.boosts}", label: "14", desc: "Number of server boosts" },
  
  { group: "Channel & Bot" },
  { tag: "{channel.mention}", label: "#general", desc: "Mentions the current channel" },
  { tag: "{channel.name}", label: "general", desc: "Name of the channel" },
  { tag: "{channel.id}", label: "456789123", desc: "ID of the current channel" },
  { tag: "{bot.mention}", label: "@Bot", desc: "Mentions the bot" },
  { tag: "{bot.id}", label: "11223344", desc: "The bot's ID" },

  { group: "Time & Date" },
  { tag: "{now}", label: "12:00 PM", desc: "Current time (Dynamic to reader)" },
  { tag: "{now.relative}", label: "2 mins ago", desc: "Relative time (Dynamic to reader)" },
  { tag: "{now.long}", label: "Tuesday, Oct 24", desc: "Long format date (Dynamic)" },
  { tag: "{now.unix}", label: "1698144000", desc: "Raw Unix timestamp number" },
];

const VariablePicker = ({ onSelect }: { onSelect: (tag: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

const toggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropWidth = 256; // 64rem (w-64 in Tailwind)
      const dropHeight = 300; // max-h constraint
      
      // Calculate Top/Bottom
      let top = rect.bottom + 4;
      if (top + dropHeight > window.innerHeight) {
        top = rect.top - dropHeight - 4; // Flip upwards if too close to bottom
      }
      
      // Calculate Left/Right with STRICT screen edge clamping
      let left = rect.right - dropWidth;
      
      // FIX: If the left coordinate is less than 10px from the screen edge, force it to 10px!
      if (left < 10) {
        left = 10;
      }
      // If the right edge bleeds off the screen, pin it to the right edge
      if (left + dropWidth > window.innerWidth) {
        left = window.innerWidth - dropWidth - 10;
      }
      
      setCoords({ top, left });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    const handleScroll = (e: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  return (
    <>
      <button ref={buttonRef} type="button" onClick={toggleDropdown} className="absolute right-2 top-1.5 z-10 flex h-[22px] items-center justify-center rounded bg-[#2b2d31] px-2 text-[11px] font-mono font-bold text-[#b5bac1] hover:bg-[#5865f2] hover:text-white transition-colors border border-[#1e1f22] shadow-sm" title="Insert Variable">
        {"{ }"}
      </button>
      
      {isOpen && createPortal(
        <div ref={dropdownRef} style={{ top: coords.top, left: coords.left }} className="fixed w-64 rounded-md border border-[#1e1f22] bg-[#2b2d31] shadow-2xl z-[99999] overflow-hidden flex flex-col max-h-[300px]">
          <div className="p-2 border-b border-[#1e1f22] shrink-0 bg-[#2b2d31]">
            <p className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider mb-1">Search Variables</p>
            <p className="text-[10px] text-[#949ba4]">Filled in dynamically on click.</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
            {VARIABLES.map((v, i) => v.group ? (
              <div key={`group-${i}`} className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase text-[#949ba4] tracking-wider border-b border-[#1e1f22]/50 mb-1 mt-1 first:mt-0">{v.group}</div>
            ) : (
              <button key={v.tag} type="button" onClick={() => { onSelect(v.tag!); setIsOpen(false); }} className="flex flex-col items-start justify-center rounded px-2 py-1.5 w-full hover:bg-[#5865f2] hover:text-white group transition-colors text-left mb-0.5">
                <div className="flex w-full items-baseline justify-between">
                  <span className="font-mono text-[11px] font-bold text-[#5865f2] group-hover:text-white">{v.tag}</span>
                  <span className="text-[10px] text-[#949ba4] group-hover:text-indigo-200">{v.label}</span>
                </div>
                <span className="text-[10px] text-[#b5bac1] group-hover:text-indigo-100 line-clamp-1">{v.desc}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

interface FieldShellProps { label?: ReactNode; hint?: ReactNode; counterValue?: string; limit?: number; className?: string; children: ReactNode; }

const FieldShell = ({ label, hint, counterValue = "", limit, className = "", children }: FieldShellProps) => (
  <label className={`block ${className}`}>
    {(label !== undefined || limit !== undefined) && (
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="field-label !mb-0">{label}</span>
        {limit !== undefined && <span className={`text-[11px] italic tabular-nums font-medium ${counterValue.length > limit ? "text-[#da373c]" : counterValue.length / limit >= 0.9 ? "text-[#faa61a]" : "text-[#949ba4]"}`}>{counterValue.length}/{limit}</span>}
      </span>
    )}
    {children}
    {hint && <span className="mt-1 block text-[11px] text-[#949ba4]">{hint}</span>}
  </label>
);

const asText = (value: unknown): string => typeof value === "string" ? value : value == null ? "" : String(value);

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; hint?: ReactNode; limit?: number; }

export const TextField = ({ label, hint, limit, className, ...props }: TextFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleInsertVariable = (tag: string) => {
    const input = inputRef.current;
    if (!input || !props.onChange) return;
    const currentVal = asText(props.value);
    const start = input.selectionStart ?? currentVal.length;
    const end = input.selectionEnd ?? currentVal.length;
    const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);
    const e = { target: { value: newVal } } as any;
    props.onChange(e);
    setTimeout(() => { input.focus(); input.setSelectionRange(start + tag.length, start + tag.length); }, 0);
  };
  return (
    <FieldShell label={label ?? (limit !== undefined ? label : undefined)} hint={hint} limit={limit} counterValue={asText(props.value)} className={className}>
      <div className="relative w-full">
        <input ref={inputRef} className="field w-full pr-10 bg-[#1e1f22] text-[#dbdee1] border-[#111214] focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]" {...props} />
        <VariablePicker onSelect={handleInsertVariable} />
      </div>
    </FieldShell>
  );
};

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; hint?: ReactNode; limit?: number; }

export const TextArea = ({ label, hint, limit, rows = 4, className, ...props }: TextAreaProps) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const handleInsertVariable = (tag: string) => {
    const input = textAreaRef.current;
    if (!input || !props.onChange) return;
    const currentVal = asText(props.value);
    const start = input.selectionStart ?? currentVal.length;
    const end = input.selectionEnd ?? currentVal.length;
    const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);
    const e = { target: { value: newVal } } as any;
    props.onChange(e);
    setTimeout(() => { input.focus(); input.setSelectionRange(start + tag.length, start + tag.length); }, 0);
  };
  return (
    <FieldShell label={label} hint={hint} limit={limit} counterValue={asText(props.value)} className={className}>
      <div className="relative w-full">
        <textarea ref={textAreaRef} rows={rows} className="field resize-y w-full pr-10 bg-[#1e1f22] text-[#dbdee1] border-[#111214] focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2] py-2" {...props} />
        <VariablePicker onSelect={handleInsertVariable} />
      </div>
    </FieldShell>
  );
};

export interface SelectOption_ { value: string; label: string; }
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; hint?: ReactNode; options: readonly SelectOption_[]; }
export const Select = ({ label, hint, options, className, ...props }: SelectProps) => (
  <FieldShell label={label} hint={hint} className={className}>
    <select className="field cursor-pointer w-full bg-[#1e1f22] text-[#dbdee1] border-[#111214] focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]" {...props}>
      {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  </FieldShell>
);

export interface CheckboxProps { label?: ReactNode; checked?: boolean; onChange: (checked: boolean) => void; className?: string; }
export const Checkbox = ({ label, checked, onChange, className = "" }: CheckboxProps) => (
  <label className={`flex cursor-pointer items-center gap-2 text-sm font-normal text-[#dbdee1] ${className}`}>
    <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} className="peer hidden" />
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#82838A] text-transparent transition-colors peer-checked:border-transparent peer-checked:bg-[#5865f2] peer-checked:text-white"><Check size={16} aria-hidden="true" /></span>
    {label}
  </label>
);
export default TextField;