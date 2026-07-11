/**
 * The eval runner (S09). Target-agnostic: give it a dataset, a `target` function, and a set of named graders,
 * and it produces a `RunSummary` — per-case scores plus aggregate quality, cost, and latency. The same runner
 * grades triage (S11), RAG (S10), and the answer-bot (S12); only the target changes.
 */
import { percentile } from "@harbor/shared";
import type { EvalDataset, Grader, RunSummary, CaseResult, Target } from "./types";

const PASS = 0.7;

export async function runEval(dataset: EvalDataset, target: Target, graders: Record<string, Grader>): Promise<RunSummary> {
  const cases: CaseResult[] = [];

  for (const c of dataset.cases) {
    const { output, costUsd = 0, latencyMs = 0 } = await target(c.input);
    const scores: CaseResult["scores"] = {};
    for (const [name, grader] of Object.entries(graders)) {
      scores[name] = await grader(output, c);
    }
    const values = Object.values(scores).map((s) => s.score);
    const aggregate = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    cases.push({ caseId: c.id, output, scores, aggregate, costUsd, latencyMs });
  }

  const aggregates = cases.map((c) => c.aggregate);
  const meanScore = aggregates.length ? aggregates.reduce((a, b) => a + b, 0) / aggregates.length : 0;
  const passRate = aggregates.length ? cases.filter((c) => c.aggregate >= PASS).length / cases.length : 0;
  const totalCostUsd = cases.reduce((s, c) => s + c.costUsd, 0);

  return {
    dataset: dataset.name,
    cases,
    meanScore,
    passRate,
    totalCostUsd,
    costPerCaseUsd: cases.length ? totalCostUsd / cases.length : 0,
    p95LatencyMs: percentile(cases.map((c) => c.latencyMs), 95),
  };
}
