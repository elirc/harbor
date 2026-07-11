import { describe, it, expect } from "vitest";
import { costByPurpose, totalCostUsd, p95LatencyMs, refusalRate, budgetState, aiAvailability, detectDrift, type LlmSpan, type QualitySnapshot } from "./observability";

const spans: LlmSpan[] = [
  { purpose: "triage", costUsd: 0.001, latencyMs: 100, inputTokens: 50, outputTokens: 20 },
  { purpose: "triage", costUsd: 0.001, latencyMs: 120, inputTokens: 50, outputTokens: 20 },
  { purpose: "bot-draft", costUsd: 0.01, latencyMs: 800, inputTokens: 500, outputTokens: 200 },
];

describe("LLM spend + latency aggregation (S15)", () => {
  it("groups cost by feature and totals it", () => {
    expect(costByPurpose(spans)).toEqual({ triage: 0.002, "bot-draft": 0.01 });
    expect(totalCostUsd(spans)).toBeCloseTo(0.012);
  });
  it("p95 latency", () => {
    expect(p95LatencyMs(spans)).toBe(800);
    expect(p95LatencyMs([])).toBe(0);
  });
  it("refusal rate is a product-health metric", () => {
    expect(refusalRate([{ refused: false }, { refused: true }, { refused: false }, { refused: false }])).toBe(0.25);
    expect(refusalRate([])).toBe(0);
  });
});

describe("budget governance + degradation (S15)", () => {
  const budget = { softAlertUsd: 5, hardCapUsd: 10 };
  it("ok → alert → capped", () => {
    expect(budgetState(2, budget)).toBe("ok");
    expect(budgetState(6, budget)).toBe("alert");
    expect(budgetState(10, budget)).toBe("capped");
  });
  it("degrades to human-only when capped or provider down; on otherwise", () => {
    expect(aiAvailability(true, "ok")).toMatchObject({ mode: "on" });
    expect(aiAvailability(true, "capped").mode).toBe("degraded_human_only");
    expect(aiAvailability(false, "ok").mode).toBe("degraded_human_only"); // provider down
  });
});

describe("drift detection — the graders watch production (S15)", () => {
  const baseline: QualitySnapshot = { groundedness: 0.92, refusalRate: 0.15, p95LatencyMs: 900 };
  it("no alerts when production matches baseline", () => {
    expect(detectDrift(baseline, { groundedness: 0.91, refusalRate: 0.16, p95LatencyMs: 950 })).toEqual([]);
  });
  it("fires on a groundedness drop AND a refusal-rate spike (a retrieval regression)", () => {
    // The incident drill: break the index → groundedness falls, refusals spike.
    const alerts = detectDrift(baseline, { groundedness: 0.70, refusalRate: 0.45, p95LatencyMs: 950 });
    expect(alerts.map((a) => a.metric).sort()).toEqual(["groundedness", "refusalRate"]);
    expect(alerts[0].message).toContain("retrieval");
  });
});
