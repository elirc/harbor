import { describe, it, expect } from "vitest";
import { refusalReason, isSensitive, buildGroundedPrompt, extractCitations, verifyCitations, isRefusal, isAcceptableAnswer, REFUSAL_MESSAGE } from "./answerbot";

describe("refusal decision (S12)", () => {
  it("refuses on weak retrieval and on sensitive topics; answers otherwise", () => {
    expect(refusalReason("how do I reset my password", true)).toBeNull();
    expect(refusalReason("how do I reset my password", false)).toBe("no_relevant_sources");
    expect(refusalReason("can you help me with a chargeback", true)).toBe("sensitive_topic"); // sensitive wins even with sources
  });
  it("flags sensitive topics", () => {
    expect(isSensitive("read me the full card number on file")).toBe(true);
    expect(isSensitive("how do I export my data")).toBe(false);
  });
});

describe("grounding prompt (S12)", () => {
  it("numbers the context and demands citations + I-don't-know", () => {
    const p = buildGroundedPrompt("q", [{ id: "a", text: "alpha" }, { id: "b", text: "beta" }]);
    expect(p).toContain("[1] alpha");
    expect(p).toContain("[2] beta");
    expect(p).toContain('"I don\'t know."');
    expect(p).toContain("ONLY the context");
  });
});

describe("citation verification (S12)", () => {
  it("extracts and validates [n] citations against the provided chunk count", () => {
    expect(extractCitations("Do X [1], then Y [2] and also [1].")).toEqual([1, 2]);
    expect(verifyCitations("Do X [1] then Y [2].", 2)).toEqual({ cited: [1, 2], invalid: [], grounded: true });
    // a [3] when only 2 chunks were provided is a FABRICATED source
    expect(verifyCitations("Per policy [3], you can.", 2)).toMatchObject({ invalid: [3], grounded: false });
    // claims with no citation at all → ungrounded
    expect(verifyCitations("Just trust me, you can do it.", 2)).toMatchObject({ cited: [], grounded: false });
  });
});

describe("acceptable-answer gate (S12)", () => {
  it("a refusal is always acceptable; a grounded answer is; an uncited claim is not", () => {
    expect(isRefusal(REFUSAL_MESSAGE)).toBe(true);
    expect(isRefusal("I don't know.")).toBe(true);
    expect(isAcceptableAnswer("I don't know.", 3)).toBe(true);
    expect(isAcceptableAnswer("Click Forgot password [1].", 3)).toBe(true);
    expect(isAcceptableAnswer("Click Forgot password.", 3)).toBe(false); // confident but uncited → suppress
    expect(isAcceptableAnswer("See policy [9].", 3)).toBe(false); // fabricated citation
  });
});
