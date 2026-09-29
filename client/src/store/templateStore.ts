import { create } from "zustand";
import {
  api,
  type TemplateDetailResponse,
  type TemplateSummary,
} from "../api/client";

/**
 * Saved message templates, backed by the server.
 *
 * Kept separate from the editor document: saving is an explicit action, and the
 * `dirty` flag is what tells the user their current work differs from what is
 * stored. Actions ride along with the template because a button without its
 * action config is useless.
 */

/** Strip the (large) document body before caching a summary in the list. */
const toSummary = (template: TemplateDetailResponse["template"]): TemplateSummary => ({
  id: template.id,
  user_id: template.user_id,
  name: template.name,
  description: template.description,
  preview_image_url: template.preview_image_url,
  is_public: template.is_public,
  created_at: template.created_at,
  updated_at: template.updated_at,
});

export interface TemplateState {
  templates: TemplateSummary[];
  currentId: number | null;
  currentName: string;
  dirty: boolean;
  status: "idle" | "loading" | "error";
  error: string | null;

  setCurrentName(name: string): void;
  markDirty(): void;

  fetchTemplates(query?: string): Promise<void>;
  /** Persist the current document. */
  save(document: { data: unknown; actions: unknown[] }): Promise<TemplateDetailResponse["template"]>;
  /** Fetch a full template and hand it back for the caller to load. */
  load(id: number): Promise<TemplateDetailResponse["template"]>;
  remove(id: number): Promise<void>;
  /** Forget the loaded template without discarding the document on screen. */
  detach(): void;
}

export const useTemplateStore = create<TemplateState>()((set, get) => ({
  templates: [],
  currentId: null,
  currentName: "",
  dirty: false,
  status: "idle",
  error: null,

  setCurrentName: (currentName) => set({ currentName, dirty: true }),
  markDirty: () => set({ dirty: true }),

  fetchTemplates: async (query) => {
    set({ status: "loading", error: null });
    try {
      const response = await api.templates.list(query);
      set({ templates: response.templates, status: "idle" });
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  save: async (document) => {
    const { currentId, currentName } = get();
    if (!currentName.trim()) throw new Error("Give the template a name before saving.");

    const body = {
      name: currentName.trim(),
      data: document.data,
      actions: document.actions,
    };

    const response = currentId
      ? await api.templates.update(currentId, body)
      : await api.templates.create(body);

    const template = response.template;
    set((state) => ({
      currentId: template.id,
      dirty: false,
      templates: [
        toSummary(template),
        ...state.templates.filter((existing) => existing.id !== template.id),
      ],
    }));

    return template;
  },

  load: async (id) => {
    set({ status: "loading", error: null });
    try {
      const response = await api.templates.get(id);
      const template = response.template;
      set({
        currentId: template.id,
        currentName: template.name,
        dirty: false,
        status: "idle",
      });
      return template;
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  remove: async (id) => {
    await api.templates.remove(id);
    set((state) => ({
      templates: state.templates.filter((template) => template.id !== id),
      currentId: state.currentId === id ? null : state.currentId,
    }));
  },

  detach: () => set({ currentId: null, currentName: "", dirty: false }),
}));

export default useTemplateStore;
