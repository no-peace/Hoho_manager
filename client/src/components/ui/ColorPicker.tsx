import { Check } from "lucide-react";
import { EMBED_COLOR_PRESETS } from "../../utils/constants";
import { decimalToHex, parseHexColor } from "../../utils/discord";

/**
 * Colour picker for embed/container accents.
 *
 * Discord stores colours as a 24-bit integer, which nobody wants to type. This
 * exposes presets plus a native colour input, and keeps the decimal value as the
 * source of truth so nothing needs converting at send time.
 *
 * The hex text field only commits once the input is a valid 6-digit colour, so
 * a half-typed value never blanks the accent.
 */
export interface ColorPickerProps {
  label?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  allowClear?: boolean;
}

export const ColorPicker = ({
  label = "Colour",
  value,
  onChange,
  allowClear = true,
}: ColorPickerProps) => {
  const hex = value == null ? "#000000" : decimalToHex(value);

  return (
    <div>
      <span className="field-label">{label}</span>

      <div className="flex flex-wrap items-center gap-1.5">
        {EMBED_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            title={preset.name}
            aria-label={preset.name}
            onClick={() => onChange(preset.value)}
            style={{ backgroundColor: decimalToHex(preset.value) }}
            className="flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-black/30 transition-transform hover:scale-110"
          >
            {value === preset.value && <Check size={12} className="text-white drop-shadow" />}
          </button>
        ))}

        <input
          type="color"
          aria-label="Custom colour"
          value={hex}
          onChange={(event) => onChange(parseHexColor(event.target.value) ?? null)}
          className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
        />

        {allowClear && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded px-2 py-1 text-[11px] text-ink-muted hover:bg-hover hover:text-ink"
          >
            None
          </button>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <input
          className="field !w-28 font-mono"
          value={value == null ? "" : decimalToHex(value)}
          placeholder="#5865f2"
          onChange={(event) => {
            const parsed = parseHexColor(event.target.value);
            if (parsed !== null) onChange(parsed);
          }}
        />
        <span className="font-mono text-[11px] text-ink-faint">
          {value == null ? "no accent" : `0x${value.toString(16)}`}
        </span>
      </div>
    </div>
  );
};

export default ColorPicker;
