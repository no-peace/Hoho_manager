import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ComponentNode,
  DiscordMessagePayload,
  EmbedData,
  EmbedField,
  MessageData,
  TargetData,
} from "@dmb/shared";
import { useActionStore } from "./actionStore.js"
import { ComponentType, DEFAULT_EMBED_COLOR, EDITOR_MODES, uid } from "../utils/constants";
import type { EditorMode } from "../utils/constants";
import { createComponent, newButton, newTextDisplay } from "../utils/componentsV2";
import { toDiscordPayload, validateMessage } from "../utils/discord";
import {
  findComponent,
  insertComponent,
  moveComponent as moveInTree,
  reorderComponent as reorderInTree,
  removeComponent as removeFromTree,
  updateComponent as updateInTree,
} from "../utils/tree";

export type EmbedPreviewPart =
  | "author"
  | "title"
  | "description"
  | "field"
  | "thumbnail"
  | "image"
  | "footer"
  | "timestamp";

export type Selection =
  | { kind: "embed"; id: string; part?: EmbedPreviewPart; fieldId?: string }
  | { kind: "component"; id: string }
  | { kind: "message"; index: number }
  | null;

export interface SendState {
  status: "idle" | "sending" | "success" | "error";
  error: string | null;
  result: unknown;
}

export interface AttachedFile {
  id: string;
  file?: File;
  url?: string;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  spoiler?: boolean;
  description?: string;
}

type MessageHistorySnapshot = {
  messages: MessageData[];
  activeMessageIndex: number;
};

const historyStructureKey = (messages: MessageData[]): string => {
  const componentKey = (node: ComponentNode): unknown => ({
    id: node._id,
    type: node.type,
    children: node.components?.map(componentKey),
    accessory: node.accessory ? componentKey(node.accessory) : undefined,
    optionIds: node.options?.map((option) => option._id),
    itemIds: node.items?.map((item) => item._id),
  });
  return JSON.stringify(messages.map((message) => ({
    mode: (message as any).mode,
    flags: message.flags,
    embeds: message.embeds?.map((embed) => ({
      id: embed._id,
      fields: embed.fields?.map((field) => field._id),
    })),
    components: message.components?.map(componentKey),
  })));
};

export interface MessageState {
  mode: EditorMode;
  data: MessageData;
  messages: MessageData[];
  activeMessageIndex: number;
  targets: TargetData[];
  selection: Selection;
  send: SendState;
  attachedFiles: AttachedFile[];
  past: MessageHistorySnapshot[];
  future: MessageHistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  markClean(): void;
  ensureStableIds(): void;
  undo(): void;
  redo(): void;

  setMode(mode: EditorMode): void;
  setMessageMode(index: number, mode: EditorMode): void;
  setField<K extends keyof MessageData>(key: K, value: MessageData[K]): void;
  setContent(content: string): void;

  addFiles(files: File[]): void;
  addUrlAttachment(url: string): void;
  removeFile(id: string): void;
  toggleFileSpoiler(id: string): void;
  updateFileDescription(id: string, description: string): void;
  clearFiles(): void;

  addEmbed(): void;
  updateEmbed(id: string, patch: Partial<EmbedData>): void;
  removeEmbed(id: string): void;
  duplicateEmbed(id: string): void;
  moveEmbed(id: string, direction: number): void;
  reorderEmbeds(activeId: string, overId: string): void;
  addEmbedField(embedId: string): void;
  updateEmbedField(embedId: string, fieldId: string, patch: Partial<EmbedField>): void;
  removeEmbedField(embedId: string, fieldId: string): void;
  moveEmbedField(embedId: string, fieldId: string, direction: number): void;
  reorderEmbedFields(embedId: string, activeId: string, overId: string): void;
  duplicateEmbedField(embedId: string, fieldId: string): void;

  addComponent(type: number, parentId?: string | null): void;
  addActionRowChild(parentId: string, type?: number): void;
  updateComponentById(id: string, patch: Partial<ComponentNode>): void;
  removeComponentById(id: string): void;
  moveComponentById(id: string, direction: number, parentId?: string | null): void;
  reorderComponentById(activeId: string, overId: string, parentId?: string | null): void;
  duplicateComponentById(id: string): void;

  select(selection: Selection): void;
  setTargetUrl(index: number, url: string): void;
  addTarget(): void;
  removeTarget(index: number): void;

  setSendState(patch: Partial<SendState>): void;
  resetSendState(): void;

  addMessage(initial?: Partial<MessageData>): void;
  removeMessage(index: number): void;
  duplicateMessage(index: number): void;
  moveMessage(index: number, direction: number): void;
  reorderMessages(fromIndex: number, toIndex: number): void;
  setActiveMessageIndex(index: number): void;
  setMessageFlags(flags: number): void;
  setAllowedMentions(allowedMentions?: MessageData["allowed_mentions"]): void;

