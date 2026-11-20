import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handleInteraction,
  completeDeferredInteraction,
  cleanupDeferredInteraction,
  getPendingLateResponsesCount,
} from "../src/services/interactionHandler.js";
import {
  InteractionType,
  InteractionResponseType,
  type DiscordInteraction,
} from "@dmb/shared";
import * as actionExecutor from "../src/services/actionExecutor.js";
import * as discord from "../src/services/discordService.js";
import { initializeDatabase } from "../src/config/database.js";
import { interactionReceiptRepository } from "../src/repositories/interactionReceiptRepository.js";

describe("PERF-03: Deferred Interaction Memory Retention & Prompt Cleanup", () => {
  beforeEach(async () => {
    await initializeDatabase();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeInteraction = (id: string): DiscordInteraction => ({
    id,
    application_id: "app_123",
    token: `token_${id}`,
    version: 1,
    type: InteractionType.MessageComponent,
    data: {
      custom_id: "action:say:{}",
      component_type: 2,
    },
  });

  it("includes a slow Turso receipt claim inside the ACK deadline", async () => {
    const interaction = makeInteraction(`int_slow_claim_${Date.now()}`);
    const claimSpy = vi.spyOn(interactionReceiptRepository, "claim").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2_300));
      return true;
    });
    const executeSpy = vi.spyOn(actionExecutor, "executeCustomId").mockResolvedValue({
      handled: true,
      response: { type: InteractionResponseType.ChannelMessageWithSource },
    });
    vi.spyOn(discord, "createFollowupMessage").mockResolvedValue({ id: "msg_followup" });

    const startedAt = Date.now();
    const acknowledgement = await handleInteraction(interaction, startedAt);
    const elapsed = Date.now() - startedAt;

    expect(acknowledgement.type).toBe(InteractionResponseType.DeferredUpdateMessage);
    expect(elapsed).toBeLessThan(2_600);
    expect(claimSpy).toHaveBeenCalledTimes(1);

    await completeDeferredInteraction(interaction);

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(getPendingLateResponsesCount()).toBe(0);
  });

  it("returns an immediate response for a duplicate still being processed", async () => {
    const interaction = makeInteraction(`int_duplicate_${Date.now()}`);
    vi.spyOn(interactionReceiptRepository, "claim").mockResolvedValue(false);
    vi.spyOn(interactionReceiptRepository, "getResponse").mockResolvedValue(null);

    const response = await handleInteraction(interaction);

    expect(response.type).toBe(InteractionResponseType.ChannelMessageWithSource);
    expect(response.data?.content).toContain("already being processed");
  });

  it("registers pending deferred interaction and cleans it up immediately on completeDeferredInteraction", async () => {
    const interactionId = `int_test_${Date.now()}_1`;
    const interaction = makeInteraction(interactionId);

    // Mock actionExecutor to take 2300ms (exceeding ACK_DEADLINE_MS = 2200ms)
    vi.spyOn(actionExecutor, "executeCustomId").mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 2300));
      return { handled: true, response: { type: InteractionResponseType.ChannelMessageWithSource } };
    });

    vi.spyOn(discord, "createFollowupMessage").mockResolvedValue({ id: "msg_followup" });

    const ackPromise = handleInteraction(interaction);
    const ack = await ackPromise;

    // ACK should be deferred
    expect(ack.type).toBe(InteractionResponseType.DeferredUpdateMessage);
    // Entry must be stored in pendingLateResponses
    expect(getPendingLateResponsesCount()).toBeGreaterThanOrEqual(1);

    // Complete the deferred interaction
    await completeDeferredInteraction(interaction);

    // Entry must be immediately cleaned up (count drops to 0)
    expect(getPendingLateResponsesCount()).toBe(0);
  });

  it("cleans up pending deferred interaction in finally block even when delivery throws", async () => {
    const interactionId = `int_test_${Date.now()}_2`;
    const interaction = makeInteraction(interactionId);

    vi.spyOn(actionExecutor, "executeCustomId").mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 2300));
      return { handled: true, response: { type: InteractionResponseType.ChannelMessageWithSource } };
    });

    // Mock delivery throwing network error
    vi.spyOn(discord, "createFollowupMessage").mockRejectedValue(new Error("Discord Network Down"));

    const ack = await handleInteraction(interaction);
    expect(ack.type).toBe(InteractionResponseType.DeferredUpdateMessage);

    // Complete deferred interaction (which triggers delivery error)
    await completeDeferredInteraction(interaction);

    // Entry must still be cleaned up via finally block
    expect(getPendingLateResponsesCount()).toBe(0);
  });

  it("allows explicit cleanup of deferred interaction via cleanupDeferredInteraction", async () => {
    const interactionId = `int_test_${Date.now()}_3`;
    const interaction = makeInteraction(interactionId);

    vi.spyOn(actionExecutor, "executeCustomId").mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 2300));
      return { handled: true };
    });

    await handleInteraction(interaction);
    expect(getPendingLateResponsesCount()).toBeGreaterThanOrEqual(1);

    cleanupDeferredInteraction(interactionId);
    expect(getPendingLateResponsesCount()).toBe(0);
  });
});
