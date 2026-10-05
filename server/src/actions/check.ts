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

const VARIABLE_PATTERN = /^\{\{\s*([\w.$]+)\s*\}\}$|^\{\s*([\w.$]+)\s*\}$/;

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
  const key = value.match(VARIABLE_PATTERN)?.[1] ?? value.match(VARIABLE_PATTERN)?.[2];
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

export const evaluateCondition = (left: unknown, op: string, right: unknown): boolean => {
  const l = String(left ?? "").trim();
  const r = String(right ?? "").trim();

  const numL = Number(l);
  const numR = Number(r);
  const isNumeric = !Number.isNaN(numL) && !Number.isNaN(numR) && l !== "" && r !== "";

  switch (op.toLowerCase()) {
    case "==":
    case "equals":
    case "is equal to":
      return l === r;
    case "!=":
    case "not_equals":
      return l !== r;
    case ">":
      return isNumeric ? numL > numR : l > r;
    case ">=":
      return isNumeric ? numL >= numR : l >= r;
    case "<":
      return isNumeric ? numL < numR : l < r;
    case "<=":
      return isNumeric ? numL <= numR : l <= r;
    case "includes":
    case "contains":
      return l.includes(r);
    case "not_includes":
    case "not_contains":
      return !l.includes(r);
    case "starts_with":
      return l.startsWith(r);
    case "ends_with":
      return l.endsWith(r);
    case "is_empty":
      return l === "";
    case "is_not_empty":
      return l !== "";
    default:
      return l === r;
  }
};

/**
 * Is `element` contained in `container`?
 *
 * `container` is usually a comma-separated string (what a `set_variable` step
 * produces) or an array (what an adaptive variable can be). Both forms are
 * accepted so users do not have to know which one they have.
 */
const contains = (element: unknown, container: unknown): boolean => {
  if (element === undefined || element === null || String(element).trim() === "") return false;
  const target = String(element).trim();

  if (Array.isArray(container)) {
    return container.some((entry) => String(entry).trim() === target);
  }
  if (typeof container === "string") {
    if (container.trim() === "") return false;
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
  // Support Discohook "Member has role" check
  const checkType = config.checkType ?? config.type;
  if (checkType === "member_has_role" || config.function === "member_has_role") {
    const roleMode = config.roleMode ?? config.mode ?? "static";
    let roleId: unknown = config.roleId ?? config.role ?? config.value;

    if (roleMode === "adaptive" || roleMode === "mirror" || roleMode === "get") {
      const trimmed = String(roleId ?? "").replace(/^\{+|\}+$/g, "").trim();
      roleId = lookup(trimmed, variables);
    } else if (typeof roleId === "string" && (roleId.startsWith("{{") || roleId.startsWith("{"))) {
      roleId = resolve(roleId, variables);
    }

    const targetKey = config.target === "selected_member" ? "selected_member.role_ids" : "member.role_ids";
    const memberRoles = lookup(targetKey, variables) ?? variables["member.roles"] ?? variables["member.role_ids"] ?? [];
    return contains(roleId, memberRoles);
  }

  // Support Discohook's in-mask format
  if (config.function === "in" && (config.array as any)?.value?.includes("role_ids")) {
    const arrayKey = (config.array as any).value;
    const memberRoles = lookup(arrayKey, variables) ?? [];
    const elementVal = (config.element as any)?.value ?? config.element;
    const resolvedRole = resolve(elementVal, variables);
    return contains(resolvedRole, memberRoles);
  }

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
  const isMemberHasRole = config.checkType === "member_has_role" || config.function === "member_has_role";
  const usesEditorCondition = !isMemberHasRole && ["left", "right", "op", "operator"].some((key) =>
    Object.hasOwn(config, key),
  );
  const passes = usesEditorCondition
    ? evaluateCondition(
        config.left,
        configString(config, "op") ?? configString(config, "operator") ?? "==",
        config.right,
      )
    : evaluateCheck(config, variables);
  if (passes) return undefined; // continue

  const failureMessage = configString(config, "failureMessage");
  return actionFailed(failureMessage ?? "This interaction isn't available for you.");
};

export default run;
