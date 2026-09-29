import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import type { DiscordInteraction } from "@dmb/shared";
import { env } from "../config/env.js";
import { ApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const log = logger.child("interactions");

export const requireInteraction = (req: Request): DiscordInteraction => {
  if (!req.interaction) {
    throw ApiError.unauthorized("No verified interaction on this request");
  }
  return req.interaction;
};

export const verifyDiscordSignature: RequestHandler = (req, res, next) => {
  const publicKeyHex = env.discord.publicKey?.trim();
  if (!publicKeyHex) {
    res.status(503).json({ error: "Interaction endpoint is not configured" });
    return;
  }

  const signatureHex = req.get("X-Signature-Ed25519")?.trim();
  const timestampStr = req.get("X-Signature-Timestamp")?.trim();
  
  if (!signatureHex || !timestampStr) {
    res.status(401).json({ error: "Missing signature headers" });
    return;
  }

  // 1. Natively capture the raw HTTP stream, completely bypassing Express parsers
  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  
  req.on("end", () => {
    const rawBody = Buffer.concat(chunks);
    
    // 2. Mathematically bind the timestamp and exact pristine bytes
    const messageBuffer = Buffer.concat([
      Buffer.from(timestampStr, "utf-8"),
      rawBody
    ]);

    // 3. Verify natively using the C++ engine
    let valid = false;
    try {
      const publicKeyPem = crypto.createPublicKey({
        key: Buffer.concat([
          Buffer.from("302a300506032b6570032100", "hex"),
          Buffer.from(publicKeyHex, "hex")
        ]),
        format: "der",
        type: "spki"
      });

      valid = crypto.verify(
        null, 
        messageBuffer,
        publicKeyPem,
        Buffer.from(signatureHex, "hex")
      );
    } catch (err) {
      log.error(`Native verification failed: ${err}`);
    }

    if (!valid) {
      log.warn("Invalid signature rejected by native stream reader");
      res.status(401).json({ error: "Invalid request signature" });
      return;
    }

    // 4. If valid, parse the JSON and continue to your route
    try {
      req.interaction = JSON.parse(rawBody.toString("utf-8")) as DiscordInteraction;
      next();
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
    }
  });
};

export default verifyDiscordSignature;