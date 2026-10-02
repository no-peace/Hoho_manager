const VARIABLE_PATTERN = /\{\{\s*([\w.$]+)\s*\}\}|\{\s*([\w.$]+)\s*\}/g;

export const replaceVariables = <T>(
  value: T,
  variables: Record<string, unknown>,
): T => {
  if (typeof value === "string") {
    return value.replace(
      VARIABLE_PATTERN,
      (match, doubleKey: string | undefined, singleKey: string | undefined) => {
        const key = doubleKey ?? singleKey;
        const replacement = key === undefined ? undefined : variables[key];
        return replacement === undefined ? match : String(replacement);
      },
    ) as T;
  }
  if (Array.isArray(value)) return value.map((entry) => replaceVariables(entry, variables)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        replaceVariables(nested, variables),
      ]),
    ) as T;
  }
  return value;
};