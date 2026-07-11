/**
 * Production observability + governance (S15). AI features have a *runtime bill* and a *quality that drifts* —
 * ops must watch both like error rate. This is the pure core: LLM-spend aggregation (the S01 LLMCall ledger
 * finally pays off), per-workspace budgets with graceful degradation, and drift detection (the S09 graders,
 * now watching production traffic). *Shipping AI responsibly means the eval never stops running.*
 */

// ── LLM spend + latency aggregation (from the cost ledger) ──────────────────────────────────────────
export interface LlmSpan {
  purpose: string;
  costUsd: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

/** $/window grouped by feature (purpose). "Why is the AI bill $4k?" answered — grouped by what it was for. */
export function costByPurpose(spans: readonly LlmSpan[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of spans) out[s.purpose] = (out[s.purpose] ?? 0) + s.costUsd;
  return out;
}

export function totalCostUsd(spans: readonly LlmSpan[]): number {
  return spans.reduce((sum, s) => sum + s.costUsd, 0);
}

export function p95LatencyMs(spans: readonly LlmSpan[]): number {
  if (spans.length === 0) return 0;
  const sorted = spans.map((s) => s.latencyMs).sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
}

/**
 * 🔍 Refusal rate is a PRODUCT-HEALTH metric, not a bot-behavior one. A rising refusal rate usually means
 * retrieval broke or content is missing — the metric points at the real cause. Watch it like an error rate.
 */
export function refusalRate(botActions: ReadonlyArray<{ refused: boolean }>): number {
  if (botActions.length === 0) return 0;
  return botActions.filter((a) => a.refused).length / botActions.length;
}

// ── Per-workspace budget governance ─────────────────────────────────────────────────────────────────
export interface Budget {
  softAlertUsd: number;
  hardCapUsd: number;
}
export type BudgetState = "ok" | "alert" | "capped";

/**
 * 🔗 Quota discipline (Relay/Pulse). A soft alert warns; the hard cap stops spend. Hitting the cap degrades to
 * HUMAN-ONLY support — never a crash, never a surprise bill.
 */
export function budgetState(spentUsd: number, budget: Budget): BudgetState {
  if (spentUsd >= budget.hardCapUsd) return "capped";
  if (spentUsd >= budget.softAlertUsd) return "alert";
  return "ok";
}

// ── Graceful degradation: AI is an enhancement over a working human system ──────────────────────────
export type AiMode = "on" | "degraded_human_only";
export interface AiAvailability {
  mode: AiMode;
  reason: string | null;
}

/**
 * 📘 AI is an enhancement over the S04 human inbox, which still works. When the provider is down or the budget
 * is capped, the bot disables cleanly and conversations route to humans — a support tool whose *core* depends
 * on an LLM being up is mis-architected.
 */
export function aiAvailability(providerUp: boolean, budget: BudgetState): AiAvailability {
  if (!providerUp) return { mode: "degraded_human_only", reason: "LLM provider unavailable — routing to humans" };
  if (budget === "capped") return { mode: "degraded_human_only", reason: "workspace LLM budget capped — human-only until reset" };
  return { mode: "on", reason: null };
}

// ── Drift detection: the graders watch production ───────────────────────────────────────────────────
export interface QualitySnapshot {
  groundedness: number; // 0..1, from sampling live conversations through the S09 graders
  refusalRate: number;
  p95LatencyMs: number;
}

export interface DriftAlert {
  metric: "groundedness" | "refusalRate" | "latency";
  baseline: number;
  current: number;
  message: string;
}

/**
 * Compare a live-traffic snapshot to a committed baseline and page on-call for material deviations. 📘 Models
 * and data shift under you; the graders are the smoke detector that catches a silent regression before an angry
 * customer tweet does. (A DROP in groundedness or a SPIKE in refusal rate / latency is the signal.)
 */
export function detectDrift(baseline: QualitySnapshot, current: QualitySnapshot, tol = { groundedness: 0.05, refusalRate: 0.1, latency: 1.5 }): DriftAlert[] {
  const alerts: DriftAlert[] = [];
  if (baseline.groundedness - current.groundedness > tol.groundedness) {
    alerts.push({ metric: "groundedness", baseline: baseline.groundedness, current: current.groundedness, message: `groundedness dropped ${((baseline.groundedness - current.groundedness) * 100).toFixed(1)}pts — check retrieval/index` });
  }
  if (current.refusalRate - baseline.refusalRate > tol.refusalRate) {
    alerts.push({ metric: "refusalRate", baseline: baseline.refusalRate, current: current.refusalRate, message: `refusal rate spiked ${((current.refusalRate - baseline.refusalRate) * 100).toFixed(0)}pts — retrieval broke or content gap` });
  }
  if (baseline.p95LatencyMs > 0 && current.p95LatencyMs > baseline.p95LatencyMs * tol.latency) {
    alerts.push({ metric: "latency", baseline: baseline.p95LatencyMs, current: current.p95LatencyMs, message: `p95 latency up ${((current.p95LatencyMs / baseline.p95LatencyMs - 1) * 100).toFixed(0)}% — provider slow or prompt bloat` });
  }
  return alerts;
}
