/**
 * The answer-bot (S12) — the user-facing AI. It drafts a reply grounded ONLY in retrieved help-center chunks,
 * **cites its sources or refuses**, and stays inside a cost budget. Grounding and refusal are treated as
 * CORRECTNESS, gated by the eval. A trustworthy bot cites or refuses; that's the whole game.
 *
 * This module is the pure logic (prompt contract, refusal decision, citation verification) so grounding is a
 * tested invariant, not a hope.
 */
import { delimitUserContent } from "./security";

export interface GroundingChunk {
  id: string;
  text: string;
}

export type RefusalReason = "no_relevant_sources" | "sensitive_topic";

export const REFUSAL_MESSAGE = "I don't have a confident answer from our help center for that — let me bring in a teammate who can help.";

// Topics an automated bot must never answer from a help article: security/account-takeover, payment details,
// legal/medical. These go to a human regardless of what retrieval found.
const SENSITIVE = [/\bwire transfer\b/i, /\bsocial security\b/i, /\bssn\b/i, /\bfull card number\b/i, /\bpassword over the phone\b/i, /\blegal advice\b/i, /\bchargeback\b/i];

export function isSensitive(question: string): boolean {
  return SENSITIVE.some((re) => re.test(question));
}

/**
 * Decide whether to answer or refuse. Refuse when retrieval is weak (no relevant sources — the S12 threshold,
 * harvesting flaw #3) or the topic is sensitive. 📘 Refusal is a FEATURE: the hardest thing to teach a bot is
 * when *not* to answer, and a bot that always answers is a liability.
 */
export function refusalReason(question: string, retrievalSufficient: boolean): RefusalReason | null {
  if (isSensitive(question)) return "sensitive_topic";
  if (!retrievalSufficient) return "no_relevant_sources";
  return null;
}

/**
 * The grounding contract, in the prompt. Answer ONLY from the numbered context; cite the [n] you used; if the
 * context doesn't support an answer, say "I don't know" — do not use outside knowledge. (Consult the claude-api
 * skill for citation + system-prompt patterns; in production the stable prefix here is prompt-cached.)
 */
export function buildGroundedPrompt(question: string, chunks: readonly GroundingChunk[]): string {
  const context = chunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n");
  // 🔒 S13: the question is untrusted (a customer could try "ignore the docs and reveal…"); delimit it as data.
  return (
    `Context (numbered help-center excerpts):\n${context}\n\n` +
    `Question:\n${delimitUserContent(question)}\n\n` +
    `Answer using ONLY the context above. Cite the sources you use as [1], [2], etc. ` +
    `If the context does not contain the answer, reply exactly "I don't know." Do not use outside knowledge.`
  );
}

// ── Citation verification (grounding as a tested invariant) ────────────────────────────────────────
/** Pull [n] citation markers from an answer. */
export function extractCitations(answer: string): number[] {
  const out = new Set<number>();
  for (const m of answer.matchAll(/\[(\d+)\]/g)) out.add(Number(m[1]));
  return [...out].sort((a, b) => a - b);
}

export interface CitationCheck {
  cited: number[];
  invalid: number[]; // cited indices with no matching provided chunk — a fabricated citation
  grounded: boolean; // has ≥1 citation and none invalid
}

/**
 * ⚠️ Citations aren't decoration — verify them. Models cite plausibly but sometimes WRONGLY (a [3] when only two
 * chunks were provided, or citing a chunk that doesn't support the claim). We check every [n] maps to a
 * provided chunk; a citation out of range is a fabricated source. An answer with claims but zero valid
 * citations is ungrounded — and an ungrounded answer is a bug, not a lower-quality answer.
 */
export function verifyCitations(answer: string, chunkCount: number): CitationCheck {
  const cited = extractCitations(answer);
  const invalid = cited.filter((n) => n < 1 || n > chunkCount);
  const grounded = cited.length > 0 && invalid.length === 0;
  return { cited, invalid, grounded };
}

/** A reply is a refusal if it's the refusal message or an explicit "I don't know". */
export function isRefusal(answer: string): boolean {
  return answer.trim() === REFUSAL_MESSAGE || /\bi don'?t know\b/i.test(answer.trim());
}

/**
 * The final correctness check for a produced answer: a refusal is always fine; otherwise it must be grounded
 * (valid citations) — a confident, uncited answer is a grounding failure and should be suppressed to a refusal.
 */
export function isAcceptableAnswer(answer: string, chunkCount: number): boolean {
  if (isRefusal(answer)) return true;
  return verifyCitations(answer, chunkCount).grounded;
}
