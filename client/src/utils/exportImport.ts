import { MessageFlags } from "@dmb/shared";
import type { MessageData, ComponentNode, EmbedData, EmbedField } from "@dmb/shared";
import { EDITOR_MODES } from "./constants";
import type { EditorMode } from "./constants";

export interface QueryData {
  version?: "d2" | string;
  messages: { data: MessageData }[];
  mode?: EditorMode;
}

const genId = () => Math.random().toString(36).substring(2, 9);

export const getEditorModeForDiscordMessage = (message: unknown): EditorMode => {
  if (message === null || typeof message !== "object") return EDITOR_MODES.CLASSIC;
  const flags = (message as Record<string, unknown>).flags;
  return typeof flags === "number" && (flags & MessageFlags.IsComponentsV2) !== 0
    ? EDITOR_MODES.V2
    : EDITOR_MODES.CLASSIC;
};
const hydrateComponentNode = (c: any): ComponentNode => {
  const node: ComponentNode = {
    ...c,
    _id: c._id || genId(),
  };
  if (c.accessory && typeof c.accessory === "object") {
    node.accessory = hydrateComponentNode(c.accessory);
  }
  if (Array.isArray(c.options)) {
    node.options = c.options.map((o: any) => ({ ...o, _id: o._id || genId() }));
  }
  if (Array.isArray(c.items)) {
    node.items = c.items.map((it: any) => ({ ...it, _id: it._id || genId() }));
  }
  if (Array.isArray(c.components)) {
    node.components = c.components.map(hydrateComponentNode);
  }
  return node;
};

const normalizeMessageData = (raw: any): MessageData => {
  let item = raw !== null && typeof raw === "object" ? raw : {};
  if (item.data !== null && typeof item.data === "object" && !Array.isArray(item.data)) {
    item = item.data;
  }
  const normalized = { ...item };
  delete normalized.username;
  delete normalized.avatar_url;
  return {
    ...normalized,
    content: item.content || "",
    thread_name: item.thread_name || "",
    ...(typeof item.flags === "number" ? { flags: item.flags } : {}),
    embeds: (item.embeds || []).map((e: any): EmbedData => ({
      ...e,
      _id: e._id || genId(),
      fields: (e.fields || []).map((f: any): EmbedField => ({ ...f, _id: f._id || genId() })),
    })),
    components: (item.components || []).map(hydrateComponentNode),
  };
};

export interface ParsedQueryData extends MessageData {
  messages: MessageData[];
  mode?: EditorMode;
}

export const fromQueryData = (parsed: any): ParsedQueryData => {
  let rawData =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};

  let rawList: any[] = [];

  // 1. Detect official Discohook full workspace backups (like backups-2026-09-30.json)
  if (rawData.backups && Array.isArray(rawData.backups) && rawData.backups.length > 0) {
    const backup = rawData.backups[0];
    if (backup.messages && Array.isArray(backup.messages) && backup.messages.length > 0) {
      rawList = backup.messages;
    }
  }
  // 2. Detect standard QueryData multi-message / single-message exports
  else if (rawData.messages && Array.isArray(rawData.messages) && rawData.messages.length > 0) {
    rawList = rawData.messages;
  }
  // 3. Raw single message object
  else if (rawData && typeof rawData === "object" && Object.keys(rawData).length > 0) {
    rawList = [rawData];
  }

  const allMessages: MessageData[] = rawList.length > 0
    ? rawList.map(normalizeMessageData)
    : [normalizeMessageData({})];

  const primary = allMessages[0] || normalizeMessageData({});

  return {
    ...primary,
    messages: allMessages,
    ...(rawData.mode === EDITOR_MODES.V2 || rawData.mode === EDITOR_MODES.CLASSIC
      ? { mode: rawData.mode }
      : {}),
  };
};

export const toQueryData = (
  payload: MessageData | MessageData[],
  mode?: EditorMode,
): QueryData => {
  const msgs = Array.isArray(payload) ? payload : [payload];
  return {
    version: "d2",
    messages: msgs.map((m) => ({ data: m })),
    ...(mode ? { mode } : {}),
  };
};

export const parseImportedJson = (text: string): any => {
  const parsed = JSON.parse(text);
  return parsed;
};

export const downloadJson = (payload: any, filename: string): void => {
  const queryData =
    payload && typeof payload === "object" && Array.isArray(payload.messages)
      ? payload
      : toQueryData(payload);
  const blob = new Blob([JSON.stringify(queryData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};