import { describe, it, expect } from "vitest";
import { percentile, percentiles, countBy } from "./reporting";

describe("percentiles (S07)", () => {
  it("nearest-rank percentile over a small sample", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(xs, 50)).toBe(5);
    expect(percentile(xs, 90)).toBe(9);
    expect(percentile(xs, 100)).toBe(10);
    expect(percentile([], 90)).toBe(0);
  });

  it("the tail the average hides", () => {
    // nine fast, one very slow (minutes)
    const responses = [1, 1, 1, 1, 1, 1, 1, 1, 1, 180];
    const p = percentiles(responses);
    const mean = responses.reduce((a, b) => a + b, 0) / responses.length;
    expect(p.p50).toBe(1); // the typical customer
    expect(p.p90).toBe(1); // still fine at p90 with this sample...
    expect(p.p95).toBe(180); // ...but the p95 is the customer about to churn
    expect(mean).toBeCloseTo(18.9); // the mean describes no actual customer
  });
});

describe("countBy (S07)", () => {
  it("tallies workload per agent", () => {
    const convos = [{ a: "ada" }, { a: "ada" }, { a: "ravi" }, { a: "ada" }];
    expect(countBy(convos, (c) => c.a)).toEqual({ ada: 3, ravi: 1 });
  });
});
