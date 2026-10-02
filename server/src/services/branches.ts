import { evaluateCheck, evaluateCondition } from "../actions/check.js";

export interface ExecutableStep {
  id: number | null;
  type: string;
  config: Record<string, any>;
}

/**
 * Checks whether an action step configuration contains branching sub-chains.
 * Supports both Discohook formats (pass/fail and then/else).
 */
export const hasBranches = (config: Record<string, any>): boolean => {
  if (!config || typeof config !== "object") return false;
  return (
    (Array.isArray(config.pass) && config.pass.length > 0) ||
    (Array.isArray(config.fail) && config.fail.length > 0) ||
    (Array.isArray(config.then) && config.then.length > 0) ||
    (Array.isArray(config.else) && config.else.length > 0)
  );
};

/**
 * Safely parses an untrusted JSON array into an array of ExecutableStep objects.
 */
export const readBranch = (value: unknown): ExecutableStep[] => {
  if (!Array.isArray(value)) return [];

  const results: ExecutableStep[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : "dud";
    const config =
      typeof record.config === "object" && record.config !== null && !Array.isArray(record.config)
        ? (record.config as Record<string, any>)
        : {};
    const id = typeof record.id === "number" ? record.id : null;

    results.push({ id, type, config });
  }

  return results;
};

/**
 * Selects the next sub-chain of steps based on evaluating the condition.
 */
export const selectBranch = (
  config: Record<string, any>,
  variables: Record<string, unknown>,
): ExecutableStep[] => {
  const operator = config.op || config.operator || config.function || "==";
  const usesEditorCondition =
    Object.hasOwn(config, "left") ||
    Object.hasOwn(config, "right") ||
    Object.hasOwn(config, "op") ||
    Object.hasOwn(config, "operator");
  const isTrue = Array.isArray(config.conditions) && !usesEditorCondition
    ? evaluateCheck(config, variables)
    : evaluateCondition(config.left, operator, config.right);

  const rawBranch = isTrue
    ? config.pass ?? config.then ?? []
    : config.fail ?? config.else ?? [];

  return readBranch(rawBranch);
};

export default { hasBranches, readBranch, selectBranch };