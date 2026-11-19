import type React from "react";
import type { WeaoExploitItem } from "../store/discordCacheStore";

export type AutocompleteType =
  | "user"
  | "channel"
  | "emoji"
  | "variable"
  | "exploit_name"
  | "exploit_field"
  | null;

export interface AutocompleteItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  replacement: string;
  keepOpen?: boolean;
  disabled?: boolean;
}

export interface DetectedToken {
  type: AutocompleteType;
  query: string;
  exploitTarget?: string;
  start: number;
  end: number;
}

export const COMMON_EMOJIS_LIST = [
  { name: "grinning", char: "😀" },
  { name: "smiley", char: "😃" },
  { name: "smile", char: "😄" },
  { name: "grin", char: "😁" },
  { name: "laughing", char: "😆" },
  { name: "sweat_smile", char: "😅" },
  { name: "rofl", char: "🤣" },
  { name: "joy", char: "😂" },
  { name: "wink", char: "😉" },
  { name: "blush", char: "😊" },
  { name: "innocent", char: "😇" },
  { name: "heart_eyes", char: "😍" },
  { name: "star_struck", char: "🤩" },
  { name: "sunglasses", char: "😎" },
  { name: "thinking", char: "🤔" },
  { name: "fire", char: "🔥" },
  { name: "sparkles", char: "✨" },
  { name: "heart", char: "❤️" },
  { name: "thumbsup", char: "👍" },
  { name: "thumbsdown", char: "👎" },
  { name: "clap", char: "👏" },
  { name: "wave", char: "👋" },
  { name: "white_check_mark", char: "✅" },
  { name: "x", char: "❌" },
  { name: "warning", char: "⚠️" },
  { name: "bell", char: "🔔" },
  { name: "tada", char: "🎉" },
] as const;

export interface ExploitFieldOption {
  key: string;
  label: string;
  getPreview: (exp?: WeaoExploitItem) => string;
}

export const EXPLOIT_FIELD_OPTIONS: readonly ExploitFieldOption[] = [
  {
    key: "status",
    label: "Status Badge (🟢 Updated / 🔴 Outdated)",
    getPreview: (e) => (e ? (e.updateStatus ? "🟢 Updated" : "🔴 Outdated") : "🟢 Updated"),
  },
  {
    key: "circle",
    label: "Status Circle Only (🟢 / 🔴)",
    getPreview: (e) => (e ? (e.updateStatus ? "🟢" : "🔴") : "🟢"),
  },
  {
    key: "statusText",
    label: "Status Text Only (Updated / Outdated)",
    getPreview: (e) => (e ? (e.updateStatus ? "Updated" : "Outdated") : "Updated"),
  },
  {
    key: "sunc",
    label: "sUNC Percentage",
    getPreview: (e) =>
      typeof e?.suncPercentage === "number" ? `${e.suncPercentage}%` : "100%",
  },
  {
    key: "unc",
    label: "UNC Percentage",
    getPreview: (e) =>
      typeof e?.uncPercentage === "number" ? `${e.uncPercentage}%` : "99%",
  },
  {
    key: "version",
    label: "Exploit Version",
    getPreview: (e) => e?.version || "v1.0.0",
  },
  {
    key: "rbxversion",
    label: "Target Roblox Version",
    getPreview: (e) => e?.rbxversion || "version-latest",
  },
  {
    key: "updatedDate",
    label: "Last Updated Timestamp (UTC)",
    getPreview: (e) => e?.updatedDate || "Recently",
  },
  {
    key: "detected",
    label: "Detection Status",
    getPreview: (e) => (e ? (e.detected ? "Detected" : "Undetected") : "Undetected"),
  },
  {
    key: "free",
    label: "Pricing / Cost",
    getPreview: (e) => (e ? (e.free ? "Free" : e.cost || "Paid") : "Free / Paid"),
  },
  {
    key: "platform",
    label: "Operating System / Platform",
    getPreview: (e) => e?.platform || "Windows",
  },
  {
    key: "decompiler",
    label: "Decompiler Support",
    getPreview: (e) => (e ? (e.decompiler ? "✅" : "❌") : "✅"),
  },
  {
    key: "multiInject",
    label: "Multi-Inject Support",
    getPreview: (e) => (e ? (e.multiInject ? "✅" : "❌") : "✅"),
  },
  {
    key: "keysystem",
    label: "Key System Requirement",
    getPreview: (e) => (e ? (e.keysystem ? "Key System" : "Keyless") : "🔑 / 🔓"),
  },
  {
    key: "suncPassed",
    label: "sUNC Passed Tests Count (Live Scrap)",
    getPreview: (e) => (e?.sunc?.suncScrap ? "Fetched from /api/sunc" : "N/A"),
  },
  {
    key: "suncFailed",
    label: "sUNC Failed Tests Count (Live Scrap)",
    getPreview: (e) => (e?.sunc?.suncScrap ? "Fetched from /api/sunc" : "N/A"),
  },
  {
    key: "suncTime",
    label: "sUNC Benchmark Duration (Seconds)",
    getPreview: (e) => (e?.sunc?.suncScrap ? "Fetched from /api/sunc" : "N/A"),
  },
  {
    key: "websitelink",
    label: "Official Website URL",
    getPreview: (e) => e?.websitelink || "https://...",
  },
  {
    key: "discordlink",
    label: "Official Discord Invite URL",
    getPreview: (e) => e?.discordlink || "https://discord.gg/...",
  },
  {
    key: "purchaselink",
    label: "Official Purchase Link",
    getPreview: (e) => e?.purchaselink || "https://...",
  },
  {
    key: "changelogs",
    label: "Recent Changelogs",
    getPreview: () => "Formatted WEAO release notes",
  },
];

