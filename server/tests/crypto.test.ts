import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { decrypt, encrypt } from "../src/utils/crypto.js";

const splitPayload = (payload: string): [string, string, string] => {
  const parts = payload.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error("Unexpected encrypted payload format");
  }
  return [parts[0]!, parts[1]!, parts[2]!];
};

describe("AES-256-GCM secret encryption", () => {
  it("decrypts values encrypted with the legacy admin-key-derived key", () => {
    const plaintext = "legacy-discord-bot-token";
    const key = crypto.createHash("sha256").update(env.adminApiKey).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const payload = [
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");

    expect(decrypt(payload)).toBe(plaintext);
  });

  it("round-trips encrypted values", () => {
    const plaintext = "discord-bot-token-test-value";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("rejects truncated authentication tags", () => {
    const [iv, tag, ciphertext] = splitPayload(encrypt("sensitive-value"));
    const shortTag = Buffer.from(tag, "base64url")
      .subarray(0, 4)
      .toString("base64url");

    expect(decrypt([iv, shortTag, ciphertext].join("."))).toBeNull();
  });

  it("rejects modified authentication tags", () => {
    const [iv, tag, ciphertext] = splitPayload(encrypt("sensitive-value"));
    const bytes = Buffer.from(tag, "base64url");
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;

    expect(
      decrypt([iv, bytes.toString("base64url"), ciphertext].join(".")),
    ).toBeNull();
  });

  it("rejects invalid IV lengths", () => {
    const [, tag, ciphertext] = splitPayload(encrypt("sensitive-value"));

    expect(decrypt(["AA", tag, ciphertext].join("."))).toBeNull();
  });
});
