import React, { Fragment, useState } from "react";

export interface MarkdownProps {
  content: string;
  className?: string;
}

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

const renderInline = (text: string): React.ReactNode => {
  if (!text) return null;

  // 1. Spoilers: ||text||
  const spoilerRegex = /\|\|([\s\S]+?)\|\|/g;
  if (spoilerRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(spoilerRegex, (match, inner, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset)));
      parts.push(<SpoilerText key={offset}>{renderInline(inner)}</SpoilerText>);
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex)));
    return <>{parts}</>;
  }

  // 2. Custom Discord Emojis: <:name:id> or <a:name:id>
  const emojiRegex = /<(a?):([a-zA-Z0-9_~]+):(\d{17,20})>/g;
  if (emojiRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(emojiRegex, (match, animated, name, id, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset)));
      const ext = animated ? "gif" : "png";
      parts.push(
        <img
          key={offset}
          src={`[https://cdn.discordapp.com/emojis/$](https://cdn.discordapp.com/emojis/$){id}.${ext}?size=48`}
          alt={`:${name}:`}
          title={`:${name}:`}
          className="inline-block h-5 w-5 object-contain align-text-bottom mx-0.5"
        />
      );
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex)));
    return <>{parts}</>;
  }

  // 3. Mentions: User <@id>, Role <@&id>, Channel <#id>
  const mentionRegex = /<(@[!&]?|#)(\d{17,20})>/g;
  if (mentionRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(mentionRegex, (match, type, id, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset)));
      const isChannel = type === "#";
      const isRole = type === "@&";
      parts.push(
        <span
          key={offset}
          className="bg-[#5865f2]/15 text-[#c9cdfb] hover:bg-[#5865f2]/30 px-1 py-0.2 rounded font-medium text-[13px] transition-colors cursor-pointer select-none inline-block mx-0.5"
        >
          {isChannel ? "#channel" : isRole ? "@role" : "@user"}
        </span>
      );
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex)));
    return <>{parts}</>;
  }

  // 4. Inline Code: `code`
  const codeRegex = /`([^`]+)`/g;
  if (codeRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(codeRegex, (match, code, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset)));
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
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex)));
    return <>{parts}</>;
  }

  // 5. Bold & Italic & Strike & Underline
  // Bold-Italic ***text***
  if (/\*\*\*([^*]+)\*\*\*/.test(text)) {
    const parts = text.split(/\*\*\*([^*]+)\*\*\*/);
    return (
      <>
        {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}><em>{part}</em></strong> : renderInline(part)))}
      </>
    );
  }

  // Bold **text**
  if (/\*\*([^*]+)\*\*/.test(text)) {
    const parts = text.split(/\*\*([^*]+)\*\*/);
    return (
      <>
        {parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="font-bold text-white">{part}</strong> : renderInline(part)))}
      </>
    );
  }

  // Underline __text__
  if (/__([^_]+)__/.test(text)) {
    const parts = text.split(/__([^_]+)__/);
    return (
      <>
        {parts.map((part, i) => (i % 2 === 1 ? <u key={i}>{part}</u> : renderInline(part)))}
      </>
    );
  }

  // Strikethrough ~~text~~
  if (/~~([^~]+)~~/.test(text)) {
    const parts = text.split(/~~([^~]+)~~/);
    return (
      <>
        {parts.map((part, i) => (i % 2 === 1 ? <del key={i} className="opacity-70">{part}</del> : renderInline(part)))}
      </>
    );
  }

  // Italic *text* or _text_
  if (/\*([^*]+)\*/.test(text)) {
    const parts = text.split(/\*([^*]+)\*/);
    return (
      <>
        {parts.map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : renderInline(part)))}
      </>
    );
  }

  // Hyperlinks: [Title](url)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  if (linkRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    text.replace(linkRegex, (match, label, url, offset) => {
      if (offset > lastIndex) parts.push(renderInline(text.slice(lastIndex, offset)));
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
    if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex)));
    return <>{parts}</>;
  }

  return text;
};

export const Markdown: React.FC<MarkdownProps> = ({ content, className = "" }) => {
  if (!content) return null;

  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  let codeBlockLang = "";

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
        codeBlockLang = "";
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
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

    // Regular line
    renderedElements.push(
      <p key={i} className="min-h-[1.25rem] whitespace-pre-wrap break-words leading-relaxed">
        {renderInline(line)}
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

export default Markdown;