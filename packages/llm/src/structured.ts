/**
 * Structured outputs (S11). Tool/JSON mode makes a model's output *likely* to match a schema. This first
 * version assumes that's good enough: call the model, parse against the schema, return the value.
 */
import type { z } from "zod";
import type { LlmProvider } from "./types";

export interface StructuredOptions<T> {
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** The safe default returned when the model fails to produce a valid value. */
  fallback: T;
  maxTokens?: number;
}

export interface StructuredResult<T> {
  value: T;
  ok: boolean;
  retried: boolean;
  fellBack: boolean;
}

/**
 * v1 — ask the model for a value and validate it. Assumes the model returns valid schema; throws otherwise.
 * (That assumption is about to meet reality.)
 */
export async function structuredComplete<T>(provider: LlmProvider, opts: StructuredOptions<T>): Promise<StructuredResult<T>> {
  const maxTokens = opts.maxTokens ?? 512;
  const first = await provider.complete({ model: opts.model, system: opts.system, messages: [{ role: "user", content: opts.user }], maxTokens });
  const a = parseStructured(opts.schema, first.text);
  if (a.ok) return { value: a.value, ok: true, retried: false, fellBack: false };
  throw new Error(`structured output did not match schema: ${a.error}`);
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
