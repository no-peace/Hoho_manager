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

/**
 * The message document — the single source of truth for both the editor and the
 * live preview.
 *
 * The shape mirrors Discord closely, with one editor-only addition: every embed
 * and component carries an `_id`. React keys, selection and updates all key off
 * it, so reordering components never causes an edit to land on the wrong element.
 * `stripInternal()` removes those ids at the payload boundary.
 *
 * Persisted to localStorage so a refresh (or a crash) never loses work.
 */

export type Selection =
  | { kind: "embed"; id: string }
  | { kind: "component"; id: string }
  | null;

export interface SendState {
  status: "idle" | "sending" | "success" | "error";
  error: string | null;
  result: unknown;
}

export interface LoadDocumentInput {
  data: MessageData;
  mode?: EditorMode;
  targets?: TargetData[];
}

export interface AttachedFile {
  id: string;
  /** Present for locally-uploaded files; absent for external URL attachments. */
  file?: File;
  /** Present for external URL attachments; absent for local files. */
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
  messages: MessageData[];
  activeMessageIndex: number;

  addMessage(initial?: Partial<MessageData>): void;
  removeMessage(index: number): void;
  duplicateMessage(index: number): void;
  setActiveMessageIndex(index: number): void;
  setMessageFlags(flags: number): void;
  setAllowedMentions(allowedMentions?: MessageData["allowed_mentions"]): void;

  reset(): void;
  load(input: LoadDocumentInput): void;

  getPayload(): DiscordMessagePayload;
  getAllPayloads(): DiscordMessagePayload[];
  getValidationErrors(): string[];
}

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

const emptyData = (): MessageData => ({
  content: "",
  embeds: [],
  components: [],
  username: "",
  avatar_url: "",
  thread_name: "",
  flags: 0,
  allowed_mentions: undefined,
});

const syncDataToMessages = (nextData: MessageData, state: MessageState) => {
  const nextMessages = state.messages && state.messages.length > 0 ? [...state.messages] : [nextData];
  const idx = Math.max(0, Math.min(state.activeMessageIndex ?? 0, nextMessages.length - 1));
  nextMessages[idx] = nextData;
  return { data: nextData, messages: nextMessages };
};

const idleSendState = (): SendState => ({ status: "idle", error: null, result: null });

