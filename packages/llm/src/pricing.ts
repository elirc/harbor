import type { Usage } from "./types";

/**
 * Model pricing (S01) — USD per MILLION tokens, input/output. 📘 Cost is a first-class metric in Harbor: a
 * support answer-bot runs at scale, so the model choice is a cost/quality decision, not a default. We keep a
 * table (not a magic number) so a cost regression is reviewable — swap a triage call from a big model to a
 * small one and the $/action drop is visible in the PR.
 *
 * (Illustrative rates for the curriculum. Real rates: see the Anthropic pricing page.)
 */
export const MODEL_PRICING: Record<string, { inPerM: number; outPerM: number }> = {
  "claude-haiku-4-5": { inPerM: 1.0, outPerM: 5.0 }, // the support-bot default: cheap + fast at scale
  "claude-sonnet-5": { inPerM: 3.0, outPerM: 15.0 }, // harder triage / summarization
  "claude-opus-4-8": { inPerM: 15.0, outPerM: 75.0 }, // rarely — only when quality demands it
  "mock-model": { inPerM: 0, outPerM: 0 }, // tests/CI — free, deterministic
};

/** The default model for high-volume support tasks — cost governance starts with the model choice. */
export const DEFAULT_MODEL = "claude-haiku-4-5";

export function costUsd(model: string, usage: Usage): number {
  const p = MODEL_PRICING[model] ?? MODEL_PRICING["mock-model"]!;
  return (usage.inputTokens / 1_000_000) * p.inPerM + (usage.outputTokens / 1_000_000) * p.outPerM;
}
