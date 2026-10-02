import Database from "better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseClient, QueryParams } from "../config/database.js";
import { migrations } from "../config/migrations.js";
import { ActionRepository } from "./actionRepository.js";

const connection = new Database(":memory:");

const spread = (params?: QueryParams): unknown[] =>
  params === undefined ? [] : Array.isArray(params) ? [...params] : [params];

const memoryDatabase: DatabaseClient = {
  async query<T>(sql: string, params?: QueryParams) {
    return connection.prepare(sql).all(...spread(params)) as T[];
  },
  async get<T>(sql: string, params?: QueryParams) {
    return connection.prepare(sql).get(...spread(params)) as T | undefined;
  },
  async run(sql: string, params?: QueryParams) {
    const result = connection.prepare(sql).run(...spread(params));
    return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
  },
  async exec(sql: string) {
    connection.exec(sql);
  },
  async transaction<T>(fn: () => T) {
    return connection.transaction(fn)();
  },
  async close() {
    connection.close();
  },
};

const repository = new ActionRepository(memoryDatabase);

beforeAll(() => {
  for (const migration of migrations) connection.exec(migration.sql);
});

afterEach(() => connection.exec("DELETE FROM action_definitions"));
afterAll(() => connection.close());

describe("ActionRepository message-scoped ad-hoc flows", () => {
  it("keeps identical custom IDs isolated by message and replaces only that message's flow", async () => {
    const registration = (content: string) => [
      { customId: "action:dud", steps: [{ type: "send_dm" as const, config: { content } }] },
    ];
    await repository.registerFlows("message-one", registration("first"));
    await repository.registerFlows("message-two", registration("second"));

    expect(
      (await repository.findByCustomId("action:dud", "message-one")).map(
        (definition) => definition.config.content,
      ),
    ).toEqual(["first"]);
    expect(
      (await repository.findByCustomId("action:dud", "message-two")).map(
        (definition) => definition.config.content,
      ),
    ).toEqual(["second"]);

    await repository.registerFlows("message-one", registration("replacement"));
    expect(
      (await repository.findByCustomId("action:dud", "message-one")).map(
        (definition) => definition.config.content,
      ),
    ).toEqual(["replacement"]);
    expect(
      (await repository.findByCustomId("action:dud", "message-two")).map(
        (definition) => definition.config.content,
      ),
    ).toEqual(["second"]);

    await repository.registerFlows("message-one", []);
    expect(await repository.findByCustomId("action:dud", "message-one")).toEqual([]);
    expect(
      (await repository.findByCustomId("action:dud", "message-two")).map(
        (definition) => definition.config.content,
      ),
    ).toEqual(["second"]);
  });

  it("uses template definitions when no message-specific flow exists", async () => {
    const user = connection
      .prepare("INSERT INTO users (discord_id, username, role) VALUES (?, ?, ?)")
      .run("test-user", "Test User", "admin");
    const template = connection
      .prepare("INSERT INTO templates (user_id, name, data) VALUES (?, ?, ?)")
      .run(Number(user.lastInsertRowid), "Template", "{}");
    await repository.create({
      templateId: Number(template.lastInsertRowid),
      customId: "action:dud",
      actionType: "send_dm",
      config: { content: "template" },
    });

    const definitions = await repository.findByCustomId("action:dud", "message-without-flow");
    expect(definitions.map((definition) => definition.config.content)).toEqual(["template"]);
  });
});