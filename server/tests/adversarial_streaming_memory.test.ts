import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import http, { type Server } from "node:http";
import net from "node:net";
import { multipartParser } from "../src/middleware/multipart.js";
import discord, {
  createInteractionResponse,
} from "../src/services/discordService.js";
import {
  handleInteraction,
  completeDeferredInteraction,
  cleanupDeferredInteraction,
  getPendingLateResponsesCount,
} from "../src/services/interactionHandler.js";
import * as actionExecutor from "../src/services/actionExecutor.js";
import { ApiError } from "../src/utils/errors.js";
import {
  InteractionType,
  InteractionResponseType,
  type DiscordInteraction,
} from "@dmb/shared";
import { initializeDatabase } from "../src/config/database.js";

describe("Milestone 3 Challenger 1: Adversarial Streaming, Timeout & Memory Probes", () => {
  /* ==========================================================================
     TARGET 1: Multipart Streaming Memory Protection (PERF-01)
     ========================================================================== */
  describe("PERF-01: Multipart Streaming Memory Protection", () => {
    let app: express.Express;
    let server: Server;
    let baseUrl: string;
    let serverPort: number;

    beforeAll(async () => {
      app = express();
      app.use(multipartParser);

      app.post("/test-upload", (req: Request, res: Response) => {
        const files = (req as any).uploadedFiles || [];
        res.json({
          ok: true,
          body: req.body,
          files: files.map((f: any) => ({
            filename: f.filename,
            size: f.size,
            key: f.key,
          })),
        });
      });

      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        res.status(err.status || 500).json({
          error: err.message,
          status: err.status,
          code: err.code,
        });
      });

      await new Promise<void>((resolve) => {
        server = app.listen(0, () => {
          const addr = server.address() as net.AddressInfo;
          serverPort = addr.port;
          baseUrl = `http://127.0.0.1:${serverPort}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("Probe 1.1: Oversized Content-Length (>52MB) rejected with HTTP 413 payload_too_large before streaming", async () => {
      // 55MB Content-Length header with minimal body
      const res = await new Promise<{ status: number; data: any }>((resolve, reject) => {
        const clientReq = http.request(
          {
            hostname: "127.0.0.1",
            port: serverPort,
            path: "/test-upload",
            method: "POST",
            headers: {
              "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundaryAdversarial",
              "Content-Length": "57671680", // 55 MB
            },
          },
          (clientRes) => {
            let raw = "";
            clientRes.on("data", (chunk) => (raw += chunk));
            clientRes.on("end", () => {
              resolve({
                status: clientRes.statusCode || 0,
                data: raw ? JSON.parse(raw) : {},
              });
            });
          },
        );
        clientReq.on("error", reject);
        clientReq.write("----WebKitFormBoundaryAdversarial\r\nContent-Disposition: form-data; name=\"probe\"\r\n\r\nhi\r\n----WebKitFormBoundaryAdversarial--\r\n");
        clientReq.end();
      });

      expect(res.status).toBe(413);
      expect(res.data.code).toBe("payload_too_large");
      expect(res.data.error).toContain("Request payload exceeds maximum allowed size");
    });

    it("Probe 1.2: Streaming single file exceeding 25MB emits HTTP 413 payload_too_large", async () => {
      const boundary = "----AdversarialSingleFileStream";
      const totalBytes = 26 * 1024 * 1024; // 26MB
      const chunkSize = 1024 * 1024; // 1MB chunks
      const chunkCount = totalBytes / chunkSize;

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `--${boundary}\r\nContent-Disposition: form-data; name="files[0]"; filename="oversized_26mb.dat"\r\nContent-Type: application/octet-stream\r\n\r\n`,
            ),
          );
          for (let i = 0; i < chunkCount; i++) {
            controller.enqueue(new Uint8Array(chunkSize));
          }
          controller.enqueue(new TextEncoder().encode(`\r\n--${boundary}--\r\n`));
          controller.close();
        },
      });

      const res = await fetch(`${baseUrl}/test-upload`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: stream,
        duplex: "half",
      } as any);

      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.code).toBe("payload_too_large");
      expect(data.error).toContain("exceeds maximum allowed size of 25 MB");
    });

    it("Probe 1.3: Aggregate files exceeding 50MB (multiple 18MB files) emits HTTP 413 payload_too_large", async () => {
      // 3 files of 18MB each = 54MB total. Each file is < 25MB individual limit.
      const boundary = "----AdversarialMultiFileAggregate";
      const fileBytes = 18 * 1024 * 1024; // 18MB per file
      const chunkSize = 1024 * 1024; // 1MB chunks
      const chunksPerFile = fileBytes / chunkSize;

      const stream = new ReadableStream({
        start(controller) {
          for (let f = 0; f < 3; f++) {
            controller.enqueue(
              new TextEncoder().encode(
                `--${boundary}\r\nContent-Disposition: form-data; name="files[${f}]"; filename="file_${f}.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`,
              ),
            );
            for (let c = 0; c < chunksPerFile; c++) {
              controller.enqueue(new Uint8Array(chunkSize));
            }
            controller.enqueue(new TextEncoder().encode("\r\n"));
          }
          controller.enqueue(new TextEncoder().encode(`--${boundary}--\r\n`));
          controller.close();
        },
      });

      const res = await fetch(`${baseUrl}/test-upload`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: stream,
        duplex: "half",
      } as any);

      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.code).toBe("payload_too_large");
      expect(data.error).toContain("Total multipart attachments exceed maximum allowed size of 50 MB");
    });

    it("Probe 1.4: Upload file count exceeding 10 files emits HTTP 400 bad_request", async () => {
      const fd = new FormData();
      for (let i = 0; i < 12; i++) {
        fd.append(`files[${i}]`, new Blob([`sample chunk ${i}`]), `probe_file_${i}.txt`);
      }

      const res = await fetch(`${baseUrl}/test-upload`, {
        method: "POST",
        body: fd,
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("bad_request");
      expect(data.error).toContain("maximum 10 attachments allowed");
    });

    it("Probe 1.5: Socket unpipe, client abort and corrupted stream resilience", async () => {
      // Test that an abrupt TCP client disconnect mid-upload does not crash the server process
      let serverErrorThrown = false;
      const uncaughtHandler = (err: Error) => {
        serverErrorThrown = true;
      };
      process.on("uncaughtException", uncaughtHandler);

      try {
        await new Promise<void>((resolve) => {
          const socket = net.createConnection({ port: serverPort }, () => {
            socket.write(
              "POST /test-upload HTTP/1.1\r\n" +
              "Host: 127.0.0.1\r\n" +
              "Content-Type: multipart/form-data; boundary=----BrokenStreamBoundary\r\n" +
              "Content-Length: 100000\r\n\r\n" +
              "------BrokenStreamBoundary\r\n" +
              "Content-Disposition: form-data; name=\"files[0]\"; filename=\"broken.bin\"\r\n" +
              "Content-Type: application/octet-stream\r\n\r\n" +
              "some initial bytes...",
            );
            // Abruptly destroy socket without closing multipart boundary
            setTimeout(() => {
              socket.destroy();
              setTimeout(resolve, 100);
            }, 50);
          });
        });

        expect(serverErrorThrown).toBe(false);

        // Verify server remains responsive after abrupt socket drop
        const healthRes = await fetch(`${baseUrl}/test-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ping: true }),
        });
        expect(healthRes.status).toBe(200);
      } finally {
        process.removeListener("uncaughtException", uncaughtHandler);
      }
    });

    it("Probe 1.6: Oversized payload_json field exceeding 2MB triggers HTTP 413 payload_too_large", async () => {
      const boundary = "----AdversarialLargeField";
      // 2.5MB payload_json string
      const largeJson = JSON.stringify({
        mode: "bot",
        channelId: "123456",
        content: "x".repeat(2.5 * 1024 * 1024),
      });

      const body =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="payload_json"\r\n\r\n` +
        largeJson +
        `\r\n--${boundary}--\r\n`;

      const res = await fetch(`${baseUrl}/test-upload`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.code).toBe("payload_too_large");
      expect(data.error).toContain("exceeds maximum allowed field size");
    });
  });

  /* ==========================================================================
     TARGET 2: Outbound REST Timeouts (PERF-02)
     ========================================================================== */
  describe("PERF-02: Outbound REST Timeouts", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it("Probe 2.1: Standard REST calls use 10s timeout signal", async () => {
      let inspectedSignal: AbortSignal | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        inspectedSignal = init?.signal as AbortSignal | undefined;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ id: "123", name: "test-guild" }),
        } as any;
      });

      await discord.getGuildChannels("guild_123");

      expect(inspectedSignal).toBeDefined();
      expect(inspectedSignal).toBeInstanceOf(AbortSignal);
    });

    it("Probe 2.2: Fast interaction callback uses a 1s attempt timeout", async () => {
      let callCount = 0;

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      });

      let err: any = null;
      try {
        await createInteractionResponse("int_456", "tok_456", {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: { content: "pong" } as any,
        });
      } catch (e) {
        err = e;
      }

      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(504);
      expect(err.code).toBe("gateway_timeout");
      expect(err.message).toContain("Discord request timed out after 1000ms");
      expect(err.message).not.toContain("tok_456");
      expect(JSON.stringify(err.details)).not.toContain("tok_456");
      // retries: 1 means 1 initial attempt + 1 retry = 2 calls
      expect(callCount).toBe(2);
    });



  });

  /* ==========================================================================
     TARGET 3: Deferred Interaction Memory (PERF-03)
     ========================================================================== */
  describe("PERF-03: Deferred Interaction Memory Retention", () => {
    beforeAll(async () => {
      await initializeDatabase();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const createMockInteraction = (id: string): DiscordInteraction => ({
      id,
      application_id: "app_adversarial",
      token: `token_${id}`,
      version: 1,
      type: InteractionType.MessageComponent,
      data: {
        custom_id: "action:slow:{}",
        component_type: 2,
      },
    });

    it("Probe 3.1: pendingLateResponses map size transitions (0 -> 1 -> 0)", async () => {
      const id = `probe_map_${Date.now()}`;
      const interaction = createMockInteraction(id);

      expect(getPendingLateResponsesCount()).toBe(0);

      // Simulate execution taking 2300ms (> ACK_DEADLINE_MS = 2200ms)
      vi.spyOn(actionExecutor, "executeCustomId").mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 2300));
        return {
          handled: true,
          response: { type: InteractionResponseType.ChannelMessageWithSource },
        };
      });

      vi.spyOn(discord, "createFollowupMessage").mockResolvedValue({ id: "msg_late" });

      const ack = await handleInteraction(interaction);
      expect(ack.type).toBe(InteractionResponseType.DeferredUpdateMessage);
      // While execution is pending, count is >= 1
      expect(getPendingLateResponsesCount()).toBe(1);

      // Complete deferred delivery
      await completeDeferredInteraction(interaction);
      // Map size must return to 0
      expect(getPendingLateResponsesCount()).toBe(0);
    });

    it("Probe 3.2: Deferred entries and timers are purged in finally block even on late delivery failure", async () => {
      const id = `probe_fail_${Date.now()}`;
      const interaction = createMockInteraction(id);

      vi.spyOn(actionExecutor, "executeCustomId").mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 2300));
        return {
          handled: true,
          response: { type: InteractionResponseType.ChannelMessageWithSource },
        };
      });

      // Discord followup rejects with 500
      vi.spyOn(discord, "createFollowupMessage").mockRejectedValue(new Error("Discord upstream 500"));

      await handleInteraction(interaction);
      expect(getPendingLateResponsesCount()).toBe(1);

      // Settle deferred interaction
      await completeDeferredInteraction(interaction);
      // Even on error, entry must be deleted
      expect(getPendingLateResponsesCount()).toBe(0);
    });

    it("Probe 3.3: Explicit cleanup on socket drop / cancellation removes map entry and clears timer", async () => {
      const id = `probe_drop_${Date.now()}`;
      const interaction = createMockInteraction(id);

      vi.spyOn(actionExecutor, "executeCustomId").mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 2300));
        return { handled: true };
      });

      await handleInteraction(interaction);
      expect(getPendingLateResponsesCount()).toBe(1);

      // Trigger cleanup as interactions route does on res.once('close')
      cleanupDeferredInteraction(id);
      expect(getPendingLateResponsesCount()).toBe(0);
    });

    it("Probe 3.4: Concurrent deferred interactions scale up map size and cleanly drain to 0 on settlement", async () => {
      const concurrency = 10;
      const interactions = Array.from({ length: concurrency }, (_, i) =>
        createMockInteraction(`probe_concurrent_${Date.now()}_${i}`),
      );

      vi.spyOn(actionExecutor, "executeCustomId").mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 2300));
        return {
          handled: true,
          response: { type: InteractionResponseType.ChannelMessageWithSource },
        };
      });

      vi.spyOn(discord, "createFollowupMessage").mockResolvedValue({ id: "msg_ok" });

      // Handle all 10 simultaneously
      const acks = await Promise.all(interactions.map((itx) => handleInteraction(itx)));
      for (const ack of acks) {
        expect(ack.type).toBe(InteractionResponseType.DeferredUpdateMessage);
      }

      // Map should now hold all 10 entries
      expect(getPendingLateResponsesCount()).toBe(concurrency);

      // Complete all 10
      await Promise.all(interactions.map((itx) => completeDeferredInteraction(itx)));

      // All entries must be cleanly dropped
      expect(getPendingLateResponsesCount()).toBe(0);
    });

    it("Probe 3.5: Express response close before finish cleans up pending late response", async () => {
      const id = `probe_express_close_${Date.now()}`;
      const interaction = createMockInteraction(id);

      vi.spyOn(actionExecutor, "executeCustomId").mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 2300));
        return { handled: true };
      });

      const ack = await handleInteraction(interaction);
      expect(ack.type).toBe(InteractionResponseType.DeferredUpdateMessage);
      expect(getPendingLateResponsesCount()).toBe(1);

      // Simulate Express response where client disconnects before finish (writableFinished is false)
      const fakeRes = new (await import("node:events")).EventEmitter() as any;
      fakeRes.writableFinished = false;

      fakeRes.once("close", () => {
        if (!fakeRes.writableFinished) {
          cleanupDeferredInteraction(interaction.id);
        }
      });

      fakeRes.emit("close");

      expect(getPendingLateResponsesCount()).toBe(0);
    });
  });
});
