# HoHo Manager — Phase 2: Staff Permissions & Security

**Source reviewed:** `no-peace/Hoho_manager`, GitHub `main`  
**Scope:** Read-only repository audit and locally applicable code changes  
**Important:** This guide does not modify GitHub. Apply the changes locally, then run the tests.

---

## 1. Audit findings

### High priority

1. `server/src/routes/tracking.ts` uses `attachUser` alone. In production, `attachUser` does not itself reject a request when there is no session; it simply continues without setting `req.user`. The tracking routes therefore lack a real authorization gate.
2. `POST /api/tracking/sync` can trigger a global sweep that edits every tracked message. It should be a machine-to-machine endpoint authenticated by the server-side admin key.
3. `POST /api/tracking/track` accepts channel/message identifiers and a payload without first verifying that the target message was authored by the configured bot.
4. `GET /api/tracking/messages` returns global tracking metadata. Non-admin staff should only see entries in their allowed channels and guilds.
5. The session routes in `server/src/routes/discord.ts` are available to any active staff record. The session-creation route accepts a caller-supplied `permissions` value and defaults it to `"8"` (Discord Administrator). Session records also expose token IDs. These routes should be Head Admin only.
6. Audit-log read/write routes are also available to any active staff record. Restrict them to Head Admin unless a more granular audit-log permission is designed.

### Medium priority

7. The Discord guild/channel/role/member/emoji discovery routes currently check only that a staff record is active. They do not require the corresponding `can_send_messages` permission. Apply the existing `requireStaffPermission("send")` middleware to these discovery routes.
8. `requireStaffPermission` parses `allowed_channel_ids` without verifying that the parsed JSON is an array of strings. Malformed data can cause runtime errors. Parse strictly and fail closed.
9. `POST /api/send` always enters `requireStaffPermission("send")`, even when `editMessageId` is present. Editing then also checks `can_edit_messages` later. This makes edit-only staff fail the earlier send check and charges the send cooldown/rate bucket. Select the action from the request body.
10. The single-message lookup route checks the guild allowlist only when `profileId === null`. The configured Discord service ignores legacy profile IDs, so a supplied `profileId` can skip that route-level guild check. Apply the channel and guild checks regardless of `profileId`.

### Permission fields that need a separate decision

| Field | Current finding |
|---|---|
| `can_attach_files` | Enforced in `send.ts` |
| `can_use_components_v2` | Enforced in `send.ts` |
| `can_use_weao_exploits` | Enforced in `send.ts` |
| mention permissions | Enforced by `mentionScrubber.ts` |
| `can_send_messages` | Enforced by staff middleware |
| `can_edit_messages` | Enforced by staff middleware on message-fetch routes and inline edit check; Phase 2 makes send-route edit selection consistent |
| `can_delete_messages` | No active route uses `requireStaffPermission("delete")`; no message-delete endpoint was found |
| `can_manage_templates` | No active route uses `requireStaffPermission("templates")`; templates are currently user-owned |
| `can_use_webhooks` | Legacy field; webhook sending is disabled |
| `can_override_profile` | Legacy field; no active enforcement was found |

Do not drop these columns in this phase. The database phase should decide whether to remove, repurpose, or implement each one, with a migration.

---

## 2. Change A — make staff permission parsing strict and action-aware

**File:** `server/src/middleware/staffPermissions.ts`

### A1. Add these helpers after `isAdmin`

```ts
type StaffActionInput =
  | StaffAction
  | ((req: Request) => StaffAction);

const parseStringList = (raw: string | null | undefined): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

const parseNumberRecord = (
  raw: string | null | undefined,
): Record<string, number> => {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) =>
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0,
      ),
    );
  } catch {
    return {};
  }
};
```

### A2. Change the middleware signature and resolve the action

Find:

```ts
export const requireStaffPermission = (action: StaffAction): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
```

Replace with:

```ts
export const requireStaffPermission = (
  actionInput: StaffActionInput,
): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const action =
      typeof actionInput === "function" ? actionInput(req) : actionInput;
```

Keep the rest of the middleware body inside the same callback.

### A3. Replace the channel allowlist parsing

Find:

