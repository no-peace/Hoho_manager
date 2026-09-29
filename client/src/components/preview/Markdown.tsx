import { Fragment, type ReactNode } from "react";

/**
 * A small Discord-flavoured markdown renderer for the live preview.
 *
 * Scope is deliberate: this covers what people actually put in messages —
 * headings, emphasis, code, quotes, lists, links, mentions and custom emoji. It
 * builds React nodes rather than HTML strings, so there is no
 * `dangerouslySetInnerHTML` and therefore no injection surface.
 *
 * Anything unrecognised renders as plain text, which is exactly how Discord
 * behaves with unsupported syntax.
 */

/* ── Inline ───────────────────────────────────────────────────────────────── */

// Order matters: longer delimiters must be tried before their prefixes.
//
// Kept as a *source string* and compiled per {@link renderInline} call, NOT as a
// shared module-level `g` regex. A global regex carries `lastIndex` between
// calls; because emphasis recurses into `renderInline`, the inner call would
// reset `lastIndex` while the outer loop was mid-scan, making the outer loop
// re-match the same token forever — an infinite loop that froze the whole
// preview the moment a Components V2 TextDisplay contained `**bold**`.
const INLINE_SOURCE = [
  "(`[^`\\n]+`)", // inline code
  "(\\*\\*\\*[^*\\n]+\\*\\*\\*)", // ***bold italic***
  "(\\*\\*[^*\\n]+\\*\\*)", // **bold**
  "(__[^_\\n]+__)", // __underline__
  "(\\*[^*\\n]+\\*)", // *italic*
  "(~~[^~\\n]+~~)", // ~~strike~~
  "(\\|\\|[^|\\n]+\\|\\|)", // ||spoiler||
  "(\\[[^\\]]+\\]\\([^)]+\\))", // [text](url)
  "(<a?:\\w+:\\d+>)", // custom emoji
  "(<@!?\\d+>)", // user mention
  "(<@&\\d+>)", // role mention
  "(<#\\d+>)", // channel mention
  "(<t:\\d+(?::[tTdDfFR])?>)", // timestamp
  "(https?:\\/\\/[^\\s<]+)", // bare URL
].join("|");

const MentionChip = ({ children }: { children: ReactNode }) => (
  <span className="rounded bg-blurple/30 px-1 font-medium text-[#dee0fc]">{children}</span>
);

const renderInline = (text: string, keyPrefix = "i"): ReactNode[] => {
  if (text.length === 0) return [text];

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let index = 0;

  // Local instance: recursion gets its own `lastIndex`, so nested emphasis
  // cannot corrupt the outer scan (see {@link INLINE_SOURCE}).
  const pattern = new RegExp(INLINE_SOURCE, "g");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const token = match[0];

    // Safety net: an empty match would spin forever. Every alternative requires
    // at least one character today, but this keeps a future pattern change from
    // reintroducing a freeze.
    if (token.length === 0) {
      pattern.lastIndex += 1;
      continue;
    }

    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    lastIndex = match.index + token.length;
    const key = `${keyPrefix}-${index++}`;

    // Inline code
    if (token.length > 1 && token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-chrome px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
      continue;
    }

    // Custom emoji -> image
    const emoji = token.match(/^<(a?):(\w+):(\d+)>$/);
    if (emoji) {
      const [, animated, name, id] = emoji;
      nodes.push(
        <img
          key={key}
          src={`https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=32`}
          alt={`:${name}:`}
          title={`:${name}:`}
          className="inline-block h-[1.375em] w-[1.375em] align-[-0.3em]"
        />,
      );
      continue;
    }

    // Mentions and timestamps render as the familiar coloured chips.
    if (/^<@!?\d+>$/.test(token)) {
      nodes.push(
        <MentionChip key={key}>
          <span>@user</span>
        </MentionChip>,
      );
      continue;
    }
    if (/^<@&\d+>$/.test(token)) {
      nodes.push(
        <MentionChip key={key}>
          <span>@role</span>
        </MentionChip>,
      );
      continue;
    }
    if (/^<#\d+>$/.test(token)) {
      nodes.push(
        <MentionChip key={key}>
          <span>#channel</span>
        </MentionChip>,
      );
      continue;
    }
    if (token.startsWith("<t:")) {
      const seconds = Number(token.match(/^<t:(\d+)/)?.[1] ?? 0) * 1000;
      nodes.push(
        <span key={key} className="rounded bg-chrome px-1 text-[0.9em] text-ink-muted">
          {new Date(seconds).toLocaleString()}
        </span>,
      );
      continue;
    }

    // Links
    if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const [, label, href] = link ?? [];
      if (label && href) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer nofollow"
            className="text-link hover:underline"
          >
            {label}
          </a>,
        );
        continue;
      }
    }
    if (token.startsWith("http")) {
      nodes.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noreferrer nofollow"
          className="text-link hover:underline"
        >
          {token}
        </a>,
      );
      continue;
    }

    // Emphasis — recursion handles nesting, e.g. **bold with `code`**.
    if (token.startsWith("***")) {
      nodes.push(
        <strong key={key} className="font-bold italic">
          {renderInline(token.slice(3, -3), key)}
        </strong>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-bold">
          {renderInline(token.slice(2, -2), key)}
        </strong>,
      );
    } else if (token.startsWith("__")) {
      nodes.push(
        <span key={key} className="underline">
          {renderInline(token.slice(2, -2), key)}
        </span>,
      );
    } else if (token.startsWith("~~")) {
      nodes.push(
        <span key={key} className="line-through">
          {renderInline(token.slice(2, -2), key)}
        </span>,
      );
    } else if (token.startsWith("||")) {
      nodes.push(
        <span key={key} className="rounded bg-chrome px-1 text-transparent hover:text-ink">
          {token.slice(2, -2)}
        </span>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={key} className="italic">
          {renderInline(token.slice(1, -1), key)}
        </em>,
      );
    } else {
      nodes.push(token);
    }
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
};

