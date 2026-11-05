import React, { useState, useEffect } from "react";
import { Hash, Volume2, Megaphone, Clock } from "lucide-react";
import { useGlobalStore } from "../../store/globalStore";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
import api from "../../api/client";

export interface MarkdownProps {
  content: string;
  className?: string;
}

interface CachedMember {
  id: string;
  username: string;
  global_name: string | null;
  nickname: string | null;
  avatar: string | null;
  roles?: string[];
}

// Module-level cache & in-flight deduplication for resolved user mentions
const resolvedMembersCache = new Map<string, CachedMember | null>();
const inflightMemberRequests = new Map<string, Promise<CachedMember | null>>();
const memberListeners = new Set<() => void>();

const notifyMemberListeners = () => {
  memberListeners.forEach((cb) => cb());
};

const fetchMemberById = (guildId: string, userId: string): Promise<CachedMember | null> => {
  const key = `${guildId}:${userId}`;
  if (resolvedMembersCache.has(key)) {
    return Promise.resolve(resolvedMembersCache.get(key) ?? null);
  }
  const existing = inflightMemberRequests.get(key);
  if (existing) return existing;

  const promise = api.discord
    .searchMembers(guildId, userId)
    .then((res) => {
      const found = (res.members || []).find((m) => m.id === userId) ?? res.members?.[0] ?? null;
      resolvedMembersCache.set(key, found);
      inflightMemberRequests.delete(key);
      notifyMemberListeners();
      return found;
    })
    .catch(() => {
      resolvedMembersCache.set(key, null);
      inflightMemberRequests.delete(key);
      notifyMemberListeners();
      return null;
    });

  inflightMemberRequests.set(key, promise);
  return promise;
};