  reset(): void;
  load(input: { data?: any; mode?: EditorMode; targets?: TargetData[] } | any): void;

  getPayload(): DiscordMessagePayload;
  getAllPayloads(): DiscordMessagePayload[];
  getValidationErrors(): string[];
}

export const createEmptyMessage = (): MessageData => ({
  _id: uid(),
  content: "",
  embeds: [],
  components: [],
  username: "",
  avatar_url: "",
  thread_name: "",
  flags: 0,
  allowed_mentions: undefined,
});

const newEmbed = (): EmbedData => ({
  _id: uid(),
  title: "",
  description: "",
  color: DEFAULT_EMBED_COLOR,
  fields: [],
});

const newEmbedField = (): EmbedField => ({
  _id: uid(),
  name: "Field name",
  value: "Field value",
  inline: false,
});

const idleSendState = (): SendState => ({ status: "idle", error: null, result: null });

const reid = (component: ComponentNode): ComponentNode => {
  const clone = structuredClone(component) as ComponentNode;
  const newId = uid();
  let nextCustomId: string | undefined;

  if (clone.custom_id) {
    nextCustomId = `action:dud:{"_id":"${newId}"}`;
    const existingFlow = useActionStore.getState().flows[clone.custom_id];
    if (existingFlow && existingFlow.length > 0) {
      useActionStore.getState().setFlow(nextCustomId, structuredClone(existingFlow));
    }
  }

  return {
    ...clone,
    _id: newId,
    ...(nextCustomId ? { custom_id: nextCustomId } : {}),
    ...(clone.accessory ? { accessory: reid(clone.accessory) } : {}),
    ...(Array.isArray(clone.components)
      ? { components: clone.components.map(reid) }
      : {}),
    ...(Array.isArray(clone.options)
      ? { options: clone.options.map((option) => ({ ...option, _id: uid() })) }
      : {}),
    ...(Array.isArray(clone.items)
      ? { items: clone.items.map((item) => ({ ...item, _id: uid() })) }
      : {}),
  };
};

const duplicateInTree = (
  list: ComponentNode[],
  targetId: string,
): { updated: ComponentNode[]; duplicated: ComponentNode | null } => {
  const index = list.findIndex((c) => c._id === targetId);
  if (index !== -1) {
    const copy = reid(list[index]);
    const next = [...list];
    next.splice(index + 1, 0, copy);
    return { updated: next, duplicated: copy };
  }

  let duplicated: ComponentNode | null = null;
  const next = list.map((item) => {
    if (item.components && !duplicated) {
      const result = duplicateInTree(item.components, targetId);
      if (result.duplicated) {
        duplicated = result.duplicated;
        return { ...item, components: result.updated };
      }
    }
    if (item.accessory?.components && !duplicated) {
      const result = duplicateInTree(item.accessory.components, targetId);
      if (result.duplicated) {
        duplicated = result.duplicated;
        return { ...item, accessory: { ...item.accessory, components: result.updated } };
      }
    }
    return item;
  });

  return { updated: next, duplicated };
};

const syncDataToMessages = (nextData: MessageData, state: MessageState) => {
  const nextMessages = state.messages && state.messages.length > 0 ? [...state.messages] : [nextData];
  const idx = Math.max(0, Math.min(state.activeMessageIndex ?? 0, nextMessages.length - 1));
  nextMessages[idx] = nextData;
  return { data: nextData, messages: nextMessages };
};

const defaultInitial = createEmptyMessage();

const resolveMessageMode = (message?: Partial<MessageData> | null, fallback: EditorMode = EDITOR_MODES.CLASSIC): EditorMode => {
  if (!message) return fallback;
  const flags = message.flags ?? 0;
  if ((flags & 32768) !== 0) return EDITOR_MODES.V2;
  if ((message as any).mode === EDITOR_MODES.V2) return EDITOR_MODES.V2;
  return EDITOR_MODES.CLASSIC;
};

