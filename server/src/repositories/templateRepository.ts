import type { QueryData, TemplateRecord } from "@dmb/shared";
import { BaseRepository, buildUpdate, parseJson } from "./baseRepository.js";

/**
 * Message templates.
 *
 * `data` is the full Discohook-compatible `QueryData` document, serialised to a
 * TEXT column and parsed back on read so callers always deal with plain objects.
 */

/** A row as stored: `data` is still a JSON string. */
export interface TemplateRow {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  data: string;
  preview_image_url: string | null;
  is_public: number;
  created_at: string;
  updated_at: string;
}

/** The list view omits the (potentially large) document body. */
export interface TemplateSummary {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  preview_image_url: string | null;
  is_public: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  userId: number;
  name: string;
  description?: string | null;
  data: QueryData | Record<string, unknown>;
  previewImageUrl?: string | null;
  isPublic?: number;
}

export type UpdateTemplateInput = Partial<
  Pick<TemplateRow, "name" | "description" | "preview_image_url" | "is_public">
>;

const UPDATABLE = ["name", "description", "preview_image_url", "is_public"] as const;

const hydrate = (row: TemplateRow | undefined): TemplateRecord | undefined =>
  parseJson<TemplateRecord>(row as unknown as TemplateRecord, ["data"]);

export class TemplateRepository extends BaseRepository {
  async create({
    userId,
    name,
    description = null,
    data,
    previewImageUrl = null,
    isPublic = 0,
  }: CreateTemplateInput): Promise<TemplateRecord | undefined> {
    const { lastInsertRowid } = await this.db.run(
      `INSERT INTO templates (user_id, name, description, data, preview_image_url, is_public)
       VALUES (@userId, @name, @description, @data, @previewImageUrl, @isPublic)`,
      {
        userId,
        name,
        description,
        data: JSON.stringify(data ?? {}),
        previewImageUrl,
        isPublic: isPublic ? 1 : 0,
      },
    );
    return this.findById(lastInsertRowid);
  }

  async findById(id: number): Promise<TemplateRecord | undefined> {
    const row = await this.db.get<TemplateRow>("SELECT * FROM templates WHERE id = @id", { id });
    return hydrate(row);
  }

  async findByUser(userId: number): Promise<TemplateSummary[]> {
    return this.db.query<TemplateSummary>(
      `SELECT id, user_id, name, description, preview_image_url, is_public, created_at, updated_at
         FROM templates
        WHERE user_id = @userId
        ORDER BY updated_at DESC`,
      { userId },
    );
  }

  /** Lightweight substring search — swap for FTS/`ILIKE` when moving to Postgres. */
  async search({
    userId,
    q,
    limit = 25,
  }: {
    userId: number;
    q?: string | null;
    limit?: number;
  }): Promise<TemplateSummary[]> {
    return this.db.query<TemplateSummary>(
      `SELECT id, user_id, name, description, preview_image_url, is_public, created_at, updated_at
         FROM templates
        WHERE user_id = @userId
          AND (@q IS NULL OR name LIKE @like OR description LIKE @like)
        ORDER BY updated_at DESC
        LIMIT @limit`,
      { userId, q: q ?? null, like: `%${q ?? ""}%`, limit },
    );
  }

  /** Replace the stored message document (`data`). */
  async updateData(
    id: number,
    data: QueryData | Record<string, unknown>,
  ): Promise<TemplateRecord | undefined> {
    await this.db.run(
      "UPDATE templates SET data = @data, updated_at = CURRENT_TIMESTAMP WHERE id = @id",
      { data: JSON.stringify(data ?? {}), id },
    );
    return this.findById(id);
  }

  async update(id: number, data: UpdateTemplateInput): Promise<TemplateRecord | undefined> {
    const setClause = buildUpdate(data as Record<string, unknown>, UPDATABLE);
    if (!setClause) return this.findById(id);

    await this.db.run(
      `UPDATE templates SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`,
      { ...data, id },
    );
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const { changes } = await this.db.run("DELETE FROM templates WHERE id = @id", { id });
    return changes > 0;
  }
}

export const templateRepository = new TemplateRepository();
