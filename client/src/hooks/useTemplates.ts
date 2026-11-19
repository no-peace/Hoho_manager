import { useCallback, useEffect } from "react";
import type { TemplateDetailResponse, TemplateSummary } from "../api/client";
import { useActionStore } from "../store/actionStore";
import { useMessageStore } from "../store/messageStore";
import { useTemplateStore } from "../store/templateStore";
import { toQueryData, type QueryData } from "../utils/exportImport";

/**
 * Bridges the template store, the message store and the action store.
 *
 * Saving needs data from three places, and loading has to write back to all
 * three  keeping that orchestration in a hook means the components stay
 * declarative and the flow only exists once.
 */
export interface UseTemplatesReturn {
  templates: TemplateSummary[];
  currentId: number | null;
  currentName: string;
  dirty: boolean;
  status: "idle" | "loading" | "error";
  error: string | null;
  saveCurrent(expiresAt?: string | null, isTracked?: boolean): Promise<TemplateDetailResponse["template"]>;
  loadTemplate(id: number): Promise<TemplateDetailResponse["template"] | null>;
  refresh(query?: string): Promise<void>;
}

export const useTemplates = (): UseTemplatesReturn => {
  const templates = useTemplateStore((state) => state.templates);
  const currentId = useTemplateStore((state) => state.currentId);
  const currentName = useTemplateStore((state) => state.currentName);
  const dirty = useTemplateStore((state) => state.dirty);
  const status = useTemplateStore((state) => state.status);
  const error = useTemplateStore((state) => state.error);
  const fetchTemplates = useTemplateStore((state) => state.fetchTemplates);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const saveCurrent = useCallback(
    async (expiresAt?: string | null, isTracked?: boolean): Promise<TemplateDetailResponse["template"]> => {
      const { data, messages, targets, mode } = useMessageStore.getState();
      const actions = useActionStore.getState().toList();
      const messagesToSave = messages && messages.length > 0 ? messages : [data];
      const document = toQueryData(messagesToSave, targets, mode);

      const saved = await useTemplateStore.getState().save({ data: document, actions, expiresAt, isTracked });
      useMessageStore.getState().markClean();
      useActionStore.getState().markClean();
      return saved;
    },
    [],
  );

  const loadTemplate = useCallback(
    async (id: number): Promise<TemplateDetailResponse["template"] | null> => {
      const template = await useTemplateStore.getState().load(id);
      if (!template) return null;

      const document = template.data as QueryData;
      const legacyData = document.messages?.[0]?.data;
      const legacyTargets = legacyData && "targets" in legacyData
        ? (legacyData as any).targets
        : undefined;
      useMessageStore.getState().load({
        data: document,
        targets: document.targets ?? legacyTargets,
        mode: document.mode,
      });
      useActionStore.getState().loadFromList(template.actions ?? []);
      return template;
    },
    [],
  );

  return {
    templates,
    currentId,
    currentName,
    dirty,
    status,
    error,
    saveCurrent,
    loadTemplate,
    refresh: fetchTemplates,
  };
};

export default useTemplates;
