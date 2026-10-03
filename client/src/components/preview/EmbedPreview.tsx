import type { EmbedData, EmbedField } from "@dmb/shared";
import { Markdown } from "./Markdown";
import { decimalToHex } from "../../utils/discord";

/**
 * Discord-style embed preview.
 *
 * Mirrors the real layout closely: a 4px accent bar on the left, an optional
 * thumbnail floated to the right, and fields laid out in inline rows of up to
 * three. The subtle part is that inline fields wrap *greedily* — three per row
 * only while each still fits — which is why fields are grouped before render.
 */

/** Tailwind cannot generate classes from a template literal, so map explicitly. */
const INLINE_COLS: Record<number, string> = {
  1: "",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

/** Group consecutive inline fields into rows of up to three. */
const groupFields = (fields: readonly EmbedField[] = []): EmbedField[][] => {
  const rows: EmbedField[][] = [];

  for (const field of fields) {
    const current = rows[rows.length - 1];
    const last = current?.[current.length - 1];

    if (current && field.inline && last?.inline && current.length < 3) {
      current.push(field);
    } else {
      rows.push([field]);
    }
  }
  return rows;
};

export interface EmbedPreviewProps {
  embed: EmbedData;
}

export const EmbedPreview = ({ embed }: EmbedPreviewProps) => {
  const accent = embed.color == null ? "#4f545c" : decimalToHex(embed.color);
  const rows = groupFields(embed.fields);

  return (
    <div
      className="max-w-[520px] rounded border-l-4 bg-[#2b2d31] px-3 py-2 pr-4 text-[#dbdee1]"
      style={{ borderLeftColor: accent }}
    >
      {embed.author?.name && (
        <div className="mb-1 flex items-center gap-2">
          {embed.author.icon_url && (
            <img src={embed.author.icon_url} alt="" className="h-6 w-6 rounded-full object-cover" />
          )}
          {embed.author.url ? (
            <a
              href={embed.author.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold hover:underline"
            >
              {embed.author.name}
            </a>
          ) : (
            <span className="text-sm font-semibold">{embed.author.name}</span>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          {embed.title && (
            <p className="mb-1 text-base leading-tight font-semibold text-[#f2f3f5]">
              {embed.url ? (
                <a
                  href={embed.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link hover:underline"
                >
                  {embed.title}
                </a>
              ) : (
                embed.title
              )}
            </p>
          )}

          {embed.description && <Markdown content={embed.description} className="text-sm" />}
        </div>

        {embed.thumbnail?.url && (
          <img
            src={embed.thumbnail.url}
            alt=""
            className="h-20 max-w-[80px] shrink-0 self-start rounded object-cover"
          />
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-2 grid grid-cols-1 gap-2">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={row.length > 1 ? `grid gap-2 ${INLINE_COLS[row.length] ?? ""}` : ""}
            >
              {row.map((field) => (
                <div key={field._id ?? field.name}>
                  <p className="text-sm font-semibold text-[#f2f3f5]">{field.name || "\u00a0"}</p>
                  {field.value && <Markdown content={field.value} className="text-sm" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {embed.image?.url && (
        <img src={embed.image.url} alt="" className="mt-2 max-h-72 w-full rounded object-cover" />
      )}

      {(embed.footer?.text || embed.timestamp) && (
        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-[#949ba4]">
          {embed.footer?.icon_url && (
            <img
              src={embed.footer.icon_url}
              alt=""
              className="h-5 w-5 rounded-full object-cover"
            />
          )}
          {embed.footer?.text && <span>{embed.footer.text}</span>}
          {embed.footer?.text && embed.timestamp && <span>•</span>}
          {embed.timestamp && <span>{new Date(embed.timestamp).toLocaleString()}</span>}
        </div>
      )}
    </div>
  );
};

export default EmbedPreview;
