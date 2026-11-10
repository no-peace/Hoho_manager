import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import http, { type Server } from "node:http";
import { multipartParser } from "../src/middleware/multipart.js";

describe("Empirical Challenger: Multipart Middleware Fallback & Stress Testing", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();

    // Do NOT register express.json() before multipartParser to test raw/undefined req.body
    app.use(multipartParser);

    app.post("/test-upload", (req: Request, res: Response) => {
      res.json({
        ok: true,
        bodyType: typeof req.body,
        body: req.body,
        files: (req as any).uploadedFiles?.map((f: any) => ({
          filename: f.filename,
          size: f.size,
          key: f.key,
        })),
      });
    });

    // Error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.status || 500).json({ error: err.message, status: err.status, code: err.code });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === "object" && addr) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("handles multipart request with NO payload_json and only text fields without crashing", async () => {
    const fd = new FormData();
    fd.append("channelId", "123456789012345678");
    fd.append("mode", "bot");
    fd.append("content", "Testing message text without payload_json");

    const res = await fetch(`${baseUrl}/test-upload`, {
      method: "POST",
      body: fd,
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.bodyType).toBe("object");
    expect(data.body.channelId).toBe("123456789012345678");
    expect(data.body.mode).toBe("bot");
    expect(data.body.content).toBe("Testing message text without payload_json");
  });

  it("handles multipart request with NO payload_json and only a file attachment", async () => {
    const fd = new FormData();
    const fileContent = "Empirical Challenger Attachment Payload";
    fd.append("files[0]", new Blob([fileContent], { type: "text/plain" }), "challenger.txt");

    const res = await fetch(`${baseUrl}/test-upload`, {
      method: "POST",
      body: fd,
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.bodyType).toBe("object");
    expect(data.body).toEqual({});
    expect(data.files).toHaveLength(1);
    expect(data.files[0].filename).toBe("challenger.txt");
    expect(data.files[0].size).toBe(fileContent.length);
  });

  it("handles completely empty multipart form data (0 parts)", async () => {
    const fd = new FormData();
    const res = await fetch(`${baseUrl}/test-upload`, {
      method: "POST",
      body: fd,
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.body).toEqual({});
    expect(data.files).toHaveLength(0);
  });

  it("returns 400 Bad Request when payload_json is invalid JSON syntax", async () => {
    const fd = new FormData();
    fd.append("payload_json", "MALFORMED_JSON_{{{");

    const res = await fetch(`${baseUrl}/test-upload`, {
      method: "POST",
      body: fd,
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid JSON format in payload_json");
  });

  it("correctly nests direct message payload when payload_json lacks envelope keys", async () => {
    const fd = new FormData();
    fd.append("payload_json", JSON.stringify({ content: "Direct message content", embeds: [] }));
    fd.append("channelId", "channel-abc");

    const res = await fetch(`${baseUrl}/test-upload`, {
      method: "POST",
      body: fd,
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.body.channelId).toBe("channel-abc");
    expect(data.body.payload).toBeDefined();
    expect(data.body.payload.content).toBe("Direct message content");
  });

  it("unwraps envelope when payload_json contains 'mode' and 'payload'", async () => {
    const fd = new FormData();
    fd.append(
      "payload_json",
      JSON.stringify({
        mode: "webhook",
        webhookUrl: "https://discord.com/api/webhooks/1/abc",
        payload: { content: "Wrapped message" },
      }),
    );

    const res = await fetch(`${baseUrl}/test-upload`, {
      method: "POST",
      body: fd,
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.body.mode).toBe("webhook");
    expect(data.body.webhookUrl).toBe("https://discord.com/api/webhooks/1/abc");
    expect(data.body.payload.content).toBe("Wrapped message");
  });

  it("enforces maximum file count constraint (rejects > 10 files)", async () => {
    const fd = new FormData();
    for (let i = 0; i < 11; i++) {
      fd.append(`files[${i}]`, new Blob([`file ${i}`]), `file_${i}.txt`);
    }

    const res = await fetch(`${baseUrl}/test-upload`, {
      method: "POST",
      body: fd,
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("maximum 10 attachments allowed");
  });

  it("passes non-multipart requests straight through to next()", async () => {
    const res = await fetch(`${baseUrl}/test-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directJson: true }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    // Since express.json() was not mounted, body is undefined / unparsed by multipartParser
    expect(data.ok).toBe(true);
  });

  it("rejects request with HTTP 413 when Content-Length exceeds max allowed payload", async () => {
    const res = await new Promise<{ status: number; data: any }>((resolve, reject) => {
      const u = new URL(`${baseUrl}/test-upload`);
      const clientReq = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundaryFake",
            "Content-Length": "60000000", // ~60 MB
          },
        },
        (clientRes) => {
          let raw = "";
          clientRes.on("data", (c) => (raw += c));
          clientRes.on("end", () => {
            resolve({
              status: clientRes.statusCode || 0,
              data: raw ? JSON.parse(raw) : {},
            });
          });
        },
      );
      clientReq.on("error", reject);
      clientReq.write("----WebKitFormBoundaryFake\r\nContent-Disposition: form-data; name=\"dummy\"\r\n\r\nhi\r\n----WebKitFormBoundaryFake--\r\n");
      clientReq.end();
    });

    expect(res.status).toBe(413);
    expect(res.data.code).toBe("payload_too_large");
    expect(res.data.error).toContain("exceeds maximum allowed size");
  });

  it("rejects file exceeding 25 MB with HTTP 413 during streaming", async () => {
    // Generate a stream exceeding 25MB (26MB)
    const chunkSize = 1024 * 1024; // 1MB
    const totalChunks = 26;
    const boundary = "----TestBoundaryStreamLimit";

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `--${boundary}\r\nContent-Disposition: form-data; name="files[0]"; filename="oversized.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`,
          ),
        );
        for (let i = 0; i < totalChunks; i++) {
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

  it("handles malformed multipart boundary gracefully without crashing", async () => {
    const res = await fetch(`${baseUrl}/test-upload`, {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data", // missing boundary
      },
      body: "dummy data",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Malformed multipart request");
  });
});
