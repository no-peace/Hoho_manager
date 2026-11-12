import { AsyncLocalStorage } from "node:async_hooks";

export type TursoQueryParams = Record<string, unknown> | readonly unknown[];

type TursoArg =
  | { type: "null" }
  | { type: "integer"; value: string }
  | { type: "float"; value: number }
  | { type: "text"; value: string };

interface TursoExecuteResult {
  cols: { name: string; decltype?: string | null }[];
  rows: { type: string; value?: string | number }[][];
  affected_row_count: number;
  last_insert_rowid?: string | number | null;
}

interface PipelineResult {
  type: string;
  response?: { type?: string; result?: TursoExecuteResult };
  error?: { message?: string };
}

interface PipelineResponse {
  baton?: string | null;
  base_url?: string | null;
  results?: PipelineResult[];
}

interface TransactionContext {
  baton: string | null;
  baseUrl: string;
  queue: Promise<void>;
}

const EMPTY_RESULT: TursoExecuteResult = {
  cols: [],
  rows: [],
  affected_row_count: 0,
  last_insert_rowid: 0,
};

const toTursoArg = (value: unknown): TursoArg => {
  if (value === null || value === undefined) return { type: "null" };
  if (typeof value === "boolean") return { type: "integer", value: value ? "1" : "0" };
  if (typeof value === "bigint") return { type: "integer", value: value.toString() };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { type: "null" };
    return Number.isInteger(value)
      ? { type: "integer", value: String(value) }
      : { type: "float", value };
  }
  return { type: "text", value: String(value) };
};

const buildStatement = (sql: string, params?: TursoQueryParams): Record<string, unknown> => {
  if (!params) return { sql };
  if (Array.isArray(params)) return { sql, args: params.map(toTursoArg) };

  const namedArgs = Object.entries(params as Record<string, unknown>)
    .filter(([key]) => {
      const name = key.replace(/^[@:$]/, "");
      return ["@", ":", "$"].some((prefix) => sql.includes(`${prefix}${name}`));
    })
    .map(([key, value]) => ({
      name: key.replace(/^[@:$]/, ""),
      value: toTursoArg(value),
    }));

  return namedArgs.length > 0 ? { sql, named_args: namedArgs } : { sql };
};

export const parseTursoRows = <T>(result: TursoExecuteResult): T[] => {
  const cols = result.cols ?? [];
  return (result.rows ?? []).map((row) => {
    const record: Record<string, unknown> = {};
    for (let index = 0; index < cols.length; index++) {
      const cell = row[index];
      if (!cell || cell.type === "null") record[cols[index]!.name] = null;
      else if (cell.type === "integer" || cell.type === "float") {
        record[cols[index]!.name] = Number(cell.value);
      } else {
        record[cols[index]!.name] = cell.value !== undefined ? String(cell.value) : null;
      }
    }
    return record as T;
  });
};

export interface TursoPipelineClient {
  execute(sql: string, params?: TursoQueryParams): Promise<TursoExecuteResult>;
  transaction<T>(fn: () => Promise<T> | T): Promise<T>;
}

/**
 * A transaction owns one Turso pipeline stream. Its baton is advanced after
 * every request, and a queue prevents concurrent calls from reusing a baton.
 */
export const createTursoPipelineClient = (
  pipelineUrl: string,
  authToken: string,
  fetchImpl: typeof fetch = fetch,
): TursoPipelineClient => {
  const transactions = new AsyncLocalStorage<TransactionContext>();

  const enqueue = <T>(context: TransactionContext, task: () => Promise<T>): Promise<T> => {
    const result = context.queue.then(task);
    context.queue = result.then(() => undefined, () => undefined);
    return result;
  };

  const send = async (
    context: TransactionContext,
    requests: Record<string, unknown>[],
  ): Promise<PipelineResult[]> => {
    const response = await fetchImpl(context.baseUrl, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ baton: context.baton, requests }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Turso HTTP ${response.status}: ${details}`);
    }

    const payload = (await response.json()) as PipelineResponse;
    context.baton = payload.baton ?? null;
    if (payload.base_url) context.baseUrl = payload.base_url;

    const results = payload.results ?? [];
    const failure = results.find((item) => item.type === "error" || item.error);
    if (failure) {
      throw new Error(`Turso SQL Error: ${failure.error?.message ?? "Unknown error"}`);
    }
    if (results.length !== requests.length) {
      throw new Error("Turso pipeline returned an unexpected number of results.");
    }
    return results;
  };

  const execute = async (sql: string, params?: TursoQueryParams): Promise<TursoExecuteResult> => {
    const context = transactions.getStore();
    const activeContext = context ?? { baton: null, baseUrl: pipelineUrl, queue: Promise.resolve() };
    const operation = () =>
      send(activeContext, [{ type: "execute", stmt: buildStatement(sql, params) }])
        .then((results) => results[0]?.response?.result ?? EMPTY_RESULT);

    return context ? enqueue(context, operation) : operation();
  };

  const transaction = async <T>(fn: () => Promise<T> | T): Promise<T> => {
    // Match the SQLite adapter: nested calls join the active transaction.
    if (transactions.getStore()) return await fn();

    const context: TransactionContext = {
      baton: null,
      baseUrl: pipelineUrl,
      queue: Promise.resolve(),
    };

    await enqueue(context, async () => {
      await send(context, [{ type: "execute", stmt: { sql: "BEGIN IMMEDIATE" } }]);
      if (!context.baton) {
        throw new Error("Turso did not retain the pipeline stream after BEGIN IMMEDIATE.");
      }
    });

    return transactions.run(context, async () => {
      try {
        const result = await fn();
        await enqueue(context, async () => {
          await send(context, [
            { type: "execute", stmt: { sql: "COMMIT" } },
            { type: "close" },
          ]);
        });
        return result;
      } catch (error) {
        try {
          await enqueue(context, async () => {
            if (context.baton) {
              await send(context, [
                { type: "execute", stmt: { sql: "ROLLBACK" } },
                { type: "close" },
              ]);
            }
          });
        } catch {
          // Preserve the original callback/statement error. If the stream was
          // lost, Turso rolls back its open transaction when the stream expires.
        }
        throw error;
      }
    });
  };

  return { execute, transaction };
};
