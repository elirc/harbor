import { describe, it, expect } from "vitest";
import { exactMatch, contains, regexGrader, jsonShape, makeLlmJudge, parseScore10, rubricPrompt } from "./graders";
import type { EvalCase } from "./types";
import type { LlmProvider, CompleteRequest, CompleteResponse } from "@harbor/llm";

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

/** A faithful rubric judge: YES iff the answer literally contains the criterion phrase. */
function faithfulJudge(): LlmProvider {
  return {
    complete(req: CompleteRequest): Promise<CompleteResponse> {
      const prompt = req.messages.at(-1)?.content ?? "";
      const answer = /Answer:\n([\s\S]*?)\n\nCriterion:/.exec(prompt)?.[1] ?? "";
      const criterion = /Criterion: (.*)\n/.exec(prompt)?.[1] ?? "";
      const text = answer.toLowerCase().includes(criterion.toLowerCase()) ? "YES" : "NO";
      return Promise.resolve({ text, usage: { inputTokens: 1, outputTokens: 1 }, stopReason: "end_turn" });
    },
  };
}

describe("LLM-as-judge, rubric mode (S09)", () => {
  it("scores the fraction of criteria met", async () => {
    const judge = makeLlmJudge(faithfulJudge(), { mode: "rubric" });
    const good = await judge("Click Forgot password, then use the reset link.", c({ rubric: ["Forgot password", "reset link"] }));
    expect(good).toMatchObject({ score: 1, pass: true, detail: "2/2 criteria met" });

    const partial = await judge("Click Forgot password.", c({ rubric: ["Forgot password", "reset link"] }));
    expect(partial.score).toBe(0.5);
    expect(partial.pass).toBe(false);
  });

  it("the rubric prompt asks one yes/no question per criterion", () => {
    expect(rubricPrompt("q", "a", "mentions X")).toContain("Answer YES or NO");
  });
});
