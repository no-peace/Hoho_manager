import type { DiscordMessagePayload } from "@dmb/shared";
import { logger } from "../utils/logger.js";

const log = logger.child("weaoService");

const WEAO_PRIMARY_BASE = "https://weao.xyz";
const WEAO_FALLBACK_BASE = "https://whatexpsare.online";
const WEAO_USER_AGENT = "WEAO-3PService";

const EXPLOITS_CACHE_TTL_MS = 60_000;
const SUNC_CACHE_TTL_MS = 15 * 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
const SAFE_SCRAP_TOKEN_REGEX = /^[A-Za-z0-9_-]{4,128}$/;

export interface WeaoSuncPointer {
  suncScrap?: string;
  suncKey?: string;
}

export interface WeaoExploitRecord {
  _id: string;
  title: string;
  version: string;
  updatedDate: string;
  uncStatus: boolean;
  free: boolean;
  detected: boolean;
  rbxversion: string;
  updateStatus: boolean;
  websitelink?: string;
  discordlink?: string;
  purchaselink?: string;
  beta?: boolean;
  platform?: string;
  extype?: string;
  roleId?: string;
  index?: number;
  elementCertified?: boolean;
  cost?: string;
  decompiler?: boolean;
  multiInject?: boolean;
  suncPercentage?: number;
  uncPercentage?: number;
  keysystem?: boolean;
  sunc?: WeaoSuncPointer;
}

export interface WeaoSuncTestEntry {
  name: string;
  description?: string;
  library?: string;
  status: string;
  reason?: string;
}

export interface WeaoSuncData {
  timestamp?: number;
  version?: string;
  bibip?: boolean;
  timeTaken?: number;
  executor?: string;
  outdated?: boolean;
  tests?: {
    passed?: WeaoSuncTestEntry[];
    failed?: WeaoSuncTestEntry[];
  };
}

interface WeaoRateLimitPayload {
  error?: string;
  rateLimitInfo?: {
    remainingTime?: number;
    requestsRemaining?: number;
    resetTime?: number;
  };
}

let exploitsCache: { data: WeaoExploitRecord[]; fetchedAt: number } | null = null;
let inFlightExploitsPromise: Promise<WeaoExploitRecord[]> | null = null;
const suncCache = new Map<string, { data: WeaoSuncData; fetchedAt: number }>();
const inFlightSuncPromises = new Map<string, Promise<WeaoSuncData | null>>();

let rateLimitedUntilMs = 0;

const fetchWeaoJson = async <T>(pathWithQuery: string): Promise<T> => {
  const now = Date.now();
  if (now < rateLimitedUntilMs) {
    const waitSec = Math.ceil((rateLimitedUntilMs - now) / 1000);
    throw new Error(`WEAO API rate-limit cooldown active (${waitSec}s remaining)`);
  }

  const bases = [WEAO_PRIMARY_BASE, WEAO_FALLBACK_BASE];
  let lastError: Error | null = null;

  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${base}${pathWithQuery}`, {
        method: "GET",
        headers: {
          "User-Agent": WEAO_USER_AGENT,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (response.status === 429) {
        const body = (await response.json().catch(() => ({}))) as WeaoRateLimitPayload;
        const resetTime = body.rateLimitInfo?.resetTime;
        const remainingSec = body.rateLimitInfo?.remainingTime ?? 120;
        rateLimitedUntilMs =
          typeof resetTime === "number" && resetTime > Date.now()
            ? resetTime
            : Date.now() + remainingSec * 1000;
        log.warn(
          `WEAO 429 Too Many Requests. Circuit breaker engaged until ${new Date(
            rateLimitedUntilMs,
          ).toISOString()}`,
        );
        throw new Error("WEAO rate limit reached (429)");
      }

      if (!response.ok) {
        throw new Error(`WEAO HTTP ${response.status} on ${pathWithQuery}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (Date.now() < rateLimitedUntilMs) break;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error("WEAO request failed");
};

