import { afterEach, describe, expect, it, vi } from "vitest";
import { createTursoPipelineClient } from "../src/config/tursoPipeline.js";

const makeFetch = () => {
  const calls: Array<{ baton: string | null; requests: Array<Record<string, any>> }> = [];
  let active = false;
  const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      baton: string | null;
      requests: Array<Record<string, any>>;
    };
    calls.push(body);

    const results = body.requests.map((request) => {
      if (request.type === "close") return { type: "ok", response: { type: "close" } };
      const sql = String((request.stmt as { sql: string }).sql);
      if (sql === "BEGIN IMMEDIATE") active = true;
      if (sql === "COMMIT" || sql === "ROLLBACK") active = false;
      return {
        type: "ok",
        response: {
          type: "execute",
          result: {
            cols: sql.startsWith("SELECT") ? [{ name: "value" }] : [],
            rows: sql.startsWith("SELECT") ? [[{ type: "integer", value: "7" }]] : [],
            affected_row_count: sql.startsWith("INSERT") ? 1 : 0,
            last_insert_rowid: 7,
          },
        },
      };
    });

    return new Response(JSON.stringify({
      baton: active ? "transaction-baton" : null,
      base_url: null,
      results,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });

  return { calls, fetchMock };
};

afterEach(() => vi.restoreAllMocks());

describe("Turso pipeline transactions", () => {
  it("keeps BEGIN, statements, and COMMIT on the same pipeline stream", async () => {
    const { calls, fetchMock } = makeFetch();
    const client = createTursoPipelineClient("https://db.example.test/v2/pipeline", "token", fetchMock as typeof fetch);

    await client.transaction(async () => {
      await client.execute("INSERT INTO items (name) VALUES (?)", ["one"]);
      const result = await client.execute("SELECT 7 AS value");
      expect(result.rows[0]?.[0]?.value).toBe("7");
    });

    expect(calls.map((call) => call.requests[0]?.stmt?.sql ?? call.requests[0]?.type)).toEqual([
      "BEGIN IMMEDIATE",
      "INSERT INTO items (name) VALUES (?)",
      "SELECT 7 AS value",
      "COMMIT",
    ]);
    expect(calls[0]?.baton).toBeNull();
    expect(calls.slice(1).every((call) => call.baton === "transaction-baton")).toBe(true);
    expect(calls.at(-1)?.requests.at(-1)?.type).toBe("close");
  });

  it("rolls back when the callback fails", async () => {
    const { calls, fetchMock } = makeFetch();
    const client = createTursoPipelineClient("https://db.example.test/v2/pipeline", "token", fetchMock as typeof fetch);

    await expect(client.transaction(async () => {
      await client.execute("INSERT INTO items (name) VALUES (?)", ["partial"]);
      throw new Error("abort transaction");
    })).rejects.toThrow("abort transaction");

    expect(calls.map((call) => call.requests[0]?.stmt?.sql ?? call.requests[0]?.type)).toEqual([
      "BEGIN IMMEDIATE",
      "INSERT INTO items (name) VALUES (?)",
      "ROLLBACK",
    ]);
    expect(calls.at(-1)?.requests.at(-1)?.type).toBe("close");
  });

  it("joins nested transactions instead of opening a second stream", async () => {
    const { calls, fetchMock } = makeFetch();
    const client = createTursoPipelineClient("https://db.example.test/v2/pipeline", "token", fetchMock as typeof fetch);

    await client.transaction(async () => {
      await client.execute("INSERT INTO items (name) VALUES (?)", ["outer"]);
      await client.transaction(async () => {
        await client.execute("INSERT INTO items (name) VALUES (?)", ["inner"]);
      });
    });

    expect(calls.filter((call) => call.requests[0]?.stmt?.sql === "BEGIN IMMEDIATE")).toHaveLength(1);
    expect(calls.filter((call) => call.requests[0]?.stmt?.sql === "COMMIT")).toHaveLength(1);
  });

  it("serializes parallel statements so a transaction baton is never reused concurrently", async () => {
    const { calls, fetchMock } = makeFetch();
    const client = createTursoPipelineClient("https://db.example.test/v2/pipeline", "token", fetchMock as typeof fetch);

    await client.transaction(async () => {
      await Promise.all([
        client.execute("INSERT INTO items (name) VALUES (?)", ["one"]),
        client.execute("INSERT INTO items (name) VALUES (?)", ["two"]),
      ]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(calls.slice(1, 3).every((call) => call.baton === "transaction-baton")).toBe(true);
  });
});
