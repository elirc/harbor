import { describe, it, expect } from "vitest";
import { MockModel, promptHash } from "./mock";
import { LlmClient, MemoryLedger } from "./client";
import { costUsd, DEFAULT_MODEL } from "./pricing";
import type { CompleteRequest } from "./types";

const req = (content: string): CompleteRequest => ({
  model: "mock-model",
  system: "You are a support agent.",
  messages: [{ role: "user", content }],
  maxTokens: 256,
});

describe("mock model (S01) — deterministic, never a live call", () => {
  it("returns a registered fixture for a matching request", async () => {
    const m = new MockModel();
    m.register(req("refund please"), "I can help with your refund.");
    const res = await m.complete(req("refund please"));
    expect(res.text).toBe("I can help with your refund.");
  });

  it("the SAME prompt always yields the SAME output (deterministic)", async () => {
    const m = new MockModel();
    const a = await m.complete(req("hello"));
    const b = await m.complete(req("hello"));
    expect(a.text).toBe(b.text);
  });

  it("promptHash is stable and distinguishes different prompts", () => {
    expect(promptHash(req("x"))).toBe(promptHash(req("x")));
    expect(promptHash(req("x"))).not.toBe(promptHash(req("y")));
  });
});

describe("cost ledger (S01) — every call is metered", () => {
  it("LlmClient logs an LlmCall on every completion", async () => {
    const ledger = new MemoryLedger();
    const client = new LlmClient(new MockModel(), ledger.record, () => 1000);
    await client.complete(req("triage this"), "triage");
    expect(ledger.calls).toHaveLength(1);
    expect(ledger.calls[0]!.purpose).toBe("triage");
    expect(ledger.calls[0]!.inputTokens).toBeGreaterThan(0);
  });

  it("groups spend by purpose (the $/action answer)", async () => {
    const ledger = new MemoryLedger();
    const client = new LlmClient(new MockModel(), ledger.record);
    await client.complete(req("a"), "triage");
    await client.complete(req("b"), "triage");
    await client.complete(req("c"), "bot-draft");
    expect(Object.keys(ledger.costByPurpose()).sort()).toEqual(["bot-draft", "triage"]);
  });

  it("cost scales with tokens and model rate", () => {
    const cheap = costUsd("claude-haiku-4-5", { inputTokens: 1_000_000, outputTokens: 0 });
    const dear = costUsd("claude-opus-4-8", { inputTokens: 1_000_000, outputTokens: 0 });
    expect(dear).toBeGreaterThan(cheap); // model choice is a cost decision
    expect(costUsd("mock-model", { inputTokens: 9_999, outputTokens: 9_999 })).toBe(0); // CI is free
  });

  it("the default model is a cost-conscious choice", () => {
    expect(DEFAULT_MODEL).toBe("claude-haiku-4-5");
  });
});
