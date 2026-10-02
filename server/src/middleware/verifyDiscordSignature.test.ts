import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { isFreshDiscordTimestamp, verifyDiscordSignatureBytes } from "./verifyDiscordSignature.js";

describe("isFreshDiscordTimestamp", () => {
  const now = 1_800_000_000_000;

  it("accepts a timestamp within the five-minute window", () => {
    expect(isFreshDiscordTimestamp(String(now / 1000 - 300), now)).toBe(true);
    expect(isFreshDiscordTimestamp(String(now / 1000 + 300), now)).toBe(true);
  });

  it("rejects stale, far-future, and malformed timestamps", () => {
    expect(isFreshDiscordTimestamp(String(now / 1000 - 301), now)).toBe(false);
    expect(isFreshDiscordTimestamp(String(now / 1000 + 301), now)).toBe(false);
    expect(isFreshDiscordTimestamp("not-a-timestamp", now)).toBe(false);
    expect(isFreshDiscordTimestamp("0", now)).toBe(false);
  });

  it("verifies the exact raw body with an Ed25519 key and fresh timestamp", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const publicDer = publicKey.export({ format: "der", type: "spki" });
    const publicKeyHex = publicDer.subarray(-32).toString("hex");
    const timestamp = String(now / 1000);
    const body = Buffer.from('{"type":1}');
    const signedData = Buffer.concat([Buffer.from(timestamp), body]);
    const signature = crypto.sign(null, signedData, privateKey).toString("hex");

    expect(verifyDiscordSignatureBytes(publicKeyHex, signature, timestamp, body, now)).toBe(true);
    expect(
      verifyDiscordSignatureBytes(publicKeyHex, signature, timestamp, Buffer.from("{}"), now),
    ).toBe(false);
    expect(verifyDiscordSignatureBytes(publicKeyHex, signature, "1", body, now)).toBe(false);
  });
});