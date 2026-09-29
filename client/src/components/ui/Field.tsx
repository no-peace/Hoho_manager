import { Check } from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Form fields.
 *
 * All share `.field` from globals.css (Discohook's rounded-lg, 36px-tall input)
 * so focus rings, borders and spacing stay identical across the app. Each
 * accepts an optional `label` and `hint`, and surfaces a live character counter
 * when a `limit` is supplied — Discord's limits are the single most common reason
 * a send fails.
 */

interface FieldShellProps {
  label?: ReactNode;
  hint?: ReactNode;
  /** Drives the `n/limit` counter. */
  counterValue?: string;
  limit?: number;
  className?: string;
  children: ReactNode;
}

const FieldShell = ({
  label,
  hint,
  counterValue = "",
  limit,
  className = "",
  children,
}: FieldShellProps) => (
  <label className={`block ${className}`}>
    {(label !== undefined || limit !== undefined) && (
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="field-label !mb-0">{label}</span>
        {limit !== undefined && (
          <span
            className={`text-xs italic tabular-nums ${
              counterValue.length > limit
                ? "text-rose-300"
                : counterValue.length / limit >= 0.9
                  ? "text-yellow-300"
                  : "text-ink-faint"
            }`}
          >
            {counterValue.length}/{limit}
          </span>
        )}
      </span>
    )}
    {children}
    {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
  </label>
);

const asText = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value);

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
  limit?: number;
}

export const TextField = ({ label, hint, limit, className, ...props }: TextFieldProps) => (
  <FieldShell
    label={label ?? (limit !== undefined ? label : undefined)}
    hint={hint}
    limit={limit}
    counterValue={asText(props.value)}
    className={className}
  >
    <input className="field" {...props} />
  </FieldShell>
);

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: ReactNode;
  limit?: number;
}

export const TextArea = ({
  label,
  hint,
  limit,
  rows = 4,
  className,
  ...props
}: TextAreaProps) => (
  <FieldShell
    label={label}
    hint={hint}
    limit={limit}
    counterValue={asText(props.value)}
    className={className}
  >
    <textarea rows={rows} className="field resize-y" {...props} />
  </FieldShell>
);

export interface SelectOption_ {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: ReactNode;
  options: readonly SelectOption_[];
}

export const Select = ({ label, hint, options, className, ...props }: SelectProps) => (
  <FieldShell label={label} hint={hint} className={className}>
    <select className="field cursor-pointer" {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </FieldShell>
);

export interface CheckboxProps {
  label?: ReactNode;
  checked?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/**
 * Compact inline checkbox row, styled like Discohook's: a 24px rounded square
 * that fills blurple when checked. The tick inherits `currentColor`, so making
 * the box's text transparent hides it until `peer-checked` turns it white — no
 * extra DOM or state needed.
 */
export const Checkbox = ({ label, checked, onChange, className = "" }: CheckboxProps) => (
  <label
    className={`flex cursor-pointer items-center gap-2 text-sm font-normal text-ink ${className}`}
  >
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => onChange(event.target.checked)}
      className="peer hidden"
    />
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#82838A] text-transparent transition-colors peer-checked:border-transparent peer-checked:bg-blurple peer-checked:text-white">
      <Check size={16} aria-hidden="true" />
    </span>
    {label}
  </label>
);

export default TextField;
