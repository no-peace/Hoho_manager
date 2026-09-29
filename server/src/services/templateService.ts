import type {
  ActionDefinitionRecord,
  ActionType,
  QueryData,
  StoredActionDefinition,
  TemplateRecord,
} from "@dmb/shared";
import { actionRepository } from "../repositories/actionRepository.js";
import {
  templateRepository,
  type TemplateSummary,
} from "../repositories/templateRepository.js";
import { ApiError } from "../utils/errors.js";

/**
 * Template use-cases.
 *
 * Routes stay thin: they parse the request and delegate here. The service owns
 * the rule that saving a template also replaces its action definitions, so the
 * two tables can never drift apart.
 */

const MAX_TEMPLATES_PER_USER = 500;

export interface TemplateWithActions extends TemplateRecord {
  /**
   * Always the editor wire shape (`customId`/`actionType`), never raw DB rows.
   * Returning `action_type` here used to make loaded flows come back with
   * `undefined` step types.
   */
  actions: StoredActionDefinition[];
}

/** DB rows -> the editor's wire shape. */
const toStoredActions = (records: ActionDefinitionRecord[]): StoredActionDefinition[] =>
  records.map((record) => ({
    customId: record.custom_id,
    actionType: record.action_type as ActionType,
    config: record.config ?? {},
    executionOrder: record.execution_order,
  }));

export interface CreateTemplateServiceInput {
  name: string;
  description?: string | null;
  data: QueryData | Record<string, unknown>;
  actions?: StoredActionDefinition[];
  isPublic?: number;
}

export interface UpdateTemplateServiceInput {
  name?: string;
  description?: string | null;
  data?: QueryData | Record<string, unknown>;
  actions?: StoredActionDefinition[];
  isPublic?: number;
}

export const templateService = {
  async list(userId: number, { q }: { q?: string } = {}): Promise<TemplateSummary[]> {
    return templateRepository.search({ userId, q: q?.trim() || null });
  },

  async get(id: number, userId: number): Promise<TemplateWithActions> {
    const template = await templateRepository.findById(id);
    if (!template) throw ApiError.notFound("Template not found");
    if (template.user_id !== userId) {
      throw ApiError.forbidden("That template belongs to someone else");
    }

    return { ...template, actions: toStoredActions(await actionRepository.listByTemplate(id)) };
  },

  async create(
    userId: number,
    { name, description = null, data, actions = [], isPublic = 0 }: CreateTemplateServiceInput,
  ): Promise<TemplateWithActions> {
    const existing = await templateRepository.findByUser(userId);
    if (existing.length >= MAX_TEMPLATES_PER_USER) {
      throw ApiError.badRequest(`You've reached the ${MAX_TEMPLATES_PER_USER} template limit`);
    }

    const template = await templateRepository.create({
      userId,
      name,
      description,
      data,
      isPublic,
    });
    if (!template) throw ApiError.upstream("Template could not be created");

    if (actions.length > 0) {
      await actionRepository.replaceForTemplate(template.id, actions);
    }

    return this.get(template.id, userId);
  },

  async update(
    id: number,
    userId: number,
    { name, description, data, actions, isPublic }: UpdateTemplateServiceInput,
  ): Promise<TemplateWithActions> {
    // Ownership check happens inside get().
    await this.get(id, userId);

    if (data !== undefined) {
      // `data` is the whole message document, so an update always replaces it.
      await templateRepository.updateData(id, data);
    }

    const updated = await templateRepository.update(id, { name, description, is_public: isPublic });
    if (!updated) throw ApiError.notFound("Template not found");

    if (actions !== undefined) {
      await actionRepository.replaceForTemplate(id, actions);
    }

    return { ...updated, actions: toStoredActions(await actionRepository.listByTemplate(id)) };
  },

  async remove(id: number, userId: number): Promise<boolean> {
    await this.get(id, userId);
    return templateRepository.delete(id);
  },
};

export default templateService;
