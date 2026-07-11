import { describe, it, expect } from "vitest";
import { chunksToReEmbed, batches } from "./reembed";

describe("re-embedding migration (S10)", () => {
  it("selects chunks whose model differs from the current one (or is missing)", () => {
    const chunks = [
      { id: "a", embeddingModel: "mock-hash-v1" },
      { id: "b", embeddingModel: "old-model" },
      { id: "c", embeddingModel: null }, // never embedded
      { id: "d", embeddingModel: "mock-hash-v1" },
    ];
    expect(chunksToReEmbed(chunks, "mock-hash-v1")).toEqual(["b", "c"]);
  });

  it("batches the backlog for an incremental migration", () => {
    expect(batches(["1", "2", "3", "4", "5"], 2)).toEqual([["1", "2"], ["3", "4"], ["5"]]);
    expect(batches([], 10)).toEqual([]);
  });
});
