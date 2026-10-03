import express, { type Express } from "express";
import http from "node:http";
import cors from "cors";
import helmet from "helmet";
import { env } from "../../src/config/env.js";
import { db } from "../../src/config/database.js";
import { errorHandler, notFoundHandler } from "../../src/middleware/errorHandler.js";
import configRouter from "../../src/routes/config.js";
import healthRouter from "../../src/routes/health.js";
import interactionsRouter from "../../src/routes/interactions.js";
import profilesRouter from "../../src/routes/profiles.js";
import sendRouter from "../../src/routes/send.js";
import templatesRouter from "../../src/routes/templates.js";
import accessRouter from "../../src/routes/access.js";
import settingsRouter from "../../src/routes/settings.js";
import * as discord from "../../src/services/discordService.js";
import { staffRepository, type StaffRecord } from "../../src/repositories/staffRepository.js";
import { settingsService } from "../../src/services/settingsService.js";

export interface TestServer {
  app: Express;
  server: http.Server;
  baseUrl: string;
  close: () => Promise<void>;
}

/**
 * Creates a Discord router to satisfy interface contract for /api/discord endpoints
 * defined in PROJECT.md:
 * - GET /api/discord/guilds
 * - GET /api/discord/guilds/:guildId/channels
 * - GET /api/discord/guilds/:guildId/roles
 * - GET /api/discord/guilds/:guildId/members/search?query=:q
 */
export const createDiscordRouter = (): express.Router => {
  const router = express.Router();

  const requireStaffOrAdmin: express.RequestHandler = (req, res, next) => {
    const adminKey = req.get("x-admin-key");
    const staffId = req.get("x-staff-id");
    if (adminKey === env.adminApiKey || (staffId && /^\d{17,20}$/.test(staffId))) {
      return next();
    }
    return res.status(401).json({ error: "Authentication required", code: "unauthorized" });
  };

  router.get("/guilds", requireStaffOrAdmin, async (_req, res) => {
    try {
      const guilds = await discord.getBotGuilds();
      return res.json({
        guilds: guilds.map((g) => ({ id: g.id, name: g.name, icon: (g as any).icon ?? null })),
      });
    } catch (err: any) {
      return res.status(err.status ?? 500).json({ error: err.message ?? "Upstream error" });
    }
  });

  router.get("/guilds/:guildId/channels", requireStaffOrAdmin, async (req, res) => {
    try {
      const channels = await discord.getGuildChannels(req.params.guildId);
      return res.json({ channels });
    } catch (err: any) {
      return res.status(err.status ?? 500).json({ error: err.message ?? "Upstream error" });
    }
  });

  router.get("/guilds/:guildId/roles", requireStaffOrAdmin, async (_req, res) => {
    return res.json({
      roles: [
        { id: "100000000000000001", name: "Admin", color: 0xff0000, position: 1 },
        { id: "100000000000000002", name: "Moderator", color: 0x00ff00, position: 2 },
        { id: "100000000000000003", name: "Announcements", color: 0x0000ff, position: 3 },
      ],
    });
  });

  router.get("/guilds/:guildId/members/search", requireStaffOrAdmin, async (req, res) => {
    const q = String(req.query.query ?? "").toLowerCase();
    const mockMembers = [
      { id: "200000000000000001", username: "alice_mod", global_name: "Alice", nickname: "Alice M", avatar: null },
      { id: "200000000000000002", username: "bob_staff", global_name: "Bob", nickname: null, avatar: null },
      { id: "200000000000000003", username: "charlie_admin", global_name: "Charlie", nickname: "Chuck", avatar: null },
    ];
    const filtered = mockMembers.filter(
      (m) =>
        m.username.toLowerCase().includes(q) ||
        (m.global_name && m.global_name.toLowerCase().includes(q)) ||
        (m.nickname && m.nickname.toLowerCase().includes(q)),
    );
    return res.json({ members: filtered });
  });

  return router;
};

/**
 * Builds the complete test Express application with all route mounts prior to notFoundHandler.
 */
export const buildTestApp = (): Express => {
  const app = express();
  app.disable("x-powered-by");

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-admin-key", "x-staff-id"],
    }),
  );

  app.use("/api/interactions", interactionsRouter);

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  // Routes
  app.use("/api/health", healthRouter);
  app.use("/api/config", configRouter);
  app.use("/api/send", sendRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/profiles", profilesRouter);
  app.use("/api/access", accessRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/discord", createDiscordRouter());

  app.get("/", (_req, res) => {
    res.json({ name: "discord-message-builder", api: "/api/health" });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

/**
 * Spawns an ephemeral HTTP test server.
 */
export const startTestServer = async (): Promise<TestServer> => {
  const app = buildTestApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to obtain test server address");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return { app, server, baseUrl, close };
};

/**
 * Test DB helpers
 */
export const createTestStaffRecord = async (
  overrides: Partial<Parameters<typeof staffRepository.create>[0]> = {},
): Promise<StaffRecord> => {
  const staffId = overrides.discord_user_id ?? "900000000000000001";
  const existing = await staffRepository.findByDiscordId(staffId);
  if (existing) {
    await staffRepository.delete(staffId);
  }

  return staffRepository.create({
    discord_user_id: staffId,
    discord_username: overrides.discord_username ?? "test_staff_user",
    granted_by_discord_id: overrides.granted_by_discord_id ?? "admin",
    is_active: overrides.is_active ?? 1,
    expires_at: overrides.expires_at ?? null,
    cooldown_seconds: overrides.cooldown_seconds ?? 30,
    can_send_messages: overrides.can_send_messages ?? 1,
    can_edit_messages: overrides.can_edit_messages ?? 1,
    can_delete_messages: overrides.can_delete_messages ?? 1,
    can_manage_templates: overrides.can_manage_templates ?? 1,
    allowed_channel_ids: overrides.allowed_channel_ids ?? JSON.stringify(["800000000000000001"]),
    can_mention_everyone: overrides.can_mention_everyone ?? 0,
    can_mention_here: overrides.can_mention_here ?? 0,
    can_mention_roles: overrides.can_mention_roles ?? 0,
    allowed_role_mention_ids: overrides.allowed_role_mention_ids ?? JSON.stringify(["100000000000000003"]),
    max_messages_per_hour: overrides.max_messages_per_hour ?? 10,
    notes: overrides.notes ?? "Test staff user",
  });
};

export const deleteTestStaffRecord = async (staffId: string): Promise<void> => {
  await staffRepository.delete(staffId);
  await db.run("DELETE FROM staff_cooldowns WHERE discord_user_id = ?", [staffId]);
};

export const resetTestSettings = async (guildId = "__global__"): Promise<void> => {
  await db.run("DELETE FROM settings WHERE guild_id = ?", [guildId]);
  settingsService.clearCache();
};
