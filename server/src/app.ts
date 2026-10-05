import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import configRouter from "./routes/config.js";
import healthRouter from "./routes/health.js";
import interactionsRouter from "./routes/interactions.js";
import profilesRouter from "./routes/profiles.js";
import sendRouter from "./routes/send.js";
import templatesRouter from "./routes/templates.js";
import accessRouter from "./routes/access.js";
import settingsRouter from "./routes/settings.js";
import discordRouter from "./routes/discord.js";
import authRouter from "./routes/auth.js";

/**
 * Build the Express application.
 *
 * Middleware order is load-bearing here:
 *
 *   1. security headers + CORS
 *   2. The interactions router is mounted before the JSON parser because
 *      Discord's signature covers the raw bytes; parsing first would invalidate
 *      it. It also deliberately sits before the API rate limiter, since
 *      throttling interaction deliveries drops real user clicks.
 *   3. body parsers
 *   4. rate limiter for the rest of /api
 *   5. routers, then 404 + error handling
 */
export const createApp = (): Express => {
  const app = express();

  app.disable("x-powered-by");
  // Behind a reverse proxy (nginx, Railway, Cloudflare) we need the real client
  // IP for rate limiting — but trusting the header blindly would let clients
  // spoof it, so only do this in production where a proxy is guaranteed.
  if (env.isProd) app.set("trust proxy", 1);

  app.use(
    helmet({
      // The API serves JSON and proxied images, not HTML documents.
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: server-to-server or curl. Allow.
        if (!origin) return callback(null, true);
        if (env.clientOrigins.includes(origin)) return callback(null, true);
        // Fail open in development so any localhost port works.
        if (env.isDev) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-admin-key", "x-staff-id"],
    }),
  );

  // 2. Interactions (raw body, no rate limit).
  app.use("/api/interactions", interactionsRouter);

  // 3. Body parsers. 2 MB comfortably covers a message document with previews.
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    }
   }));
  app.use(express.urlencoded({ extended: false }));

  // 4. Rate limit the rest of the API.
  app.use("/api", apiLimiter);

  // 5. Routes.
  app.use("/api/health", healthRouter);
  app.use("/api/config", configRouter);
  app.use("/api/send", sendRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/profiles", profilesRouter);
  app.use("/api/access", accessRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/discord", discordRouter);
  app.use("/api/v1", discordRouter);
  app.use("/api/auth", authRouter);

  // Root ping so hitting the bare host is informative rather than a 404 page.
  app.get("/", (_req, res) => {
    res.json({ name: "discord-message-builder", api: "/api/health" });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
