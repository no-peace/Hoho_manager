export const calculateStats = (samples: number[]) => {
  if (samples.length === 0) {
    return { min: 0, avg: 0, p95: 0, p99: 0, max: 0, total: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const total = sorted.reduce((sum, val) => sum + val, 0);
  const avg = total / sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { min, avg, p95, p99, max, total };
};
