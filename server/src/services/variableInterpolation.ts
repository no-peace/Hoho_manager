const VARIABLE_PATTERN = /\{{1,2}\s*([^{}]+?)\s*\}{1,2}/g;

export function buildTimestampVariables(date: Date = new Date()): Record<string, string> {
  const unixNow = Math.floor(date.getTime() / 1000);
  const timestamp = String(unixNow);

  return {
    "now.iso": date.toISOString(),
    "now.unix": timestamp,
    "now.date": `<t:${timestamp}:D>`,
    "now.time": `<t:${timestamp}:T>`,
    "now.datetime": `<t:${timestamp}:F>`,
    "now.relative": `<t:${timestamp}:R>`,
    "now.short_date": `<t:${timestamp}:d>`,
    "now.short_time": `<t:${timestamp}:t>`,
    "now.short_datetime": `<t:${timestamp}:f>`,
    timestamp: `<t:${timestamp}:F>`,
  };
}

export interface VariableInterpolationOptions {\n  preserveUnknown?: boolean;\n}\n\nexport const replaceVariables = <T>(\n  value: T,\n  variables: Record<string, unknown>,\n  options: VariableInterpolationOptions = {},\n): T => {
  if (typeof value === "string") {
    return value.replace(VARIABLE_PATTERN, (match, rawKey: string) => {
      const key = rawKey.trim();
      const replacement = variables[key];
      return replacement === undefined\n        ? options.preserveUnknown === false ? "" : match\n        : String(replacement);
    }) as T;
  }
  if (Array.isArray(value)) return value.map((entry) => replaceVariables(entry, variables, options)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        replaceVariables(nested, variables, options),
      ]),
    ) as T;
  }
  return value;
};

export const interpolateObject = <T>(
  value: T,
  variables: Record<string, unknown>,
  options: VariableInterpolationOptions = {},
): T => replaceVariables(value, variables, options);
