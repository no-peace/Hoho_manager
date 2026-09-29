import type { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Terminal middleware.
 *
 * `notFoundHandler` runs when no route matched; `errorHandler` runs whenever
 * `next(err)` is called. Both always respond with the same JSON envelope:
 *
 *   { error: string, code: string, details?: unknown }
 */

interface ErrorBody {
  error: string;
  code: string;
  details?: unknown;
  stack?: string;
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: `No route matches ${req.method} ${req.originalUrl}`,
    code: "not_found",
  });
};

// The 4-argument signature is how Express identifies error middleware, so
// `_next` cannot be removed even though it is unused.
export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isApiError = error instanceof ApiError;
  const status = isApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : String(error);

  // Only 5xx are worth a full stack trace; 4xx are routine client mistakes.
  if (status >= 500) {
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(`${req.method} ${req.originalUrl} failed: ${message}`, stack);
  } else {
    logger.debug(`${req.method} ${req.originalUrl} -> ${status}: ${message}`);
  }

  const body: ErrorBody = {
    error: isApiError && error.expose ? error.message : "Internal server error",
    code: isApiError ? error.code : "internal_error",
  };

  if (isApiError && error.details !== undefined) body.details = error.details;
  // Include the stack only in development to speed up debugging.
  if (env.isDev && status >= 500 && error instanceof Error) body.stack = error.stack;

  res.status(status).json(body);
};
