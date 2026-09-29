import type { ActionType, CheckCondition, CheckFunction } from "@dmb/shared";
import { actionFailed } from "./responses.js";
import { configString, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "check";
export const description = "Branch or stop the flow based on a condition";

/**
 * Evaluates a condition, optionally branching the flow.
 *
 * Two shapes are supported, deliberately:
 *
 * **1. Branching (preferred, Discohook-compatible).** The step carries
 * `then` and `else` arrays of steps. `evaluateCheck` decides which one runs, and
 * the executor recurses into it — this handler is never called. Because the
 * branches live in the step's own config they survive the flat
 * `action_definitions` table, which can only express one ordered list.
 *
 *     { function: "equals", conditions: [{ a, b, loose? }],
 *       then: [ FlowStep, ... ], else: [ FlowStep, ... ] }
 *
 * **2. Legacy single-shot.** No branches: the condition is checked and, when it
 * fails, an error response ends the chain ("this interaction isn't available for
 * you"). Kept so flows saved before branching still work.
 *
 * Values may reference a flow variable with `{{name}}` or a dotted path
 * (`{{result.channel_id}}`).
 */

const VARIABLE_PATTERN = /^\{\{\s*([\w.$]+)\s*\}\}$/;

/** Read a (possibly nested) value out of the variable bag. */
const lookup = (path: string, variables: Record<string, unknown>): unknown => {
  if (!path.includes(".")) return variables[path];

  let current: unknown = variables;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const resolve = (value: unknown, variables: Record<string, unknown>): unknown => {
  if (typeof value !== "string") return value;
  const key = value.match(VARIABLE_PATTERN)?.[1];
  return key === undefined ? value : lookup(key, variables);
};

/** Config arrives from JSON, so `conditions` is `unknown` until checked. */
const toConditions = (value: unknown): CheckCondition[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    return [{ a: record.a, b: record.b, loose: record.loose === true }];
  });
};

/** Comparable primitives, so a loose `==` is well-defined. */
type Comparable = string | number | boolean | null | undefined;

const equals = (a: unknown, b: unknown, loose: boolean): boolean => {
  if (!loose) return a === b;
  // Loose equality is opt-in, which is why the cast and the lint escape exist.
  // eslint-disable-next-line eqeqeq
  return (a as Comparable) == (b as Comparable);
};

/**
 * Is `element` contained in `container`?
 *
 * `container` is usually a comma-separated string (what a `set_variable` step
 * produces) or an array (what an adaptive variable can be). Both forms are
 * accepted so users do not have to know which one they have.
 */
const contains = (element: unknown, container: unknown): boolean => {
  const target = element === undefined || element === null ? "" : String(element);

  if (Array.isArray(container)) {
    return container.some((entry) => String(entry) === target);
  }
  if (typeof container === "string") {
    const list = container.split(",").map((entry) => entry.trim());
    return list.includes(target);
  }
  return false;
};

/** Evaluate a `check` step's condition against the current variables. */
export const evaluateCheck = (
  config: Record<string, unknown>,
  variables: Record<string, unknown>,
): boolean => {
  const conditions = toConditions(config.conditions);
  const test = (condition: CheckCondition): boolean =>
    equals(resolve(condition.a, variables), resolve(condition.b, variables), condition.loose === true);

  const fn = (configString(config, "function") ?? "equals") as CheckFunction;

  switch (fn) {
    case "and":
      // An empty condition list is vacuously true, which keeps a half-built step
      // from silently halting the whole flow.
      return conditions.every(test);
    case "or":
      return conditions.some(test);
    case "not":
      return conditions.every((condition) => !test(condition));
    case "in": {
      const [first] = conditions;
      return first ? contains(resolve(first.a, variables), resolve(first.b, variables)) : true;
    }
    case "equals":
    default: {
      const [first] = conditions;
      return first ? test(first) : true;
    }
  }
};

/** Legacy path: no branches configured — a failed check ends the chain. */
export const run = async ({
  config,
  variables,
}: ActionContext): Promise<ActionResponse | undefined> => {
  if (evaluateCheck(config, variables)) return undefined; // continue

  const failureMessage = configString(config, "failureMessage");
  return actionFailed(failureMessage ?? "This interaction isn't available for you.");
};

export default run;
