import { describe, it, expect } from "vitest";
import { MockEmbedder, cosineSimilarity, tokenize, l2normalize } from "./embed";

describe("mock embedder (S10)", () => {
  const e = new MockEmbedder(64);

  it("is deterministic and unit-normalized", () => {
    const a = e.embed("reset your password");
    const b = e.embed("reset your password");
    expect(a).toEqual(b); // same text → same vector, every run
    expect(cosineSimilarity(a, a)).toBeCloseTo(1); // normalized → self-similarity 1
  });

  it("captures lexical overlap: related text is closer than unrelated", () => {
    const query = e.embed("how long does the password reset link last");
    const relevant = e.embed("the password reset link expires after one hour");
    const unrelated = e.embed("enable two factor authentication in settings");
    expect(cosineSimilarity(query, relevant)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  });

  it("tokenize drops stopwords and short tokens", () => {
    expect(tokenize("How do I reset my Password?")).toEqual(["reset", "password"]);
  });

  it("l2normalize handles the zero vector without NaN", () => {
    expect(l2normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });
});
