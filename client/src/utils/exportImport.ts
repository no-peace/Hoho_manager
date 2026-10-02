import { MessageFlags } from "@dmb/shared";
import type { MessageData, ComponentNode, EmbedData, EmbedField, TargetData } from "@dmb/shared";
import { EDITOR_MODES } from "./constants";
import type { EditorMode } from "./constants";

export interface QueryData {
  messages: { data: MessageData | { data: MessageData; targets?: TargetData[] } }[];
  targets?: TargetData[];
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

export const fromQueryData = (parsed: any): MessageData => {
  let rawData =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};

  // 1. Detect official Discohook full workspace backups (like backups-2026-09-30.json)
  if (rawData.backups && Array.isArray(rawData.backups) && rawData.backups.length > 0) {
    const backup = rawData.backups[0];
    if (backup.messages && Array.isArray(backup.messages) && backup.messages.length > 0) {
      rawData = backup.messages[0].data;
    }
  }
  // 2. Detect standard QueryData single-message exports
  else if (rawData.messages && Array.isArray(rawData.messages) && rawData.messages.length > 0) {
    rawData = rawData.messages[0].data;
  }

  if (rawData === null || typeof rawData !== "object" || Array.isArray(rawData)) rawData = {};

  // Older template saves wrapped the message and targets inside messages[0].data.
  if (rawData.data !== null && typeof rawData.data === "object") rawData = rawData.data;

  // Fallback to empty object to prevent UI crashes if data is malformed
  if (!rawData || typeof rawData !== 'object') rawData = {};

  return {
    content: rawData.content || "",
    username: rawData.username || "",
    avatar_url: rawData.avatar_url || "",
    thread_name: rawData.thread_name || "",
    embeds: (rawData.embeds || []).map((e: any): EmbedData => ({
      ...e,
      _id: e._id || genId(),
      fields: (e.fields || []).map((f: any): EmbedField => ({ ...f, _id: f._id || genId() }))
    })),
    components: (rawData.components || []).map((c: any): ComponentNode => ({
      ...c,
      _id: c._id || genId(),
      components: (c.components || []).map((child: any) => ({
        ...child,
        _id: child._id || genId(),
        options: (child.options || []).map((o: any) => ({ ...o, _id: o._id || genId() }))
      }))
    }))
  };
};

export const toQueryData = (
  payload: MessageData,
  targets?: TargetData[],
  mode?: EditorMode,
): QueryData => {
  return {
    messages: [{ data: payload }],
    ...(targets ? { targets } : {}),
    ...(mode ? { mode } : {}),
  };
};

export const parseImportedJson = (text: string): MessageData => {
  const parsed = JSON.parse(text);
  return fromQueryData(parsed);
};

export const downloadJson = (payload: any, filename: string): void => {
  const queryData = toQueryData(payload);
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