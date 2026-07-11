import { describe, it, expect } from "vitest";
import { runEval } from "./runner";
import type { Grader, EvalDataset, Target } from "./types";
import { isRefusal, refusalRate, detectDrift, type QualitySnapshot } from "@harbor/shared";

/**
 * THE INCIDENT DRILL (S15). We inject a retrieval regression (the embedding index is "broken," so retrieval
 * returns nothing relevant and the bot refuses everything) and prove the eval harness catches it: refusal rate
 * spikes, the drift alert fires, and on-call is paged — BEFORE an angry customer tweet. The S09 harness, built
 * for CI, is here the production smoke detector. This is the spine of the whole course paying off one last time.
 */
const answerable: EvalDataset = {
  name: "prod-sample",
  cases: [
    { id: "q1", input: "how do I reset my password", expected: "answer" },
    { id: "q2", input: "how do I enable 2fa", expected: "answer" },
    { id: "q3", input: "how do I update billing", expected: "answer" },
    { id: "q4", input: "how do I export data", expected: "answer" },
  ],
};

// Healthy bot: grounds and answers the answerable questions.
const healthyBot: Target = (input) => Promise.resolve({ output: `Here's how: … [1]`, costUsd: 0.01, latencyMs: 700, __ans: input } as never);
// Regressed bot: the index is broken, retrieval finds nothing, so it refuses everything.
const regressedBot: Target = () => Promise.resolve({ output: "I don't know.", costUsd: 0.002, latencyMs: 700 });

const refusalGrader: Grader = (output, c) => {
  const shouldRefuse = c.expected === "refuse";
  const ok = shouldRefuse === isRefusal(output);
  return { score: ok ? 1 : 0, pass: ok };
};

describe("incident drill: retrieval regression caught by the eval (S15)", () => {
  it("healthy: the answerable sample passes; regressed: it collapses", async () => {
    const healthy = await runEval(answerable, healthyBot, { refusal: refusalGrader });
    const regressed = await runEval(answerable, regressedBot, { refusal: refusalGrader });
    expect(healthy.passRate).toBe(1); // all answered
    expect(regressed.passRate).toBe(0); // all refused when they shouldn't be
  });

  it("the refusal-rate spike trips the drift alert (the smoke detector)", async () => {
    const regressed = await runEval(answerable, regressedBot, { refusal: refusalGrader });
    // Every answerable case was refused → refusal rate ~1.0 on this sample.
    const liveRefusal = refusalRate(regressed.cases.map((c) => ({ refused: isRefusal(c.output) })));
    expect(liveRefusal).toBe(1);

    const baseline: QualitySnapshot = { groundedness: 0.9, refusalRate: 0.15, p95LatencyMs: 800 };
    const current: QualitySnapshot = { groundedness: 0.5, refusalRate: liveRefusal, p95LatencyMs: 800 };
    const alerts = detectDrift(baseline, current);
    expect(alerts.some((a) => a.metric === "refusalRate")).toBe(true); // on-call is paged
    expect(alerts.some((a) => a.metric === "groundedness")).toBe(true);
  });
});
