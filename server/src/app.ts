// server/src/app.ts
import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import { env, serverRoot } from "./config/env.js";
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
import weaoRouter from "./routes/weao.js";

export const createApp = (): Express => {
  const app = express();

  app.disable("x-powered-by");
  if (env.isProd) app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
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

  // 2. Interactions (raw body, no rate limit).
  app.use("/api/interactions", interactionsRouter);

  // 3. Body parsers.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    }),
  );
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
  app.use("/api/weao", weaoRouter);

  // Serve built frontend if client/dist exists (Express 5 compatible SPA fallback)
  const clientDist = path.resolve(serverRoot, "../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
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