/**
 * The app's LLM client (S10). Everything AI goes through one `LlmClient` so every call is logged to the cost
 * ledger (S01's thesis). In dev/CI the provider is the deterministic MockModel; in production it's swapped for
 * the real Claude client behind the same `LlmProvider` interface — a wiring change, not a rewrite (ADR-0001).
 * The nightly live-eval is the only place a real model runs; the PR path is always the mock.
 */
import { LlmClient, MockModel, MemoryLedger, type LlmProvider } from "@harbor/llm";

export const ledger = new MemoryLedger();

function provider(): LlmProvider {
  // if (process.env.ANTHROPIC_API_KEY && process.env.NODE_ENV === "production") return new ClaudeProvider(...);
  return new MockModel();
}

export const llm = new LlmClient(provider(), ledger.record);
