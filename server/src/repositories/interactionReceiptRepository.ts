import type { InteractionResponse } from "@dmb/shared";
import { BaseRepository } from "./baseRepository.js";

interface InteractionReceiptRow {
  response_json: string | null;
  duplicate_delivery: number;
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
         duplicate_delivery = 0,
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

  async markDuplicate(interactionId: string): Promise<void> {
    await this.db.run(
      `UPDATE interaction_receipts SET duplicate_delivery = 1
       WHERE interaction_id = @interactionId
         AND expires_at > @now
         AND response_json IS NULL`,
      { interactionId, now: new Date().toISOString() },
    );
  }

  async complete(
    interactionId: string,
    response: InteractionResponse,
    duplicateResponse: InteractionResponse = response,
  ): Promise<boolean> {
    await this.db.run(
      `UPDATE interaction_receipts
       SET response_json = CASE WHEN duplicate_delivery = 1 THEN @duplicateResponse ELSE @response END
       WHERE interaction_id = @interactionId`,
      {
        interactionId,
        response: JSON.stringify(response),
        duplicateResponse: JSON.stringify(duplicateResponse),
      },
    );
    const row = await this.db.get<{ duplicate_delivery: number }>(
      "SELECT duplicate_delivery FROM interaction_receipts WHERE interaction_id = @interactionId",
      { interactionId },
    );
    return row?.duplicate_delivery === 1;
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