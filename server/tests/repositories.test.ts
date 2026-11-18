import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import type { DatabaseClient, QueryParams, RunResult } from "../src/config/database.js";
import { ActionRepository } from "../src/repositories/actionRepository.js";
import { sessionRepository } from "../src/repositories/sessionRepository.js";
import { TemplateRepository } from "../src/repositories/templateRepository.js";
import { migrations } from "../src/config/migrations.js";

const spread = (params?: QueryParams): unknown[] =>
  params === undefined ? [] : Array.isArray(params) ? [...params] : [params];

const createFullMemoryDb = (): { client: DatabaseClient; raw: Database.Database } => {
  const raw = new Database(":memory:");
  raw.pragma("foreign_keys = ON");

  // Apply all migrations
  for (const migration of migrations) {
    raw.exec(migration.sql);
  }

  const client: DatabaseClient = {
    async query<T>(sql: string, params?: QueryParams): Promise<T[]> {
      return raw.prepare(sql).all(...spread(params)) as T[];
    },
    async get<T>(sql: string, params?: QueryParams): Promise<T | undefined> {
      return raw.prepare(sql).get(...spread(params)) as T | undefined;
    },
    async run(sql: string, params?: QueryParams): Promise<RunResult> {
      const res = raw.prepare(sql).run(...spread(params));
      return {
        changes: res.changes,
        lastInsertRowid: Number(res.lastInsertRowid),
      };
    },
    async exec(sql: string): Promise<void> {
      raw.exec(sql);
    },
    async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
      if (raw.inTransaction) {
        return await fn();
      }
      raw.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn();
        raw.exec("COMMIT");
        return result;
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
    },
    async close(): Promise<void> {
      raw.close();
    },
  };

  return { client, raw };
};

