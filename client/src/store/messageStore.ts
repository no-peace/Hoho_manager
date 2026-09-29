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

export interface MessageState {
  mode: EditorMode;
  data: MessageData;
  targets: TargetData[];
  selection: Selection;
  send: SendState;

  setMode(mode: EditorMode): void;

  setField<K extends keyof MessageData>(key: K, value: MessageData[K]): void;
  setContent(content: string): void;

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

  reset(): void;
  load(input: LoadDocumentInput): void;

  getPayload(): DiscordMessagePayload;
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
});

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
      targets: [{ url: "" }],
      selection: null,
      send: idleSendState(),

      /* ── Mode ─────────────────────────────────────────────────────────── */

      setMode: (mode) => set({ mode, selection: null }),

      /* ── Scalar fields ────────────────────────────────────────────────── */

      setField: (key, value) => set((state) => ({ data: { ...state.data, [key]: value } })),

      setContent: (content) => get().setField("content", content),

      /* ── Embeds ───────────────────────────────────────────────────────── */

      addEmbed: () =>
        set((state) => {
          const embed = newEmbed();
          return {
            data: { ...state.data, embeds: [...state.data.embeds, embed] },
            selection: { kind: "embed", id: embed._id as string },
          };
        }),

      updateEmbed: (id, patch) =>
        set((state) => ({
          data: {
            ...state.data,
            embeds: state.data.embeds.map((embed) =>
              embed._id === id ? { ...embed, ...patch } : embed,
            ),
          },
        })),

      removeEmbed: (id) =>
        set((state) => ({
          data: {
            ...state.data,
            embeds: state.data.embeds.filter((embed) => embed._id !== id),
          },
          selection: state.selection?.id === id ? null : state.selection,
        })),

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
          return {
            data: { ...state.data, embeds },
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
          return { data: { ...state.data, embeds } };
        }),

      addEmbedField: (embedId) =>
        set((state) => ({
          data: {
            ...state.data,
            embeds: state.data.embeds.map((embed) =>
              embed._id === embedId
                ? { ...embed, fields: [...(embed.fields ?? []), newEmbedField()] }
                : embed,
            ),
          },
        })),

      updateEmbedField: (embedId, fieldId, patch) =>
        set((state) => ({
          data: {
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
          },
        })),

      removeEmbedField: (embedId, fieldId) =>
        set((state) => ({
          data: {
            ...state.data,
            embeds: state.data.embeds.map((embed) =>
              embed._id === embedId
                ? { ...embed, fields: (embed.fields ?? []).filter((field) => field._id !== fieldId) }
                : embed,
            ),
          },
        })),

      /* ── Components ───────────────────────────────────────────────────── */

      /**
       * Add a component from the palette.
       * @param parentId nest inside this component, else the top level
       */
      addComponent: (type, parentId = null) =>
        set((state) => {
          const component = createComponent(type);
          const { components } = insertComponent(state.data.components, parentId, component);
          return {
            data: { ...state.data, components },
            selection: { kind: "component", id: component._id as string },
          };
        }),

      /** Add a button or select into a specific ActionRow. */
      addActionRowChild: (parentId, type = ComponentType.Button) =>
        set((state) => {
          const child = type === ComponentType.Button ? newButton() : createComponent(type);
          const { components } = insertComponent(state.data.components, parentId, child);
          return {
            data: { ...state.data, components },
            selection: { kind: "component", id: child._id as string },
          };
        }),

      updateComponentById: (id, patch) =>
        set((state) => {
          const { components } = updateInTree(state.data.components, id, () => patch);
          return { data: { ...state.data, components } };
        }),

      removeComponentById: (id) =>
        set((state) => {
          const { components } = removeFromTree(state.data.components, id);
          return {
            data: { ...state.data, components },
            selection: state.selection?.id === id ? null : state.selection,
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
          return found ? { data: { ...state.data, components } } : {};
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

          return {
            data: { ...state.data, components },
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

      /* ── Whole-document operations ────────────────────────────────────── */

      reset: () =>
        set({
          mode: EDITOR_MODES.CLASSIC,
          data: emptyData(),
          targets: [{ url: "" }],
          selection: null,
          send: idleSendState(),
        }),

      /** Replace the document (after importing a backup). */
      load: ({ data, mode, targets }) =>
        set({
          mode: mode ?? EDITOR_MODES.CLASSIC,
          data: { ...emptyData(), ...data },
          targets: targets && targets.length > 0 ? targets : [{ url: "" }],
          selection: null,
        }),

      /* ── Derived values ───────────────────────────────────────────────── */

      /** The exact body to send to Discord. */
      getPayload: () => toDiscordPayload(get().data, get().mode),

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
        targets: state.targets,
      }),
      version: 1,
    },
  ),
);

export default useMessageStore;
