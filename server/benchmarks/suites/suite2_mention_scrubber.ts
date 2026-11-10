import { performance } from "node:perf_hooks";
import { scrubMentions } from "../../src/utils/mentionScrubber.js";
import { calculateStats } from "../utils/stats.js";
import type { BenchmarkMetric } from "../types.js";

/**
 * Suite 2: Mention Scrubber Throughput
 * Target: < 1.0 ms execution latency per 10KB message; > 10 MB/s throughput.
 * Scenario: Scrub 10,000-character payload containing dense regex patterns,
 * role mentions, and @everyone.
 */
export const runSuite2 = async (): Promise<BenchmarkMetric> => {
  const ITERATIONS = 1000;
  const TARGET_BYTES = 10 * 1024; // 10,240 bytes (10KB)

  // Construct dense 10KB text containing mixed mentions
  const chunk =
    "Alert @everyone and @here! Role <@&111222333444555666> and <@&999888777666555444> inspect now! ";
  let text = "";
  while (Buffer.byteLength(text, "utf8") < TARGET_BYTES) {
    text += chunk;
  }
  text = text.slice(0, TARGET_BYTES);

  const payload = {
    content: text.slice(0, 5120),
    embeds: [{ description: text.slice(5120, 10240) }],
  };

  const perms = {
    can_mention_everyone: 0,
    can_mention_here: 0,
    can_mention_roles: 0,
    allowed_role_mention_ids: "[]",
  };

  // Warmup
  for (let i = 0; i < 50; i++) scrubMentions(payload, perms);

  const latencies: number[] = [];
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    scrubMentions(payload, perms);
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }
  const elapsed = performance.now() - start;

  const stats = calculateStats(latencies);
  const totalMB = (TARGET_BYTES * ITERATIONS) / (1024 * 1024);
  const throughputMBs = totalMB / (elapsed / 1000);
  const passed = stats.p95 < 1.0 && throughputMBs > 10.0;

  return {
    name: "Suite 2: Mention Scrubber Throughput",
    iterations: ITERATIONS,
    minMs: stats.min,
    avgMs: stats.avg,
    p95Ms: stats.p95,
    p99Ms: stats.p99,
    maxMs: stats.max,
    throughputMBs,
    passed,
    targetDescription: "< 1.0 ms latency, > 10.0 MB/s throughput",
  };
};
