import dns from "node:dns/promises";
import net from "node:net";
import type { DiscordAttachmentFile } from "../services/discordService.js";
import { ApiError } from "./errors.js";
import { logger } from "./logger.js";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_TOTAL_URL_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50 mb
const FETCH_TIMEOUT_MS = 15_000;
const MAX_URL_ATTACHMENTS = 10;

const log = logger.child("url-attachments");

interface UrlAttachmentInput {
  filename?: unknown;
  url?: unknown;
  is_spoiler?: unknown;
  description?: unknown;
}

const IPV4_BLOCKED_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

const IPV6_BLOCKED_CIDRS = [
  "::/128",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
];

const ipv4ToBigInt = (ip: string): bigint =>
  ip
    .split(".")
    .map((octet) => BigInt(parseInt(octet, 10)))
    .reduce((acc, octet) => (acc << 8n) | octet, 0n);

const normalizeIp = (rawIp: string): { ip: string; version: 4 | 6 | 0 } => {
  const cleaned = rawIp.replace(/^\[|\]$/g, "").split("%")[0].trim().toLowerCase();
  if (cleaned.startsWith("::ffff:")) {
    const mapped = cleaned.slice(7);
    if (net.isIP(mapped) === 4) {
      return { ip: mapped, version: 4 };
    }
  }
  const version = net.isIP(cleaned);
  return { ip: cleaned, version: version === 4 ? 4 : version === 6 ? 6 : 0 };
};

const expandIpv6ToBigInt = (ip: string): bigint => {
  const [leftRaw, rightRaw] = ip.split("::");
  const left = leftRaw ? leftRaw.split(":").filter(Boolean) : [];
  const right = rightRaw ? rightRaw.split(":").filter(Boolean) : [];

  if (right.length > 0 && right[right.length - 1].includes(".")) {
    const v4 = ipv4ToBigInt(right.pop()!);
    right.push(((v4 >> 16n) & 0xffffn).toString(16), (v4 & 0xffffn).toString(16));
  } else if (left.length > 0 && left[left.length - 1].includes(".")) {
    const v4 = ipv4ToBigInt(left.pop()!);
    left.push(((v4 >> 16n) & 0xffffn).toString(16), (v4 & 0xffffn).toString(16));
  }

  const missing = Math.max(0, 8 - (left.length + right.length));
  const groups = ip.includes("::")
    ? [...left, ...Array(missing).fill("0"), ...right]
    : left;

  const hex = groups.slice(0, 8).map((g) => g.padStart(4, "0")).join("");
  return BigInt("0x" + (hex || "0"));
};

const inCidr = (ip: string, cidr: string): boolean => {
  const [rangeIp, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);
  const normIp = normalizeIp(ip);
  const normRange = normalizeIp(rangeIp);
  if (normIp.version === 0 || normIp.version !== normRange.version) return false;

  const bits = normIp.version === 4 ? 32n : 128n;
  const ipNum = normIp.version === 4 ? ipv4ToBigInt(normIp.ip) : expandIpv6ToBigInt(normIp.ip);
  const rangeNum = normRange.version === 4 ? ipv4ToBigInt(normRange.ip) : expandIpv6ToBigInt(normRange.ip);
  const shift = bits - BigInt(prefix);
  const mask = shift >= bits ? 0n : ((1n << bits) - 1n) ^ ((1n << shift) - 1n);
  return (ipNum & mask) === (rangeNum & mask);
};

const isBlockedIp = (rawIp: string): boolean => {
  const { ip, version } = normalizeIp(rawIp);
  if (version === 4) return IPV4_BLOCKED_CIDRS.some((cidr) => inCidr(ip, cidr));
  if (version === 6) return IPV6_BLOCKED_CIDRS.some((cidr) => inCidr(ip, cidr));
  return true;
};

const assertSafeRemoteUrl = async (rawUrl: string): Promise<URL> => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw ApiError.badRequest(`Invalid attachment URL: ${rawUrl}`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw ApiError.badRequest("Attachment URLs must start with http:// or https://");
  }
  if (parsed.username || parsed.password) {
    throw ApiError.badRequest("Credentials in attachment URLs are not allowed");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw ApiError.badRequest(`Blocked internal attachment hostname: ${hostname}`);
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw ApiError.badRequest(`Blocked internal or private IP address: ${hostname}`);
    }
    return parsed;
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length) {
    throw ApiError.badRequest(`Could not resolve attachment hostname: ${hostname}`);
  }
  for (const rec of records) {
    if (isBlockedIp(rec.address)) {
      throw ApiError.badRequest(`Attachment hostname ${hostname} resolved to blocked address`);
    }
  }

  return parsed;
};

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
  if (attachments.length > MAX_URL_ATTACHMENTS) {
    throw ApiError.badRequest(`Too many URL attachments: maximum ${MAX_URL_ATTACHMENTS} allowed`);
  }

  const inputs = attachments as UrlAttachmentInput[];
  const resolved: DiscordAttachmentFile[] = [];
  let totalReceived = 0;

  for (const input of inputs) {
    const rawUrl = typeof input?.url === "string" ? input.url.trim() : "";
    if (!/^https?:\/\//i.test(rawUrl)) {
      throw ApiError.badRequest("Attachment URLs must start with http:// or https://");
    }

    const parsed = await assertSafeRemoteUrl(rawUrl);

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
        redirect: "error",
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

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE) {
      throw ApiError.badRequest(
        `Attachment "${safeFilename}" exceeds maximum allowed size of 25 MB`,
      );
    }
    if (
      Number.isFinite(contentLength) &&
      contentLength > 0 &&
      totalReceived + contentLength > MAX_TOTAL_URL_ATTACHMENT_SIZE
    ) {
      throw ApiError.badRequest("Combined URL attachments exceed maximum allowed size of 50 MB");
    }

    let buffer: ArrayBuffer;
    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > MAX_FILE_SIZE) {
            await reader.cancel().catch(() => {});
            throw ApiError.badRequest(
              `Attachment "${safeFilename}" exceeds maximum allowed size of 25 MB`,
            );
          }
          if (totalReceived + received > MAX_TOTAL_URL_ATTACHMENT_SIZE) {
            await reader.cancel().catch(() => {});
            throw ApiError.badRequest("Combined URL attachments exceed maximum allowed size of 50 MB");
          }
          chunks.push(value);
        }
      }
      const merged = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      buffer = merged.buffer;
      totalReceived += received;
    } else {
      buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_FILE_SIZE) {
        throw ApiError.badRequest(
          `Attachment "${safeFilename}" exceeds maximum allowed size of 25 MB`,
        );
      }
      if (totalReceived + buffer.byteLength > MAX_TOTAL_URL_ATTACHMENT_SIZE) {
        throw ApiError.badRequest("Combined URL attachments exceed maximum allowed size of 50 MB");
      }
      totalReceived += buffer.byteLength;
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