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
import { ComponentType, DEFAULT_EMBED_COLOR, EDITOR_MODES, uid } from "../utils/constants";
import type { EditorMode } from "../utils/constants";
import { createComponent, newButton } from "../utils/componentsV2";
import { toDiscordPayload, validateMessage } from "../utils/discord";
import {
  findComponent,
  insertComponent,
  moveComponent as moveInTree,
  removeComponent as removeFromTree,
  updateComponent as updateInTree,
} from "../utils/tree";

export type Selection =
  | { kind: "embed"; id: string }
  | { kind: "component"; id: string }
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

export interface MessageState {
  mode: EditorMode;
  data: MessageData;
  messages: MessageData[];
  activeMessageIndex: number;
  targets: TargetData[];
  selection: Selection;
  send: SendState;
  attachedFiles: AttachedFile[];

  setMode(mode: EditorMode): void;
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
  addEmbedField(embedId: string): void;
  updateEmbedField(embedId: string, fieldId: string, patch: Partial<EmbedField>): void;
  removeEmbedField(embedId: string, fieldId: string): void;

  addComponent(type: number, parentId?: string | null): void;
  addActionRowChild(parentId: string, type?: number): void;
  updateComponentById(id: string, patch: Partial<ComponentNode>): void;
  removeComponentById(id: string): void;
  moveComponentById(id: string, direction: number, parentId?: string | null): void;
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
  setActiveMessageIndex(index: number): void;
  setMessageFlags(flags: number): void;
  setAllowedMentions(allowedMentions?: MessageData["allowed_mentions"]): void;

  reset(): void;
  load(input: { data: any; mode?: EditorMode; targets?: TargetData[] }): void;

  getPayload(): DiscordMessagePayload;
  getAllPayloads(): DiscordMessagePayload[];
  getValidationErrors(): string[];
}

