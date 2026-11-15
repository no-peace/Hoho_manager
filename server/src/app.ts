// server/src/app.ts
import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import { env, serverRoot } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimit.js";
import configRouter from "./routes/config.js";
import healthRouter from "./routes/health.js";
import interactionsRouter from "./routes/interactions.js";

import sendRouter from "./routes/send.js";
import templatesRouter from "./routes/templates.js";
import accessRouter from "./routes/access.js";
import settingsRouter from "./routes/settings.js";
import discordRouter from "./routes/discord.js";
import authRouter from "./routes/auth.js";
import weaoRouter from "./routes/weao.js";
import executorsRouter from "./routes/executors.js";
import trackingRouter from "./routes/tracking.js";

export const createApp = (): Express => {
  const app = express();

  app.disable("x-powered-by");
  if (env.isProd) app.set("trust proxy", 1);

  if (env.isProd) {
    const allowedHttpsHosts = new Set(
      [...env.clientOrigins, env.discord.redirectUri].flatMap((value) => {
        try {
          return [new URL(value).host.toLowerCase()];
        } catch {
          return [];
        }
      }),
    );

    app.use((req, res, next) => {
      const forwardedProto = req.headers["x-forwarded-proto"];
      const externalProto =
        typeof forwardedProto === "string"
          ? forwardedProto.split(",")[0]?.trim().toLowerCase()
          : undefined;

      if (externalProto && externalProto !== "https") {
        let requestedHost: string;
        try {
          requestedHost = new URL(`https://${req.get("host") ?? ""}`).host.toLowerCase();
        } catch {
          return res.status(400).json({ error: "Invalid host header" });
        }

        if (!allowedHttpsHosts.has(requestedHost)) {
          return res.status(400).json({ error: "Unrecognized host" });
        }

        return res.redirect(301, `https://${requestedHost}${req.originalUrl}`);
      }
      next();
    });
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      strictTransportSecurity: env.isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      contentSecurityPolicy: env.isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "blob:", "https:"],
              mediaSrc: ["'self'", "data:", "blob:", "https:"],
              connectSrc: ["'self'", "https:", "wss:"],
              fontSrc: ["'self'", "data:", "https:"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      frameguard: { action: "deny" },
      xssFilter: true,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (env.clientOrigins.includes(origin)) return callback(null, true);
        if (env.isDev) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-admin-key", "x-staff-id"],
    }),
  );

  // Discord-signed interaction delivery remains exempt from the generic limiter.
  // The gateway relay is machine-authenticated, so rate-limit it separately.
  app.use("/api/interactions/relay", apiLimiter);
  app.use("/api/interactions", interactionsRouter);

  // 3. Body parsers.
  app.use(
    express.json({
      limit: "2mb",
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));

  // 4. Rate limit the rest of the API.
  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter);

  // 5. Routes.
  app.use("/api/health", healthRouter);
  app.use("/api/config", configRouter);
  app.use("/api/send", sendRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/access", accessRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/discord", discordRouter);
  app.use("/api/v1", discordRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/weao", weaoRouter);
  app.use("/api/executors", executorsRouter);
  app.use("/api/tracking", trackingRouter);

  // Serve built frontend if client/dist exists (Express 5 compatible SPA fallback)
  const clientDist = path.resolve(serverRoot, "../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(
      "/assets",
      express.static(path.join(clientDist, "assets"), {
        maxAge: "365d",
        immutable: true,
      }),
    );
    app.use(
      express.static(clientDist, {
        maxAge: "7d",
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) return next();
      res.sendFile(path.join(clientDist, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res.json({ name: "discord-message-builder", api: "/api/health" });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;