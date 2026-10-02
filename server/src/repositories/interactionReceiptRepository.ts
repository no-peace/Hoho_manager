import type { InteractionResponse } from "@dmb/shared";
import { BaseRepository } from "./baseRepository.js";

interface InteractionReceiptRow {
  response_json: string | null;
}

const RECEIPT_TTL_SECONDS = 15 * 60;

export class InteractionReceiptRepository extends BaseRepository {
  async claim(interactionId: string): Promise<boolean> {
    const now = new Date();
    const { changes } = await this.db.run(
      `INSERT INTO interaction_receipts (interaction_id, expires_at, created_at)
       VALUES (@interactionId, @expiresAt, @createdAt)
       ON CONFLICT(interaction_id) DO UPDATE SET
         response_json = NULL,
         expires_at = @expiresAt,
         created_at = @createdAt
       WHERE interaction_receipts.expires_at <= @createdAt`,
      {
        interactionId,
        expiresAt: new Date(now.getTime() + RECEIPT_TTL_SECONDS * 1000).toISOString(),
        createdAt: now.toISOString(),
      },
    );
    return changes === 1;
  }

  async getResponse(interactionId: string): Promise<InteractionResponse | null> {
    const row = await this.db.get<InteractionReceiptRow>(
      `SELECT response_json FROM interaction_receipts
       WHERE interaction_id = @interactionId AND expires_at > @now`,
      { interactionId, now: new Date().toISOString() },
    );
    if (!row?.response_json) return null;

    try {
      const parsed: unknown = JSON.parse(row.response_json);
      return parsed !== null && typeof parsed === "object"
        ? (parsed as InteractionResponse)
        : null;
    } catch {
      return null;
    }
  }

  async complete(interactionId: string, response: InteractionResponse): Promise<void> {
    await this.db.run(
      `UPDATE interaction_receipts SET response_json = @response
       WHERE interaction_id = @interactionId`,
      { interactionId, response: JSON.stringify(response) },
    );
  }

  async pruneExpired(): Promise<number> {
    const { changes } = await this.db.run(
      "DELETE FROM interaction_receipts WHERE expires_at <= @now",
      { now: new Date().toISOString() },
    );
    return changes;
  }
}

export const interactionReceiptRepository = new InteractionReceiptRepository();