export const useMessageStore = create<MessageState>()(
  persist(
    (rawSet, get) => {
      let lastHistoryAt = 0;
      let resetHistoryOnNextChange = false;
      let suppressDirtyTracking = false;
      const set: typeof rawSet = (partial, replace) => {
        const current = get();
        const nextState = typeof partial === "function" ? partial(current) : partial;
        const next = (nextState ?? {}) as Partial<MessageState>;
        const nextMessages = next.messages ?? current.messages;
        const nextData = next.data ?? current.data;
        const hasDocumentChanges =
          (next.messages !== undefined && next.messages !== current.messages) ||
          (next.data !== undefined && next.data !== current.data) ||
          (next.targets !== undefined && next.targets !== current.targets) ||
          (next.attachedFiles !== undefined && next.attachedFiles !== current.attachedFiles);
        if (hasDocumentChanges && !suppressDirtyTracking && next.isDirty !== false) {
          // A document becomes dirty only after an actual editor mutation.
          // Loading and resetting explicitly suppress this transition.
          next.isDirty = true;
        }
        const activeIndexChanged =
          next.activeMessageIndex !== undefined &&
          next.activeMessageIndex !== current.activeMessageIndex;
        const shouldTrackHistory =
          nextMessages !== current.messages ||
          (nextData !== current.data && !activeIndexChanged);
        if (shouldTrackHistory) {
          if (resetHistoryOnNextChange) {
            resetHistoryOnNextChange = false;
            rawSet({
              ...next,
              past: [],
              future: [],
              canUndo: false,
              canRedo: false,
            } as Partial<MessageState>, replace as any);
            return;
          }
          const structureChanged =
            historyStructureKey(current.messages) !== historyStructureKey(nextMessages);
          const now = Date.now();
          const coalesceTyping =
            !structureChanged && current.past.length > 0 && now - lastHistoryAt < 600;
          const snapshot: MessageHistorySnapshot = {
            messages: structuredClone(current.messages),
            activeMessageIndex: current.activeMessageIndex,
          };
          const past = coalesceTyping
            ? current.past
            : [...current.past, snapshot].slice(-40);
          lastHistoryAt = now;
          rawSet({
            ...next,
            past,
            future: [],
            canUndo: past.length > 0,
            canRedo: false,
          } as Partial<MessageState>, replace as any);
          return;
        }
        rawSet(next as any, replace as any);
      };
      return ({
      mode: EDITOR_MODES.CLASSIC,
      data: defaultInitial,
      messages: [defaultInitial],
      activeMessageIndex: 0,
      targets: [{ url: "" }],
      selection: null,
      send: idleSendState(),
      attachedFiles: [],
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
      isDirty: false,
      markClean: () => rawSet({ isDirty: false }),
      ensureStableIds: () => {
        const state = get();
        let changed = false;
        const messages = state.messages.map((message) => {
          const messageId = message._id || uid();
          let answersChanged = false;
          const answers = message.poll?.answers.map((answer) => {
            const answerId = answer._id || uid();
            if (answerId !== answer._id) {
              changed = true;
              answersChanged = true;
            }
            return answerId === answer._id ? answer : { ...answer, _id: answerId };
          });
          if (messageId !== message._id) changed = true;
          if (messageId === message._id && !answersChanged) return message;
          return {
            ...message,
            _id: messageId,
            ...(message.poll && answers ? { poll: { ...message.poll, answers } } : {}),
          };
        });
        if (!changed) return;
        const activeIndex = Math.max(0, Math.min(state.activeMessageIndex, messages.length - 1));
        rawSet({
          messages,
          data: messages[activeIndex] ?? messages[0] ?? createEmptyMessage(),
          past: [],
          future: [],
          canUndo: false,
          canRedo: false,
        });
      },

      undo: () => {
        const state = get();
        const previous = state.past[state.past.length - 1];
        if (!previous) return;
        const activeMessageIndex = Math.max(0, Math.min(previous.activeMessageIndex, previous.messages.length - 1));
        const messages = structuredClone(previous.messages);
        const data = messages[activeMessageIndex] ?? createEmptyMessage();
        const future = [...state.future, {
          messages: structuredClone(state.messages),
          activeMessageIndex: state.activeMessageIndex,
        }].slice(-40);
        rawSet({
          messages,
          data,
          activeMessageIndex,
          mode: resolveMessageMode(data, state.mode),
          selection: null,
          past: state.past.slice(0, -1),
          future,
          canUndo: state.past.length > 1,
          canRedo: future.length > 0,
          isDirty: true,
        });
      },

      redo: () => {
        const state = get();
        const next = state.future[state.future.length - 1];
        if (!next) return;
        const activeMessageIndex = Math.max(0, Math.min(next.activeMessageIndex, next.messages.length - 1));
        const messages = structuredClone(next.messages);
        const data = messages[activeMessageIndex] ?? createEmptyMessage();
        const past = [...state.past, {
          messages: structuredClone(state.messages),
          activeMessageIndex: state.activeMessageIndex,
        }].slice(-40);
        rawSet({
          messages,
          data,
          activeMessageIndex,
          mode: resolveMessageMode(data, state.mode),
          selection: null,
          past,
          future: state.future.slice(0, -1),
          canUndo: past.length > 0,
          canRedo: state.future.length > 1,
          isDirty: true,
        });
      },

      setMode: (mode) => {
        const activeIdx = get().activeMessageIndex ?? 0;
        get().setMessageMode(activeIdx, mode);
      },

      setMessageMode: (index, mode) =>
        set((state) => {
          if (index < 0 || index >= state.messages.length) return state;
          const targetMsg = state.messages[index] ?? state.data ?? createEmptyMessage();
          const currentMode = resolveMessageMode(targetMsg, state.mode);
          if (currentMode === mode) return state;

          const isV2 = mode === EDITOR_MODES.V2;
          const nextFlags = isV2
            ? (targetMsg.flags ?? 0) | 32768
            : (targetMsg.flags ?? 0) & ~32768;
          const existingComponents = targetMsg.components ?? [];
          const collectClassicRows = (nodes: ComponentNode[]): ComponentNode[] => {
            const rows: ComponentNode[] = [];
            for (const node of nodes) {
              if (node.type === ComponentType.ActionRow) {
                rows.push(node);
              } else if (node.type === ComponentType.Container && node.components) {
                rows.push(...collectClassicRows(node.components));
              }
              if (rows.length >= 5) break;
            }
            return rows.slice(0, 5);
          };
          const collectText = (nodes: ComponentNode[]): string[] =>
            nodes.flatMap((node) => [
              ...(node.type === ComponentType.TextDisplay && node.content ? [node.content] : []),
              ...(node.components ? collectText(node.components) : []),
            ]);
          const convertedContent = isV2
            ? ""
            : [
                targetMsg.content ?? "",
                ...collectText(existingComponents),
              ].filter((part) => part.length > 0).join("\n\n");
          const convertedComponents = isV2
            ? [
                ...(targetMsg.content ? [newTextDisplay(targetMsg.content)] : []),
                ...existingComponents,
              ]
            : collectClassicRows(existingComponents);
          const updatedMsg: MessageData = {
            ...targetMsg,
            content: convertedContent,
            components: convertedComponents,
            flags: nextFlags,
            ...(isV2 ? { poll: undefined } : {}),
          };
          (updatedMsg as MessageData & { mode?: EditorMode }).mode = mode;

          const nextMessages = [...state.messages];
          nextMessages[index] = updatedMsg;
          const isCurrent = index === (state.activeMessageIndex ?? 0);
          return {
            messages: nextMessages,
            data: isCurrent ? updatedMsg : state.data,
            mode: isCurrent ? mode : state.mode,
            selection: null,
          };
        }),

      setField: (key, value) =>
        set((state) => {
          const nextData = { ...(state.data ?? createEmptyMessage()), [key]: value };
          return syncDataToMessages(nextData, state);
        }),

      setContent: (content) => get().setField("content", content),

      addFiles: (files) => {
        const MAX_FILES = 10;
        const current = get().attachedFiles;
        const availableSlots = Math.max(0, MAX_FILES - current.length);
        const toAdd = files.slice(0, availableSlots).map((file) => {
          let previewUrl = "";
          try {
            previewUrl = URL.createObjectURL(file);
          } catch {
            previewUrl = "";
          }
          return {
            id: uid(),
            file,
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            previewUrl,
            spoiler: false,
          };
        });
        set({ attachedFiles: [...current, ...toAdd] });
      },

      addUrlAttachment: (rawUrl) => {
        const MAX_FILES = 10;
        const current = get().attachedFiles;
        if (current.length >= MAX_FILES) return;
        const trimmed = rawUrl.trim();
        if (!/^https?:\/\//i.test(trimmed)) return;

        let name = "attachment";
        try {
          const parsed = new URL(trimmed);
          const last = parsed.pathname.split("/").filter(Boolean).pop();
          if (last) name = decodeURIComponent(last);
        } catch {}

        set({
          attachedFiles: [
            ...current,
            {
              id: uid(),
              url: trimmed,
              name,
              size: 0,
              type: "application/octet-stream",
              previewUrl: trimmed,
              spoiler: false,
            },
          ],
        });
      },

      removeFile: (id) => {
        const file = get().attachedFiles.find((f) => f.id === id);
        if (file?.previewUrl && file.file) {
          try {
            URL.revokeObjectURL(file.previewUrl);
          } catch {}
        }
        set({ attachedFiles: get().attachedFiles.filter((f) => f.id !== id) });
      },

      toggleFileSpoiler: (id) => {
        set({
          attachedFiles: get().attachedFiles.map((f) =>
            f.id === id ? { ...f, spoiler: !f.spoiler } : f,
          ),
        });
      },

      updateFileDescription: (id, description) => {
        set({
          attachedFiles: get().attachedFiles.map((f) =>
            f.id === id ? { ...f, description } : f,
          ),
        });
      },

      clearFiles: () => {
        for (const file of get().attachedFiles) {
          if (file.previewUrl && file.file) {
            try {
              URL.revokeObjectURL(file.previewUrl);
            } catch {}
          }
        }
        set({ attachedFiles: [] });
      },

      addEmbed: () =>
        set((state) => {
          const embeds = [...(state.data?.embeds ?? []), newEmbed()];
          const nextData = { ...(state.data ?? createEmptyMessage()), embeds };
          return syncDataToMessages(nextData, state);
        }),

      updateEmbed: (id, patch) =>
        set((state) => {
          const embeds = (state.data?.embeds ?? []).map((embed) =>
            embed._id === id ? { ...embed, ...patch } : embed,
          );
          const nextData = { ...(state.data ?? createEmptyMessage()), embeds };
          return syncDataToMessages(nextData, state);
        }),

      removeEmbed: (id) =>
        set((state) => {
          const embeds = (state.data?.embeds ?? []).filter((embed) => embed._id !== id);
          const selection =
            state.selection?.kind === "embed" && state.selection.id === id
              ? null
              : state.selection;
          const nextData = { ...(state.data ?? createEmptyMessage()), embeds };
          return {
            ...syncDataToMessages(nextData, state),
            selection,
          };
        }),

      duplicateEmbed: (id) =>
        set((state) => {
          const list = state.data?.embeds ?? [];
          const index = list.findIndex((embed) => embed._id === id);
          if (index === -1) return {};
          const source = list[index];
          const cloned: EmbedData = {
            ...(structuredClone(source) as EmbedData),
            _id: uid(),
            fields: source.fields?.map((field) => ({ ...field, _id: uid() })) ?? [],
          };
          const embeds = [...list];
          embeds.splice(index + 1, 0, cloned);
          const nextData = { ...(state.data ?? createEmptyMessage()), embeds };
          return syncDataToMessages(nextData, state);
        }),

      reorderEmbeds: (activeId, overId) =>
        set((state) => {
          const original = state.data?.embeds ?? [];
          const from = original.findIndex((embed, index) => (embed._id ?? `embed-${index}`) === activeId);
          const to = original.findIndex((embed, index) => (embed._id ?? `embed-${index}`) === overId);
          if (from < 0 || to < 0 || from === to) return {};
          const embeds = original.map((embed) => embed._id ? embed : { ...embed, _id: uid() });
          const [moved] = embeds.splice(from, 1);
          if (!moved) return {};
          embeds.splice(to, 0, moved);
          return syncDataToMessages({ ...(state.data ?? createEmptyMessage()), embeds }, state);
        }),

      moveEmbed: (id, direction) =>
        set((state) => {
          const embeds = [...(state.data?.embeds ?? [])];
          const index = embeds.findIndex((embed) => embed._id === id);
          const target = index + direction;
          if (index === -1 || target < 0 || target >= embeds.length) return {};
          const [moved] = embeds.splice(index, 1);
          embeds.splice(target, 0, moved);
          const nextData = { ...(state.data ?? createEmptyMessage()), embeds };
          return syncDataToMessages(nextData, state);
        }),

      addEmbedField: (embedId) =>
        set((state) => {
          const embeds = (state.data?.embeds ?? []).map((embed) =>
            embed._id === embedId
              ? { ...embed, fields: [...(embed.fields ?? []), newEmbedField()] }
              : embed,
          );
          const nextData = { ...(state.data ?? createEmptyMessage()), embeds };
          return syncDataToMessages(nextData, state);
        }),

      updateEmbedField: (embedId, fieldId, patch) =>
        set((state) => {
          const embeds = (state.data?.embeds ?? []).map((embed) =>
            embed._id === embedId
              ? {
                  ...embed,
                  fields: (embed.fields ?? []).map((field) =>
                    field._id === fieldId ? { ...field, ...patch } : field,
                  ),
                }
              : embed,
          );
          const nextData = { ...(state.data ?? createEmptyMessage()), embeds };
          return syncDataToMessages(nextData, state);
        }),

      removeEmbedField: (embedId, fieldId) =>
        set((state) => {
          const embeds = (state.data?.embeds ?? []).map((embed) =>
            embed._id === embedId
              ? {
                  ...embed,
                  fields: (embed.fields ?? []).filter((field) => field._id !== fieldId),
                }
              : embed,
          );
          const nextData = { ...(state.data ?? createEmptyMessage()), embeds };
          return syncDataToMessages(nextData, state);
        }),

      reorderEmbedFields: (embedId, activeId, overId) =>
        set((state) => {
          let changed = false;
          const embeds = (state.data?.embeds ?? []).map((embed) => {
            if (embed._id !== embedId) return embed;
            const originalFields = embed.fields ?? [];
            const from = originalFields.findIndex((field, index) => (field._id ?? `field-${embedId}-${index}`) === activeId);
            const to = originalFields.findIndex((field, index) => (field._id ?? `field-${embedId}-${index}`) === overId);
            if (from < 0 || to < 0 || from === to) return embed;
            const fields = originalFields.map((field) => field._id ? field : { ...field, _id: uid() });
            const [moved] = fields.splice(from, 1);
            if (!moved) return embed;
            fields.splice(to, 0, moved);
            changed = true;
            return { ...embed, fields };
          });
          if (!changed) return {};
          return syncDataToMessages({ ...(state.data ?? createEmptyMessage()), embeds }, state);
        }),

      moveEmbedField: (embedId, fieldId, direction) =>
        set((state) => {
          const embeds = (state.data?.embeds ?? []).map((embed) => {
            if (embed._id !== embedId) return embed;
            const fields = [...(embed.fields ?? [])];
            const idx = fields.findIndex((f) => f._id === fieldId);
            if (idx === -1) return embed;
            const target = idx + direction;
            if (target < 0 || target >= fields.length) return embed;
            const current = fields[idx];
            const swap = fields[target];
            if (!current || !swap) return embed;
            fields[idx] = swap;
            fields[target] = current;
            return { ...embed, fields };
          });
          const nextData = { ...(state.data ?? createEmptyMessage()), embeds };
          return syncDataToMessages(nextData, state);
        }),

      duplicateEmbedField: (embedId, fieldId) =>
        set((state) => {
          const embeds = (state.data?.embeds ?? []).map((embed) => {
            if (embed._id !== embedId) return embed;
            const fields = [...(embed.fields ?? [])];
            const idx = fields.findIndex((f) => f._id === fieldId);
            if (idx === -1) return embed;
            const copy: EmbedField = {
              ...structuredClone(fields[idx]),
              _id: uid(),
            };
            fields.splice(idx + 1, 0, copy);
            return { ...embed, fields };
          });
          const nextData = { ...(state.data ?? createEmptyMessage()), embeds };
          return syncDataToMessages(nextData, state);
        }),

      addComponent: (type, parentId = null) =>
        set((state) => {
          const created = createComponent(type);
          const { components } = insertComponent(
            state.data?.components ?? [],
            parentId,
            created,
          );
          const nextData = { ...(state.data ?? createEmptyMessage()), components };
          return {
            ...syncDataToMessages(nextData, state),
            // Action Rows are structural containers; they have no useful inspector
            // inputs. Keep the inspector closed until the user adds/selects a child.
            selection:
              type === ComponentType.ActionRow
                ? null
                : { kind: "component", id: created._id as string },
          };
        }),

      addActionRowChild: (parentId, type = ComponentType.Button) =>
        set((state) => {
          const child = type === ComponentType.Button ? newButton() : createComponent(type);
          const { components } = insertComponent(
            state.data?.components ?? [],
            parentId,
            child,
          );
          const nextData = { ...(state.data ?? createEmptyMessage()), components };
          return {
            ...syncDataToMessages(nextData, state),
            selection: { kind: "component", id: child._id as string },
          };
        }),

      updateComponentById: (id, patch) =>
        set((state) => {
          const { components } = updateInTree(state.data?.components ?? [], id, () => patch);
          const nextData = { ...(state.data ?? createEmptyMessage()), components };
          return syncDataToMessages(nextData, state);
        }),

      removeComponentById: (id) =>
        set((state) => {
          const { components } = removeFromTree(state.data?.components ?? [], id);
          const selection =
            state.selection?.kind === "component" &&
            !findComponent(components, state.selection.id)
              ? null
              : state.selection;
          const nextData = { ...(state.data ?? createEmptyMessage()), components };
          return {
            ...syncDataToMessages(nextData, state),
            selection,
          };
        }),

      moveComponentById: (id, direction, parentId = null) =>
        set((state) => {
          const { components, found } = moveInTree(
            state.data?.components ?? [],
            id,
            direction,
            parentId,
          );
          if (!found) return {};
          const nextData = { ...(state.data ?? createEmptyMessage()), components };
          return syncDataToMessages(nextData, state);
        }),

      reorderComponentById: (activeId, overId, parentId = null) =>
        set((state) => {
          const { components, found } = reorderInTree(
            state.data?.components ?? [],
            activeId,
            overId,
            parentId,
          );
          if (!found) return {};
          return syncDataToMessages({ ...(state.data ?? createEmptyMessage()), components }, state);
        }),

      duplicateComponentById: (id) =>
        set((state) => {
          const list = state.data?.components ?? [];
          const { updated, duplicated } = duplicateInTree(list, id);
          if (!duplicated) return {};

          const nextData = { ...(state.data ?? createEmptyMessage()), components: updated };
          return {
            ...syncDataToMessages(nextData, state),
            selection: { kind: "component", id: duplicated._id as string },
          };
        }),

      select: (selection) => set({ selection }),

      setTargetUrl: (index, url) =>
        set((state) => {
          const targets = [...state.targets];
          targets[index] = { url };
          return { targets };
        }),

      addTarget: () => set((state) => ({ targets: [...state.targets, { url: "" }] })),

      removeTarget: (index) =>
        set((state) => ({ targets: state.targets.filter((_, i) => i !== index) })),

      setSendState: (patch) => set((state) => ({ send: { ...state.send, ...patch } })),
      resetSendState: () => set({ send: idleSendState() }),

      addMessage: (initial) =>
        set((state) => {
          if (state.messages.length >= 10) return state;
          const newMsg: MessageData = { ...createEmptyMessage(), ...initial };
          const nextMessages = [...state.messages, newMsg];
          const newIdx = nextMessages.length - 1;
          const newMode = resolveMessageMode(newMsg);
          return {
            messages: nextMessages,
            activeMessageIndex: newIdx,
            data: newMsg,
            mode: newMode,
            selection: null,
          };
        }),

      removeMessage: (index) =>
        set((state) => {
          if (state.messages.length <= 1) {
            const resetMsg = createEmptyMessage();
            return {
              messages: [resetMsg],
              activeMessageIndex: 0,
              data: resetMsg,
              mode: EDITOR_MODES.CLASSIC,
              selection: null,
            };
          }
          const nextMessages = state.messages.filter((_, idx) => idx !== index);
          const nextIdx = Math.max(0, Math.min(state.activeMessageIndex, nextMessages.length - 1));
          const nextData = nextMessages[nextIdx];
          return {
            messages: nextMessages,
            activeMessageIndex: nextIdx,
            data: nextData,
            mode: resolveMessageMode(nextData),
            selection: null,
          };
        }),

      duplicateMessage: (index) =>
        set((state) => {
          if (state.messages.length >= 10) return state;
          const source = state.messages[index] ?? state.data ?? createEmptyMessage();
          const cloned: MessageData = { ...structuredClone(source), _id: uid() };
          if (cloned.poll) {
            cloned.poll = {
              ...cloned.poll,
              answers: cloned.poll.answers.map((answer) => ({ ...answer, _id: uid() })),
            };
          }
          if (cloned.embeds) {
            cloned.embeds = cloned.embeds.map((emb) => ({
              ...emb,
              _id: uid(),
              fields: emb.fields?.map((f) => ({ ...f, _id: uid() })),
            }));
          }
          if (cloned.components) {
            cloned.components = cloned.components.map(reid);
          }
          const nextMessages = [...state.messages];
          nextMessages.splice(index + 1, 0, cloned);
          const newIdx = index + 1;
          return {
            messages: nextMessages,
            activeMessageIndex: newIdx,
            data: cloned,
            mode: resolveMessageMode(cloned),
            selection: null,
          };
        }),

      moveMessage: (index, direction) =>
        set((state) => {
          const target = index + direction;
          if (target < 0 || target >= state.messages.length) return state;
          const nextMessages = [...state.messages];
          const [moved] = nextMessages.splice(index, 1);
          nextMessages.splice(target, 0, moved);
          const targetMsg = nextMessages[target];
          return {
            messages: nextMessages,
            activeMessageIndex: target,
            data: targetMsg,
            mode: resolveMessageMode(targetMsg),
          };
        }),

      reorderMessages: (fromIndex, toIndex) =>
        set((state) => {
          if (
            fromIndex < 0 || toIndex < 0 ||
            fromIndex >= state.messages.length || toIndex >= state.messages.length ||
            fromIndex === toIndex
          ) return {};
          const messages = [...state.messages];
          const [moved] = messages.splice(fromIndex, 1);
          if (!moved) return {};
          messages.splice(toIndex, 0, moved);
          const activeMessageIndex = state.activeMessageIndex === fromIndex
            ? toIndex
            : fromIndex < state.activeMessageIndex && toIndex >= state.activeMessageIndex
              ? state.activeMessageIndex - 1
              : fromIndex > state.activeMessageIndex && toIndex <= state.activeMessageIndex
                ? state.activeMessageIndex + 1
                : state.activeMessageIndex;
          const selection = state.selection?.kind === "message"
            ? {
                ...state.selection,
                index: state.selection.index === fromIndex
                  ? toIndex
                  : fromIndex < state.selection.index && toIndex >= state.selection.index
                    ? state.selection.index - 1
                    : fromIndex > state.selection.index && toIndex <= state.selection.index
                      ? state.selection.index + 1
                      : state.selection.index,
              }
            : state.selection;
          return {
            messages,
            activeMessageIndex,
            data: messages[activeMessageIndex] ?? state.data,
            selection,
          };
        }),

      setActiveMessageIndex: (index) =>
        set((state) => {
          if (index < 0 || index >= state.messages.length) return state;
          if (index === state.activeMessageIndex && state.data === state.messages[index]){ 
            return state;
          }
          const currentMsg = state.messages[index];
          return {
            activeMessageIndex: index,
            data: currentMsg,
            mode: resolveMessageMode(currentMsg, state.mode),
            selection:
              state.selection?.kind === "message" && state.selection.index === index
                ? state.selection
                : null,
          };
        }),

      setMessageFlags: (flags) => get().setField("flags", flags),
      setAllowedMentions: (allowedMentions) => get().setField("allowed_mentions", allowedMentions),

      reset: () => {
        suppressDirtyTracking = true;
        get().clearFiles();
        const blank = createEmptyMessage();
        resetHistoryOnNextChange = true;
        set({
          mode: EDITOR_MODES.CLASSIC,
          data: blank,
          messages: [blank],
          activeMessageIndex: 0,
          targets: [{ url: "" }],
          selection: null,
          send: idleSendState(),
          isDirty: false,
        });
        suppressDirtyTracking = false;
      },

      load: (input: any) => {
        suppressDirtyTracking = true;
        try {
          get().clearFiles();
          const doc =
            input && typeof input === "object" && input.data !== undefined && input.messages === undefined && input.backups === undefined
              ? input.data
              : (input ?? {});
          const resolvedMode = input?.mode ?? doc?.mode;
          const resolvedTargets =
            (input?.targets && input.targets.length > 0)
              ? input.targets
              : (doc?.targets && doc.targets.length > 0 ? doc.targets : undefined);

          let initialMessages: MessageData[] = [];
          if (doc?.backups && Array.isArray(doc.backups) && doc.backups.length > 0) {
            const b = doc.backups[0];
            if (Array.isArray(b.messages) && b.messages.length > 0) {
              initialMessages = b.messages.map((m: any) => ({
                ...createEmptyMessage(),
                ...(m.data || m),
              }));
            }
          } else if (Array.isArray(doc?.messages) && doc.messages.length > 0) {
            initialMessages = doc.messages.map((m: any) => ({
              ...createEmptyMessage(),
              ...(m.data || m),
            }));
          } else if (doc && typeof doc === "object" && (doc.content !== undefined || doc.embeds !== undefined || doc.components !== undefined)) {
            initialMessages = [{ ...createEmptyMessage(), ...doc }];
          } else {
            initialMessages = [createEmptyMessage()];
          }

          initialMessages.forEach((msg) => {
            msg._id = msg._id || uid();
            if (msg.poll) {
              msg.poll = {
                ...msg.poll,
                answers: msg.poll.answers.map((answer) => ({ ...answer, _id: answer._id || uid() })),
              };
            }
            if (msg.embeds) {
              msg.embeds = msg.embeds.map((e) => ({
                ...e,
                _id: e._id || uid(),
                fields: (e.fields || []).map((f) => ({ ...f, _id: f._id || uid() })),
              }));
            }
            const hydrateNode = (c: ComponentNode): ComponentNode => ({
              ...c,
              _id: c._id || uid(),
              ...(c.accessory ? { accessory: hydrateNode(c.accessory) } : {}),
              ...(Array.isArray(c.components) ? { components: c.components.map(hydrateNode) } : {}),
              ...(Array.isArray(c.options)
                ? { options: c.options.map((o) => ({ ...o, _id: o._id || uid() })) }
                : {}),
              ...(Array.isArray(c.items)
                ? { items: c.items.map((it) => ({ ...it, _id: it._id || uid() })) }
                : {}),
            });
            if (msg.components) {
              msg.components = msg.components.map(hydrateNode);
            }
            const isV2 = resolveMessageMode(msg, resolvedMode || EDITOR_MODES.CLASSIC) === EDITOR_MODES.V2;
            msg.flags = isV2 ? (msg.flags ?? 0) | 32768 : (msg.flags ?? 0) & ~32768;
            (msg as any).mode = isV2 ? EDITOR_MODES.V2 : EDITOR_MODES.CLASSIC;
          });

          const activeMode = resolveMessageMode(initialMessages[0], resolvedMode || EDITOR_MODES.CLASSIC);

          resetHistoryOnNextChange = true;
          set({
            mode: activeMode,
            data: initialMessages[0],
            messages: initialMessages,
            activeMessageIndex: 0,
            targets: resolvedTargets && resolvedTargets.length > 0 ? resolvedTargets : [{ url: "" }],
            selection: null,
            past: [],
            future: [],
            canUndo: false,
            canRedo: false,
            isDirty: false,
          });
          } finally {
            suppressDirtyTracking = false;
          }
      },

      getPayload: () => {
        const activeData = get().data;
        const msgMode = resolveMessageMode(activeData, get().mode);
        return toDiscordPayload(activeData, msgMode);
      },

      getAllPayloads: () => {
        return get().messages.map((msg) => {
          const msgMode = resolveMessageMode(msg, get().mode);
          return toDiscordPayload(msg, msgMode);
        });
      },

      getValidationErrors: () => {
        const activeData = get().data;
        const msgMode = resolveMessageMode(activeData, get().mode);
        return validateMessage(activeData, msgMode);
      },
      });
    },
    {
      name: "dmb:message",
      partialize: (state) => ({
        mode: state.mode,
        data: state.data,
        messages: state.messages,
        activeMessageIndex: state.activeMessageIndex,
      }),
      version: 1,
    },
  ),
);

export default useMessageStore;