/** Deep-copy a component tree with fresh editor ids. */
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

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      /* ── State ────────────────────────────────────────────────────────── */
      mode: EDITOR_MODES.CLASSIC,
      data: emptyData(),
      messages: [emptyData()],
      activeMessageIndex: 0,
      targets: [{ url: "" }],
      selection: null,
      send: idleSendState(),
      attachedFiles: [],

      /* ── File Attachments ──────────────────────────────────────────────── */

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

        // Best-effort filename + MIME guess from the URL so the card and the
        // Discord payload have something meaningful to show.
        let name = "attachment";
        try {
          const parsed = new URL(trimmed);
          const last = parsed.pathname.split("/").filter(Boolean).pop();
          if (last) name = decodeURIComponent(last);
        } catch {
          // Keep the default name
        }

        const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
        const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg"];
        const VIDEO_EXTS = ["mp4", "mov", "webm", "mkv", "avi"];
        const AUDIO_EXTS = ["mp3", "wav", "ogg", "m4a", "flac"];
        const type = IMAGE_EXTS.includes(ext)
          ? `image/${ext === "jpg" ? "jpeg" : ext}`
          : VIDEO_EXTS.includes(ext)
            ? `video/${ext}`
            : AUDIO_EXTS.includes(ext)
              ? `audio/${ext}`
              : "application/octet-stream";

        set({
          attachedFiles: [
            ...current,
            {
              id: uid(),
              url: trimmed,
              name,
              size: 0,
              type,
              previewUrl: trimmed,
              spoiler: false,
            },
          ],
        });
      },

      removeFile: (id) => {
        const target = get().attachedFiles.find((f) => f.id === id);
        // Only local files own a blob URL that needs revoking.
        if (target?.file && target.previewUrl) {
          try {
            URL.revokeObjectURL(target.previewUrl);
          } catch {
            // Ignore revoke error
          }
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
          if (file.file && file.previewUrl) {
            try {
              URL.revokeObjectURL(file.previewUrl);
            } catch {
              // Ignore revoke error
            }
          }
        }
        set({ attachedFiles: [] });
      },

      /* ── Mode ─────────────────────────────────────────────────────────── */

      setMode: (mode) => set({ mode, selection: null }),

      /* ── Scalar fields ────────────────────────────────────────────────── */

      setField: (key, value) =>
        set((state) => {
          const nextData = { ...state.data, [key]: value };
          return syncDataToMessages(nextData, state);
        }),

      setContent: (content) => get().setField("content", content),

      /* ── Embeds ───────────────────────────────────────────────────────── */

      addEmbed: () =>
        set((state) => {
          const embed = newEmbed();
          const nextData = { ...state.data, embeds: [...state.data.embeds, embed] };
          return {
            ...syncDataToMessages(nextData, state),
            selection: { kind: "embed", id: embed._id as string },
          };
        }),

      updateEmbed: (id, patch) =>
        set((state) => {
          const nextData = {
            ...state.data,
            embeds: state.data.embeds.map((embed) =>
              embed._id === id ? { ...embed, ...patch } : embed,
            ),
          };
          return syncDataToMessages(nextData, state);
        }),

      removeEmbed: (id) =>
        set((state) => {
          const nextData = {
            ...state.data,
            embeds: state.data.embeds.filter((embed) => embed._id !== id),
          };
          return {
            ...syncDataToMessages(nextData, state),
            selection: state.selection?.id === id ? null : state.selection,
          };
        }),

      duplicateEmbed: (id) =>
        set((state) => {
          const index = state.data.embeds.findIndex((embed) => embed._id === id);
          const source = state.data.embeds[index];
          if (index === -1 || !source) return {};

          const copy: EmbedData = {
            ...(structuredClone(source) as EmbedData),
            _id: uid(),
            fields: (source.fields ?? []).map((field) => ({ ...field, _id: uid() })),
          };

          const embeds = [...state.data.embeds];
          embeds.splice(index + 1, 0, copy);
          const nextData = { ...state.data, embeds };
          return {
            ...syncDataToMessages(nextData, state),
            selection: { kind: "embed", id: copy._id as string },
          };
        }),

      /** `direction` is -1 for up, +1 for down. */
      moveEmbed: (id, direction) =>
        set((state) => {
          const embeds = [...state.data.embeds];
          const index = embeds.findIndex((embed) => embed._id === id);
          const target = index + direction;
          const a = embeds[index];
          const b = embeds[target];
          if (index === -1 || !a || !b) return {};

          embeds[index] = b;
          embeds[target] = a;
          const nextData = { ...state.data, embeds };
          return syncDataToMessages(nextData, state);
        }),

      addEmbedField: (embedId) =>
        set((state) => {
          const nextData = {
            ...state.data,
            embeds: state.data.embeds.map((embed) =>
              embed._id === embedId
                ? { ...embed, fields: [...(embed.fields ?? []), newEmbedField()] }
                : embed,
            ),
          };
          return syncDataToMessages(nextData, state);
        }),

      updateEmbedField: (embedId, fieldId, patch) =>
        set((state) => {
          const nextData = {
            ...state.data,
            embeds: state.data.embeds.map((embed) =>
              embed._id === embedId
                ? {
                    ...embed,
                    fields: (embed.fields ?? []).map((field) =>
                      field._id === fieldId ? { ...field, ...patch } : field,
                    ),
                  }
                : embed,
            ),
          };
          return syncDataToMessages(nextData, state);
        }),

      removeEmbedField: (embedId, fieldId) =>
        set((state) => {
          const nextData = {
            ...state.data,
            embeds: state.data.embeds.map((embed) =>
              embed._id === embedId
                ? { ...embed, fields: (embed.fields ?? []).filter((field) => field._id !== fieldId) }
                : embed,
            ),
          };
          return syncDataToMessages(nextData, state);
        }),

      /* ── Components ───────────────────────────────────────────────────── */

      /**
       * Add a component from the palette.
       * @param parentId nest inside this component, else the top level
       */
      addComponent: (type, parentId = null) =>
        set((state) => {
          const component = createComponent(type);
          const { components } = insertComponent(state.data.components, parentId, component);
          const nextData = { ...state.data, components };
          return {
            ...syncDataToMessages(nextData, state),
            selection: { kind: "component", id: component._id as string },
          };
        }),

      /** Add a button or select into a specific ActionRow. */
      addActionRowChild: (parentId, type = ComponentType.Button) =>
        set((state) => {
          const child = type === ComponentType.Button ? newButton() : createComponent(type);
          const { components } = insertComponent(state.data.components, parentId, child);
          const nextData = { ...state.data, components };
          return {
            ...syncDataToMessages(nextData, state),
            selection: { kind: "component", id: child._id as string },
          };
        }),

      updateComponentById: (id, patch) =>
        set((state) => {
          const { components } = updateInTree(state.data.components, id, () => patch);
          const nextData = { ...state.data, components };
          return syncDataToMessages(nextData, state);
        }),

      removeComponentById: (id) =>
        set((state) => {
          const { components } = removeFromTree(state.data.components, id);
          const selection =
            state.selection?.kind === "component" &&
            !findComponent(components, state.selection.id)
              ? null
              : state.selection;
          const nextData = { ...state.data, components };
          return {
            ...syncDataToMessages(nextData, state),
            selection,
          };
        }),

      moveComponentById: (id, direction, parentId = null) =>
        set((state) => {
          const { components, found } = moveInTree(
            state.data.components,
            id,
            direction,
            parentId,
          );
          if (!found) return {};
          const nextData = { ...state.data, components };
          return syncDataToMessages(nextData, state);
        }),

      /**
       * Duplicate a component (and any children) with fresh ids, inserting it
       * directly after the original.
       */
      duplicateComponentById: (id) =>
        set((state) => {
          const source = findComponent(state.data.components, id);
          if (!source) return {};

          const copy = reid(source);
          const list = state.data.components;
          const index = list.findIndex((component) => component._id === id);

          let components: ComponentNode[];
          if (index !== -1) {
            components = [...list];
            components.splice(index + 1, 0, copy);
          } else {
            components = insertComponent(list, null, copy).components;
          }

          const nextData = { ...state.data, components };
          return {
            ...syncDataToMessages(nextData, state),
            selection: { kind: "component", id: copy._id as string },
          };
        }),

      /* ── Selection & targets ──────────────────────────────────────────── */

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

      /* ── Send state ───────────────────────────────────────────────────── */

      setSendState: (patch) => set((state) => ({ send: { ...state.send, ...patch } })),
      resetSendState: () => set({ send: idleSendState() }),

      /* ── Multi-message Operations ────────────────────────────────────── */

      addMessage: (initial) =>
        set((state) => {
          if (state.messages.length >= 10) return state;
          const newMsg: MessageData = { ...emptyData(), ...initial };
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
            const resetMsg = emptyData();
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
          const source = state.messages[index] ?? state.data;
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

      /* ── Whole-document operations ────────────────────────────────────── */

      reset: () => {
        for (const file of get().attachedFiles) {
          if (file.previewUrl) {
            try {
              URL.revokeObjectURL(file.previewUrl);
            } catch {
              // Ignore
            }
          }
        }
        const blank = emptyData();
        set({
          mode: EDITOR_MODES.CLASSIC,
          data: blank,
          messages: [blank],
          activeMessageIndex: 0,
          targets: [{ url: "" }],
          selection: null,
          send: idleSendState(),
          attachedFiles: [],
        });
      },

      /** Replace the document (after importing a backup). */
      load: ({ data, mode, targets }) => {
        const inputMessages = (data as any)?.messages;
        let initialMessages: MessageData[] = [];
        if (Array.isArray(inputMessages) && inputMessages.length > 0) {
          initialMessages = inputMessages.map((m: any) => ({
            ...emptyData(),
            ...(m.data || m),
          }));
        } else {
          initialMessages = [{ ...emptyData(), ...data }];
        }
        set({
          mode: mode ?? EDITOR_MODES.CLASSIC,
          data: initialMessages[0],
          messages: initialMessages,
          activeMessageIndex: 0,
          targets: targets && targets.length > 0 ? targets : [{ url: "" }],
          selection: null,
        });
      },

      /* ── Derived values ───────────────────────────────────────────────── */

      /** The exact body to send to Discord. */
      getPayload: () => toDiscordPayload(get().data, get().mode),

      /** All message payloads for multi-message payloads. */
      getAllPayloads: () => {
        const mode = get().mode;
        return get().messages.map((msg) => toDiscordPayload(msg, mode));
      },

      /** Problems that would make Discord reject the message. */
      getValidationErrors: () => validateMessage(get().data, get().mode),
    }),
    {
      name: "dmb:message",
      // Only the document is worth persisting; transient send/selection state
      // should reset on reload.
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
