import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorHandler, notFoundHandler } from "../src/middleware/errorHandler.js";
import { ApiError } from "../src/utils/errors.js";

describe("API error detail disclosure", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.get("/private-error", () => {
      throw new ApiError(500, "internal failure", {
        code: "internal_error",
        details: { secret: "sensitive-token" },
        expose: false,
      });
    });
    app.get("/safe-error", () => {
      throw ApiError.gatewayTimeout("A safe timeout occurred", { timeoutMs: 1000 });
    });
    app.use(notFoundHandler, errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("does not serialize details when the error is marked non-exposed", async () => {
    const response = await fetch(`${baseUrl}/private-error`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Internal server error",
      code: "internal_error",
    });
  });

  it("does not reflect query-string credentials in 404 responses", async () => {
    const response = await fetch(`${baseUrl}/missing?access_token=secret-query-token`);
    const body = await response.json() as { error: string };
    expect(response.status).toBe(404);
    expect(body.error).toBe("No route matches GET /missing");
    expect(body.error).not.toContain("secret-query-token");
  });

  it("keeps explicitly safe details available to clients", async () => {
    const response = await fetch(`${baseUrl}/safe-error`);
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({
      error: "A safe timeout occurred",
      code: "gateway_timeout",
      details: { timeoutMs: 1000 },
    });
  });
});
