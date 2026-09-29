import type { Request, RequestHandler, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";

/**
 * Rate limiting.
 *
 * Two limiters are exported:
 *   - {@link apiLimiter}  general ceiling for the whole `/api` surface
 *   - {@link sendLimiter} tighter budget for `/api/send`, which talks to Discord
 *
 * `/api/interactions` is deliberately unbounded: Discord retries failed
 * interaction deliveries, and throttling them would drop real user clicks.
 */

const json429 = (_req: Request, res: Response): void => {
  res.status(429).json({
    error: "Too many requests",
    code: "rate_limited",
    retryAfterMs: env.rateLimit.windowMs,
  });
};

export const apiLimiter: RequestHandler = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: json429,
  // Skip entirely in tests so suites never flake on the limiter.
  skip: () => env.nodeEnv === "test",
});

export const sendLimiter: RequestHandler = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: Math.max(10, Math.floor(env.rateLimit.max / 2)),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: json429,
  // `ipKeyGenerator` normalises IPv6 addresses to a /64 prefix; without it,
  // anyone with an IPv6 allocation could sidestep the limit by rotating the
  // host portion of their address.
  keyGenerator: (req: Request): string => req.user?.discord_id ?? ipKeyGenerator(req.ip ?? ""),
  skip: () => env.nodeEnv === "test",
});
