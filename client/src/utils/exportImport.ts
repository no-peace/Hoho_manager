import type { MessageData, ComponentNode, EmbedData, EmbedField } from "@dmb/shared";

export interface QueryData {
  messages: { data: MessageData }[];
}

const genId = () => Math.random().toString(36).substring(2, 9);

export const fromQueryData = (parsed: any): MessageData => {
  let rawData = parsed;

  // 1. Detect official Discohook full workspace backups (like backups-2026-09-30.json)
  if (parsed.backups && Array.isArray(parsed.backups) && parsed.backups.length > 0) {
    const backup = parsed.backups[0];
    if (backup.messages && Array.isArray(backup.messages) && backup.messages.length > 0) {
      rawData = backup.messages[0].data;
    }
  }
  // 2. Detect standard QueryData single-message exports
  else if (parsed.messages && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
    rawData = parsed.messages[0].data;
  }

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

export const toQueryData = (payload: any): QueryData => {
  return {
    messages: [{ data: payload }]
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