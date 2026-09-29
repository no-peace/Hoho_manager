import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto.js";

/**
 * Bot tokens are stored encrypted (AES-256-GCM). A round-trip plus tamper
 * detection is the whole contract here.
 */
describe("encrypt / decrypt", () => {
  it("round-trips a secret", () => {
    const secret = "MTIzNDU2Nzg5MDEyMzQ1Njc4.GaBcDe.FgHiJkLmNoP";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = encrypt("same-input");
    const b = encrypt("same-input");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same-input");
    expect(decrypt(b)).toBe("same-input");
  });

  it("embeds the auth tag so tampering is detected, not decrypted as garbage", () => {
    const sealed = encrypt("top secret");
    const [iv, tag, data] = sealed.split(".");

    // Flip a *byte* of the ciphertext, then re-encode.
    //
    // Flipping a base64 character instead was flaky: the last character of a
    // base64url group can carry only padding bits, so swapping it between some
    // values (e.g. "A" and "B") decodes to the identical bytes and GCM happily
    // authenticates the "tampered" value. `^ 0xff` always changes a byte.
    const bytes = Buffer.from(data, "base64url");
    const middle = Math.floor(bytes.length / 2);
    bytes[middle] = (bytes[middle] ?? 0) ^ 0xff;

    const flipped = `${iv}.${tag}.${bytes.toString("base64url")}`;
    expect(decrypt(flipped)).toBeNull();
  });

  it("returns null for structurally broken input rather than throwing", () => {
    expect(decrypt("not-a-valid-seal")).toBeNull();
    expect(decrypt("")).toBeNull();
    expect(decrypt("a.b")).toBeNull();
  });
});
