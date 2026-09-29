import type { Request, RequestHandler } from "express";
import { verifyKey } from "discord-interactions";
import type { DiscordInteraction } from "@dmb/shared";
import { env } from "../config/env.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const log = logger.child("interactions");

/**
 * The verified interaction, guaranteed.
 * @throws ApiError 401 when verification did not run or failed.
 */
export const requireInteraction = (req: Request): DiscordInteraction => {
  if (!req.interaction) {
    throw ApiError.unauthorized("No verified interaction on this request");
  }
  return req.interaction;
};

/**
 * Verify that an incoming request really came from Discord.
 *
 * Discord signs every interaction with Ed25519 using your application's keys:
 *   - `X-Signature-Ed25519` — base64 signature
 *   - `X-Signature-Timestamp` — the signed timestamp
 *
 * The signature covers the **raw** body, so this middleware must run behind
 * `express.raw({ type: "application/json" })` (see `app.ts`). We verify against
 * the raw buffer, then parse it once and expose the result as `req.interaction`
 * so downstream handlers never re-parse.
 *
 * Any request that fails verification gets a 401 — Discord treats that as an
 * invalid endpoint and will refuse to save the URL.
 */
export const verifyDiscordSignature: RequestHandler = asyncHandler(async (req, res, next) => {
  const publicKey = env.discord.publicKey;

  if (!publicKey) {
    log.error("DISCORD_PUBLIC_KEY is not configured; rejecting interaction");
    res.status(503).json({ error: "Interaction endpoint is not configured on this server" });
    return;
  }

  const signature = req.get("X-Signature-Ed25519");
  const timestamp = req.get("X-Signature-Timestamp");
  const rawBody: unknown = req.body;

  if (!signature || !timestamp || !Buffer.isBuffer(rawBody)) {
    log.warn("Rejected interaction with missing signature headers or non-raw body");
    res.status(401).json({ error: "Missing or malformed signature" });
    return;
  }

  // `verifyKey` is async in discord-interactions v4.
  let valid = false;
  // Force the public key to trim invisible spaces/newlines from Windows .env files
  const safePublicKey = publicKey.trim();
  
  // Convert the Node Buffer into a standard UTF-8 string for the verifier
  const safeBody = (rawBody as Buffer).toString("utf8");

  try {
    valid = await verifyKey(safeBody, signature as string, timestamp as string, safePublicKey);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.warn(`Signature verification threw: ${reason}`);
    res.status(401).json({ error: "Invalid request signature" });
    return;
  }
/* before debugging
  try {
    valid = await verifyKey(rawBody, signature, timestamp, publicKey);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.warn(`Signature verification threw: ${reason}`);
    res.status(401).json({ error: "Invalid request signature" });
    return;
  }
*/
  if (!valid) {
    log.warn("Rejected interaction with an invalid signature");
    res.status(401).json({ error: "Invalid request signature" });
    return;
  }

  try {
    req.interaction = JSON.parse(rawBody.toString("utf8")) as DiscordInteraction;
  } catch {
    res.status(400).json({ error: "Interaction body is not valid JSON" });
    return;
  }

  next();
});

export default verifyDiscordSignature;
