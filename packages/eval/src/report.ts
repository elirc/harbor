/**
 * Cost/latency reporting (S09). 📘 Cost is a first-class metric from the FIRST eval, not an afterthought. Every
 * run reports tokens spent as dollars per case and p95 latency, so a quality win that triples cost shows up as
 * a tradeoff to weigh — reviewed like a latency regression — instead of a surprise on next month's invoice.
 */
import type { RunSummary } from "./types";

export function formatReport(run: RunSummary): string {
  const lines = [
    `eval: ${run.dataset}`,
    `  cases:        ${run.cases.length}`,
    `  mean score:   ${(run.meanScore * 100).toFixed(1)}%`,
    `  pass rate:    ${(run.passRate * 100).toFixed(1)}%`,
    `  cost/case:    $${run.costPerCaseUsd.toFixed(5)}`,
    `  total cost:   $${run.totalCostUsd.toFixed(4)}`,
    `  p95 latency:  ${run.p95LatencyMs.toFixed(0)}ms`,
  ];
  return lines.join("\n");
}