```ts
        let allowed: string[];
        try {
          allowed = JSON.parse(record.allowed_channel_ids);
        } catch {
          allowed = [];
        }
```

Replace with:

```ts
        const allowed = parseStringList(record.allowed_channel_ids);
```

### A4. Replace granular cooldown parsing

Find the block that initializes and parses `granularCooldowns`:

```ts
      let granularCooldowns: Record<string, number> = {};
      if (record.granular_cooldowns) {
        try {
          granularCooldowns = JSON.parse(record.granular_cooldowns);
        } catch {
          granularCooldowns = {};
        }
      }
```

Replace with:

```ts
      const granularCooldowns = parseNumberRecord(record.granular_cooldowns);
```

Find the equivalent `granularRateLimits` block and replace it with:

```ts
      const granularRateLimits = parseNumberRecord(record.granular_rate_limits);
```

This ensures malformed JSON and non-object values fail closed instead of causing unexpected runtime behavior.

---

## 3. Change B — use edit permission for edit requests

**File:** `server/src/routes/send.ts`

Find the middleware list for `router.post("/")`:

```ts
  sendLimiter,
  requireStaffPermission("send"),
  asyncHandler(async (req, res) => {
```

Replace it with:

```ts
  sendLimiter,
  requireStaffPermission((req) =>
    typeof req.body?.editMessageId === "string" &&
    req.body.editMessageId.trim() !== ""
      ? "edit"
      : "send",
  ),
  asyncHandler(async (req, res) => {
```

The existing inline `can_edit_messages` check may remain as defense in depth.

### B2. Fix the single-message lookup guild check

In the handler for:

`GET /channels/:channelId/messages/:messageId`

Find:

```ts
    if (profileId === null) {
      if (!req.staffContext?.isAdmin && !req.staffContext?.record) {
        throw ApiError.forbidden("Default bot requires an active staff record or Head Admin access");
      }
      assertStaffChannelAllowed(req.staffContext, channelId);
      await assertStaffGuildAllowed(req.staffContext, channelId);
    }
```

Replace with:

```ts
    if (!req.staffContext?.isAdmin) {
      if (!req.staffContext?.record) {
        throw ApiError.forbidden(
          "Default bot requires an active staff record or Head Admin access",
        );
      }

      assertStaffChannelAllowed(req.staffContext, channelId);
      await assertStaffGuildAllowed(req.staffContext, channelId);
    }
```

This prevents a non-null legacy `profileId` query parameter from skipping the guild allowlist check.

---

## 4. Change C — harden Discord guild routes

**File:** `server/src/routes/discord.ts`

### C1. Import the permission middleware

Add:

```ts
import { requireStaffPermission } from "../middleware/staffPermissions.js";
import { requireHeadAdmin } from "../middleware/auth.js";
```

The file already imports `Router`, `RequestHandler`, `staffRepository`, `settingsService`, `getSessionUserFromRequest`, and `env` for its local `requireStaffOrAdmin` middleware. Keep those imports for now because `/identity` will continue using that middleware.

### C2. Add a strict allowlist parser

Add this helper immediately before `requireAllowedGuild`:

```ts
const parseAllowedIds = (raw: string | null | undefined): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};
```

### C3. Replace `requireAllowedGuild`

Replace the current `requireAllowedGuild` middleware with:

```ts
const requireAllowedGuild: RequestHandler = (req, _res, next) => {
  const guildId = req.params.guildId;
  const staffCtx = req.staffContext;

  if (!guildId || staffCtx?.isAdmin) return next();

  if (!staffCtx?.record) {
    return next(ApiError.forbidden("An active staff record is required"));
  }

  const allowedGuilds = parseAllowedIds(
    staffCtx.record.allowed_guild_ids,
  );

  if (allowedGuilds.includes("*") || allowedGuilds.includes(guildId)) {
    return next();
  }

  return next(
    ApiError.forbidden(`You are not allowed to access guild ${guildId}`),
  );
};
```

### C4. Require send permission for Discord discovery routes

Change the middleware on these routes:

