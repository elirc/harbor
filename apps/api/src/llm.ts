/**
 * The app's LLM client (S10/S11). Everything AI goes through one `LlmClient` so every call is logged to the
 * cost ledger (S01's thesis) — now PERSISTED to the LLMCall table. In dev/CI the provider is the deterministic
 * MockModel; production swaps the real Claude client behind the same `LlmProvider` interface — a wiring change,
 * not a rewrite (ADR-0001). The nightly live-eval is the only place a real model runs; the PR path is the mock.
 */
import { LlmClient, MockModel, type LlmProvider, type LlmCall } from "@harbor/llm";
import { prisma } from "@harbor/db";

function provider(): LlmProvider {
  // if (process.env.ANTHROPIC_API_KEY && process.env.NODE_ENV === "production") return new ClaudeProvider(...);
  return new MockModel();
}

/** Append-only ledger sink: fire-and-forget insert per call. "Why is the AI bill $4k?" is a query over this. */
function persist(call: LlmCall): void {
  void prisma.lLMCall
    .create({ data: { model: call.model, purpose: call.purpose, inputTokens: call.inputTokens, outputTokens: call.outputTokens, costUsd: call.costUsd, latencyMs: call.latencyMs } })
    .catch(() => undefined);
}

export const llm = new LlmClient(provider(), persist);

/**
 * A purpose-bound LlmProvider that routes through the metered client, so helpers like `structuredComplete`
 * (which take a bare provider and may call the model twice) still land every call in the cost ledger.
 */
export function providerFor(purpose: string): LlmProvider {
  return { complete: (req) => llm.complete(req, purpose) };
}
