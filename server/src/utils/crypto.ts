import crypto from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * Symmetric encryption for secrets that must live in the database (bot tokens).
 *
 * Uses AES-256-GCM: authenticated encryption, so tampering is detected on
 * decrypt rather than silently producing garbage.
 *
 * If `ENCRYPTION_KEY` is unset we *derive* a key from `ADMIN_API_KEY` so local
 * development still never writes a plaintext token. Production must set a real
 * key — `validateEnv()` warns about the development default.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the GCM recommendation

let cachedKey: Buffer | null = null;

const deriveKey = (): Buffer => {
  const secret = env.encryptionKey ?? env.adminApiKey;
  if (!env.encryptionKey) {
    logger.warn(
      "ENCRYPTION_KEY is not set — deriving one from ADMIN_API_KEY. " +
        "Set ENCRYPTION_KEY before deploying; rotating it will invalidate stored tokens.",
    );
  }
  // Always SHA-256 the material down to exactly 32 bytes.
  return crypto.createHash("sha256").update(secret).digest();
};

const getKey = (): Buffer => (cachedKey ??= deriveKey());

/** Encrypt a string. Output: `<iv>.<tag>.<ciphertext>`, all base64url. */
export const encrypt = (plaintext: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
};

/** Decrypt a value produced by {@link encrypt}. Returns `null` if unreadable. */
export const decrypt = (payload: string): string | null => {
  try {
    const [ivPart, tagPart, dataPart] = payload.split(".");
    if (!ivPart || !tagPart || !dataPart) return null;

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to decrypt a stored secret (wrong key?): ${reason}`);
    return null;
  }
};

/** Mask a secret for logging, e.g. `MTIz4••••••••2Y2Q`. */
export const maskSecret = (secret: string | null | undefined): string => {
  if (!secret) return "";
  if (secret.length <= 8) return "\u2022".repeat(secret.length);
  return `${secret.slice(0, 4)}${"\u2022".repeat(8)}${secret.slice(-4)}`;
};
