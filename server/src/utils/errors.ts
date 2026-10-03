import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Error primitives shared by routes and services.
 */

export interface ApiErrorOptions {
  /** Stable machine-readable code the client can branch on. */
  code?: string;
  details?: unknown;
  /**
   * Whether `message` may be sent to the client.
   *
   * Defaults to `status < 500`: client mistakes are safe to echo back,
   * unexpected server faults are not. An intentional 5xx with a *deliberate,
   * safe* message (e.g. "no bot token configured") opts in explicitly rather
   * than showing the user a useless "Internal server error".
   */
  expose?: boolean;
}

/** An error with an HTTP status and a stable machine-readable code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly expose: boolean;

  constructor(status: number, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options.code ?? "error";
    this.details = options.details;
    this.expose = options.expose ?? status < 500;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, { code: "bad_request", details });
  }

  static unauthorized(message = "Authentication required"): ApiError {
    return new ApiError(401, message, { code: "unauthorized" });
  }

  static forbidden(message = "You do not have permission to do that"): ApiError {
    return new ApiError(403, message, { code: "forbidden" });
  }

  static tooManyRequests(message = "Too many requests"): ApiError {
    return new ApiError(429, message);
  }

  static notFound(message = "Not found"): ApiError {
    return new ApiError(404, message, { code: "not_found" });
  }

  static tooMany(message = "Too many requests"): ApiError {
    return new ApiError(429, message, { code: "rate_limited" });
  }

  static upstream(message: string, details?: unknown): ApiError {
    return new ApiError(502, message, { code: "upstream_error", details });
  }
}

/** A route handler that may be async. */
export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/**
 * Wrap an async route handler so rejected promises reach Express' error
 * middleware.
 *
 * Express 5 forwards rejected promises automatically, but wrapping keeps the
 * behaviour explicit and identical if you ever pin back to v4.
 */
export const asyncHandler =
  (fn: AsyncRouteHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
