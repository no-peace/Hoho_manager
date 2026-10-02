import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractionResponseType, InteractionType } from "@dmb/shared";
import type { DiscordInteraction, InteractionResponse } from "@dmb/shared";
import type { ExecuteResult } from "./actionExecutor.js";
import * as discord from "./discordService.js";
import { interactionReceiptRepository } from "../repositories/index.js";
import { executeCustomId } from "./actionExecutor.js";
import { completeDeferredInteraction, handleInteraction } from "./interactionHandler.js";

vi.mock("./actionExecutor.js", () => ({ executeCustomId: vi.fn() }));

const interaction = (): DiscordInteraction => ({
  id: "interaction-1",
  application_id: "application-1",
  type: InteractionType.MessageComponent,
  token: "interaction-token",
  data: { custom_id: "action:dud" },
});

describe("handleInteraction idempotency", () => {
  beforeEach(() => {
    vi.spyOn(interactionReceiptRepository, "claim").mockResolvedValue(true);
    vi.spyOn(interactionReceiptRepository, "getResponse").mockResolvedValue(null);
    vi.spyOn(interactionReceiptRepository, "complete").mockResolvedValue();
    vi.mocked(executeCustomId).mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  it("executes a claimed interaction and caches its response", async () => {
    const response: InteractionResponse = {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "Done" },
    };
    vi.mocked(executeCustomId).mockResolvedValue({ response, handled: true, type: "dud" });

    await expect(handleInteraction(interaction())).resolves.toEqual(response);
    expect(executeCustomId).toHaveBeenCalledOnce();
    expect(interactionReceiptRepository.complete).toHaveBeenCalledWith("interaction-1", response);
  });

  it("returns the cached response without executing a duplicate", async () => {
    const response: InteractionResponse = {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "Already handled" },
    };
    vi.mocked(interactionReceiptRepository.claim).mockResolvedValue(false);
    vi.mocked(interactionReceiptRepository.getResponse).mockResolvedValue(response);

    await expect(handleInteraction(interaction())).resolves.toEqual(response);
    expect(executeCustomId).not.toHaveBeenCalled();
  });

  it("acknowledges a duplicate while its original delivery is still running", async () => {
    vi.mocked(interactionReceiptRepository.claim).mockResolvedValue(false);

    await expect(handleInteraction(interaction())).resolves.toEqual({
      type: InteractionResponseType.DeferredUpdateMessage,
    });
    expect(executeCustomId).not.toHaveBeenCalled();
  });

  it("defers a slow action and sends its late visible response as a followup", async () => {
    vi.useFakeTimers();
    const followup = vi.spyOn(discord, "createFollowupMessage").mockResolvedValue(null);
    let finishExecution!: (result: ExecuteResult) => void;
    vi.mocked(executeCustomId).mockImplementation(
      () => new Promise((resolve) => { finishExecution = resolve; }),
    );

    const handled = handleInteraction(interaction());
    await vi.advanceTimersByTimeAsync(2_200);
    await expect(handled).resolves.toEqual({
      type: InteractionResponseType.DeferredUpdateMessage,
    });
    expect(followup).not.toHaveBeenCalled();

    vi.useRealTimers();
    finishExecution({
      response: {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: { content: "Completed after acknowledgement" },
      },
      handled: true,
      type: "dud",
    });
    await completeDeferredInteraction(interaction());
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(followup).toHaveBeenCalledWith("application-1", "interaction-token", {
      content: "Completed after acknowledgement",
    });
    expect(executeCustomId).toHaveBeenCalledOnce();
  });
});