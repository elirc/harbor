import { describe, it, expect } from "vitest";
import { runEval } from "./runner";
import { exactMatch, contains } from "./graders";
import { checkRegression, toBaseline } from "./regression";
import type { EvalDataset, Target } from "./types";

const dataset: EvalDataset = {
  name: "intent-smoke",
  cases: [
    { id: "1", input: "billing question", expected: "billing" },
    { id: "2", input: "how do I integrate", expected: "technical" },
    { id: "3", input: "cancel my plan", expected: "billing" },
  ],
};

// A stub "classifier": right on 1 & 3, wrong on 2. Carries cost + latency like the real LLM client would.
const target: Target = (input) =>
  Promise.resolve({
    output: input.includes("integrate") ? "billing" /* wrong */ : "billing",
    costUsd: 0.0002,
    latencyMs: input.length,
  });

describe("runEval (S09)", () => {
  it("scores every case with every grader and aggregates cost/latency", async () => {
    const run = await runEval(dataset, target, { exact: exactMatch(), has: contains() });
    expect(run.cases).toHaveLength(3);
    // cases 1 & 3 expect "billing" (correct); case 2 expects "technical" (target said "billing" → wrong)
    expect(run.cases[0].scores.exact.pass).toBe(true);
    expect(run.cases[1].scores.exact.pass).toBe(false);
    expect(run.meanScore).toBeCloseTo((1 + 0 + 1) / 3);
    expect(run.passRate).toBeCloseTo(2 / 3);
    expect(run.totalCostUsd).toBeCloseTo(0.0006);
    expect(run.costPerCaseUsd).toBeCloseTo(0.0002);
    expect(run.p95LatencyMs).toBeGreaterThan(0);
  });
});

describe("regression gate (S09)", () => {
  it("passes when score holds and fails when it regresses beyond tolerance", async () => {
    const run = await runEval(dataset, target, { exact: exactMatch() });
    const baseline = toBaseline(run); // freeze current as baseline

    // Same run vs its own baseline → no regression.
    expect(checkRegression(run, baseline).pass).toBe(true);

    // A worse run (all wrong) → score drops, gate fails with a reason.
    const worse = await runEval(dataset, () => Promise.resolve({ output: "nope", costUsd: 0.0002, latencyMs: 1 }), { exact: exactMatch() });
    const gate = checkRegression(worse, baseline);
    expect(gate.pass).toBe(false);
    expect(gate.reasons[0]).toContain("score regressed");
  });

  it("flags a cost blow-up even when quality holds", async () => {
    const cheap = await runEval(dataset, () => Promise.resolve({ output: "billing", costUsd: 0.0001, latencyMs: 1 }), { exact: exactMatch() });
    const baseline = toBaseline(cheap);
    const pricey = await runEval(dataset, () => Promise.resolve({ output: "billing", costUsd: 0.001, latencyMs: 1 }), { exact: exactMatch() });
    const gate = checkRegression(pricey, baseline);
    expect(gate.pass).toBe(false);
    expect(gate.reasons.some((r) => r.includes("cost/case up"))).toBe(true);
  });
});
