import { describe, it, expect } from "vitest";
import { vectorTopK, reciprocalRankFusion, recallAtK, reciprocalRank, meanReciprocalRank, type VectorDoc } from "./retrieve";
import { MockEmbedder } from "./embed";

describe("vector top-k (S10)", () => {
  const e = new MockEmbedder(64);
  const corpus: VectorDoc[] = [
    { id: "reset", vector: e.embed("reset your password from the login screen") },
    { id: "2fa", vector: e.embed("enable two factor authentication in security settings") },
    { id: "billing", vector: e.embed("update your billing card and view invoices") },
  ];

  it("ranks the most similar chunk first", () => {
    const q = e.embed("I forgot my password, how do I reset it");
    const top = vectorTopK(q, corpus, 2);
    expect(top[0].id).toBe("reset");
    expect(top).toHaveLength(2);
  });
});

describe("reciprocal rank fusion (S10)", () => {
  it("rewards ids ranked well by BOTH lists over an id ranked well by one", () => {
    const vector = ["a", "b", "c"];
    const fts = ["b", "a", "d"];
    const fused = reciprocalRankFusion([vector, fts]);
    // 'a' (ranks 1,2) and 'b' (ranks 2,1) both appear high in both → they top the fused list
    expect(fused.slice(0, 2).map((s) => s.id).sort()).toEqual(["a", "b"]);
    // 'c' and 'd' each appear in only one list → below the consensus pair
    expect(fused[0].score).toBeGreaterThan(fused[2].score);
  });
});

describe("retrieval metrics (S10)", () => {
  it("recall@k = fraction of relevant found in top-k", () => {
    const relevant = new Set(["x", "y"]);
    expect(recallAtK(["x", "z", "y"], relevant, 3)).toBe(1);
    expect(recallAtK(["x", "z", "w"], relevant, 3)).toBe(0.5);
    expect(recallAtK(["z", "w", "x"], relevant, 2)).toBe(0); // relevant not in top-2
  });

  it("reciprocal rank = 1/rank of first hit; MRR averages it", () => {
    expect(reciprocalRank(["a", "hit", "b"], new Set(["hit"]))).toBe(0.5);
    expect(reciprocalRank(["a", "b"], new Set(["none"]))).toBe(0);
    const mrr = meanReciprocalRank([
      { retrieved: ["hit", "a"], relevant: new Set(["hit"]) }, // 1
      { retrieved: ["a", "hit"], relevant: new Set(["hit"]) }, // 1/2
    ]);
    expect(mrr).toBe(0.75);
  });
});
