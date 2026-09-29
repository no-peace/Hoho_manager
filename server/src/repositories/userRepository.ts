import type { UserRecord, UserRole } from "@dmb/shared";
import { BaseRepository, buildUpdate } from "./baseRepository.js";

/**
 * Users repository.
 *
 * There is a single `local-admin` row today, but the shape is already
 * multi-user: `role` is what the RBAC middleware checks, so adding real accounts
 * later is additive.
 */

export interface CreateUserInput {
  discordId: string;
  username: string;
  avatar?: string | null;
  role?: UserRole;
}

export type UpdateUserInput = Partial<Pick<UserRecord, "username" | "avatar" | "role">>;

const UPDATABLE = ["username", "avatar", "role"] as const;

export class UserRepository extends BaseRepository {
  async findById(id: number): Promise<UserRecord | undefined> {
    return this.db.get<UserRecord>("SELECT * FROM users WHERE id = @id", { id });
  }

  async findByDiscordId(discordId: string): Promise<UserRecord | undefined> {
    return this.db.get<UserRecord>("SELECT * FROM users WHERE discord_id = @discordId", {
      discordId,
    });
  }

  async list(): Promise<UserRecord[]> {
    return this.db.query<UserRecord>("SELECT * FROM users ORDER BY created_at ASC");
  }

  async create({
    discordId,
    username,
    avatar = null,
    role = "editor",
  }: CreateUserInput): Promise<UserRecord | undefined> {
    const { lastInsertRowid } = await this.db.run(
      `INSERT INTO users (discord_id, username, avatar, role)
       VALUES (@discordId, @username, @avatar, @role)`,
      { discordId, username, avatar, role },
    );
    return this.findById(lastInsertRowid);
  }

  /** Insert-or-update keyed on `discord_id`; useful for login flows. */
  async upsert({
    discordId,
    username,
    avatar = null,
    role = "editor",
  }: CreateUserInput): Promise<UserRecord | undefined> {
    await this.db.run(
      `INSERT INTO users (discord_id, username, avatar, role)
       VALUES (@discordId, @username, @avatar, @role)
       ON CONFLICT(discord_id) DO UPDATE SET
         username   = @username,
         avatar     = @avatar,
         updated_at = CURRENT_TIMESTAMP`,
      { discordId, username, avatar, role },
    );
    return this.findByDiscordId(discordId);
  }

  async update(id: number, data: UpdateUserInput): Promise<UserRecord | undefined> {
    const setClause = buildUpdate(data as Record<string, unknown>, UPDATABLE);
    if (!setClause) return this.findById(id);

    await this.db.run(
      `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`,
      { ...data, id },
    );
    return this.findById(id);
  }

  async setRole(id: number, role: UserRole): Promise<UserRecord | undefined> {
    return this.update(id, { role });
  }

  async delete(id: number): Promise<boolean> {
    const { changes } = await this.db.run("DELETE FROM users WHERE id = @id", { id });
    return changes > 0;
  }
}

export const userRepository = new UserRepository();
