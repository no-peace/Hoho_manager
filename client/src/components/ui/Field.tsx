import { Check } from "lucide-react";
import { useRef } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const VARIABLES = [
  { group: "User / Clicker" },
  { tag: "{user.mention}", label: "@ada", desc: "Mentions the user who clicked" },
  { tag: "{user.name}", label: "ada", desc: "The user's exact username" },
  { tag: "{user.displayname}", label: "Ada L.", desc: "Server nickname or global name" },
  { tag: "{user.id}", label: "123456789", desc: "The user's numeric ID" },
  { tag: "{user.avatar}", label: "https://...", desc: "Link to user's profile picture" },
  { tag: "{user.roles}", label: "@Role1 @Role2", desc: "All roles the clicker holds" },
  { tag: "{user.clantag}", label: "HOHO", desc: "Prefix tag inside [TAG] or (TAG)" },
  { tag: "{user.created}", label: "Oct 24, 2019", desc: "When the account was created" },
  { tag: "{user.created.relative}", label: "5 years ago", desc: "Account age (Relative)" },
  { tag: "{user.joined}", label: "2 years ago", desc: "When they joined the server (Relative)" },
  { tag: "{user.joined.date}", label: "Jun 15, 2024", desc: "Server join date (Short date)" },

  { group: "Server, Channel & Bot" },
  { tag: "{server.id}", label: "987654321", desc: "ID of the current server" },
  { tag: "{server.name}", label: "HoHo Hub", desc: "Name of the current server" },
  { tag: "{server.icon}", label: "https://...", desc: "Server icon URL" },
  { tag: "{channel.mention}", label: "#general", desc: "Mentions the current channel" },
  { tag: "{channel.id}", label: "456789123", desc: "ID of the current channel" },
  { tag: "{bot.mention}", label: "@Bot", desc: "Mentions the bot" },
  { tag: "{bot.id}", label: "11223344", desc: "The bot's ID" },
  { tag: "{message.id}", label: "129384756", desc: "ID of the message with the button" },
  { tag: "{message.url}", label: "https://discord.com/...", desc: "Jump link to the message" },

  { group: "Time & Date" },
  { tag: "{now}", label: "12:00 PM", desc: "Current time (Dynamic to reader)" },
  { tag: "{now.relative}", label: "2 mins ago", desc: "Relative time (Dynamic to reader)" },
  { tag: "{now.long}", label: "Tuesday, Oct 24", desc: "Long format date (Dynamic)" },
  { tag: "{now.unix}", label: "1698144000", desc: "Raw Unix timestamp number" },

  { group: "Select Menus & Modals" },
  { tag: "{selected}", label: "option_1, option_2", desc: "Values chosen in a Select Menu" },
  { tag: "{selected.0}", label: "option_1", desc: "First value chosen in a Select Menu" },
  { tag: "{input.field_1}", label: "Answer", desc: "Modal input value by Custom ID" },
  { tag: "{modal.field_1}", label: "Answer", desc: "Modal input value alias" },
];

interface FieldShellProps { label?: ReactNode; hint?: ReactNode; counterValue?: string; limit?: number; className?: string; children: ReactNode; }

const FieldShell = ({ label, hint, counterValue = "", limit, className = "", children }: FieldShellProps) => (
  <div className={`block ${className}`}>
    {(label !== undefined || limit !== undefined) && (
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="field-label !mb-0">{label}</span>
        {limit !== undefined && <span className={`text-[11px] italic tabular-nums font-medium ${counterValue.length > limit ? "text-[#da373c]" : counterValue.length / limit >= 0.9 ? "text-[#faa61a]" : "text-[#949ba4]"}`}>{counterValue.length}/{limit}</span>}
      </span>
    )}
    {children}
    {hint && <span className="mt-1 block text-[11px] text-[#949ba4]">{hint}</span>}
  </div>
);

const asText = (value: unknown): string => typeof value === "string" ? value : value == null ? "" : String(value);

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
  limit?: number;
  variables?: boolean;
}

import { QuickMentionBox } from "./QuickMentionBox";

export const TextField = ({ label, hint, limit, variables = false, className, ...props }: TextFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const showVars = Boolean(variables) && !props.disabled && (!props.type || props.type === "text");
  const handleInsertVariable = (tag: string) => {
    const input = inputRef.current;
    if (!input || !props.onChange) return;
    const currentVal = asText(props.value);
    const start = input.selectionStart ?? currentVal.length;
    const end = input.selectionEnd ?? currentVal.length;
    const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);
    const e = { target: { value: newVal } } as any;
    props.onChange(e);
    setTimeout(() => {
      try {
        input.focus();
        input.setSelectionRange(start + tag.length, start + tag.length);
      } catch {}
    }, 0);
  };
  return (
    <FieldShell label={label ?? (limit !== undefined ? label : undefined)} hint={hint} limit={limit} counterValue={asText(props.value)} className={className}>
      <div className="relative w-full">
        <input ref={inputRef} className={`field w-full ${showVars ? "pr-12" : "pr-3"} bg-[#1e1f22] text-[#dbdee1] border-[#111214] focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]`} {...props} />
        {showVars && <QuickMentionBox onSelect={handleInsertVariable} />}
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
        <QuickMentionBox onSelect={handleInsertVariable} />
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