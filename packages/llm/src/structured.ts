/**
 * Structured outputs (S11). Tool/JSON mode makes a model's output *likely* to match a schema — never certain.
 * A model can return prose, a fenced code block, an extra field, or a missing one. So the rule: **treat model
 * output like untrusted user input** — validate it, bound your retries, and always have a safe fallback.
 *
 * This is the reusable validate → reprompt → fallback triad. A handler that does `schema.parse(text)` and trusts
 * it will crash in production the first time the model gets creative.
 */
import type { z } from "zod";
import type { LlmProvider } from "./types";

export interface StructuredOptions<T> {
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** The safe default returned when both the first call and the one reprompt fail to validate. */
  fallback: T;
  maxTokens?: number;
}

export interface StructuredResult<T> {
  value: T;
  ok: boolean; // true if the model produced a valid value (possibly after one reprompt)
  retried: boolean;
  fellBack: boolean;
}

/**
 * Ask the model for a value, validate it against `schema`, and — on failure — reprompt ONCE with the
 * validation error as feedback, then fall back to a safe default. Never throws on model output.
 */
export async function structuredComplete<T>(provider: LlmProvider, opts: StructuredOptions<T>): Promise<StructuredResult<T>> {
  const maxTokens = opts.maxTokens ?? 512;

  const first = await provider.complete({ model: opts.model, system: opts.system, messages: [{ role: "user", content: opts.user }], maxTokens });
  const a = parseStructured(opts.schema, first.text);
  if (a.ok) return { value: a.value, ok: true, retried: false, fellBack: false };

  // One reprompt: hand the model its own bad output + the specific error, and demand JSON only.
  const second = await provider.complete({
    model: opts.model,
    system: opts.system,
    messages: [
      { role: "user", content: opts.user },
      { role: "assistant", content: first.text },
      { role: "user", content: `That did not match the required schema: ${a.error}. Reply with ONLY the JSON object, no prose or code fences.` },
    ],
    maxTokens,
  });
  const b = parseStructured(opts.schema, second.text);
  if (b.ok) return { value: b.value, ok: true, retried: true, fellBack: false };

  // Bounded: never a second reprompt, never a crash, never a block — degrade to the safe default.
  return { value: opts.fallback, ok: false, retried: true, fellBack: true };
}

type ParseOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

/** Extract a JSON object from possibly-noisy model text and validate it against the schema. */
export function parseStructured<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, text: string): ParseOutcome<T> {
  const json = extractJson(text);
  if (json === null) return { ok: false, error: "no JSON object found in the reply" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "reply was not valid JSON" };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: true, value: result.data };
}

/** Pull the first balanced {...} object out of text (models love wrapping JSON in prose or ```json fences). */
export function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
