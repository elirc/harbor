/**
 * The LLM provider abstraction (S01) — deliberately built on DAY ONE, before any AI feature exists.
 *
 * 📘 ABSTRACTION BEFORE USE. Seams are cheapest to cut before there's anything to cut through. By defining
 * `LlmProvider` now, every later AI sprint (triage S11, answer-bot S12) is *configuration* — swap the mock
 * for the real Claude client — not a rewrite. And because the interface MIRRORS the Claude Messages API
 * (role/content messages, a system prompt, max tokens, token usage, a stop reason), adopting the real SDK in
 * S10+ is a wiring change, not a redesign. (Consult the `claude-api` skill before touching real LLM code.)
 */

export type Role = "user" | "assistant";

export interface LlmMessage {
  role: Role;
  content: string;
}

export interface CompleteRequest {
  model: string;
  system?: string;
  messages: LlmMessage[];
  maxTokens: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompleteResponse {
  text: string;
  usage: Usage;
  stopReason: "end_turn" | "max_tokens" | "stop";
}

/** Any model backend — the mock (tests/CI) or the real Claude client (prod) — implements this. */
export interface LlmProvider {
  complete(req: CompleteRequest): Promise<CompleteResponse>;
}

/**
 * An append-only record of ONE model call — the cost ledger's row. 🔗 "Why is the AI bill $4k?" is
 * answerable only if every call is logged with its tokens, cost, and latency from day one. This is Harbor's
 * cost-as-a-metric thesis, wired before there's a bill to explain.
 */
export interface LlmCall {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  /** A coarse label for what the call was for (triage, bot-draft, …) — set by the caller. */
  purpose: string;
  at: number;
}
