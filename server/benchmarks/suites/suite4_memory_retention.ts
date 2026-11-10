import {
  handleInteraction,
  completeDeferredInteraction,
  getPendingLateResponsesCount,
} from "../../src/services/interactionHandler.js";
import { InteractionType, InteractionResponseType, type DiscordInteraction } from "@dmb/shared";
import { initializeDatabase } from "../../src/config/database.js";
import type { BenchmarkMetric } from "../types.js";

/**
 * Suite 4: Heap Memory Leak & Retention Detection
 * Target: Zero retained closures; heap delta < 1MB after 5,000 synthetic interaction requests.
 */
export const runSuite4 = async (): Promise<BenchmarkMetric> => {
  await initializeDatabase();

  const ITERATIONS = 5000;
  const BATCH_SIZE = 250;

  // Intercept outbound Discord REST calls via global fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ id: "msg_followup" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof globalThis.fetch;

  const makeInteraction = (id: string): DiscordInteraction => ({
    id,
    application_id: "app_bench_123",
    token: `token_${id}`,
    version: 1,
    type: InteractionType.MessageComponent,
    data: {
      custom_id: "action:dud:{}",
      component_type: 2,
    },
  });

  try {
    if (global.gc) global.gc();
    const initialHeap = process.memoryUsage().heapUsed;
    const initialCount = getPendingLateResponsesCount();

    for (let b = 0; b < ITERATIONS; b += BATCH_SIZE) {
      const currentBatch = Math.min(BATCH_SIZE, ITERATIONS - b);
      const promises: Promise<void>[] = [];

      for (let i = 0; i < currentBatch; i++) {
        const id = `bench_int_${b + i}_${Date.now()}`;
        const interaction = makeInteraction(id);

        promises.push(
          (async () => {
            const ack = await handleInteraction(interaction);
            if (
              ack.type === InteractionResponseType.DeferredUpdateMessage ||
              ack.type === InteractionResponseType.DeferredChannelMessageWithSource
            ) {
              await completeDeferredInteraction(interaction);
            }
          })(),
        );
      }

      await Promise.all(promises);
    }

    // Drain microtasks
    await new Promise((r) => setTimeout(r, 100));

    if (global.gc) global.gc();
    const finalHeap = process.memoryUsage().heapUsed;
    const finalCount = getPendingLateResponsesCount();
    const memoryDeltaMB = (finalHeap - initialHeap) / (1024 * 1024);

    const passed = finalCount === 0 && memoryDeltaMB < 1.0;

    return {
      name: "Suite 4: Heap Memory Leak & Retention Detection",
      iterations: ITERATIONS,
      minMs: 0,
      avgMs: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
      memoryDeltaMB,
      retainedClosures: finalCount,
      passed,
      targetDescription: "Heap delta < 1.0 MB, 0 retained closures after 5k reqs",
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
};
