import { performance } from "node:perf_hooks";
import { selectBranch, hasBranches, type ExecutableStep } from "../../src/services/branches.js";
import { getActionHandler } from "../../src/actions/index.js";
import { calculateStats } from "../utils/stats.js";
import type { BenchmarkMetric } from "../types.js";

/**
 * Suite 1: Action Flow Execution Latency
 * Target: < 2.0 ms per flow execution.
 * Scenario: Execute 1,000 synthetic flows containing nested `check` and
 * `set_variable` chains up to depth 10.
 */
export const runSuite1 = async (): Promise<BenchmarkMetric> => {
  const MAX_DEPTH = 10;
  const ITERATIONS = 1000;

  // Build recursive AST up to depth 10
  const buildDeepFlow = (depth: number, max: number): ExecutableStep[] => {
    if (depth > max) {
      return [
        {
          id: depth,
          type: "set_variable",
          config: { name: "flow_complete", varType: "static", value: "true" },
        },
      ];
    }
    return [
      {
        id: depth,
        type: "set_variable",
        config: { name: `step_var_${depth}`, varType: "static", value: `step_val_${depth}` },
      },
      {
        id: depth,
        type: "check",
        config: {
          left: `{{step_var_${depth}}}`,
          op: "==",
          right: `step_val_${depth}`,
          then: buildDeepFlow(depth + 1, max),
          else: [],
        },
      },
    ];
  };

  const syntheticSteps = buildDeepFlow(1, MAX_DEPTH);

  // Flow runner executing branching recursion
  const executeSteps = async (
    steps: ExecutableStep[],
    depth: number,
    variables: Record<string, unknown>,
  ): Promise<void> => {
    if (depth > MAX_DEPTH) return;

    for (const step of steps) {
      if (step.type === "check" && hasBranches(step.config)) {
        const { pass, fail, then: thenBranch, else: elseBranch, ...condOnly } = step.config;
        const leftResolved = String(condOnly.left ?? "").replace(
          /\{{1,2}\s*([^{}]+?)\s*\}{1,2}/g,
          (_, k) => String(variables[k.trim()] ?? ""),
        );
        const branch = selectBranch(
          { ...condOnly, left: leftResolved, pass, fail, then: thenBranch, else: elseBranch },
          variables,
        );
        await executeSteps(branch, depth + 1, variables);
        continue;
      }

      const handler = getActionHandler(step.type);
      if (handler) {
        await handler.run({
          config: step.config,
          variables,
          interaction: {} as any,
          botToken: null,
          discord: {} as any,
          repositories: {} as any,
          logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
        });
      }
    }
  };

  // Warmup
  for (let i = 0; i < 50; i++) {
    const vars: Record<string, unknown> = {};
    await executeSteps(syntheticSteps, 0, vars);
  }

  // Metered execution
  const latencies: number[] = [];
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const vars: Record<string, unknown> = {};
    const t0 = performance.now();
    await executeSteps(syntheticSteps, 0, vars);
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }
  const elapsed = performance.now() - start;

  const stats = calculateStats(latencies);
  const opsPerSec = (ITERATIONS / elapsed) * 1000;
  const passed = stats.p95 < 2.0 && stats.avg < 2.0;

  return {
    name: "Suite 1: Action Flow Execution Latency",
    iterations: ITERATIONS,
    minMs: stats.min,
    avgMs: stats.avg,
    p95Ms: stats.p95,
    p99Ms: stats.p99,
    maxMs: stats.max,
    opsPerSec,
    passed,
    targetDescription: "< 2.0 ms per flow execution (depth 10)",
  };
};
