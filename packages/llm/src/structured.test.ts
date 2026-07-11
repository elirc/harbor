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

describe("structuredComplete: validate → reprompt → fallback (S11)", () => {
  it("returns the value directly when the first reply is valid", async () => {
    const p = scripted(['{"intent":"billing","confidence":0.8}']);
    const r = await structuredComplete(p, { model: "mock-model", system: "s", user: "u", schema: Schema, fallback: FALLBACK });
    expect(r).toMatchObject({ ok: true, retried: false, fellBack: false });
    expect(r.value.intent).toBe("billing");
  });

  // RED against v1: the model replies with prose, and a robust handler should reprompt and recover — v1 throws.
  it("recovers on the ONE reprompt when the first reply is prose", async () => {
    const p = scripted(["I think this is a billing issue, pretty confident.", '{"intent":"billing","confidence":0.7}']);
    const r = await structuredComplete(p, { model: "mock-model", system: "s", user: "u", schema: Schema, fallback: FALLBACK });
    expect(r).toMatchObject({ ok: true, retried: true, fellBack: false });
  });

  // RED against v1: both replies are invalid, and a robust handler should fall back — v1 throws.
  it("falls back to the safe default when both attempts are invalid — never throws", async () => {
    const p = scripted(["not json", '{"intent":"space-lasers","confidence":9}']);
    const r = await structuredComplete(p, { model: "mock-model", system: "s", user: "u", schema: Schema, fallback: FALLBACK });
    expect(r).toEqual({ value: FALLBACK, ok: false, retried: true, fellBack: true });
  });
});
