import { describe, it, expect } from "vitest";
import { TriageOutputSchema, UNCLASSIFIED, buildTriagePrompt } from "./triage";

describe("triage schema (S11)", () => {
  it("accepts a well-formed classification and rejects bad fields", () => {
    expect(TriageOutputSchema.safeParse({ intent: "billing", urgency: "high", sentiment: "angry", suggestedTeam: "team-billing", confidence: 0.82 }).success).toBe(true);
    expect(TriageOutputSchema.safeParse({ intent: "wizardry", urgency: "high", sentiment: "angry", suggestedTeam: "x", confidence: 0.5 }).success).toBe(false);
    expect(TriageOutputSchema.safeParse({ intent: "billing", urgency: "high", sentiment: "angry", suggestedTeam: "x", confidence: 5 }).success).toBe(false); // >1
  });

  it("UNCLASSIFIED is a valid, safe default", () => {
    expect(TriageOutputSchema.safeParse(UNCLASSIFIED).success).toBe(true);
    expect(UNCLASSIFIED.confidence).toBe(0); // never confident when we don't know
  });

  it("buildTriagePrompt includes the customer message", () => {
    expect(buildTriagePrompt("my invoice is wrong")).toContain("my invoice is wrong");
  });
});
