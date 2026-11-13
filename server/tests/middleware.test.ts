import crypto from "node:crypto";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { requireStaffPermission } from "../src/middleware/staffPermissions.js";
import {
  isFreshDiscordTimestamp,
  verifyDiscordSignatureBytes,
  verifyDiscordSignature,
} from "../src/middleware/verifyDiscordSignature.js";
import { multipartParser } from "../src/middleware/multipart.js";
import { env } from "../src/config/env.js";
import { staffRepository } from "../src/repositories/staffRepository.js";

describe("server/middleware: Security & Verification Pipelines Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("staffPermissions.ts", () => {
    const mockRes: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    it("rejects request when x-staff-id does not match authenticated OAuth session (Anti-spoofing)", async () => {
      const middleware = requireStaffPermission("send");

      const req: any = {
        get: (h: string) => (h === "x-staff-id" ? "999888777666555444" : undefined),
        cookies: {
          dmb_session: "valid_jwt_cookie",
        },
        ip: "127.0.0.1",
        socket: {},
      };

      // Mock session extraction
      vi.spyOn(await import("../src/utils/session.js"), "getSessionUserFromRequest").mockResolvedValueOnce({
        id: "111222333444555666",
        username: "Alice",
        role: "editor",
      } as any);

      let capturedError: any;
      await middleware(req, mockRes, (err: any) => {
        capturedError = err;
      });

      expect(capturedError).toBeDefined();
      expect(capturedError?.status).toBe(403);
      expect(capturedError?.message).toContain("does not match authenticated user session");
    });

    const runMiddleware = (middleware: any, req: any, res: any = mockRes) =>
      new Promise<{ error?: any; nextCalled: boolean }>((resolve) => {
        let resolved = false;
        const next = (err?: any) => {
          if (!resolved) {
            resolved = true;
            resolve({ error: err, nextCalled: !err });
          }
        };
        try {
          Promise.resolve(middleware(req, res, next)).catch(next);
        } catch (err) {
          next(err);
        }
      });

    it("allows machine-to-machine admin key fast-path without staff record check", async () => {
      const middleware = requireStaffPermission("send");

      const req: any = {
        headers: { "x-admin-key": env.adminApiKey },
        get: (h: string) => (h.toLowerCase() === "x-admin-key" ? env.adminApiKey : undefined),
        ip: "127.0.0.1",
        socket: {},
      };

      const result = await runMiddleware(middleware, req);

      expect(result.nextCalled).toBe(true);
      expect(req.staffContext?.isAdmin).toBe(true);
    });

    it("rejects request when staff account is disabled (is_active = 0)", async () => {
      const middleware = requireStaffPermission("send");

      const req: any = {
        headers: { "x-staff-id": "123456789012345678" },
        get: (h: string) => (h.toLowerCase() === "x-staff-id" ? "123456789012345678" : undefined),
        ip: "127.0.0.1",
        socket: {},
        body: {},
      };

      vi.spyOn(staffRepository, "findByDiscordId").mockResolvedValueOnce({
        id: 1,
        discord_id: "123456789012345678",
        is_active: 0,
        can_send_messages: 1,
      } as any);

      const result = await runMiddleware(middleware, req);

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(403);
      expect(result.error?.message).toContain("disabled");
    });

    it("rejects request when staff access has expired", async () => {
      const middleware = requireStaffPermission("send");

      const req: any = {
        headers: { "x-staff-id": "123456789012345679" },
        get: (h: string) => (h.toLowerCase() === "x-staff-id" ? "123456789012345679" : undefined),
        ip: "127.0.0.1",
        socket: {},
        body: {},
      };

      vi.spyOn(staffRepository, "findByDiscordId").mockResolvedValueOnce({
        id: 2,
        discord_id: "123456789012345679",
        is_active: 1,
        can_send_messages: 1,
        expires_at: "2020-01-01T00:00:00Z", // expired
      } as any);

      const result = await runMiddleware(middleware, req);

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(403);
      expect(result.error?.message).toContain("expired");
    });

    it("rejects request when target channel is not in allowed_channel_ids", async () => {
      const middleware = requireStaffPermission("send");

      const req: any = {
        headers: { "x-staff-id": "123456789012345680" },
        get: (h: string) => (h.toLowerCase() === "x-staff-id" ? "123456789012345680" : undefined),
        ip: "127.0.0.1",
        socket: {},
        body: { channelId: "unauthorized_chan_99" },
      };

      vi.spyOn(staffRepository, "findByDiscordId").mockResolvedValueOnce({
        id: 3,
        discord_id: "123456789012345680",
        is_active: 1,
        can_send_messages: 1,
        allowed_channel_ids: '["allowed_chan_1", "allowed_chan_2"]',
      } as any);

      const result = await runMiddleware(middleware, req);

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(403);
      expect(result.error?.message).toContain("not allowed to send to channel");
    });
  });

  describe("verifyDiscordSignature.ts", () => {
    // Generate valid Ed25519 keypair for cryptographic testing
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const rawPublicKey = publicKey.export({ type: "spki", format: "der" }).subarray(12);
    const publicKeyHex = rawPublicKey.toString("hex");

    it("verifies timestamp freshness correctly", () => {
      const nowSec = Math.floor(Date.now() / 1000);
      expect(isFreshDiscordTimestamp(String(nowSec))).toBe(true);
      expect(isFreshDiscordTimestamp(String(nowSec - 100))).toBe(true); // 100s ago
      expect(isFreshDiscordTimestamp(String(nowSec - 400))).toBe(false); // > 300s stale
      expect(isFreshDiscordTimestamp("invalid-timestamp")).toBe(false);
    });

    it("validates authentic Ed25519 signature bytes", () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = Buffer.from(JSON.stringify({ type: 1 }));
      const signature = crypto.sign(null, Buffer.concat([Buffer.from(timestamp, "utf-8"), body]), privateKey);
      const signatureHex = signature.toString("hex");

      const isValid = verifyDiscordSignatureBytes(publicKeyHex, signatureHex, timestamp, body);
      expect(isValid).toBe(true);
    });

    it("rejects forged Ed25519 signature bytes", () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = Buffer.from(JSON.stringify({ type: 1 }));
      const forgedSigHex = "00".repeat(64); // 128 hex chars of zeros

      const isValid = verifyDiscordSignatureBytes(publicKeyHex, forgedSigHex, timestamp, body);
      expect(isValid).toBe(false);
    });

    it("middleware rejects missing signature headers with HTTP 401", async () => {
      const req: any = {
        get: () => undefined,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await verifyDiscordSignature(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Missing signature headers" }));
      expect(next).not.toHaveBeenCalled();
    });

    it("middleware rejects stale timestamp with HTTP 401", async () => {
      const req: any = {
        get: (h: string) => {
          if (h === "X-Signature-Ed25519") return "aa".repeat(64);
          if (h === "X-Signature-Timestamp") return "1000000000"; // ancient timestamp
          return undefined;
        },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await verifyDiscordSignature(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Expired or invalid request timestamp" }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("multipart.ts (RB-12, INV-9)", () => {
    it("passes through non-multipart requests cleanly without modifying body", () => {
      const req: any = {
        headers: { "content-type": "application/json" },
        body: { mode: "bot" },
      };
      let calledNext = false;
      multipartParser(req, {} as any, () => {
        calledNext = true;
      });
      expect(calledNext).toBe(true);
      expect(req.body.mode).toBe("bot");
    });

    it("rejects requests exceeding Content-Length threshold before buffering", () => {
      const req: any = {
        headers: {
          "content-type": "multipart/form-data; boundary=----boundary",
          "content-length": "100000000", // ~100MB (exceeds 52MB limit)
        },
      };
      let capturedError: any;
      multipartParser(req, {} as any, (err: any) => {
        capturedError = err;
      });
      expect(capturedError).toBeDefined();
      expect(capturedError?.status).toBe(413);
    });
  });
});