const getDefaultAvatar = (userId: string): string => {
  try {
    const idx = (BigInt(userId) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`; } catch { return "https://cdn.discordapp.com/embed/avatars/0.png"; } };  const intToRgb = (color: number): { r: number; g: number; b: number; hex: string } => { const hex = `#${color.toString(16).padStart(6, "0")}`;
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return { r, g, b, hex };
};

/* ── Rich Mention, Emoji & Timestamp Components ───────────────────────────── */

const UserMention: React.FC<{ id: string }> = ({ id }) => {
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const guilds = useDiscordCacheStore((state) => state.guilds);
  const rolesMap = useDiscordCacheStore((state) => state.roles);
  const fetchGuilds = useDiscordCacheStore((state) => state.fetchGuilds);
  const fetchRoles = useDiscordCacheStore((state) => state.fetchRoles);

  const effectiveGuildId = selectedGuildId || guilds?.[0]?.id || "";
  const cacheKey = `${effectiveGuildId}:${id}`;

  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    memberListeners.add(listener);
    return () => {
      memberListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!selectedGuildId && !guilds) {
      fetchGuilds();
    }
  }, [selectedGuildId, guilds, fetchGuilds]);

  useEffect(() => {
    if (effectiveGuildId) {
      fetchRoles(effectiveGuildId);
      if (!resolvedMembersCache.has(cacheKey)) {
        void fetchMemberById(effectiveGuildId, id);
      }
    }
  }, [effectiveGuildId, id, cacheKey, fetchRoles]);

  const member = resolvedMembersCache.get(cacheKey);
  const guildRoles = (effectiveGuildId && rolesMap[effectiveGuildId]) || [];

  // Find highest colored role if member roles are available
  let roleColor: { r: number; g: number; b: number; hex: string } | null = null;
  if (member?.roles && member.roles.length > 0 && guildRoles.length > 0) {
    const matchingColored = guildRoles.filter(
      (r) => member.roles!.includes(r.id) && r.color > 0
    );
    if (matchingColored.length > 0) {
      roleColor = intToRgb(matchingColored[0].color);
    }
  }

  const displayName = member
    ? member.nickname || member.global_name || member.username
    : `user-${id.slice(-4)}`;  const avatarUrl = member?.avatar ? `https://cdn.discordapp.com/avatars/${id}/${member.avatar}.${
        member.avatar.startsWith("a_") ? "gif" : "webp"
      }?size=32`
    : getDefaultAvatar(id);

  return (
    <span
      title={`<@${id}>`} style={ roleColor ? { backgroundColor: `rgba(${roleColor.r}, ${roleColor.g},${roleColor.b}, 0.18)`,
              color: roleColor.hex,
            }
          : undefined
      }
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium text-[14px] leading-tight align-baseline transition-colors cursor-pointer select-none mx-0.5 ${
        roleColor ? "hover:brightness-110" : "bg-[#5865f2]/25 text-[#c9cdfb] hover:bg-[#5865f2]/40"
      }`}
    >
      <img
        src={avatarUrl}
        alt=""
        className="w-4 h-4 rounded-full object-cover shrink-0 inline-block"
        onError={(e) => {
          const fallback = getDefaultAvatar(id);
          if (e.currentTarget.src !== fallback) {
            e.currentTarget.src = fallback;
          }
        }}
      />
      <span>@{displayName}</span>
    </span>
  );
};

const RoleMention: React.FC<{ id: string }> = ({ id }) => {
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const guilds = useDiscordCacheStore((state) => state.guilds);
  const rolesMap = useDiscordCacheStore((state) => state.roles);
  const fetchGuilds = useDiscordCacheStore((state) => state.fetchGuilds);
  const fetchRoles = useDiscordCacheStore((state) => state.fetchRoles);

  const effectiveGuildId = selectedGuildId || guilds?.[0]?.id || "";

  useEffect(() => {
    if (!selectedGuildId && !guilds) fetchGuilds();
  }, [selectedGuildId, guilds, fetchGuilds]);

  useEffect(() => {
    if (effectiveGuildId) fetchRoles(effectiveGuildId);
  }, [effectiveGuildId, fetchRoles]);

  const guildRoles = (effectiveGuildId && rolesMap[effectiveGuildId]) || [];
  const role = guildRoles.find((r) => r.id === id);
  const rgb = role && role.color > 0 ? intToRgb(role.color) : null;

  return (
    <span
      title={`<@&${id}>`} style={ rgb ? { backgroundColor: `rgba(${rgb.r}, ${rgb.g},${rgb.b}, 0.18)`,
              color: rgb.hex,
            }
          : undefined
      }
      className={`inline-flex items-center px-1 py-0.5 rounded font-medium text-[14px] leading-tight transition-colors cursor-pointer select-none mx-0.5 ${ rgb ? "hover:brightness-110" : "bg-[#5865f2]/25 text-[#c9cdfb] hover:bg-[#5865f2]/40" }`} > @{role ? role.name : `role-${id.slice(-4)}`}
    </span>
  );
};

const ChannelMention: React.FC<{ id: string }> = ({ id }) => {
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const guilds = useDiscordCacheStore((state) => state.guilds);
  const channelsMap = useDiscordCacheStore((state) => state.channels);
  const fetchGuilds = useDiscordCacheStore((state) => state.fetchGuilds);
  const fetchChannels = useDiscordCacheStore((state) => state.fetchChannels);

  const effectiveGuildId = selectedGuildId || guilds?.[0]?.id || "";

  useEffect(() => {
    if (!selectedGuildId && !guilds) fetchGuilds();
  }, [selectedGuildId, guilds, fetchGuilds]);

  useEffect(() => {
    if (effectiveGuildId) fetchChannels(effectiveGuildId);
  }, [effectiveGuildId, fetchChannels]);

  const guildChannels = (effectiveGuildId && channelsMap[effectiveGuildId]) || [];
  const channel = guildChannels.find((c) => c.id === id);

  const Icon =
    channel?.type === 2 ? Volume2 : channel?.type === 5 ? Megaphone : Hash;

  return (
    <span
      title={`<#${id}>`} className="inline-flex items-center gap-0.5 bg-[#5865f2]/25 text-[#c9cdfb] hover:bg-[#5865f2]/40 hover:text-white px-1.5 py-0.5 rounded font-medium text-[14px] leading-tight transition-colors cursor-pointer select-none mx-0.5 align-baseline" > <Icon size={13} className="inline-block shrink-0" /> <span>{channel ? channel.name : `channel-${id.slice(-4)}`}</span>
    </span>
  );
};

