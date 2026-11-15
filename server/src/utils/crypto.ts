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
 * key  `validateEnv()` warns about the development default.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the GCM recommendation
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

let cachedEncryptionKey: Buffer | null = null;
let cachedDecryptionKeys: Buffer[] | null = null;

const deriveKey = (secret: string): Buffer =>
  // Always SHA-256 the material down to exactly 32 bytes.
  crypto.createHash("sha256").update(secret).digest();

const getEncryptionKey = (): Buffer =>
  (cachedEncryptionKey ??= deriveKey(env.encryptionKey || env.adminApiKey));

/** Keep the old admin-key-derived key as a read-only migration fallback. */
const getDecryptionKeys = (): Buffer[] => {
  if (cachedDecryptionKeys) return cachedDecryptionKeys;
  const secrets = [...new Set([env.encryptionKey, env.adminApiKey].filter((value): value is string => Boolean(value)))];
  cachedDecryptionKeys = secrets.map(deriveKey);
  return cachedDecryptionKeys;
};

/** Encrypt a string. Output: `<iv>.<tag>.<ciphertext>`, all base64url. */
export const encrypt = (plaintext: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
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

    const iv = Buffer.from(ivPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");
    if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) return null;

    for (const key of getDecryptionKeys()) {
      try {
        const decipher = crypto.createDecipheriv(
          ALGORITHM,
          key,
          iv,
          { authTagLength: AUTH_TAG_LENGTH },
        );
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([
          decipher.update(Buffer.from(dataPart, "base64url")),
          decipher.final(),
        ]);
        return decrypted.toString("utf8");
      } catch {
        // Try the next configured key during the admin-key -> dedicated-key migration.
      }
    }
    throw new Error("No configured key could authenticate this encrypted value");
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
