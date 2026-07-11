/**
 * Model selection by task (S12). 📘 Cost engineering starts with the model choice: don't pay Opus prices to
 * classify an intent. High-volume, low-nuance tasks (triage, rerank) run on the cheap+fast model; the
 * user-facing generated answer — where quality is worth more — gets a stronger one. Every choice is a
 * cost/quality decision measured against the eval's $/answer budget, never a default.
 *
 * (The other big $/answer lever is PROMPT CACHING the stable prefix — system prompt + retrieved context — so
 * repeated calls pay ~0.1× for the cached tokens. That's a claude-api `cache_control` concern applied where the
 * real client is wired; here we record the model-selection half.)
 */
import { MODEL_PRICING } from "./pricing";

export type Task = "classify" | "rerank" | "generate";

export function selectModel(task: Task): string {
  switch (task) {
    case "classify":
    case "rerank":
      return "claude-haiku-4-5"; // cheap + fast at scale
    case "generate":
      return "claude-sonnet-5"; // the customer-facing answer earns a stronger model
  }
}

/** A hard per-answer output cap, so a runaway generation can't blow the token budget. */
export const MAX_ANSWER_TOKENS = 400;

/** Rough $/answer estimate for a task at a given token shape — used to check against the eval's cost gate. */
export function estimateAnswerCostUsd(task: Task, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[selectModel(task)] ?? MODEL_PRICING["mock-model"]!;
  return (inputTokens / 1_000_000) * p.inPerM + (outputTokens / 1_000_000) * p.outPerM;
}