const formatRelativeTime = (targetMs: number, nowMs: number): string => {
  const diffSec = Math.round((targetMs - nowMs) / 1000);
  const absSec = Math.abs(diffSec);
  const isFuture = diffSec > 0;

  const fmt = (n: number, unit: string) => {
    const label = `${n}${unit}${n === 1 ? "" : "s"}`; return isFuture ? `in ${label}` : `${label} ago`; };  if (absSec < 45) return isFuture ? "in a few seconds" : "a few seconds ago"; const mins = Math.round(absSec / 60); if (mins < 60) return fmt(mins, "minute"); const hours = Math.round(absSec / 3600); if (hours < 24) return fmt(hours, "hour"); const days = Math.round(absSec / 86400); if (days < 30) return fmt(days, "day"); const months = Math.round(absSec / (86400 * 30)); if (months < 12) return fmt(months, "month"); const years = Math.round(absSec / (86400 * 365)); return fmt(years, "year"); };  const TimestampMention: React.FC<{ unix: number; format?: string }> = ({ unix, format = "f", }) => { const [nowMs, setNowMs] = useState(() => Date.now());  useEffect(() => { if (format !== "R") return; const timer = setInterval(() => setNowMs(Date.now()), 30_000); return () => clearInterval(timer); }, [format]);  const date = new Date(unix * 1000); if (Number.isNaN(date.getTime())) { return <span>{`<t:${unix}:${format}>`}</span>; }  let formatted = ""; switch (format) { case "t": formatted = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); break; case "T": formatted = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit", }); break; case "d": formatted = date.toLocaleDateString(); break; case "D": formatted = date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric", }); break; case "F": formatted = `${date.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })} ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`; break; case "R": formatted = formatRelativeTime(date.getTime(), nowMs); break; case "f": default: formatted = `${date.toLocaleDateString([], {
        month: "long",
        day: "numeric",
        year: "numeric",
      })} ${date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      })}`;
      break;
    }
    return (
    <span title={date.toLocaleString()}
      className="inline-flex items-center gap-1 rounded-[3px] bg-[#3c3f45]/80 px-1.5 py-0.5 text-[13px] text-[#dbdee1] font-normal mx-0.5 cursor-pointer select-none" >
        <Clock size={11} className="text-[#949ba4] shrink-0" />
        <span>{formatted}</span>
      </span> ); };
      const CustomEmojiImg: React.FC<{
        id: string;
        name: string; 
        animated: boolean; 
        jumbo?: boolean; 
      }> = ({ id, name, animated, jumbo = false }) => { 
        const [extIndex, setExtIndex] = useState(0); 
        const exts = animated ? ["gif", "webp", "png"] : ["webp", "png", "gif"]; 
        const currentExt = exts[extIndex] || "png";  return ( <img src={`https://cdn.discordapp.com/emojis/${id}.${currentExt}?size=${
        jumbo ? 96 : 48
      }&quality=lossless`}
      alt={`:${name}:`} title={`:${name}:`}
      onError={() => {
        if (extIndex < exts.length - 1) {
          setExtIndex(extIndex + 1);
        }
      }}
      className={`inline-block object-contain align-middle mx-0.5 ${
        jumbo ? "h-10 w-10 my-0.5" : "h-[22px] w-[22px]"
      }`}
    />
  );
};

const SpoilerText: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={() => setRevealed(!revealed)}
      title={revealed ? "Click to hide spoiler" : "Click to reveal spoiler"}
      className={`inline-block px-1 py-0.5 rounded cursor-pointer transition-colors ${
        revealed
          ? "bg-[#2b2d31] text-[#dbdee1] border border-[#3f4147]"
          : "bg-[#202225] text-transparent hover:bg-[#25282c] select-none"
      }`}
    >
      {children}
    </span>
  );
};

const isJumboEmojiLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const withoutCustomEmojis = trimmed.replace(/<a?:[a-zA-Z0-9_~]+:\d+>/g, "").trim();
  const emojiCount = (trimmed.match(/<a?:[a-zA-Z0-9_~]+:\d+>/g) || []).length;
  return withoutCustomEmojis.length === 0 && emojiCount >= 1 && emojiCount <= 30;
};

const renderInline = (text: string, jumbo = false): React.ReactNode => {
  if (!text) return null;

  // 1. Spoiler tags
  const spoilerRegex = new RegExp("\\|\\|([\\s\\S]+?)\\|\\|", "g");
  if (spoilerRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(spoilerRegex, (match, inner, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset), jumbo));
      parts.push(<SpoilerText key={offset}>{renderInline(inner, jumbo)}</SpoilerText>);
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex), jumbo));
    return <>{parts}</>;
  }

  // 2. Inline Code: `code`
  const codeRegex = /`([^`]+)`/g;
  if (codeRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(codeRegex, (match, code, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset), jumbo));
      parts.push(
        <code
          key={offset}
          className="bg-[#1e1f22] text-[#e0e1e5] px-1.5 py-0.5 rounded text-[13px] font-mono border border-[#111214]"
        >
          {code}
        </code>
      );
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex), jumbo));
    return <>{parts}</>;
  }

  // 3. Custom Discord Emojis: <:name:id> or <a:name:id>
  const emojiRegex = /<(a?):([a-zA-Z0-9_~]+):(\d+)>/g;
  if (emojiRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(emojiRegex, (match, animated, name, id, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset), jumbo));
      parts.push(
        <CustomEmojiImg
          key={`emoji-${id}-${offset}`}
          id={id}
          name={name}
          animated={Boolean(animated)}
          jumbo={jumbo}
        />
      );
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex), jumbo));
    return <>{parts}</>;
  }

  // 4. Timestamps: <t:unix> or <t:unix:format>
  const timestampRegex = /<t:(-?\d+)(?::([tTdDfFR]))?>/g;
  if (timestampRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(timestampRegex, (match, unixStr, fmt, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset), jumbo));
      parts.push(
        <TimestampMention
          key={`ts-${offset}`}
          unix={Number(unixStr)}
          format={fmt || "f"}
        />
      );
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex), jumbo));
    return <>{parts}</>;
  }

  // 5. Mentions: User <@id> / <@!id>, Role <@&id>, Channel <#id>
  const mentionRegex = /<(@[!&]?|#)([0-9]{15,22})>/g;
  if (mentionRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(mentionRegex, (match, prefix, id, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset), jumbo));
      if (prefix === "#") {
        parts.push(<ChannelMention key={`ch-${id}-${offset}`} id={id} />);
      } else if (prefix === "@&") {
        parts.push(<RoleMention key={`role-${id}-${offset}`} id={id} />);
      } else {
        parts.push(<UserMention key={`usr-${id}-${offset}`} id={id} />);
      }
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex), jumbo));
    return <>{parts}</>;
  }

  // 6. @everyone and @here
  const globalMentionRegex = /(@everyone|@here)/g;
  if (globalMentionRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(globalMentionRegex, (match, token, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset), jumbo));
      parts.push(
        <span
          key={`gm-${offset}`}
          className="bg-[#5865f2]/25 text-[#c9cdfb] hover:bg-[#5865f2]/40 px-1 py-0.5 rounded font-medium text-[14px] mx-0.5 select-none"
        >
          {token}
        </span>
      );
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex), jumbo));
    return <>{parts}</>;
  }

  // 7. Bold & Italic & Strike & Underline
  if (/\*\*\*([^*]+)\*\*\*/.test(text)) {
    const parts = text.split(/\*\*\*([^*]+)\*\*\*/);
    return (
      <>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <strong key={i}>
              <em>{renderInline(part, jumbo)}</em>
            </strong>
          ) : (
            renderInline(part, jumbo)
          )
        )}
      </>
    );
  }

  if (/\*\*([^*]+)\*\*/.test(text)) {
    const parts = text.split(/\*\*([^*]+)\*\*/);
    return (
      <>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <strong key={i} className="font-bold text-white">
              {renderInline(part, jumbo)}
            </strong>
          ) : (
            renderInline(part, jumbo)
          )
        )}
      </>
    );
  }

  if (/__([^_]+)__/.test(text)) {
    const parts = text.split(/__([^_]+)__/);
    return (
      <>
        {parts.map((part, i) =>
          i % 2 === 1 ? <u key={i}>{renderInline(part, jumbo)}</u> : renderInline(part, jumbo)
        )}
      </>
    );
  }

  if (/~~([^~]+)~~/.test(text)) {
    const parts = text.split(/~~([^~]+)~~/);
    return (
      <>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <del key={i} className="line-through opacity-75">
              {renderInline(part, jumbo)}
            </del>
          ) : (
            renderInline(part, jumbo)
          )
        )}
      </>
    );
  }

  if (/\*([^*]+)\*/.test(text)) {
    const parts = text.split(/\*([^*]+)\*/);
    return (
      <>
        {parts.map((part, i) =>
          i % 2 === 1 ? <em key={i}>{renderInline(part, jumbo)}</em> : renderInline(part, jumbo)
        )}
      </>
    );
  }

  // 8. Hyperlinks: [Title](url)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  if (linkRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(linkRegex, (match, label, url, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset), jumbo));
      parts.push(
        <a
          key={offset}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-[#00a8fc] hover:underline"
        >
          {label}
        </a>
      );
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex), jumbo));
    return <>{parts}</>;
  }

  return text;
};

const MarkdownComponent: React.FC<MarkdownProps> = ({ content, className = "" }) => {
  if (!content) return null;

  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced Code Block handling
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        renderedElements.push(
          <pre
            key={`code-${i}`}
            className="my-1.5 overflow-x-auto rounded bg-[#1e1f22] border border-[#111214] p-3 font-mono text-[13px] text-[#dbdee1]"
          >
            <code>{codeBlockBuffer.join("\n")}</code>
          </pre>
        );
        inCodeBlock = false;
        codeBlockBuffer = [];
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    // Subtext (-# text)
    if (line.startsWith("-# ")) {
      renderedElements.push(
        <p key={i} className="text-xs text-[#949ba4] leading-normal my-0.5">
          {renderInline(line.slice(3))}
        </p>
      );
      continue;
    }

    // Headers
    if (line.startsWith("# ")) {
      renderedElements.push(
        <h1 key={i} className="text-xl font-bold text-white mt-2 mb-1">
          {renderInline(line.slice(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      renderedElements.push(
        <h2 key={i} className="text-lg font-bold text-white mt-1.5 mb-0.5">
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      renderedElements.push(
        <h3 key={i} className="text-base font-bold text-white mt-1 mb-0.5">
          {renderInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      renderedElements.push(
        <blockquote
          key={i}
          className="my-1 border-l-4 border-[#4f545c] pl-3 text-[#dbdee1]"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    const jumbo = isJumboEmojiLine(line);

    // Regular line
    renderedElements.push(
      <p key={i} className="min-h-[1.25rem] whitespace-pre-wrap break-words leading-relaxed">
        {renderInline(line, jumbo)}
      </p>
    );
  }

  // Unclosed code block fallback
  if (inCodeBlock) {
    renderedElements.push(
      <pre
        key="unclosed-code"
        className="my-1.5 overflow-x-auto rounded bg-[#1e1f22] border border-[#111214] p-3 font-mono text-[13px] text-[#dbdee1]"
      >
        <code>{codeBlockBuffer.join("\n")}</code>
      </pre>
    );
  }

  return <div className={`space-y-0.5 ${className}`}>{renderedElements}</div>;
};

export const Markdown = React.memo(MarkdownComponent);
export default Markdown;