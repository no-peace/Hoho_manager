import { performance } from "node:perf_hooks";
import { replaceVariables } from "../../src/services/variableInterpolation.js";
import { calculateStats } from "../utils/stats.js";
import type { BenchmarkMetric } from "../types.js";

/**
 * Suite 3: Variable Interpolation Throughput
 * Target: > 10,000 payloads/second.
 * Scenario: Replace 20 template tokens across 10 embeds.
 */
export const runSuite3 = async (): Promise<BenchmarkMetric> => {
  const ITERATIONS = 10000;

  const sampleVariables: Record<string, unknown> = {
    "user.name": "TestPilot",
    "user.id": "123456789012345678",
    "user.mention": "<@123456789012345678>",
    "user.displayname": "Commander Pilot",
    "user.avatar": "https://cdn.discordapp.com/avatars/123/abc.png",
    "user.roles": "<@&111>",
    "user.clantag": "PRO",
    "user.joined": "1 hour ago",
    "user.created": "1 year ago",
    "server.name": "Starship Command",
    "server.id": "999888777666555444",
    "channel.name": "ops-briefing",
    "channel.id": "555666777888999000",
    "channel.mention": "<#555666777888999000>",
    "bot.id": "100000000000000001",
    "bot.mention": "<@100000000000000001>",
    "message.id": "888888888888888888",
    now: "12:00:00",
    "now.time": "12:00:00",
    "now.unix": 1700000000,
  };

  // 10 embeds with 20 template tokens total
  const message20Tokens = {
    content: "Header from {user.name} in {server.name}",
    embeds: [
      { title: "Embed 1 {user.mention}", description: "Time is {now}" },
      { title: "Embed 2 {channel.name}", description: "Channel ID {channel.id}" },
      { title: "Embed 3 {bot.mention}", description: "Bot ID {bot.id}" },
      { title: "Embed 4 {user.displayname}", description: "Clan {user.clantag}" },
      { title: "Embed 5 {user.roles}", description: "Joined {user.joined}" },
      { title: "Embed 6 {user.created}", description: "Message {message.id}" },
      { title: "Embed 7 {server.id}", description: "Avatar {user.avatar}" },
      { title: "Embed 8 {now.time}", description: "Unix {now.unix}" },
      { title: "Embed 9 {user.id}", description: "User ID {user.id}" },
      { title: "Embed 10 {server.name}", description: "Status OK" },
    ],
  };

  // Warmup
  for (let i = 0; i < 500; i++) replaceVariables(message20Tokens, sampleVariables);

  const latencies: number[] = [];
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    replaceVariables(message20Tokens, sampleVariables);
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }
  const elapsed = performance.now() - start;

  const stats = calculateStats(latencies);
  const opsPerSec = (ITERATIONS / elapsed) * 1000;
  const passed = opsPerSec > 10000;

  return {
    name: "Suite 3: Variable Interpolation Throughput",
    iterations: ITERATIONS,
    minMs: stats.min,
    avgMs: stats.avg,
    p95Ms: stats.p95,
    p99Ms: stats.p99,
    maxMs: stats.max,
    opsPerSec,
    passed,
    targetDescription: "> 10,000 payloads/second (10 embeds, 20 tokens)",
  };
};
