import { db } from "../config/database.js";

export interface CustomExecutorRecord {
  id: string;
  title: string;
  enabled: number;
  author_id: string | null;
  template_id: number | null;
  custom_payload: string | null;
  created_at: number;
  updated_at: number;
}

export interface UpsertCustomExecutorInput {
  id: string;
  title: string;
  enabled?: boolean;
  author_id?: string | null;
  template_id?: number | null;
  custom_payload?: string | null;
}

export const customExecutorRepository = {
  async list(onlyEnabled = true): Promise<CustomExecutorRecord[]> {
    if (onlyEnabled) {
      return db.query<CustomExecutorRecord>(
        `SELECT * FROM custom_executors WHERE enabled = 1 ORDER BY title ASC`,
      );
    }
    return db.query<CustomExecutorRecord>(
      `SELECT * FROM custom_executors ORDER BY title ASC`,
    );
  },

  async findById(id: string): Promise<CustomExecutorRecord | undefined> {
    return db.get<CustomExecutorRecord>(
      `SELECT * FROM custom_executors WHERE id = @id`,
      { id },
    );
  },

  async findByTitle(title: string): Promise<CustomExecutorRecord | undefined> {
    return db.get<CustomExecutorRecord>(
      `SELECT * FROM custom_executors WHERE LOWER(title) = LOWER(@title) LIMIT 1`,
      { title },
    );
  },

  async upsert(data: UpsertCustomExecutorInput): Promise<CustomExecutorRecord> {
    const now = Date.now();
    const existing = await this.findById(data.id);
    const enabledVal = data.enabled === false ? 0 : 1;

    if (existing) {
      await db.run(
        `UPDATE custom_executors
            SET title = @title,
                enabled = @enabled,
                author_id = @author_id,
                template_id = @template_id,
                custom_payload = @custom_payload,
                updated_at = @now
          WHERE id = @id`,
        {
          id: data.id,
          title: data.title,
          enabled: enabledVal,
          author_id: data.author_id !== undefined ? data.author_id : existing.author_id,
          template_id: data.template_id !== undefined ? data.template_id : existing.template_id,
          custom_payload: data.custom_payload !== undefined ? data.custom_payload : existing.custom_payload,
          now,
        },
      );
      return {
        ...existing,
        title: data.title,
        enabled: enabledVal,
        author_id: data.author_id !== undefined ? data.author_id : existing.author_id,
        template_id: data.template_id !== undefined ? data.template_id : existing.template_id,
        custom_payload: data.custom_payload !== undefined ? data.custom_payload : existing.custom_payload,
        updated_at: now,
      };
    }

    await db.run(
      `INSERT INTO custom_executors (
         id, title, enabled, author_id, template_id, custom_payload, created_at, updated_at
       ) VALUES (
         @id, @title, @enabled, @author_id, @template_id, @custom_payload, @now, @now
       )`,
      {
        id: data.id,
        title: data.title,
        enabled: enabledVal,
        author_id: data.author_id ?? null,
        template_id: data.template_id ?? null,
        custom_payload: data.custom_payload ?? null,
        now,
      },
    );

    return {
      id: data.id,
      title: data.title,
      enabled: enabledVal,
      author_id: data.author_id ?? null,
      template_id: data.template_id ?? null,
      custom_payload: data.custom_payload ?? null,
      created_at: now,
      updated_at: now,
    };
  },

  async delete(id: string): Promise<void> {
    await db.run(`DELETE FROM custom_executors WHERE id = @id`, { id });
  },
};
