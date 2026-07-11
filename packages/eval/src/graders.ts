/**
 * Graders (S09). A taxonomy, cheapest first:
 *  - **exact** — when there's one right answer (a label, a JSON value).
 *  - **heuristic** — contains / regex / JSON-shape: cheap, deterministic, catches gate-able properties.
 *  - **LLM-as-judge** — scalable nuance for open-ended quality, but BIASED and costs money.
 *
 * 📘 Pick the cheapest grader that captures what you care about. A regex that checks "did it cite a source" is
 * worth more than an LLM judge that rates "helpfulness" if citation is the property you actually gate on.
 */
import type { LlmProvider } from "@harbor/llm";
import { DEFAULT_MODEL } from "@harbor/llm";
import type { Grader, GradeResult } from "./types";

const PASS = 0.7; // default score threshold for pass/fail

// ── Heuristic graders (pure, deterministic) ────────────────────────────────────────────────────────
export function exactMatch(): Grader {
  return (output, c) => bool(output.trim() === (c.expected ?? "").trim(), "exact");
}

export function contains(): Grader {
  return (output, c) => bool(output.toLowerCase().includes((c.expected ?? "").toLowerCase()), "contains");
}

export function regexGrader(re: RegExp): Grader {
  return (output) => bool(re.test(output), `regex ${re}`);
}

/** Passes if the output parses as JSON and contains every required key (shape check, not value check). */
export function jsonShape(requiredKeys: readonly string[]): Grader {
  return (output) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch {
      return { score: 0, pass: false, detail: "not valid JSON" };
    }
    if (typeof parsed !== "object" || parsed === null) return { score: 0, pass: false, detail: "not a JSON object" };
    const missing = requiredKeys.filter((k) => !Object.prototype.hasOwnProperty.call(parsed, k));
    return { score: missing.length === 0 ? 1 : 0, pass: missing.length === 0, detail: missing.length ? `missing: ${missing.join(",")}` : "shape ok" };
  };
}

// ── LLM-as-judge (goes through the provider — the mock in CI) ────────────────────────────────────────
export type JudgeMode = "overall" | "rubric";
export interface JudgeOptions {
  model?: string;
  mode?: JudgeMode;
}

/**
 * The first LLM-as-judge: ask the model to holistically RATE the answer 0–10. Simple, general, and — as the
 * meta-eval will show — quietly length-biased. Shipped naive on purpose; the rubric fix follows.
 */
export function makeLlmJudge(provider: LlmProvider, opts: JudgeOptions = {}): Grader {
  const model = opts.model ?? DEFAULT_MODEL;
  return async (output, c): Promise<GradeResult> => {
    const res = await provider.complete({
      model,
      system: "You are a strict grader. Reply with only a number.",
      messages: [{ role: "user", content: overallPrompt(c.input, output) }],
      maxTokens: 8,
    });
    const score = parseScore10(res.text);
    return { score, pass: score >= PASS, detail: `overall judge → "${res.text.trim()}"` };
  };
}

export function overallPrompt(input: string, output: string): string {
  return `Question:\n${input}\n\nAnswer:\n${output}\n\nRate the answer's overall quality from 0 to 10.`;
}

/** Extract the first 0–10 number from judge text and normalize to 0..1. Defensive: unparseable → 0. */
export function parseScore10(text: string): number {
  const m = /(\d+(?:\.\d+)?)/.exec(text);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n / 10));
}

function bool(ok: boolean, detail: string): GradeResult {
  return { score: ok ? 1 : 0, pass: ok, detail };
}
