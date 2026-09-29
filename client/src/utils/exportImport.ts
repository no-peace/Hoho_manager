import { EDITOR_MODES, MessageFlags, TargetType } from "./constants";
import type { EditorMode } from "./constants";
import type {
  ComponentNode,
  DiscordMessagePayload,
  EmbedData,
  MessageData,
  QueryData,
  TargetData,
} from "@dmb/shared";
import { stripInternal } from "./discord";

/**
 * Import/export in Discohook's `QueryData` format (`version: "d2"`).
 *
 * Compatibility matters: users who already have Discohook backups should be able
 * to paste them in, and our exports should open there. That means keeping the
 * `messages[].data` nesting and the `targets[]` array intact, even though the
 * editor deals with a single message at a time.
 */

export interface EditorDocument {
  data: MessageData;
  targets: TargetData[];
}

/** Editor state -> QueryData. */
export const toQueryData = ({ data, targets }: EditorDocument): QueryData => ({
  version: "d2",
  messages: [{ data: stripInternal(data) as DiscordMessagePayload }],
  targets: targets.map((target) => ({ type: TargetType.Webhook, url: target.url })),
});

export interface LoadedDocument {
  data: MessageData;
  mode: EditorMode;
  targets: TargetData[];
}

/* ── Internal id plumbing ─────────────────────────────────────────────────── */

let idCounter = 0;
const nextId = (): string =>
  `i${(idCounter += 1).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Attach an editor id to an imported embed. */
const addEmbedIds = (embed: EmbedData): EmbedData => ({
  _id: nextId(),
  ...embed,
  ...(Array.isArray(embed.fields)
    ? { fields: embed.fields.map((field) => ({ _id: nextId(), ...field })) }
    : {}),
});

/** Attach editor ids to a component tree without mutating the input. */
const addComponentIds = (component: ComponentNode): ComponentNode => {
  const copy: ComponentNode = { _id: nextId(), ...component };

  if (Array.isArray(component.components)) {
    copy.components = component.components.map(addComponentIds);
  }
  if (Array.isArray(component.items)) {
    copy.items = component.items.map((item) => ({ _id: nextId(), ...item }));
  }
  if (Array.isArray(component.options)) {
    copy.options = component.options.map((option) => ({ _id: nextId(), ...option }));
  }
  return copy;
};

/**
 * QueryData -> editor state.
 * Tolerates the older shape where message fields sit at the top level.
 */
export const fromQueryData = (queryData: QueryData): LoadedDocument => {
  const message = queryData.messages[0];
  const data = (message?.data ?? {}) as DiscordMessagePayload & Record<string, unknown>;

  const isV2 = Boolean((data.flags ?? 0) & MessageFlags.IsComponentsV2);

  return {
    data: {
      content: typeof data.content === "string" ? data.content : "",
      embeds: Array.isArray(data.embeds) ? data.embeds.map(addEmbedIds) : [],
      components: Array.isArray(data.components) ? data.components.map(addComponentIds) : [],
      username: typeof data.username === "string" ? data.username : "",
      avatar_url: typeof data.avatar_url === "string" ? data.avatar_url : "",
      thread_name: typeof data.thread_name === "string" ? data.thread_name : "",
    },
    mode: isV2 ? EDITOR_MODES.V2 : EDITOR_MODES.CLASSIC,
    targets: (queryData.targets ?? []).map((target) => ({ url: target.url })),
  };
};

/* ── File helpers ─────────────────────────────────────────────────────────── */

/** Trigger a browser download of `value` as pretty-printed JSON. */
export const downloadJson = (value: unknown, filename = "message.json"): void => {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

/**
 * Parse JSON the user pasted or dropped in.
 * Throws a friendly error instead of letting a raw SyntaxError escape.
 */
export const parseImportedJson = (text: string): QueryData => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That doesn't look like valid JSON.");
  }

  // Some tools wrap the document under `data`.
  const candidate =
    parsed !== null &&
    typeof parsed === "object" &&
    "data" in parsed &&
    !("messages" in parsed)
      ? (parsed as { data: unknown }).data
      : parsed;

  if (
    candidate === null ||
    typeof candidate !== "object" ||
    !Array.isArray((candidate as QueryData).messages)
  ) {
    throw new Error("Expected a Discohook backup with a `messages` array.");
  }

  return candidate as QueryData;
};
