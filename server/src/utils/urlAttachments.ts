import type { DiscordAttachmentFile } from "../services/discordService.js";
import { ApiError } from "./errors.js";
import { logger } from "./logger.js";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const FETCH_TIMEOUT_MS = 15_000;
const MAX_URL_ATTACHMENTS = 10;

const log = logger.child("url-attachments");

interface UrlAttachmentInput {
  filename?: unknown;
  url?: unknown;
  is_spoiler?: unknown;
  description?: unknown;
}

/** Strip path separators and characters Discord rejects in filenames. */
const sanitizeFilename = (value: string): string => {
  const cleaned = value.split(/[\\/]/).pop()?.trim() ?? "";
  return cleaned.replace(/[\u0000-\u001f<>:"|?*]/g, "_").slice(0, 200) || "attachment";
};

const deriveFilename = (url: URL): string => {
  const last = url.pathname.split("/").filter(Boolean).pop();
  if (!last) return "attachment";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

/**
 * Downloads external URL attachments so they can be forwarded to Discord as
 * real multipart files (Discord does not fetch external URLs for `attachments`).
 *
 * Buffers stay in memory and are capped at 25 MB each, matching the multipart
 * upload limit. Failures are surfaced as 400s so the UI can explain what broke.
 */
export const fetchUrlAttachments = async (
  attachments: unknown,
): Promise<DiscordAttachmentFile[]> => {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];

  const inputs = attachments.slice(0, MAX_URL_ATTACHMENTS) as UrlAttachmentInput[];
  const resolved: DiscordAttachmentFile[] = [];

  for (const input of inputs) {
    const rawUrl = typeof input?.url === "string" ? input.url.trim() : "";
    if (!/^https?:\/\//i.test(rawUrl)) {
      throw ApiError.badRequest("Attachment URLs must start with http:// or https://");
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw ApiError.badRequest(`Invalid attachment URL: ${rawUrl}`);
    }

    const rawName =
      typeof input?.filename === "string" && input.filename.trim() !== ""
        ? input.filename
        : deriveFilename(parsed);
    const isSpoiler = input?.is_spoiler === true;
    const filename = isSpoiler && !/^SPOILER_/i.test(rawName) ? `SPOILER_${rawName}` : rawName;
    const safeFilename = sanitizeFilename(filename);

    let response: Response;
    try {
      response = await fetch(parsed, {
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      throw ApiError.badRequest(
        `Could not download attachment "${safeFilename}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      throw ApiError.badRequest(
        `Could not download attachment "${safeFilename}": HTTP ${response.status}`,
      );
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_FILE_SIZE) {
      throw ApiError.badRequest(
        `Attachment "${safeFilename}" exceeds maximum allowed size of 25 MB`,
      );
    }

    const type =
      response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    resolved.push({
      file: new Blob([buffer], { type }),
      filename: safeFilename,
    });
    log.info(`Downloaded URL attachment "${safeFilename}" (${buffer.byteLength} bytes)`);
  }

  return resolved;
};
