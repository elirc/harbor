import { describe, it, expect } from "vitest";
import { makeLlmJudge } from "./graders";
import type { EvalCase } from "./types";
import type { LlmProvider, CompleteRequest, CompleteResponse } from "@harbor/llm";

/**
 * THE META-EVAL (S09) — evaluating the evaluator. The judge is code, and code has bugs. Here we grade the
 * grader against GOLD LABELS: we know which answer is actually better, and we check whether the judge agrees.
 *
 * The stand-in judge below mimics a real LLM judge's documented biases: in holistic "rate 0–10" mode it is
 * LENGTH-BIASED (longer looks more thorough); in decomposed "yes/no per criterion" mode it faithfully checks
 * content. This lets us prove, deterministically, that the *overall* judge silently prefers a worse answer —
 * and that the *rubric* judge does not.
 */

// Gold-labeled pair for "How do I reset my password?"
const CASE: EvalCase = {
  id: "reset",
  input: "How do I reset my password?",
  rubric: ["Forgot password", "reset link"], // the two things a correct answer must contain
};
const GOOD_TERSE = "Click Forgot password on the login screen; we'll email you a reset link.";
const BAD_VERBOSE =
  "Password management is a cornerstone of modern account security, and there are many considerations to keep " +
  "in mind. Users frequently encounter situations where credentials need attention for a variety of reasons, " +
  "including but not limited to routine hygiene, organizational policy, and general peace of mind. We take this " +
  "extremely seriously and have invested heavily in a robust, layered approach to protecting your information.";

/** A judge model that is length-biased when rating holistically, faithful when checking criteria. */
function biasedJudge(): LlmProvider {
  return {
    complete(req: CompleteRequest): Promise<CompleteResponse> {
      const prompt = req.messages.at(-1)?.content ?? "";
      let text = "0";
      if (/from 0 to 10/.test(prompt)) {
        // ⚠️ LENGTH BIAS: score scales with the answer's length, not its correctness.
        const answer = /Answer:\n([\s\S]*?)\n\nRate/.exec(prompt)?.[1] ?? "";
        text = String(Math.min(10, Math.round(answer.length / 45)));
      } else if (/Answer YES or NO/.test(prompt)) {
        // Faithful: YES iff the answer actually contains the criterion phrase.
        const answer = /Answer:\n([\s\S]*?)\n\nCriterion:/.exec(prompt)?.[1] ?? "";
        const criterion = /Criterion: (.*)\n/.exec(prompt)?.[1] ?? "";
        text = answer.toLowerCase().includes(criterion.toLowerCase()) ? "YES" : "NO";
      }
      return Promise.resolve({ text, usage: { inputTokens: 1, outputTokens: 1 }, stopReason: "end_turn" });
    },
  };
}

describe("meta-eval: the overall judge is length-biased (S09)", () => {
  it("RED — the naive judge scores the WORSE, verbose answer above the good, terse one", async () => {
    const judge = makeLlmJudge(biasedJudge(), { mode: "overall" });
    const good = await judge(GOOD_TERSE, CASE);
    const bad = await judge(BAD_VERBOSE, CASE);
    // The gold label says GOOD should win. It doesn't — the judge rewards length. This is the bug the
    // meta-eval exists to catch: a verbosity-biased grader silently prefers worse answers.
    expect(bad.score).toBeGreaterThan(good.score);
  });
});

describe("meta-eval: the rubric judge fixes it (S09)", () => {
  it("GREEN — the rubric judge scores the good answer above the verbose one", async () => {
    const judge = makeLlmJudge(biasedJudge(), { mode: "rubric" });
    const good = await judge(GOOD_TERSE, CASE);
    const bad = await judge(BAD_VERBOSE, CASE);
    expect(good.score).toBe(1); // meets both criteria
    expect(bad.score).toBe(0); // long, but meets neither — length can't buy a criterion
    expect(good.score).toBeGreaterThan(bad.score); // gold label restored
  });
});
