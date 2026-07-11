import { describe, it, expect } from "vitest";
import { z } from "zod";
import { structuredComplete, parseStructured, extractJson } from "./structured";
import type { LlmProvider, CompleteRequest, CompleteResponse } from "./types";

const Schema = z.object({ intent: z.enum(["billing", "other"]), confidence: z.number().min(0).max(1) });
type Out = z.infer<typeof Schema>;
const FALLBACK: Out = { intent: "other", confidence: 0 };

/** A scripted provider: returns the next queued reply per call, so we can simulate a model that disobeys. */
function scripted(replies: string[]): LlmProvider {
  let i = 0;
  return {
    complete(_req: CompleteRequest): Promise<CompleteResponse> {
      const text = replies[Math.min(i++, replies.length - 1)];
      return Promise.resolve({ text, usage: { inputTokens: 1, outputTokens: 1 }, stopReason: "end_turn" });
    },
  };
}

describe("extractJson / parseStructured (S11)", () => {
  it("pulls JSON out of prose and code fences", () => {
    expect(extractJson('Sure! ```json\n{"intent":"billing","confidence":0.9}\n``` hope that helps')).toBe('{"intent":"billing","confidence":0.9}');
    expect(extractJson("no json here")).toBeNull();
  });
  it("validates against the schema", () => {
    expect(parseStructured(Schema, '{"intent":"billing","confidence":0.9}')).toMatchObject({ ok: true });
    expect(parseStructured(Schema, '{"intent":"nope","confidence":2}')).toMatchObject({ ok: false });
  });
});

describe("structuredComplete (S11)", () => {
  it("returns the value directly when the first reply is valid", async () => {
    const p = scripted(['{"intent":"billing","confidence":0.8}']);
    const r = await structuredComplete(p, { model: "mock-model", system: "s", user: "u", schema: Schema, fallback: FALLBACK });
    expect(r).toMatchObject({ ok: true, retried: false, fellBack: false });
    expect(r.value.intent).toBe("billing");
  });
});