```ts
router.get("/guilds", requireStaffOrAdmin, ...
router.get("/guilds/:guildId/channels", requireStaffOrAdmin, ...
router.get("/guilds/:guildId/roles", requireStaffOrAdmin, ...
router.get("/guilds/:guildId/members/search", requireStaffOrAdmin, ...
router.get("/guilds/:guildId/emojis", requireStaffOrAdmin, ...
```

Use `requireStaffPermission("send")` instead of `requireStaffOrAdmin` on each of these routes. Keep `requireAllowedGuild` on the routes that have `:guildId`.

Keep `/identity` on `requireStaffOrAdmin`, because it returns the configured bot identity and is not a guild-scoped data endpoint.

### C5. Use the strict parser for guild and channel filtering

In `GET /guilds`, replace the current `try/catch` that parses `allowed_guild_ids` with:

```ts
    const allowedGuilds = parseAllowedIds(
      staffCtx.record.allowed_guild_ids,
    );

    if (!allowedGuilds.includes("*")) {
      guilds = guilds.filter((guild) =>
        allowedGuilds.includes(guild.id),
      );
    }
```

In `GET /guilds/:guildId/channels`, replace the current `try/catch` that parses `allowed_channel_ids` with:

```ts
    const allowedChannels = parseAllowedIds(
      staffCtx.record.allowed_channel_ids,
    );

    if (!allowedChannels.includes("*")) {
      channels = channels.filter((channel) =>
        allowedChannels.includes(channel.id),
      );
    }
```

### C6. Restrict session and audit-log management to Head Admin

Replace the middleware on these route registrations:

```ts
router.get("/guilds/:guildId/audit-logs", requireStaffOrAdmin, requireAllowedGuild, getAuditLogsHandler);
router.get("/guilds/:guildId/log", requireStaffOrAdmin, requireAllowedGuild, getAuditLogsHandler);
router.post("/guilds/:guildId/audit-logs", requireStaffOrAdmin, requireAllowedGuild, ...
router.get("/guilds/:guildId/sessions", requireStaffOrAdmin, requireAllowedGuild, ...
router.post("/guilds/:guildId/sessions", requireStaffOrAdmin, requireAllowedGuild, ...
router.delete("/guilds/:guildId/sessions", requireStaffOrAdmin, requireAllowedGuild, ...
router.delete("/guilds/:guildId/sessions/:tokenId", requireStaffOrAdmin, requireAllowedGuild, ...
```

Use `requireHeadAdmin` for these routes. Example:

```ts
router.get(
  "/guilds/:guildId/sessions",
  requireHeadAdmin,
  asyncHandler(async (req, res) => {
```

Apply the same middleware replacement to the other session and audit-log routes. Remove `requireAllowedGuild` from these routes because Head Admin authorization is the access boundary.

**Reason:** session IDs are sensitive, and the session creation endpoint can create a record with Administrator permissions. Ordinary staff should not be able to list, create, or revoke these records.

---

## 5. Change D — replace the tracking routes

**File:** `server/src/routes/tracking.ts`

Replace the entire file with:

```ts
import { Router } from "express";
import { attachUser, requireAdminKey } from "../middleware/auth.js";
import { requireStaffPermission } from "../middleware/staffPermissions.js";
import { trackedMessageRepository } from "../repositories/trackedMessageRepository.js";
import { templateRepository } from "../repositories/templateRepository.js";
import { syncTrackedMessages, trackMessage } from "../services/messageTrackerService.js";
import * as discord from "../services/discordService.js";
import { asyncHandler, ApiError } from "../utils/errors.js";

const router = Router();

const parseAllowedIds = (raw: string | null | undefined): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

const assertStaffGuildAllowed = async (
  req: Express.Request,
  channelId: string,
): Promise<void> => {
  const staffCtx = req.staffContext;

  if (!staffCtx || staffCtx.isAdmin) return;

  if (!staffCtx.record) {
    throw ApiError.forbidden("An active staff record is required");
  }

  const allowedGuilds = parseAllowedIds(
    staffCtx.record.allowed_guild_ids,
  );

  if (allowedGuilds.includes("*")) return;

  const guildId = await discord.getChannelGuildId(channelId);

  if (!guildId || !allowedGuilds.includes(guildId)) {
    throw ApiError.forbidden(
      `You are not allowed to access guild ${guildId ?? "unknown"}`,
    );
  }
};

/**
 * List only tracking records the caller is authorized to see.
 * The admin key can see all records; staff are filtered by both allowlists.
 */
router.get(
  "/messages",
  attachUser,
  requireStaffPermission("edit"),
  asyncHandler(async (req, res) => {
    const list = await trackedMessageRepository.listAll();
    const staffCtx = req.staffContext;

    if (!staffCtx || staffCtx.isAdmin || !staffCtx.record) {
      return res.json({
        count: list.length,
        messages: list.map((m) => ({
          id: m.id,
          channelId: m.channel_id,
          messageId: m.message_id,
          templateId: m.template_id,
          exploitName: m.exploit_name,
          authorUserId: m.author_user_id,
          updatedAt: m.updated_at,
          lastCheckedAt: m.last_checked_at,
        })),
      });
    }

    const allowedChannels = parseAllowedIds(
      staffCtx.record.allowed_channel_ids,
    );
    const allowedGuilds = parseAllowedIds(
      staffCtx.record.allowed_guild_ids,
    );

    const guildCache = new Map<string, string | null>();
    const visible = [];

    for (const message of list) {
      if (
        !allowedChannels.includes("*") &&
        !allowedChannels.includes(message.channel_id)
      ) {
        continue;
      }

      if (!allowedGuilds.includes("*")) {
        if (!guildCache.has(message.channel_id)) {
          try {
            guildCache.set(
              message.channel_id,
              await discord.getChannelGuildId(message.channel_id),
            );
          } catch {
            // A failed lookup must not reveal the record.
            guildCache.set(message.channel_id, null);
          }
        }

        const guildId = guildCache.get(message.channel_id);
        if (!guildId || !allowedGuilds.includes(guildId)) {
          continue;
        }
      }

      visible.push(message);
    }

    return res.json({
      count: visible.length,
      messages: visible.map((m) => ({
        id: m.id,
        channelId: m.channel_id,
        messageId: m.message_id,
        templateId: m.template_id,
        exploitName: m.exploit_name,
        authorUserId: m.author_user_id,
        updatedAt: m.updated_at,
        lastCheckedAt: m.last_checked_at,
      })),
    });
  }),
);

/**
 * Global synchronization is a bot maintenance operation, not a user action.
 * The bot's API client already sends x-admin-key.
 */
router.post(
  "/sync",
  requireAdminKey,
  asyncHandler(async (_req, res) => {
    const syncResult = await syncTrackedMessages();
    return res.json({ ok: true, result: syncResult });
  }),
);

/**
 * Track a message only when:
 * - the caller has edit permission;
 * - the channel and guild are allowed;
 * - the message exists and was authored by the configured server bot;
 * - the caller can access the referenced template, if one is supplied.
 */
router.post(
  "/track",
  attachUser,
  requireStaffPermission("edit"),
  asyncHandler(async (req, res) => {
    const {
      channelId,
      messageId,
      templateId: rawTemplateId,
      exploitName,
      authorUserId,
      rawPayload,
    } = req.body ?? {};

    if (
      typeof channelId !== "string" ||
      !channelId.trim() ||
      typeof messageId !== "string" ||
      !messageId.trim()
    ) {
      throw ApiError.badRequest("`channelId` and `messageId` are required");
    }

    await assertStaffGuildAllowed(req, channelId);

    let templateId: number | null = null;
    if (rawTemplateId !== undefined && rawTemplateId !== null) {
      const parsed = Number(rawTemplateId);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw ApiError.badRequest("`templateId` must be a positive integer");
      }
      templateId = parsed;
    }

    if (
      exploitName !== undefined &&
      exploitName !== null &&
      (typeof exploitName !== "string" || exploitName.length > 100)
    ) {
      throw ApiError.badRequest("`exploitName` must be a string of at most 100 characters");
    }

    if (
      authorUserId !== undefined &&
      authorUserId !== null &&
      (typeof authorUserId !== "string" || !/^\\d{17,20}$/.test(authorUserId))
    ) {
      throw ApiError.badRequest("`authorUserId` must be a valid Discord user ID");
    }

    if (
      rawPayload !== undefined &&
      (rawPayload === null ||
        typeof rawPayload !== "object" ||
        Array.isArray(rawPayload))
    ) {
      throw ApiError.badRequest("`rawPayload` must be a JSON object");
    }

    if (!templateId && !exploitName && !rawPayload) {
      throw ApiError.badRequest(
        "Provide a template, exploit name, or raw payload to track",
      );
    }

    if (templateId !== null) {
      const template = await templateRepository.findById(templateId);
      if (!template) {
        throw ApiError.notFound("Template not found");
      }

      const isAdmin = Boolean(req.staffContext?.isAdmin);
      const isOwner = template.user_id === req.user?.id;
      if (!isAdmin && !isOwner && !template.is_public) {
        throw ApiError.forbidden("You cannot track a private template owned by another user");
      }
    }

    const token = await discord.resolveBotToken(null);
    const bot = await discord.getBotIdentity(token);
    if (!bot?.id) {
      throw new ApiError(503, "Configured server bot identity is unavailable");
    }

    const existingMessage = await discord.getChannelMessage(
      channelId,
      messageId,
      null,
    );

    if (!existingMessage) {
      throw ApiError.notFound("Message not found");
    }

    if (existingMessage.author?.id !== bot.id) {
      throw ApiError.forbidden(
        "Only messages authored by the configured server bot can be tracked",
      );
    }

    const tracked = await trackMessage({
      channelId,
      messageId,
      templateId,
      exploitName: typeof exploitName === "string" ? exploitName : null,
      authorUserId: typeof authorUserId === "string" ? authorUserId : null,
      rawPayload: rawPayload ?? null,
    });

    if (!tracked) {
      throw new ApiError(500, "Failed to save tracking record");
    }

    return res.json({ ok: true, tracked });
  }),
);

export default router;
```

