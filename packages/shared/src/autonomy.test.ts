import { describe, it, expect } from "vitest";
import { autonomyDecision, buildHandoffNote, DEFAULT_AUTONOMY, adjustTonePrompt, type AutonomySettings, type AutonomyInput } from "./autonomy";

const base = (over: Partial<AutonomySettings> = {}): AutonomySettings => ({ ...DEFAULT_AUTONOMY, mode: "auto", topicAllowlist: ["billing"], minConfidence: 0.85, minRetrievalScore: 0.3, businessHoursOnly: false, ...over });
const input = (over: Partial<AutonomyInput> = {}): AutonomyInput => ({ settings: base(), refused: false, confidence: 0.9, retrievalScore: 0.5, topic: "billing", businessHoursOk: true, ...over });

describe("autonomy gate — three gates in series (S14)", () => {
  it("auto-sends only when ALL gates pass", () => {
    expect(autonomyDecision(input()).action).toBe("auto_send");
  });
  it("a refusal always hands off", () => {
    expect(autonomyDecision(input({ refused: true })).action).toBe("handoff");
  });
  it("drafts (never auto) when any single gate fails", () => {
    expect(autonomyDecision(input({ topic: "security" })).action).toBe("draft"); // not allowlisted
    expect(autonomyDecision(input({ confidence: 0.7 })).action).toBe("draft"); // low confidence
    expect(autonomyDecision(input({ retrievalScore: 0.1 })).action).toBe("draft"); // weak retrieval
    expect(autonomyDecision(input({ settings: base({ businessHoursOnly: true }), businessHoursOk: false })).action).toBe("draft");
  });
  it("defaults to draft when autonomy is off", () => {
    expect(autonomyDecision(input({ settings: base({ mode: "off" }) })).action).toBe("draft");
  });
  it("auto+CC mode sends with a copy", () => {
    expect(autonomyDecision(input({ settings: base({ mode: "auto_cc" }) })).action).toBe("auto_send_cc");
  });
  it("the safe default is autonomy OFF", () => {
    expect(DEFAULT_AUTONOMY.mode).toBe("off");
    expect(DEFAULT_AUTONOMY.topicAllowlist).toEqual([]);
  });
});

describe("handoff carries context (S14)", () => {
  it("includes the summary and what the bot tried", () => {
    const note = buildHandoffNote("Billing issue", ["I was double charged", "still waiting"], { answer: "", refused: true, reason: "no_relevant_sources", citations: [] });
    expect(note).toContain("Billing issue");
    expect(note).toContain("still waiting");
    expect(note).toContain("could not answer");
  });
});

describe("assists (S14)", () => {
  it("tone adjustment preserves facts + citations", () => {
    expect(adjustTonePrompt("Do X [1].", "friendlier")).toContain("citations unchanged");
  });
});
