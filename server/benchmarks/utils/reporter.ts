import type { BenchmarkSuiteResult, BenchmarkMetric } from "../types.js";

export const printAsciiTable = (res: BenchmarkSuiteResult) => {
  console.log("\n------------------------------------------------------------------------------------------");
  console.log(
    "Suite Name                                | Iterations | P95 Latency | Throughput    | Memory Δ  | Status",
  );
  console.log("------------------------------------------------------------------------------------------");

  const formatRow = (m: BenchmarkMetric) => {
    const name = m.name.padEnd(42, " ");
    const iter = String(m.iterations).padStart(10, " ");
    const p95 = m.p95Ms > 0 ? `${m.p95Ms.toFixed(3)} ms`.padStart(11, " ") : "    N/A    ";
    let tp = "    N/A     ";
    if (m.opsPerSec) tp = `${Math.round(m.opsPerSec).toLocaleString()} ops/s`.padStart(14, " ");
    if (m.throughputMBs) tp = `${m.throughputMBs.toFixed(2)} MB/s`.padStart(14, " ");
    const mem = m.memoryDeltaMB !== undefined ? `${m.memoryDeltaMB.toFixed(2)} MB`.padStart(9, " ") : "   N/A   ";
    const status = m.passed ? "✅ PASS" : "❌ FAIL";
    return `${name} | ${iter} | ${p95} | ${tp} | ${mem} | ${status}`;
  };

  console.log(formatRow(res.suite1));
  console.log(formatRow(res.suite2));
  console.log(formatRow(res.suite3));
  console.log(formatRow(res.suite4));
  console.log("------------------------------------------------------------------------------------------");
  console.log(
    res.overallPassed
      ? "🎯 ALL BENCHMARK ASSERTION GATES PASSED (4/4)"
      : "⚠️ ONE OR MORE BENCHMARK ASSERTION GATES FAILED",
  );
  console.log("------------------------------------------------------------------------------------------\n");
};

export const outputJsonReport = (res: BenchmarkSuiteResult) => {
  console.log(JSON.stringify(res, null, 2));
};
