import { describe, it, expect } from "vitest";
import { retrieveRelevant, DEFAULT_RELEVANCE_THRESHOLD } from "./retrieve";
import { MockEmbedder, type Embedder } from "./embed";
import type { VectorDoc } from "./retrieve";

/**
 * The relevance threshold (S12) — harvest of flaw #3, part 2. S10's retrieval always returned top-k; now a
 * below-threshold query reports "no good sources," which is the precondition for the bot to refuse.
 */
const e: Embedder = new MockEmbedder(96);
const corpus: VectorDoc[] = [
  { id: "reset", vector: e.embed("reset your password from the login screen with the forgot password link") },
  { id: "billing", vector: e.embed("update the billing card on file and download past invoices") },
];

describe("retrieveRelevant (S12)", () => {
  it("returns relevant chunks for an on-topic query", () => {
    const r = retrieveRelevant(e.embed("how do I reset my password"), corpus, { minScore: 0.1 });
    expect(r.sufficient).toBe(true);
    expect(r.chunks[0].id).toBe("reset");
  });

  it("reports INSUFFICIENT for an out-of-scope query (the flaw #3 fix)", () => {
    // Nothing in the corpus is about weather; below-threshold → sufficient:false → the bot must refuse.
    const r = retrieveRelevant(e.embed("what is the weather forecast for tokyo tomorrow"), corpus, { minScore: 0.2 });
    expect(r.sufficient).toBe(false);
    expect(r.chunks).toHaveLength(0);
  });

  it("has a sane default threshold", () => {
    expect(DEFAULT_RELEVANCE_THRESHOLD).toBeGreaterThan(0);
    expect(DEFAULT_RELEVANCE_THRESHOLD).toBeLessThan(1);
  });
});