/* ── Block level ──────────────────────────────────────────────────────────── */

type Block =
  | { kind: "code"; language: string; content: string }
  | { kind: "heading"; level: number; content: string }
  | { kind: "quote"; content: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "paragraph"; content: string };

const splitBlocks = (content: string): Block[] => {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const language = line.trim().slice(3);
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trimStart().startsWith("```")) {
        body.push(lines[index] ?? "");
        index += 1;
      }
      index += 1; // closing fence
      blocks.push({ kind: "code", language, content: body.join("\n") });
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: (heading[1] ?? "#").length,
        content: heading[2] ?? "",
      });
      index += 1;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const body: string[] = [];
      while (index < lines.length && (lines[index] ?? "").startsWith("> ")) {
        body.push((lines[index] ?? "").slice(2));
        index += 1;
      }
      blocks.push({ kind: "quote", content: body.join("\n") });
      continue;
    }

    // Lists
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*([-*]|\d+\.)\s+/, ""));
        index += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    blocks.push({ kind: "paragraph", content: line });
    index += 1;
  }

  return blocks;
};

export interface MarkdownProps {
  content: string;
  className?: string;
}

/** Render Discord-flavoured markdown as React nodes. */
export const Markdown = ({ content, className = "" }: MarkdownProps) => {
  if (!content) return null;
  const blocks = splitBlocks(content);

  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "code":
            return (
              <pre
                key={index}
                className="my-1 overflow-x-auto rounded border border-chrome bg-[#2b2d31] p-2 font-mono text-[0.8125rem]"
              >
                <code>{block.content}</code>
              </pre>
            );
          case "heading": {
            const sizes: Record<number, string> = {
              1: "text-xl font-bold",
              2: "text-lg font-bold",
              3: "text-base font-bold",
            };
            return (
              <p key={index} className={`mt-2 first:mt-0 ${sizes[block.level] ?? ""}`}>
                {renderInline(block.content)}
              </p>
            );
          }
          case "quote":
            return (
              <blockquote
                key={index}
                className="my-1 border-l-4 border-[#4f545c] pl-2 text-[0.95em]"
              >
                {renderInline(block.content)}
              </blockquote>
            );
          case "list":
            return block.ordered ? (
              <ol key={index} className="my-1 list-inside list-decimal space-y-0.5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ol>
            ) : (
              <ul key={index} className="my-1 list-inside list-disc space-y-0.5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          default:
            return (
              <Fragment key={index}>
                <p className="min-h-[1px]">{renderInline(block.content)}</p>
              </Fragment>
            );
        }
      })}
    </div>
  );
};

export default Markdown;
