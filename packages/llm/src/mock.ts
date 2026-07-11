import type { CompleteRequest, CompleteResponse, LlmProvider } from "./types";

/**
 * The mock model (S01) — the reason Harbor's CI is DETERMINISTIC and never makes a live LLM call.
 *
 * 📘 A real model is non-deterministic and costs money; neither belongs in CI. The mock returns a recorded
 * fixture keyed by a hash of the request, so the same prompt always yields the same answer — tests assert
 * behavior, not vibes. Live-Claude runs are a separate, cost-capped nightly (S09), never the PR gate. This is
 * how you test AI features: pin the model's output so the *feature's* logic is what's under test.
 */
export function promptHash(req: CompleteRequest): string {
  const canonical = JSON.stringify({ model: req.model, system: req.system ?? "", messages: req.messages });
  // FNV-1a — deterministic, dependency-free.
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Rough token estimate (~4 chars/token) — enough for cost accounting in tests without a tokenizer dep. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class MockModel implements LlmProvider {
  private readonly fixtures = new Map<string, string>();

  /** Register a canned response for a request (keyed by its hash). */
  register(req: CompleteRequest, response: string): void {
    this.fixtures.set(promptHash(req), response);
  }

  complete(req: CompleteRequest): Promise<CompleteResponse> {
    const key = promptHash(req);
    // A registered fixture, or a deterministic echo so unconfigured prompts are still stable (not random).
    const text = this.fixtures.get(key) ?? `[mock:${key}] ${req.messages.at(-1)?.content ?? ""}`.slice(0, 500);
    const inputTokens = estimateTokens((req.system ?? "") + req.messages.map((m) => m.content).join(" "));
    const outputTokens = estimateTokens(text);
    return Promise.resolve({ text, usage: { inputTokens, outputTokens }, stopReason: "end_turn" });
  }
}
