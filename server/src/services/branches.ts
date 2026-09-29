import type { ActionConfig } from "@dmb/shared";
import { evaluateCheck } from "../actions/check.js";

/**
 * `check` step branches.
 *
 * A branching `check` carries its sub-chains in its own config as `then` / `else`
 * arrays of `{ type, config }`. They are stored that way — rather than as rows in
 * `action_definitions` — because that table is a flat ordered list and cannot
 * express a tree.
 *
 * This module is deliberately free of I/O: parsing untrusted JSON and deciding
 * which branch runs are pure operations, which means the recursion the executor
 * relies on can be tested without a database.
 */

/** One resolved step of an action chain. */
export interface ExecutableStep {
  /** `action_definitions.id`, or null for an inline (ad-hoc) or nested step. */
  id: number | null;
  type: string;
  config: ActionConfig;
}

/**
 * Normalise a `then` / `else` value into steps.
 *
 * Nested steps are already the editor's own shape, so this is a defensive read of
 * untrusted JSON rather than a conversion: anything malformed is dropped instead
 * of aborting the whole interaction. Nested `check`s survive untouched, which is
 * what makes branches nest arbitrarily deeply.
 */
export const readBranch = (value: unknown): ExecutableStep[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const config =
      record.config !== null && typeof record.config === "object" && !Array.isArray(record.config)
        ? (record.config as ActionConfig)
        : {};

    return [
      {
        id: null,
        type: typeof record.type === "string" ? record.type : "dud",
        config,
      },
    ];
  });
};

/** Does this `check` config carry any branch steps at all? */
export const hasBranches = (config: ActionConfig): boolean =>
  readBranch(config.then).length > 0 || readBranch(config.else).length > 0;

/**
 * The branch a `check` should recurse into.
 *
 * Returns an empty list when neither branch has steps, which the executor treats
 * as "no branches configured" and falls back to the handler's legacy behaviour.
 */
export const selectBranch = (
  config: ActionConfig,
  variables: Record<string, unknown>,
): ExecutableStep[] =>
  evaluateCheck(config, variables) ? readBranch(config.then) : readBranch(config.else);

export default { readBranch, hasBranches, selectBranch };
