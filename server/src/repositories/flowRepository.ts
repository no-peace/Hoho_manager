import type { FlowStateRecord } from "@dmb/shared";
import { BaseRepository, parseJson } from "./baseRepository.js";

/**
 * Short-lived state for multi-step interactions (modals, wizard-like flows).
 *
 * Discord interaction tokens are valid for 15 minutes, so entries are keyed by
 * token and carry an `expires_at`; {@link pruneExpired} clears stale rows.
 */

/** A row as stored: `variables` is still a JSON string. */
export interface FlowRow {
  token: string;
  template_id: number | null;
  step: number;
  variables: string;
  expires_at: string;
  created_at: string;
}

export interface SaveFlowInput {
  token: string;
  templateId?: number | null;
  step?: number;
  variables?: Record<string, unknown>;
  /** Defaults to Discord's 15-minute interaction-token lifetime. */
  ttlSeconds?: number;
}

const DEFAULT_TTL_SECONDS = 900;

const hydrate = (row: FlowRow | undefined): FlowStateRecord | undefined =>
  parseJson<FlowStateRecord>(row as unknown as FlowStateRecord, ["variables"]);

export class FlowRepository extends BaseRepository {
  async save({
    token,
    templateId = null,
    step = 0,
    variables = {},
    ttlSeconds = DEFAULT_TTL_SECONDS,
  }: SaveFlowInput): Promise<FlowStateRecord | undefined> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    await this.db.run(
      `INSERT INTO flow_states (token, template_id, step, variables, expires_at)
       VALUES (@token, @templateId, @step, @variables, @expiresAt)
       ON CONFLICT(token) DO UPDATE SET
         step       = @step,
         variables  = @variables,
         expires_at = @expiresAt`,
      { token, templateId, step, variables: JSON.stringify(variables ?? {}), expiresAt },
    );
    return this.get(token);
  }

  async get(token: string): Promise<FlowStateRecord | undefined> {
    const row = await this.db.get<FlowRow>(
      "SELECT * FROM flow_states WHERE token = @token AND expires_at > CURRENT_TIMESTAMP",
      { token },
    );
    return hydrate(row);
  }

  async advance(
    token: string,
    { variables }: { variables?: Record<string, unknown> } = {},
  ): Promise<FlowStateRecord | undefined> {
    const existing = await this.get(token);
    if (!existing) return undefined;

    return this.save({
      token,
      templateId: existing.template_id,
      step: existing.step + 1,
      variables: variables ? { ...existing.variables, ...variables } : existing.variables,
    });
  }

  async remove(token: string): Promise<boolean> {
    const { changes } = await this.db.run("DELETE FROM flow_states WHERE token = @token", {
      token,
    });
    return changes > 0;
  }

  async pruneExpired(): Promise<number> {
    const { changes } = await this.db.run(
      "DELETE FROM flow_states WHERE expires_at <= CURRENT_TIMESTAMP",
    );
    return changes;
  }
}

export const flowRepository = new FlowRepository();