---

## 6. Change E — add regression tests

Create a new file:

`server/tests/staff_security_regression.test.ts`

```ts
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { initializeDatabase } from "../src/config/database.js";
import * as discordService from "../src/services/discordService.js";
import { staffRepository } from "../src/repositories/staffRepository.js";
import { trackedMessageRepository } from "../src/repositories/trackedMessageRepository.js";

vi.mock("../src/services/discordService.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/discordService.js")>();

  return {
    ...actual,
    getBotGuilds: vi.fn().mockResolvedValue([
      { id: "guild_allowed", name: "Allowed Guild" },
      { id: "guild_denied", name: "Denied Guild" },
    ]),
    getGuildChannels: vi.fn().mockResolvedValue([
      { id: "channel_123", name: "Allowed Channel" },
      { id: "channel_456", name: "Other Channel" },
    ]),
    getChannelGuildId: vi.fn().mockResolvedValue("guild_denied"),
    getBotIdentity: vi.fn().mockResolvedValue({
      id: "bot_123456789012345678",
      username: "HoHo Bot",
    }),
    getChannelMessage: vi.fn().mockResolvedValue({
      id: "message_123",
      author: { id: "bot_123456789012345678" },
    }),
    getChannelMessages: vi.fn().mockResolvedValue([]),
    sendChannelMessage: vi.fn().mockResolvedValue({ id: "sent_123" }),
    editChannelMessage: vi.fn().mockResolvedValue({ id: "edited_123" }),
    resolveBotToken: vi.fn().mockResolvedValue("Bot.FakeToken"),
  };
});

describe("Phase 2 staff security regressions", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await initializeDatabase();

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_denied");
  });

  const createStaff = async (
    discordUserId: string,
    overrides: Record<string, unknown> = {},
  ) => {
    await staffRepository.create({
      discord_user_id: discordUserId,
      discord_username: "phase2_test",
      granted_by_discord_id: "987654321098765432",
      is_active: 1,
      cooldown_seconds: 0,
      max_messages_per_hour: 20,
      can_send_messages: 1,
      can_edit_messages: 1,
      can_delete_messages: 0,
      can_manage_templates: 0,
      allowed_channel_ids: JSON.stringify(["channel_123"]),
      allowed_guild_ids: JSON.stringify(["guild_allowed"]),
      ...overrides,
    } as any);
  };

  it("rejects anonymous access to all tracking endpoints", async () => {
    const list = await fetch(`${baseUrl}/api/tracking/messages`);
    const sync = await fetch(`${baseUrl}/api/tracking/sync`, {
      method: "POST",
    });
    const track = await fetch(`${baseUrl}/api/tracking/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: "channel_123",
        messageId: "message_123",
        rawPayload: { content: "test" },
      }),
    });

    expect(list.status).toBe(401);
    expect(sync.status).toBe(401);
    expect(track.status).toBe(401);
  });

  it("allows the bot's admin-key client to run global tracking sync", async () => {
    const response = await fetch(`${baseUrl}/api/tracking/sync`, {
      method: "POST",
      headers: { "x-admin-key": env.adminApiKey },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
  });

  it("blocks staff from tracking a message in a disallowed guild", async () => {
    const staffId = "123456789012345678";
    await createStaff(staffId);

    try {
      vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_denied");

      const response = await fetch(`${baseUrl}/api/tracking/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-id": staffId,
        },
        body: JSON.stringify({
          channelId: "channel_123",
          messageId: "message_123",
          rawPayload: { content: "tracked message" },
        }),
      });

      expect(response.status).toBe(403);
      expect(discordService.getChannelMessage).not.toHaveBeenCalled();
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("does not reveal tracked records from a disallowed guild to staff", async () => {
    const staffId = "123456789012345679";
    await createStaff(staffId);

    await trackedMessageRepository.upsert({
      channel_id: "channel_123",
      message_id: "tracked_123",
      last_payload_hash: "test-hash",
    });

    try {
      vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_denied");

      const response = await fetch(`${baseUrl}/api/tracking/messages`, {
        headers: { "x-staff-id": staffId },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.messages).toHaveLength(0);
    } finally {
      await trackedMessageRepository.delete("channel_123", "tracked_123");
      await staffRepository.delete(staffId);
    }
  });

  it("blocks staff from fetching a channel's messages in a disallowed guild", async () => {
    const staffId = "123456789012345680";
    await createStaff(staffId);

    try {
      vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_denied");

      const response = await fetch(
        `${baseUrl}/api/send/channels/channel_123/messages`,
        { headers: { "x-staff-id": staffId } },
      );

      expect(response.status).toBe(403);
      expect(discordService.getChannelMessages).not.toHaveBeenCalled();
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("blocks staff from fetching a specific message in a disallowed guild", async () => {
    const staffId = "123456789012345681";
    await createStaff(staffId);

    try {
      vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_denied");

      const response = await fetch(
        `${baseUrl}/api/send/channels/channel_123/messages/message_123`,
        { headers: { "x-staff-id": staffId } },
      );

      expect(response.status).toBe(403);
      expect(discordService.getChannelMessage).not.toHaveBeenCalled();
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("requires send permission to enumerate bot guilds", async () => {
    const staffId = "123456789012345682";
    await createStaff(staffId, { can_send_messages: 0 });

    try {
      const response = await fetch(`${baseUrl}/api/discord/guilds`, {
        headers: { "x-staff-id": staffId },
      });

      expect(response.status).toBe(403);
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("filters guild discovery to the staff member's guild allowlist", async () => {
    const staffId = "123456789012345683";
    await createStaff(staffId);

    try {
      const response = await fetch(`${baseUrl}/api/discord/guilds`, {
        headers: { "x-staff-id": staffId },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.guilds.map((guild: { id: string }) => guild.id)).toEqual([
        "guild_allowed",
      ]);
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("restricts session records to Head Admins", async () => {
    const staffId = "123456789012345684";
    await createStaff(staffId);

    try {
      const response = await fetch(
        `${baseUrl}/api/discord/guilds/guild_allowed/sessions`,
        { headers: { "x-staff-id": staffId } },
      );

      expect(response.status).toBe(403);
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("restricts audit-log access to Head Admins", async () => {
    const staffId = "123456789012345685";
    await createStaff(staffId);

    try {
      const response = await fetch(
        `${baseUrl}/api/discord/guilds/guild_allowed/audit-logs`,
        { headers: { "x-staff-id": staffId } },
      );

      expect(response.status).toBe(403);
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("allows an admin-key request to bypass staff allowlists", async () => {
    const response = await fetch(`${baseUrl}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": env.adminApiKey,
      },
      body: JSON.stringify({
        mode: "bot",
        channelId: "channel_123",
        payload: { content: "Admin bypass regression test" },
      }),
    });

    expect(response.status).toBe(200);
    expect(discordService.sendChannelMessage).toHaveBeenCalled();
    expect(discordService.getChannelGuildId).not.toHaveBeenCalled();
  });

  it("allows an edit-only staff member to edit without send permission", async () => {
    const staffId = "123456789012345686";
    await createStaff(staffId, {
      can_send_messages: 0,
      can_edit_messages: 1,
    });

    try {
      vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_allowed");

      const response = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-id": staffId,
        },
        body: JSON.stringify({
          mode: "bot",
          channelId: "channel_123",
          editMessageId: "message_123",
          payload: { content: "Edited by edit-only staff" },
        }),
      });

      expect(response.status).toBe(200);
      expect(discordService.editChannelMessage).toHaveBeenCalled();
      expect(discordService.sendChannelMessage).not.toHaveBeenCalled();
    } finally {
      await staffRepository.delete(staffId);
    }
  });
});
```

**Test note:** this new suite is a proposed regression suite. I have not run it in your repository. If TypeScript flags the `createStaff` helper's `as any`, keep it temporarily; the existing test suite already uses the same pragmatic test-fixture pattern.

---

## 7. Commands to run

From the repository root in PowerShell:

```powershell
npm test
```

Then run the production build scripts:

```powershell
npm run build
```

If your root package does not define `build`, inspect the scripts first:

```powershell
Get-Content package.json
Get-Content server/package.json
Get-Content client/package.json
```

Also run the typecheck scripts if present:

```powershell
npm run typecheck
```

Do not deploy until tests and builds pass.

---

## 8. Manual verification checklist

- [ ] Anonymous request to `/api/tracking/messages` returns `401`.
- [ ] Anonymous request to `/api/tracking/track` returns `401`.
- [ ] Anonymous request to `/api/tracking/sync` returns `401`.
- [ ] The bot's `x-admin-key` can still run tracking sync.
- [ ] Staff cannot track or list messages outside their allowed guilds.
- [ ] Staff cannot fetch message lists or individual messages from a disallowed guild.
- [ ] Staff with `can_send_messages = 0` cannot enumerate guilds or channels.
- [ ] Staff with edit permission but no send permission can edit an allowed message.
- [ ] Ordinary staff cannot list, create, or revoke session records.
- [ ] Ordinary staff cannot read or create audit-log records.
- [ ] Admin-key requests still bypass staff allowlists.
- [ ] Existing allowed staff can still send within their permitted channel and guild.

---

## 9. Items intentionally deferred

- Do not remove `can_use_webhooks`, `can_override_profile`, `can_delete_messages`, or `can_manage_templates` yet. Their current enforcement/use is inconsistent; decide their final behavior in the database and access-panel phase.
- Do not change Turso transaction handling in this phase.
- Do not add or remove database columns in this phase.
- Do not delete legacy webhook tables until all runtime references and migration history have been audited.
- Do not assume Discord policy compliance is guaranteed. Keep bot actions authorized, transparent, rate-limited, and within the Developer Terms and Developer Policy.

## 10. Audit correction for the existing `docs/` reports

The reports in `docs/` contain some recommendations that should not be applied blindly:

- SQLite WAL, foreign keys, busy timeout, and synchronous pragmas are already configured in the current database adapter; adding them again is unnecessary.
- The suggested `transactionAsync(fn)` example is not a safe drop-in for the custom Turso HTTP-pipeline adapter. The database phase must redesign transaction boundaries around the adapter's actual API.
- `can_delete_messages` and `can_manage_templates` exist in the schema/UI but currently have no active route enforcement.
- The current `requireStaffOrAdmin` checks a live staff record, but it does not apply the same action-specific permission checks as `requireStaffPermission`.

These are corrections to the plan, not changes to your repository.