export const createEmptyMessage = (): MessageData => ({
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

const reid = (component: ComponentNode): ComponentNode => ({
  ...(structuredClone(component) as ComponentNode),
  _id: uid(),
  ...(Array.isArray(component.components)
    ? { components: component.components.map(reid) }
    : {}),
  ...(Array.isArray(component.options)
    ? { options: component.options.map((option) => ({ ...option, _id: uid() })) }
    : {}),
  ...(Array.isArray(component.items)
    ? { items: component.items.map((item) => ({ ...item, _id: uid() })) }
    : {}),
});

const duplicateInTree =(
  list: ComponentNode[],
  targetId: string,
): {updated: ComponentNode[]; duplicated: ComponentNode | null} => {
  const index = list.findIndex((c) => c._id === targetId);
  if(index !== -1){
    const copy = reid(list[index]);
    const next = [...list];
    next.splice(index +1,0,copy);
    return {updated: next, duplicated: copy};
  }

  let duplicated: ComponentNode | null = null;
  const next = list.map((item) => {
    if (item.components && !duplicated) {
      const result = duplicateInTree(item.components,targetId);
      if (result.duplicated) {
        duplicated = result.duplicated;
        return {...item, components: result.updated };
      }
    }
    return item;
  });

  return {updated: next, duplicated};
};

const syncDataToMessages = (nextData: MessageData, state: MessageState) => {
  const nextMessages = state.messages && state.messages.length > 0 ? [...state.messages] : [nextData];
  const idx = Math.max(0, Math.min(state.activeMessageIndex ?? 0, nextMessages.length - 1));
  nextMessages[idx] = nextData;
  return { data: nextData, messages: nextMessages };
};

const defaultInitial = createEmptyMessage();

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      mode: EDITOR_MODES.CLASSIC,
      data: defaultInitial,
      messages: [defaultInitial],
      activeMessageIndex: 0,
      targets: [{ url: "" }],
      selection: null,
      send: idleSendState(),
      attachedFiles: [],

      setMode: (mode) => set({ mode }),

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
            selection: { kind: "component", id: created._id as string },
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
      
      

      duplicateComponentById: (id) =>
        set((state) => {
          const list = state.data?.components ?? [];
          const {updated, duplicated } = duplicateInTree(list, id);
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
          return {
            messages: nextMessages,
            activeMessageIndex: nextMessages.length - 1,
            data: newMsg,
            selection: null,
          };
        }),

      removeMessage: (index) =>
        set((state) => {
          if (state.messages.length <= 1) {
            const resetMsg = createEmptyMessage();
            return { messages: [resetMsg], activeMessageIndex: 0, data: resetMsg, selection: null };
          }
          const nextMessages = state.messages.filter((_, idx) => idx !== index);
          const nextIdx = Math.max(0, Math.min(state.activeMessageIndex, nextMessages.length - 1));
          return {
            messages: nextMessages,
            activeMessageIndex: nextIdx,
            data: nextMessages[nextIdx],
            selection: null,
          };
        }),

      duplicateMessage: (index) =>
        set((state) => {
          if (state.messages.length >= 10) return state;
          const source = state.messages[index] ?? state.data ?? createEmptyMessage();
          const cloned: MessageData = structuredClone(source);
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
          return {
            messages: nextMessages,
            activeMessageIndex: index + 1,
            data: cloned,
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
          return {
            messages: nextMessages,
            activeMessageIndex: target,
            data: nextMessages[target],
          };
        }),

      setActiveMessageIndex: (index) =>
        set((state) => {
          if (index < 0 || index >= state.messages.length) return state;
          return {
            activeMessageIndex: index,
            data: state.messages[index],
            selection: null,
          };
        }),

      setMessageFlags: (flags) => get().setField("flags", flags),
      setAllowedMentions: (allowedMentions) => get().setField("allowed_mentions", allowedMentions),

      reset: () => {
        get().clearFiles();
        const blank = createEmptyMessage();
        set({
          mode: EDITOR_MODES.CLASSIC,
          data: blank,
          messages: [blank],
          activeMessageIndex: 0,
          targets: [{ url: "" }],
          selection: null,
          send: idleSendState(),
        });
      },

      load: ({ data, mode, targets }) => {
        let initialMessages: MessageData[] = [];
        if (data?.backups && Array.isArray(data.backups) && data.backups.length > 0) {
          const b = data.backups[0];
          if (Array.isArray(b.messages) && b.messages.length > 0) {
            initialMessages = b.messages.map((m: any) => ({
              ...createEmptyMessage(),
              ...(m.data || m),
            }));
          }
        } else if (Array.isArray(data?.messages) && data.messages.length > 0) {
          initialMessages = data.messages.map((m: any) => ({
            ...createEmptyMessage(),
            ...(m.data || m),
          }));
        } else if (data && typeof data === "object") {
          initialMessages = [{ ...createEmptyMessage(), ...data }];
        } else {
          initialMessages = [createEmptyMessage()];
        }

        initialMessages.forEach((msg) => {
          if (msg.embeds) {
            msg.embeds = msg.embeds.map((e) => ({
              ...e,
              _id: e._id || uid(),
              fields: (e.fields || []).map((f) => ({ ...f, _id: f._id || uid() })),
            }));
          }
          if (msg.components) {
            msg.components = msg.components.map((c) => ({
              ...c,
              _id: c._id || uid(),
              components: (c.components || []).map((child) => ({ ...child, _id: child._id || uid() })),
            }));
          }
        });

        set({
          mode: mode ?? EDITOR_MODES.CLASSIC,
          data: initialMessages[0],
          messages: initialMessages,
          activeMessageIndex: 0,
          targets: targets && targets.length > 0 ? targets : [{ url: "" }],
          selection: null,
        });
      },

      getPayload: () => toDiscordPayload(get().data, get().mode),
      getAllPayloads: () => {
        const mode = get().mode;
        return get().messages.map((msg) => toDiscordPayload(msg, mode));
      },
      getValidationErrors: () => validateMessage(get().data, get().mode),
    }),
    {
      name: "dmb:message",
      partialize: (state) => ({
        mode: state.mode,
        data: state.data,
        messages: state.messages,
        activeMessageIndex: state.activeMessageIndex,
        targets: state.targets,
      }),
      version: 1,
    },
  ),
);

export default useMessageStore;