import express, { Router } from "express";
import { InteractionResponseType } from "@dmb/shared";
import type { DiscordInteraction } from "@dmb/shared";
import { requireAdminKey } from "../middleware/auth.js";
import { requireInteraction, verifyDiscordSignature } from "../middleware/verifyDiscordSignature.js";
import {
  completeDeferredInteraction,
  handleInteraction,
} from "../services/interactionHandler.js";
import * as discord from "../services/discordService.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const router = Router();
const log = logger.child("interactions");

/**
 * Interaction delivery.
 *
 * Discord delivers interactions in exactly **one** of two ways, and which one is
 * determined by the app's *Interactions Endpoint URL* — the two are mutually
 * exclusive per application:
 *
 *   - **Endpoint URL set** → Discord POSTs to `POST /api/interactions`. This needs
 *     a public HTTPS address (a Cloudflare Tunnel, in the laptop setup).
 *   - **No endpoint URL** → Discord sends `INTERACTION_CREATE` over the gateway.
 *     The gateway worker then forwards the payload to `POST /api/interactions/relay`
 *     on this same server, which is a plain localhost call — so a machine with no
 *     public address and no tunnel can still run the action system.
 *
 * Both routes converge on {@link handleInteraction} so a flow behaves identically
 * whichever delivery is in play. Only the transport differs.
 */

/* ── 1. Webhook delivery (public HTTPS) ────────────────────────────────────── */

/**
 * POST /api/interactions
 *
 * Pipeline:
 *   1. `express.raw` keeps the body as a Buffer — signatures cover the exact
 *      bytes, so parsing first would break verification.
 *   2. `verifyDiscordSignature` validates the Ed25519 signature and parses the
 *      payload onto `req.interaction`.
 *   3. We route by `data.custom_id` through the action executor and reply with
 *      whatever the first responding action returned.
 *
 * Discord requires a response within **3 seconds** or it shows the user
 * "This interaction failed", so every path here must reply — including errors.
 */

router.post(
  "/",
  express.raw({ type: "application/json", limit: "1mb" }),
  verifyDiscordSignature,
  asyncHandler(async (req, res) => {
    const interaction = requireInteraction(req);
    log.info(`Received verified interaction type ${interaction.type}`);
    const response = await handleInteraction(interaction);
    if (
      response.type === InteractionResponseType.DeferredUpdateMessage ||
      response.type === InteractionResponseType.DeferredChannelMessageWithSource
    ) {
      res.once("finish", () => void completeDeferredInteraction(interaction));
    }
    res.json(response);
  }),
);

/* ── 2. Gateway relay (no public address needed) ───────────────────────────── */

/** Fields the relay cannot work without; Discord signs none of them for us. */
const isRelayable = (value: unknown): value is DiscordInteraction => {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.token === "string" &&
    typeof record.application_id === "string"
  );
};

/**
 * POST /api/interactions/relay
 *
 * Called by the gateway worker, not by Discord, so it authenticates with the
 * shared `x-admin-key` instead of an Ed25519 signature.
 *
 * We do **not** verify a signature here because there is none to verify: the
 * payload is re-serialised by the worker, and Discord's signature covers the
 * original bytes. The admin key plus the fact that the route is only ever
 * reached over the API's own port is the trust boundary — bind the API to
 * localhost (or a private network) and it is not reachable from outside.
 *
 * The reply is delivered by *this* process via
 * `POST /interactions/{id}/{token}/callback`. That endpoint is authenticated by
 * the interaction token itself, which is exactly how the webhook path replies —
 * a gateway connection is not needed to answer a gateway-delivered interaction.
 *
 * The worker therefore has nothing to send back to Discord; it only needs to
 * know whether the reply landed so it can fall back to its own error message when
 * the API is unreachable.
 */
router.post(
  "/relay",
  requireAdminKey,
  express.json({ limit: "1mb" }),
  asyncHandler(async (req, res) => {
    if (!isRelayable(req.body)) {
      throw ApiError.badRequest(
        "Relay body must be the raw interaction, including id, token and application_id.",
      );
    }

    const interaction = req.body;
    const response = await handleInteraction(interaction);

    // A Ping never reaches this route (the worker only relays components and
    // modals), but posting a Pong to the callback endpoint would be nonsense.
    if (response.type === InteractionResponseType.Pong) {
      res.json({ ok: true, delivered: false, type: response.type });
      return;
    }

    try {
      await discord.createInteractionResponse(
        interaction.application_id,
        interaction.token,
        response,
      );
      if (
        response.type === InteractionResponseType.DeferredUpdateMessage ||
        response.type === InteractionResponseType.DeferredChannelMessageWithSource
      ) {
        void completeDeferredInteraction(interaction);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log.error(`Relay could not deliver a reply for ${interaction.id}: ${reason}`);
      // `delivered: false` is what lets the worker decide to answer in-process.
      res.status(502).json({ ok: false, delivered: false, error: reason });
      return;
    }

    res.json({ ok: true, delivered: true, type: response.type });
  }),
);

export default router;
