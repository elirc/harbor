/**
 * Reporting primitives (S07). The one idea that matters: report **percentiles, not averages**. Pure so the
 * statistics are testable and identical in prod and CI.
 */

/**
 * 📘 The average response time hides the angry tail. If 9 customers wait 1 minute and 1 waits 3 hours, the
 * mean (~19 min) describes no one — the p90 (3 hours) is the customer who's about to churn. Report p50/p90/p95
 * so the tail is visible. 🔗 Pulse's percentile lessons.
 *
 * Nearest-rank method: p-th percentile is the value at ⌈(p/100)·N⌉ in the sorted list (1-indexed).
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const idx = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[idx];
}

export interface Percentiles {
  count: number;
  p50: number;
  p90: number;
  p95: number;
}

export function percentiles(values: readonly number[]): Percentiles {
  return { count: values.length, p50: percentile(values, 50), p90: percentile(values, 90), p95: percentile(values, 95) };
}

/** Tally counts by key (e.g. conversations per agent, volume per channel). */
export function countBy<T>(items: readonly T[], keyOf: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = keyOf(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
