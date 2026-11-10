export interface BenchmarkMetric {
  name: string;
  iterations: number;
  minMs: number;
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  opsPerSec?: number;
  throughputMBs?: number;
  memoryDeltaMB?: number;
  retainedClosures?: number;
  passed: boolean;
  targetDescription: string;
}

export interface BenchmarkSuiteResult {
  suite1: BenchmarkMetric;
  suite2: BenchmarkMetric;
  suite3: BenchmarkMetric;
  suite4: BenchmarkMetric;
  timestamp: string;
  overallPassed: boolean;
  nodeVersion: string;
  platform: string;
}