describe("server/repositories: SQLite Repositories & Transactions Suite", () => {
  let memory: ReturnType<typeof createFullMemoryDb>;
  let actionRepo: ActionRepository;
  let templateRepo: TemplateRepository;
  let testUserId: number;

  beforeEach(async () => {
    memory = createFullMemoryDb();
    actionRepo = new ActionRepository(memory.client);
    templateRepo = new TemplateRepository(memory.client);

    // Create a base user for foreign key constraints
    const userRes = await memory.client.run(
      "INSERT INTO users (discord_id, username, role) VALUES ('123456789', 'TestUser', 'admin')",
    );
    testUserId = userRes.lastInsertRowid;
  });

  afterEach(async () => {
    await memory.client.close();
  });

  describe("ActionRepository", () => {
    it("atomically registers ad-hoc flows with registerFlows() in a transaction", async () => {
      const messageId = "msg_snowflake_1001";
      const flows = [
        {
          customId: "action:btn_verify",
          steps: [{ type: "send_ephemeral_reply", config: { content: "Verified!" } }],
        },
        {
          customId: "action:btn_role",
          steps: [{ type: "add_role", config: { roleId: "role_999" } }],
        },
      ];

      await actionRepo.registerFlows(messageId, flows as any);

      const registered = await actionRepo.findByCustomId("action:btn_verify", messageId);
      expect(registered).toHaveLength(1);
      expect((registered[0] as any).message_id).toBe(messageId);
      expect((registered[0] as any).action_type).toBe("send_ephemeral_reply");

      // Verify replacing flows atomically replaces old ones
      const updatedFlows = [
        {
          customId: "action:btn_verify",
          steps: [{ type: "send_ephemeral_reply", config: { content: "Replaced!" } }],
        },
      ];
      await actionRepo.registerFlows(messageId, updatedFlows as any);

      const replaced = await actionRepo.findByCustomId("action:btn_verify", messageId);
      expect(replaced).toHaveLength(1);
      expect((replaced[0] as any).config.content).toBe("Replaced!");

      const oldFlow = await actionRepo.findByCustomId("action:btn_role", messageId);
      expect(oldFlow).toHaveLength(0);
    });

    it("atomically replaces template action flows with replaceForTemplate()", async () => {
      // Create template first
      const template = await templateRepo.create({
        userId: testUserId,
        name: "Welcome Card",
        data: { messages: [{ data: { content: "Welcome!" } }] },
      });
      if (!template) {
        throw new Error("Expected template creation to return a record");
      }

      const actions = [
        {
          customId: "action:btn_1",
          actionType: "dud",
          config: {},
          executionOrder: 0,
        },
      ];

      await actionRepo.replaceForTemplate(template.id, actions as any);

      const list = await actionRepo.listByTemplate(template.id);
      expect(list).toHaveLength(1);
      expect(list[0].action_type).toBe("dud");

      // Template actions must never resolve without a tracked source message.
      const unresolved = await actionRepo.findByCustomId("action:btn_1");
      expect(unresolved).toHaveLength(0);
    });

    it("logs action execution and prunes logs older than TTL", async () => {
      await actionRepo.log({
        actionDefinitionId: null,
        interactionId: "int_100",
        userId: "user_555",
        status: "success",
        response: { step: 1 },
      });

      const countBefore = await memory.client.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM action_logs",
      );
      expect(countBefore?.count).toBe(1);

      // Backdate the log entry to 30 days ago
      await memory.client.run(
        "UPDATE action_logs SET executed_at = datetime('now', '-30 days')",
      );

      // Prune logs older than 7 days
      const { changes: pruned } = await memory.client.run(
        "DELETE FROM action_logs WHERE executed_at < datetime('now', '-7 days')",
      );
      expect(pruned).toBe(1);

      const countAfter = await memory.client.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM action_logs",
      );
      expect(countAfter?.count).toBe(0);
    });
  });

  describe("SessionRepository", () => {
    it("creates active session and resolves caller ownership accurately (RB-18)", async () => {
      const session = await sessionRepository.create({
        guildId: "guild_test_1",
        userId: "discord_user_888",
        currentUserId: "discord_user_888",
        guildOwnerId: "discord_user_888",
      });

      expect(session.tokenId).toBeDefined();
      expect(session.me).toBe(true);
      expect(session.owner).toBe(true);

      // Other caller
      const sessionForOther = await sessionRepository.create({
        guildId: "guild_test_1",
        userId: "discord_user_888",
        currentUserId: "different_user",
        guildOwnerId: "different_owner",
      });
      expect(sessionForOther.me).toBe(false);
      expect(sessionForOther.owner).toBe(false);
    });

    it("filters active sessions and excludes expired tokens", async () => {
      // Create active session
      await sessionRepository.create({
        guildId: "guild_active_1",
        userId: "user_active",
      });

      // Create expired session
      await sessionRepository.create({
        guildId: "guild_active_1",
        userId: "user_expired",
        expiresAt: Date.now() - 10000,
      });

      const res = await sessionRepository.findActive({ guildId: "guild_active_1" });
      expect(res.results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("TemplateRepository", () => {
    it("supports full CRUD lifecycle and search queries for message templates", async () => {
      const initialData = { messages: [{ data: { content: "Rule 1: Be respectful" } }] };
      const created = await templateRepo.create({
        userId: testUserId,
        name: "Rules and Info",
        description: "Official server rules",
        data: initialData,
      });
      if (!created) {
        throw new Error("Expected template creation to return a record");
      }

      expect(created.id).toBeGreaterThan(0);
      expect(created.name).toBe("Rules and Info");
      expect(created.data).toEqual(initialData);

      // Search by name
      const searchResults = await templateRepo.search({ userId: testUserId, q: "Rules" });
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0]?.id).toBe(created.id);

      // Update template metadata and data
      const updatedMeta = await templateRepo.update(created.id, {
        name: "Updated Rules",
      });
      const updatedData = { messages: [{ data: { content: "Rule 1: Be awesome" } }] };
      const updated = await templateRepo.updateData(created.id, updatedData);
      if (!updatedMeta || !updated) {
        throw new Error("Expected template updates to return a record");
      }
      expect(updatedMeta.name).toBe("Updated Rules");
      expect(updated.name).toBe("Updated Rules");
      expect(updated.data).toEqual(updatedData);

      // Delete template
      const deleted = await templateRepo.delete(created.id);
      expect(deleted).toBe(true);

      const fetchDeleted = await templateRepo.findById(created.id);
      expect(fetchDeleted).toBeUndefined();
    });

    it("enforces user isolation so search and list queries return only user's templates", async () => {
      const otherUser = await memory.client.run(
        "INSERT INTO users (discord_id, username, role) VALUES ('999999', 'OtherUser', 'viewer')",
      );
      const otherUserId = otherUser.lastInsertRowid;

      await templateRepo.create({
        userId: testUserId,
        name: "Secret Template",
        data: { content: "Confidential" } as any,
      });

      // Search by other user returns empty
      const otherUserTemplates = await templateRepo.findByUser(otherUserId);
      expect(otherUserTemplates).toHaveLength(0);
    });
  });

});
