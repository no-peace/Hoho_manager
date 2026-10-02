import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import type { DiscordInteraction } from "@dmb/shared";
import { env } from "../config/env.js";
import { botProfileRepository } from "../repositories/profileRepository.js";
import { ApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const log = logger.child("interactions");
const MAX_SIGNATURE_AGE_SECONDS = 5 * 60;

export const isFreshDiscordTimestamp = (timestamp: string, nowMs = Date.now()): boolean => {
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds <= 0) return false;
  return Math.abs(nowMs / 1000 - timestampSeconds) <= MAX_SIGNATURE_AGE_SECONDS;
};

export const verifyDiscordSignatureBytes = (
  publicKeyHex: string,
  signatureHex: string,
  timestamp: string,
  rawBody: Buffer,
  nowMs = Date.now(),
): boolean => {
  if (
    !isFreshDiscordTimestamp(timestamp, nowMs) ||
    !/^[\da-fA-F]{64}$/.test(publicKeyHex) ||
    !/^[\da-fA-F]{128}$/.test(signatureHex)
  ) {
    return false;
  }

  try {
    const publicKeyPem = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        Buffer.from(publicKeyHex, "hex"),
      ]),
      format: "der",
      type: "spki",
    });
    const signedData = Buffer.concat([Buffer.from(timestamp, "utf-8"), rawBody]);
    return crypto.verify(null, signedData, publicKeyPem, Buffer.from(signatureHex, "hex"));
  } catch (error) {
    log.error(`Native verification failed: ${error}`);
    return false;
  }
};

export const requireInteraction = (req: Request): DiscordInteraction => {
  if (!req.interaction) {
    throw ApiError.unauthorized("No verified interaction on this request");
  }
  return req.interaction;
};

export const verifyDiscordSignature: RequestHandler = async (req, res, next) => {
  const signatureHex = req.get("X-Signature-Ed25519")?.trim();
  const timestampStr = req.get("X-Signature-Timestamp")?.trim();

  if (!signatureHex || !timestampStr) {
    res.status(401).json({ error: "Missing signature headers" });
    return;
  }

  if (!isFreshDiscordTimestamp(timestampStr)) {
    res.status(401).json({ error: "Expired or invalid request timestamp" });
    return;
  }
  if (!/^[\da-fA-F]{128}$/.test(signatureHex)) {
    res.status(401).json({ error: "Invalid request signature" });
    return;
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).json({ error: "Expected a raw JSON request body" });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf-8")) as unknown;
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  if (payload === null || typeof payload !== "object") {
    res.status(400).json({ error: "Invalid interaction payload" });
    return;
  }
  const interaction = payload as Partial<DiscordInteraction>;
  if (typeof interaction.application_id !== "string") {
    res.status(400).json({ error: "Interaction application ID is missing" });
    return;
  }

  const configuredApplicationId = env.discord.applicationId;
  const publicKeyHex =
    configuredApplicationId === interaction.application_id
      ? env.discord.publicKey?.trim()
      : (await botProfileRepository.findPublicKeyByApplicationId(interaction.application_id)) ??
        (configuredApplicationId ? undefined : env.discord.publicKey?.trim());

  if (!publicKeyHex) {
    res.status(503).json({ error: "No public key is configured for this application" });
    return;
  }

  if (!verifyDiscordSignatureBytes(publicKeyHex, signatureHex, timestampStr, rawBody)) {
    log.warn(`Invalid Discord signature rejected for application ${interaction.application_id}`);
    res.status(401).json({ error: "Invalid request signature" });
    return;
  }

  req.interaction = interaction as DiscordInteraction;
  next();
};

export default verifyDiscordSignature;