import { runSuite1 } from "./suites/suite1_flow_latency.js";
import { runSuite2 } from "./suites/suite2_mention_scrubber.js";
import { runSuite3 } from "./suites/suite3_interpolation.js";
import { runSuite4 } from "./suites/suite4_memory_retention.js";
import { printAsciiTable, outputJsonReport } from "./utils/reporter.js";
import type { BenchmarkSuiteResult } from "./types.js";

const main = async () => {
  const isJson = process.argv.includes("--json");

  if (!isJson) {
    console.log("==========================================================================================");
    console.log("                HOHO MANAGER AUTOMATED PERFORMANCE BENCHMARK SUITE (R5.6)");
    console.log("==========================================================================================");
    if (!global.gc) {
      console.warn("⚠️  Node was started without --expose-gc. For deterministic Suite 4 heap measurements,");
      console.warn("   run with: node --expose-gc --import tsx server/benchmarks/runner.ts");
    }
  }

  const s1 = await runSuite1();
  const s2 = await runSuite2();
  const s3 = await runSuite3();
  const s4 = await runSuite4();

  const overallPassed = s1.passed && s2.passed && s3.passed && s4.passed;

  const result: BenchmarkSuiteResult = {
    suite1: s1,
    suite2: s2,
    suite3: s3,
    suite4: s4,
    timestamp: new Date().toISOString(),
    overallPassed,
    nodeVersion: process.version,
    platform: process.platform,
  };

  if (isJson) {
    outputJsonReport(result);
  } else {
    printAsciiTable(result);
  }

  process.exit(overallPassed ? 0 : 1);
};

main().catch((err) => {
  console.error("Benchmark runner crashed:", err);
  process.exit(1);
});
