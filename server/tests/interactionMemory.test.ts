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