/**
 * Pure function that inspects text up to `cursorPos` and detects active
 * autocomplete triggers (`{exploit.<Name>.<Field>`, `{variable`, `@user`, `#channel`, `:emoji`).
 */
export const detectAutocompleteToken = (
  text: string,
  cursorPos: number,
  weaoExploits: readonly WeaoExploitItem[] = [],
): DetectedToken | null => {
  const beforeCursor = text.slice(0, cursorPos);
  const braceMatch = beforeCursor.match(/(\{{1,2})([^{}\r\n]*)$/);

  if (braceMatch) {
    const token = braceMatch[2] ?? "";
    const start = cursorPos - braceMatch[0].length;
    if (token.toLowerCase().startsWith("exploit.")) {
        const afterPrefix = token.slice("exploit.".length);
        const sortedKnown = [...weaoExploits].sort((a, b) => b.title.length - a.title.length);
        const matchedKnown = sortedKnown.find((exploit) =>
          afterPrefix.toLowerCase().startsWith(`${exploit.title.toLowerCase()}.`),
        );

        if (matchedKnown) {
          const fieldQuery = afterPrefix.slice(matchedKnown.title.length + 1);
          if (!fieldQuery.includes(".")) {
            return {
              type: "exploit_field",
              exploitTarget: matchedKnown.title,
              query: fieldQuery,
              start,
              end: cursorPos,
            };
          }
        }

        const lastDotIndex = afterPrefix.lastIndexOf(".");
        if (lastDotIndex > 0) {
          const candidateName = afterPrefix.slice(0, lastDotIndex);
          const fieldQuery = afterPrefix.slice(lastDotIndex + 1);
          const isPartialDottedExploit = sortedKnown.some(
            (exploit) =>
              exploit.title.includes(".") &&
              exploit.title.toLowerCase().startsWith(`${candidateName.toLowerCase()}.`) &&
              exploit.title.toLowerCase() !== candidateName.toLowerCase(),
          );
          const isKnownExploit = sortedKnown.some(
            (exploit) => exploit.title.toLowerCase() === candidateName.toLowerCase(),
          );
          const isKnownField = EXPLOIT_FIELD_OPTIONS.some(
            (field) => field.key.toLowerCase() === fieldQuery.toLowerCase(),
          );
          const isFieldPrefix = fieldQuery.length > 0 && EXPLOIT_FIELD_OPTIONS.some(
            (field) => field.key.toLowerCase().startsWith(fieldQuery.toLowerCase()),
          );

          if (sortedKnown.length > 0 && !isPartialDottedExploit && (isKnownExploit || fieldQuery === "" || isKnownField || isFieldPrefix)) {
            return {
              type: "exploit_field",
              exploitTarget: candidateName,
              query: fieldQuery,
              start,
              end: cursorPos,
            };
          }
        }

        return {
          type: "exploit_name",
          query: afterPrefix,
          start,
          end: cursorPos,
        };
      }

      if (!/\s/.test(token)) {
        return {
          type: "variable",
          query: token,
          start,
          end: cursorPos,
        };
      }
  }

  const userMatch = beforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_.-]{0,32})$/);
  if (userMatch) {
    const startOffset = userMatch[0].startsWith("@") ? 0 : 1;
    return {
      type: "user",
      query: userMatch[1] || "",
      start: cursorPos - userMatch[0].length + startOffset,
      end: cursorPos,
    };
  }

  const channelMatch = beforeCursor.match(/(?:^|\s)#([a-zA-Z0-9_-]{0,32})$/);
  if (channelMatch) {
    const startOffset = channelMatch[0].startsWith("#") ? 0 : 1;
    return {
      type: "channel",
      query: channelMatch[1] || "",
      start: cursorPos - channelMatch[0].length + startOffset,
      end: cursorPos,
    };
  }

  const emojiMatch = beforeCursor.match(/(?:^|\s):([a-zA-Z0-9_]{1,32})$/);
  if (emojiMatch) {
    const startOffset = emojiMatch[0].startsWith(":") ? 0 : 1;
    return {
      type: "emoji",
      query: emojiMatch[1] || "",
      start: cursorPos - emojiMatch[0].length + startOffset,
      end: cursorPos,
    };
  }

  return null;
};

export const replaceDetectedToken = (
  text: string,
  token: Pick<DetectedToken, "start" | "end">,
  replacement: string,
): { value: string; cursor: number } => {
  const start = Math.max(0, Math.min(text.length, token.start));
  const end = Math.max(start, Math.min(text.length, token.end));
  return {
    value: text.slice(0, start) + replacement + text.slice(end),
    cursor: start + replacement.length,
  };
};
