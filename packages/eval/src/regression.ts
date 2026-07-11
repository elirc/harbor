/**
 * The regression gate (S09). This is what turns "AI quality" into a CI CHECK, exactly like a test. A PR that
 * drops the eval score beyond tolerance fails, the same way a PR that breaks a unit test fails.
 *
 * 🔗 Each course makes its crown property a permanent CI citizen: Tracer's convergence tests, Pulse's
 * loss-accounting, and here — answer quality. A number in a committed baseline is the only thing that makes
 * "did this prompt change help or hurt?" answerable instead of a matter of opinion.
 */
import type { RunSummary } from "./types";

export interface Baseline {
  dataset: string;
  meanScore: number;
  passRate: number;
  costPerCaseUsd: number;
}

export interface GateResult {
  pass: boolean;
  scoreDelta: number;
  costDelta: number;
  reasons: string[];
}

/**
 * Compare a run to its committed baseline. A score drop beyond `tolerance` fails the gate. A cost INCREASE
 * beyond `costTolerance` is reported (and can fail) too — 📘 a quality win that triples cost is a tradeoff to
 * review, not a silent victory. Score *improvements* never fail; they mean it's time to update the baseline.
 */
export function checkRegression(current: RunSummary, baseline: Baseline, tolerance = 0.02, costTolerance = 0.25): GateResult {
  const scoreDelta = current.meanScore - baseline.meanScore;
  const costDelta = baseline.costPerCaseUsd > 0 ? (current.costPerCaseUsd - baseline.costPerCaseUsd) / baseline.costPerCaseUsd : 0;
  const reasons: string[] = [];

  if (scoreDelta < -tolerance) {
    reasons.push(`score regressed ${(scoreDelta * 100).toFixed(1)}pts (baseline ${baseline.meanScore.toFixed(3)} → ${current.meanScore.toFixed(3)}, tolerance ${tolerance})`);
  }
  if (costDelta > costTolerance) {
    reasons.push(`cost/case up ${(costDelta * 100).toFixed(0)}% (baseline $${baseline.costPerCaseUsd.toFixed(5)} → $${current.costPerCaseUsd.toFixed(5)}) — review the tradeoff`);
  }
  return { pass: reasons.length === 0, scoreDelta, costDelta, reasons };
}

/** Freeze a run as the new committed baseline (written to docs/evals/*.baseline.json in the real workflow). */
export function toBaseline(run: RunSummary): Baseline {
  return { dataset: run.dataset, meanScore: run.meanScore, passRate: run.passRate, costPerCaseUsd: run.costPerCaseUsd };
}
