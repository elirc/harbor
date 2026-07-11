import { describe, it, expect } from "vitest";
import { parseDataset } from "./dataset";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("dataset validation (S09)", () => {
  it("parses the committed intent-smoke dataset", () => {
    const path = fileURLToPath(new URL("../../../docs/evals/intent-smoke.dataset.json", import.meta.url));
    const d = parseDataset(JSON.parse(readFileSync(path, "utf8")));
    expect(d.name).toBe("intent-smoke");
    expect(d.cases.length).toBeGreaterThan(0);
    expect(d.cases.every((c) => c.id && typeof c.input === "string")).toBe(true);
  });

  it("rejects a malformed dataset at the boundary", () => {
    expect(() => parseDataset({ name: "x", cases: [] })).toThrow(); // needs ≥1 case
    expect(() => parseDataset({ cases: [{ id: "1", input: "a" }] })).toThrow(); // missing name
    expect(() => parseDataset({ name: "x", cases: [{ input: "a" }] })).toThrow(); // case missing id
  });
});
