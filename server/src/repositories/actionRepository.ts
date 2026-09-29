import type {
  ActionConfig,
  ActionDefinitionRecord,
  ActionType,
  FlowRegistration,
  StoredActionDefinition,
} from "@dmb/shared";
import { BaseRepository, parseJson, parseJsonList } from "./baseRepository.js";

/**
 * Action definitions + the execution audit log.
 *
 * A definition binds a component `custom_id` to a handler and its config.
 * Several definitions can share a `custom_id` — they run in `execution_order`,
 * which is how multi-step flows are expressed.
 */

interface ActionRow {
  id: number;
  template_id: number | null;
  custom_id: string;
  action_type: string;
  config: string;
  execution_order: number;
  created_at: string;
}

export interface ActionLogRow {
  id: number;
  action_definition_id: number | null;
  interaction_id: string;
  user_id: string;
  guild_id: string | null;
  channel_id: string | null;
  status: string;
  response: string | null;
  executed_at: string;
}

export interface CreateActionInput {
  templateId?: number | null;
  customId: string;
  actionType: ActionType;
  config?: ActionConfig;
  executionOrder?: number;
}

export interface LogActionInput {
  actionDefinitionId?: number | null;
  interactionId: string;
  userId: string;
  guildId?: string | null;
  channelId?: string | null;
  status: "success" | "failed" | "pending";
  response?: unknown;
}

const hydrate = (row: ActionRow | undefined): ActionDefinitionRecord | undefined =>
  parseJson<ActionDefinitionRecord>(row as unknown as ActionDefinitionRecord, ["config"]);

export class ActionRepository extends BaseRepository {
  async create({
    templateId = null,
    customId,
    actionType,
    config = {},
    executionOrder = 0,
  }: CreateActionInput): Promise<ActionDefinitionRecord | undefined> {
    const { lastInsertRowid } = await this.db.run(
      `INSERT INTO action_definitions (template_id, custom_id, action_type, config, execution_order)
       VALUES (@templateId, @customId, @actionType, @config, @executionOrder)`,
      {
        templateId,
        customId,
        actionType,
        config: JSON.stringify(config ?? {}),
        executionOrder,
      },
    );
    return this.findById(lastInsertRowid);
  }

  /** Replace every action bound to a template in one call. */
  async replaceForTemplate(
    templateId: number,
    actions: StoredActionDefinition[] = [],
  ): Promise<ActionDefinitionRecord[]> {
    await this.deleteByTemplate(templateId);

    const created: ActionDefinitionRecord[] = [];
    for (const [index, action] of actions.entries()) {
      const definition = await this.create({
        templateId,
        customId: action.customId,
        actionType: action.actionType,
        config: action.config ?? {},
        executionOrder: action.executionOrder ?? index,
      });
      if (definition) created.push(definition);
    }
    return created;
  }

  async findById(id: number): Promise<ActionDefinitionRecord | undefined> {
    const row = await this.db.get<ActionRow>(
      "SELECT * FROM action_definitions WHERE id = @id",
      { id },
    );
    return hydrate(row);
  }

  /**
   * All steps bound to a custom_id, in execution order.
   *
   * Precedence matters: a flow registered at send time (`template_id IS NULL`,
   * the freshest definition of what this button does) wins over steps owned by a
   * saved template. Without that, sending a template-backed message ad-hoc would
   * execute both sets and double up every action.
   */
  async findByCustomId(customId: string): Promise<ActionDefinitionRecord[]> {
    const registered = await this.db.query<ActionRow>(
      `SELECT * FROM action_definitions
        WHERE custom_id = @customId AND template_id IS NULL
        ORDER BY execution_order ASC`,
      { customId },
    );
    if (registered.length > 0) {
      return parseJsonList(registered as unknown as ActionDefinitionRecord[], ["config"]);
    }

    const rows = await this.db.query<ActionRow>(
      "SELECT * FROM action_definitions WHERE custom_id = @customId ORDER BY execution_order ASC",
      { customId },
    );
    return parseJsonList(rows as unknown as ActionDefinitionRecord[], ["config"]);
  }

  /**
   * Register the flows an ad-hoc message ships with, replacing any previous
   * ad-hoc registration for the same components. Template-owned rows are left
   * untouched.
   */
  async registerFlows(flows: FlowRegistration[] = []): Promise<number> {
    let written = 0;

    for (const flow of flows) {
      await this.db.run(
        "DELETE FROM action_definitions WHERE custom_id = @customId AND template_id IS NULL",
        { customId: flow.customId },
      );

      for (const [index, step] of (flow.steps ?? []).entries()) {
        await this.create({
          templateId: null,
          customId: flow.customId,
          actionType: step.type,
          config: step.config ?? {},
          executionOrder: index,
        });
        written += 1;
      }
    }

    return written;
  }

  async listByTemplate(templateId: number): Promise<ActionDefinitionRecord[]> {
    const rows = await this.db.query<ActionRow>(
      `SELECT * FROM action_definitions
        WHERE template_id = @templateId
        ORDER BY execution_order ASC`,
      { templateId },
    );
    return parseJsonList(rows as unknown as ActionDefinitionRecord[], ["config"]);
  }

  async deleteByTemplate(templateId: number): Promise<number> {
    const { changes } = await this.db.run(
      "DELETE FROM action_definitions WHERE template_id = @templateId",
      { templateId },
    );
    return changes;
  }

  /** Append to the audit trail. Never let a log failure break an interaction. */
  async log({
    actionDefinitionId = null,
    interactionId,
    userId,
    guildId = null,
    channelId = null,
    status,
    response = null,
  }: LogActionInput): Promise<void> {
    try {
      await this.db.run(
        `INSERT INTO action_logs
           (action_definition_id, interaction_id, user_id, guild_id, channel_id, status, response)
         VALUES
           (@actionDefinitionId, @interactionId, @userId, @guildId, @channelId, @status, @response)`,
        {
          actionDefinitionId,
          interactionId,
          userId,
          guildId,
          channelId,
          status,
          response: response == null ? null : JSON.stringify(response),
        },
      );
    } catch {
      // Logging is best-effort; a failure here must not fail the interaction.
    }
  }

  async listLogs({
    limit = 50,
    offset = 0,
  }: { limit?: number; offset?: number } = {}): Promise<ActionLogRow[]> {
    const rows = await this.db.query<ActionLogRow>(
      "SELECT * FROM action_logs ORDER BY executed_at DESC LIMIT @limit OFFSET @offset",
      { limit, offset },
    );
    return parseJsonList(rows as unknown as ActionLogRow[], ["response"]);
  }
}

export const actionRepository = new ActionRepository();