export const getAllExploits = async (forceRefresh = false): Promise<WeaoExploitRecord[]> => {
  const now = Date.now();
  if (
    !forceRefresh &&
    exploitsCache &&
    now - exploitsCache.fetchedAt < EXPLOITS_CACHE_TTL_MS
  ) {
    return exploitsCache.data;
  }

  if (inFlightExploitsPromise) {
    return inFlightExploitsPromise;
  }

  inFlightExploitsPromise = (async () => {
    try {
      const data = await fetchWeaoJson<WeaoExploitRecord[]>("/api/status/exploits");
      if (Array.isArray(data)) {
        exploitsCache = { data, fetchedAt: Date.now() };
        return data;
      }
      return exploitsCache?.data ?? [];
    } catch (err) {
      log.warn(
        `Serving cached WEAO exploits after upstream error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return exploitsCache?.data ?? [];
    } finally {
      inFlightExploitsPromise = null;
    }
  })();

  return inFlightExploitsPromise;
};

export const findExploitByName = async (
  query: string,
): Promise<WeaoExploitRecord | null> => {
  const normalized = (query || "").trim().toLowerCase();
  if (!normalized) return null;

  const list = await getAllExploits();
  return (
    list.find((item) => item.title.toLowerCase() === normalized) ??
    list.find((item) => item.title.toLowerCase().includes(normalized)) ??
    null
  );
};

export const getExploitSuncDetails = async (
  exploit: WeaoExploitRecord,
): Promise<WeaoSuncData | null> => {
  const scrap = exploit.sunc?.suncScrap?.trim();
  const key = exploit.sunc?.suncKey?.trim();
  if (!scrap || !key) return null;

  if (!SAFE_SCRAP_TOKEN_REGEX.test(scrap) || !SAFE_SCRAP_TOKEN_REGEX.test(key)) {
    log.warn(`Rejected unsafe sUNC parameters for exploit ${exploit.title}`);
    return null;
  }

  const cacheKey = `${scrap}:${key}`;
  const cached = suncCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SUNC_CACHE_TTL_MS) {
    return cached.data;
  }

  const existingPromise = inFlightSuncPromises.get(cacheKey);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    try {
      const path = `/api/sunc?scrap=${encodeURIComponent(scrap)}&key=${encodeURIComponent(
        key,
      )}`;
      const data = await fetchWeaoJson<WeaoSuncData>(path);
      if (data && typeof data === "object") {
        suncCache.set(cacheKey, { data, fetchedAt: Date.now() });
        return data;
      }
      return cached?.data ?? null;
    } catch (err) {
      log.warn(
        `Failed to fetch sUNC details for ${exploit.title}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return cached?.data ?? null;
    } finally {
      inFlightSuncPromises.delete(cacheKey);
    }
  })();

  inFlightSuncPromises.set(cacheKey, promise);
  return promise;
};

export const formatExploitField = (
  exploit: WeaoExploitRecord,
  field: string,
  suncDetails?: WeaoSuncData | null,
): string => {
  const key = field.trim().toLowerCase();
  const passedCount = suncDetails?.tests?.passed?.length;
  const failedCount = suncDetails?.tests?.failed?.length;
  const computedPct =
    typeof passedCount === "number" &&
    typeof failedCount === "number" &&
    passedCount + failedCount > 0
      ? Math.round((passedCount / (passedCount + failedCount)) * 100)
      : undefined;

  const suncPct = exploit.suncPercentage ?? computedPct;

  switch (key) {
    case "title":
    case "name":
      return exploit.title;
    case "status":
      return exploit.updateStatus ? "🟢 Updated" : "🔴 Outdated";
    case "statuscircle":
    case "circle":
      return exploit.updateStatus ? "🟢" : "🔴";
    case "statustext":
      return exploit.updateStatus ? "Updated" : "Outdated";
    case "sunc":
      return typeof suncPct === "number" ? `${suncPct}%` : "N/A";
    case "suncraw":
      return typeof suncPct === "number" ? String(suncPct) : "0";
    case "suncpassed":
      return typeof passedCount === "number" ? String(passedCount) : "N/A";
    case "suncfailed":
      return typeof failedCount === "number" ? String(failedCount) : "N/A";
    case "sunctime":
      return typeof suncDetails?.timeTaken === "number"
        ? `${suncDetails.timeTaken.toFixed(2)}s`
        : "N/A";
    case "unc":
      return typeof exploit.uncPercentage === "number"
        ? `${exploit.uncPercentage}%`
        : exploit.uncStatus
          ? "Supported"
          : "Unsupported";
    case "version":
      return exploit.version || "Unknown";
    case "rbxversion":
      return exploit.rbxversion || "Unknown";
    case "updateddate":
    case "updated":
      return exploit.updatedDate || "Unknown";
    case "detected":
      return exploit.detected ? "⚠️ Detected" : "🛡️ Undetected";
    case "free":
    case "price":
    case "cost":
      return exploit.free ? "Free" : exploit.cost || "Paid";
    case "platform":
      return exploit.platform || "Unknown";
    case "decompiler":
      return exploit.decompiler ? "✅ Yes" : "❌ No";
    case "multiinject":
      return exploit.multiInject ? "✅ Yes" : "❌ No";
    case "keysystem":
      return exploit.keysystem ? "🔑 Key System" : "🔓 Keyless";
    case "websitelink":
    case "website":
      return exploit.websitelink || "";
    case "discordlink":
    case "discord":
      return exploit.discordlink || "";
    case "purchaselink":
    case "purchase":
      return exploit.purchaselink || "";
    case "suncscrap":
      return exploit.sunc?.suncScrap || "";
    case "sunckey":
      return exploit.sunc?.suncKey || "";
    default:
      return `{${field}}`;
  }
};

const PLACEHOLDER_REGEX = /\{([a-zA-Z0-9_.: -]+)\}/g;

export const interpolateWeaoPlaceholders = async (
  payload: DiscordMessagePayload,
  defaultExploitName?: string,
): Promise<{
  payload: DiscordMessagePayload;
  primaryExploit: WeaoExploitRecord | null;
}> => {
  const serialized = JSON.stringify(payload);
  if (!serialized.includes("{")) {
    const primary = defaultExploitName
      ? await findExploitByName(defaultExploitName)
      : null;
    return { payload, primaryExploit: primary };
  }

  const allExploits = await getAllExploits();
  const primaryExploit = defaultExploitName
    ? (allExploits.find(
        (e) => e.title.toLowerCase() === defaultExploitName.trim().toLowerCase(),
      ) ??
      allExploits.find((e) =>
        e.title.toLowerCase().includes(defaultExploitName.trim().toLowerCase()),
      ) ??
      null)
    : null;

  const needsDetailedSunc =
    /\{(?:exploit:[^:}]+:)?(suncPassed|suncFailed|suncTime|sunc)\}/i.test(serialized);

  const suncMap = new Map<string, WeaoSuncData | null>();
  if (primaryExploit && needsDetailedSunc) {
    suncMap.set(
      primaryExploit.title.toLowerCase(),
      await getExploitSuncDetails(primaryExploit),
    );
  }

  const scopedMatches = Array.from(
    serialized.matchAll(/\{exploit:([^:}]+):([^}]+)\}/gi),
  );
  for (const match of scopedMatches) {
    const targetName = match[1]?.trim().toLowerCase();
    if (!targetName || suncMap.has(targetName)) continue;
    const found =
      allExploits.find((e) => e.title.toLowerCase() === targetName) ??
      allExploits.find((e) => e.title.toLowerCase().includes(targetName));
    if (found && needsDetailedSunc) {
      suncMap.set(found.title.toLowerCase(), await getExploitSuncDetails(found));
    }
  }

  const interpolateString = (text: string): string =>
    text.replace(PLACEHOLDER_REGEX, (fullMatch, inner: string) => {
      if (inner.toLowerCase().startsWith("exploit:")) {
        const parts = inner.split(":");
        const targetName = parts[1]?.trim() || "";
        const fieldName = parts.slice(2).join(":").trim() || "status";
        const target =
          allExploits.find(
            (e) => e.title.toLowerCase() === targetName.toLowerCase(),
          ) ??
          allExploits.find((e) =>
            e.title.toLowerCase().includes(targetName.toLowerCase()),
          );
        if (!target) return fullMatch;
        return formatExploitField(
          target,
          fieldName,
          suncMap.get(target.title.toLowerCase()),
        );
      }

      if (!primaryExploit) return fullMatch;
      return formatExploitField(
        primaryExploit,
        inner,
        suncMap.get(primaryExploit.title.toLowerCase()),
      );
    });

  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return interpolateString(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node !== null && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };

  return {
    payload: walk(payload) as DiscordMessagePayload,
    primaryExploit,
  };
};

export const getWeaoRateLimitStatus = () => ({
  rateLimited: Date.now() < rateLimitedUntilMs,
  rateLimitedUntilMs,
  cachedCount: exploitsCache?.data.length ?? 0,
  cacheAgeMs: exploitsCache ? Date.now() - exploitsCache.fetchedAt : null,
});