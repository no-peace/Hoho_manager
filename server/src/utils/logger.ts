/**
 * Tiny structured logger.
 *
 * Deliberately dependency-free; Phase 4 swaps this for `pino` without touching
 * call sites, because everything imports this single module.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  /** Returns a logger that prefixes every line with `[scope] `. */
  child(scope: string): Logger;
}

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const isLogLevel = (value: unknown): value is LogLevel =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(LEVELS, value);

// Read once at module load so `LOG_LEVEL` cannot change mid-run.
const configuredLevel = process.env.LOG_LEVEL;
const ACTIVE = isLogLevel(configuredLevel) ? LEVELS[configuredLevel] : LEVELS.info;

const COLORS: Record<LogLevel, string> = {
  debug: "\u001b[90m",
  info: "\u001b[36m",
  warn: "\u001b[33m",
  error: "\u001b[31m",
};
const RESET = "\u001b[0m";

const write = (level: LogLevel, message: string, meta?: unknown): void => {
  if (LEVELS[level] < ACTIVE) return;

  const timestamp = new Date().toISOString();
  const prefix = `${COLORS[level]}${level.toUpperCase().padEnd(5)}${RESET}`;
  const line = `${timestamp} ${prefix} ${message}`;

  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (meta === undefined) sink(line);
  else sink(line, meta);
};

const createLogger = (scope?: string): Logger => {
  const tag = scope ? `[${scope}] ` : "";
  return {
    debug: (message, meta) => write("debug", `${tag}${message}`, meta),
    info: (message, meta) => write("info", `${tag}${message}`, meta),
    warn: (message, meta) => write("warn", `${tag}${message}`, meta),
    error: (message, meta) => write("error", `${tag}${message}`, meta),
    child: (childScope) => createLogger(scope ? `${scope}:${childScope}` : childScope),
  };
};

export const logger: Logger = createLogger();
