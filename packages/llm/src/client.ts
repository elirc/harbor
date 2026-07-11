import type { CompleteRequest, CompleteResponse, LlmProvider, LlmCall } from "./types";
import { costUsd } from "./pricing";

/**
 * The LLM client (S01) — wraps a provider and LOGS EVERY CALL to the cost ledger. Nothing calls a model
 * directly; everything goes through here, so there is no un-metered LLM call anywhere in Harbor.
 *
 * 🔗 The append-only cost ledger is wired before there's a bill to explain. When someone asks "why is the AI
 * spend $4k this month," the answer is a query over LlmCall — grouped by purpose, by model, by day. Cost is a
 * metric you design in, not one you reconstruct after a surprise invoice.
 */
export class LlmClient {
  constructor(
    private readonly provider: LlmProvider,
    /** Where LlmCall rows go (an in-memory array in tests; the LLMCall table in prod). */
    private readonly sink: (call: LlmCall) => void,
    private readonly now: () => number = Date.now,
  ) {}

  async complete(req: CompleteRequest, purpose: string): Promise<CompleteResponse> {
    const start = this.now();
    const res = await this.provider.complete(req);
    this.sink({
      model: req.model,
      inputTokens: res.usage.inputTokens,
      outputTokens: res.usage.outputTokens,
      costUsd: costUsd(req.model, res.usage),
      latencyMs: this.now() - start,
      purpose,
      at: start,
    });
    return res;
  }
}

/** A simple in-memory ledger for tests/dev — sums cost, groups by purpose. */
export class MemoryLedger {
  readonly calls: LlmCall[] = [];
  record = (call: LlmCall): void => {
    this.calls.push(call);
  };
  get totalCostUsd(): number {
    return this.calls.reduce((s, c) => s + c.costUsd, 0);
  }
  costByPurpose(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const c of this.calls) out[c.purpose] = (out[c.purpose] ?? 0) + c.costUsd;
    return out;
  }
}
