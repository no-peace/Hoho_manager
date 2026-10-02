export interface ExecutableStep {
  id: string | null;
  type: string;
  config: Record<string, any>;
}

export const hasBranches = (config: Record<string, any>): boolean => {
  // Detects if the action contains nested steps in Discohook's pass/fail format
  return Array.isArray(config.pass) || Array.isArray(config.fail);
};

const evaluateCondition = (left: any, op: string, right: any): boolean => {
  const l = String(left ?? "").trim();
  const r = String(right ?? "").trim();

  const numL = Number(l);
  const numR = Number(r);
  
  // Ensure both sides are valid numbers before doing mathematical comparisons
  const isNum = !isNaN(numL) && !isNaN(numR) && l !== "" && r !== "";

  switch (op) {
    case "==":
    case "equals":
    case "is equal to":
      return l === r;
    case "!=":
    case "not_equals":
      return l !== r;
    case ">":
      return isNum ? numL > numR : l > r;
    case ">=":
      return isNum ? numL >= numR : l >= r;
    case "<":
      return isNum ? numL < numR : l < r;
    case "<=":
      return isNum ? numL <= numR : l <= r;
    case "includes":
      return l.includes(r);
    case "not_includes":
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
      return l === r; // Fallback to strict equality
  }
};

export const selectBranch = (
  config: Record<string, any>,
  variables: Record<string, unknown>
): ExecutableStep[] => {
  // Fallback operator is "==" if none is provided by the UI
  const operator = config.op || config.operator || "==";
  const isTrue = evaluateCondition(config.left, operator, config.right);

  // Return the 'pass' array if true, or the 'fail' array if false
  if (isTrue) {
    return config.pass || [];
  } else {
    return config.fail || [];
  }
};