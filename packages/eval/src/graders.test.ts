import { describe, it, expect } from "vitest";
import { exactMatch, contains, regexGrader, jsonShape, parseScore10 } from "./graders";
import type { EvalCase } from "./types";

const c = (over: Partial<EvalCase> = {}): EvalCase => ({ id: "c1", input: "in", ...over });

describe("heuristic graders (S09)", () => {
  it("exact / contains / regex", () => {
    expect(exactMatch()("hello", c({ expected: "hello" }))).toMatchObject({ pass: true, score: 1 });
    expect(exactMatch()("hello ", c({ expected: "hello" }))).toMatchObject({ pass: true }); // trims
    expect(contains()("well hello there", c({ expected: "HELLO" }))).toMatchObject({ pass: true });
    expect(regexGrader(/\d{3}-\d{4}/)("call 555-1234", c())).toMatchObject({ pass: true });
    expect(regexGrader(/\d{3}-\d{4}/)("no number", c())).toMatchObject({ pass: false });
  });

  it("jsonShape checks keys, not values, and fails on invalid JSON", () => {
    expect(jsonShape(["intent", "priority"])(`{"intent":"billing","priority":"high"}`, c())).toMatchObject({ pass: true });
    expect(jsonShape(["intent", "priority"])(`{"intent":"billing"}`, c())).toMatchObject({ pass: false, detail: "missing: priority" });
    expect(jsonShape(["intent"])("not json", c())).toMatchObject({ pass: false, detail: "not valid JSON" });
  });
});

describe("parseScore10 (S09)", () => {
  it("extracts and normalizes 0..1, defensively", () => {
    expect(parseScore10("8")).toBe(0.8);
    expect(parseScore10("Score: 7.5/10")).toBe(0.75);
    expect(parseScore10("nonsense")).toBe(0);
    expect(parseScore10("11")).toBe(1); // clamped
  });
});
