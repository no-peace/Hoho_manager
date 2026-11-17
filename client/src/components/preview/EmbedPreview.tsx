import React from "react";
import type { EmbedData, EmbedField } from "@dmb/shared";
import { Markdown } from "./Markdown";
import { useUserPlaceholderPreview } from "./UserPlaceholderPreviewContent";
import { decimalToHex } from "../../utils/discord";
import { useMessageStore } from "../../store/messageStore";
import { useGlobalStore } from "../../store/globalStore";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
/**
 * Discord-style embed preview.
 *
 * Mirrors the real layout closely: a 4px accent bar on the left, an optional
 * thumbnail floated to the right, and fields laid out in inline rows of up to
 * three. The subtle part is that inline fields wrap *greedily*  three per row
 * only while each still fits  which is why fields are grouped before render.
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

const formatTimestamp = (timestamp?: string | null): string | null => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

export const EmbedPreview = ({ embed }: EmbedPreviewProps) => {
  const accent = embed.color == null ? "#4f545c" : decimalToHex(embed.color);
  const rows = groupFields(embed.fields);
  const attachedFiles = useMessageStore((state) => state.attachedFiles);
  const { resolveUserPlaceholders } = useUserPlaceholderPreview();
  const currentUser = useGlobalStore((state) => state.currentUser);
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const guilds = useDiscordCacheStore((state) => state.guilds);
  const previewGuild = guilds?.find((g) => g.id === selectedGuildId) ?? guilds?.[0];

  const resolvePlainVars = (text?: string): string => {
    if (!text || !text.includes("{")) return text ?? "";
    const username = currentUser?.username || "User";
    const userId = currentUser?.id || "123456789012345678";
    const avatarUrl =
      currentUser?.avatarUrl ||
      (currentUser?.avatar
        ? `https://cdn.discordapp.com/avatars/${userId}/${currentUser.avatar}.png`
        : "https://cdn.discordapp.com/embed/avatars/0.png");
    const guildIcon =
      previewGuild?.id && previewGuild?.icon
        ? `https://cdn.discordapp.com/icons/${previewGuild.id}/${previewGuild.icon}.png`
        : "https://cdn.discordapp.com/embed/avatars/1.png";
    const map: Record<string, string> = {
      "user.username": username,
      "user.id": userId,
      "user.avatar": avatarUrl,
      "server.name": previewGuild?.name || "HoHo Server",
      "server.id": previewGuild?.id || selectedGuildId || "987654321",
      "server.icon": guildIcon,
      "now.unix": String(Math.floor(Date.now() / 1000)),
      "now.iso": new Date().toISOString(),
    };
    const withLocalVars = text.replace(
      /\{{1,2}\s*([a-zA-Z0-9_.$]+)\s*\}{1,2}/g,
      (m, k: string) => {
        const key = k.trim().toLowerCase();
        return map[key] ?? m;
      },
    );
    return resolveUserPlaceholders(withLocalVars);
  };

  const resolveExternalLink = (url?: string): string | undefined => {
    if (!url) return undefined;
    try {
      const parsed = new URL(resolvePlainVars(url));
      return parsed.protocol === "http:" || parsed.protocol === "https:"
        ? parsed.toString()
        : undefined;
    } catch {
      return undefined;
    }
  };

  const resolveAttachmentUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    const interpolated = resolvePlainVars(url);
    if (interpolated.startsWith("attachment://")) {
      const filename = interpolated.slice("attachment://".length);
      const match = attachedFiles.find(
        (f) => f.name === filename || `SPOILER_${f.name}` === filename,
      );
      if (match) return match.previewUrl;
    }
    return interpolated;
  };

  const authorUrl = resolveExternalLink(embed.author?.url);
  const embedUrl = resolveExternalLink(embed.url);

  return (
    <div
      data-preview-embed-id={embed._id}
      className="max-w-[520px] w-full min-w-0 rounded border-l-4 bg-[#2b2d31] px-3 py-2 pr-4 text-[#dbdee1] overflow-hidden [overflow-wrap:anywhere]"
      style={{ borderLeftColor: accent }}
    >
      {embed.author?.name && (
        <div data-preview-embed-part="author" className="mb-1 flex items-center gap-2 min-w-0">
          {embed.author.icon_url && (
            <img
              src={resolveAttachmentUrl(embed.author.icon_url)}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full object-cover"
            />
          )}
          {authorUrl ? (
            <a
              href={authorUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold hover:underline min-w-0 break-words [overflow-wrap:anywhere]"
            >
              {resolvePlainVars(embed.author.name)}
            </a>
          ) : (
            <span className="text-sm font-semibold min-w-0 break-words [overflow-wrap:anywhere]">
              {resolvePlainVars(embed.author.name)}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          {embed.title && (
            <div data-preview-embed-part="title" className="mb-1 text-base leading-tight font-semibold text-[#f2f3f5] break-words [overflow-wrap:anywhere]">
              {embedUrl ? (
                <a
                  href={embedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link hover:underline break-words [overflow-wrap:anywhere]"
                >
                  <Markdown content={embed.title} className="inline break-words [overflow-wrap:anywhere]" />
                </a>
              ) : (
                <Markdown content={embed.title} className="break-words [overflow-wrap:anywhere]" />
              )}
            </div>
          )}

          {embed.description && (
            <div data-preview-embed-part="description"><Markdown content={embed.description} className="text-sm break-words [overflow-wrap:anywhere]" /></div>
          )}
        </div>

        {embed.thumbnail?.url && (
          <img
            data-preview-embed-part="thumbnail"
            src={resolveAttachmentUrl(embed.thumbnail.url)}
            alt=""
            className="h-20 max-w-[80px] shrink-0 self-start rounded object-cover"
          />
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-2 grid grid-cols-1 gap-2 min-w-0">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={row.length > 1 ? `grid gap-2 ${INLINE_COLS[row.length] ?? ""} min-w-0` : "min-w-0"}
            >
              {row.map((field) => (
                <div key={field._id ?? field.name} data-preview-embed-part="field" data-preview-embed-field-id={field._id} className="min-w-0 break-words [overflow-wrap:anywhere]">
                  <p className="text-sm font-semibold text-[#f2f3f5] break-words [overflow-wrap:anywhere]">
                    {resolvePlainVars(field.name) || "\u00a0"}
                  </p>
                  {field.value && (
                    <Markdown content={field.value} className="text-sm break-words [overflow-wrap:anywhere]" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {embed.image?.url && (
        <img data-preview-embed-part="image" src={resolveAttachmentUrl(embed.image.url)} alt="" className="mt-2 max-h-72 w-full rounded object-cover" />
      )}

      {(() => {
        const formattedTimestamp = formatTimestamp(embed.timestamp);
        return (embed.footer?.text || formattedTimestamp) ? (
          <div data-preview-embed-part="footer" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#949ba4] min-w-0">
            {embed.footer?.icon_url && (
              <img
                src={resolveAttachmentUrl(embed.footer.icon_url)}
                alt=""
                className="h-5 w-5 shrink-0 rounded-full object-cover"
              />
            )}
            {embed.footer?.text && (
              <span className="break-words min-w-0 [overflow-wrap:anywhere]">
                {resolvePlainVars(embed.footer.text)}
              </span>
            )}
            {embed.footer?.text && formattedTimestamp && <span className="shrink-0">•</span>}
            {formattedTimestamp && <span data-preview-embed-part="timestamp" className="shrink-0">{formattedTimestamp}</span>}
          </div>
        ) : null;
      })()}
    </div>
  );
};

export default React.memo(EmbedPreview);
