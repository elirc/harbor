/**
 * Retrieval (S10). RAG is a retrieval problem wearing a generation costume: a perfect model over the wrong
 * chunks produces confident wrong answers. So this is where the sprint spends its budget. Pure functions over
 * pre-computed vectors, so retrieval quality is measurable in CI (the pgvector query is the same math in SQL).
 */
import { cosineSimilarity } from "./embed";

export interface Scored {
  id: string;
  score: number;
}
export interface VectorDoc {
  id: string;
  vector: number[];
}

/**
 * Cosine top-k over a corpus of vectors. Returns the k highest-similarity chunk ids, best first. Mirrors the
 * pgvector query `ORDER BY embedding <=> $q LIMIT k` — the in-memory version so retrieval logic is unit-tested.
 */
export function vectorTopK(query: readonly number[], corpus: readonly VectorDoc[], k = 5): Scored[] {
  return corpus
    .map((d) => ({ id: d.id, score: cosineSimilarity(query, d.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * 📘 Reciprocal Rank Fusion — ~10 lines that reliably beat either input list. Vector search finds semantic
 * matches but misses exact terms (error codes, product names); lexical (FTS) finds exact terms but misses
 * paraphrase. They fail DIFFERENTLY, so fusing them covers both. RRF scores each id by Σ 1/(k + rank) across
 * the input rankings — rank-based, so it needs no score calibration between the two very different scales.
 */
export function reciprocalRankFusion(rankings: readonly (readonly string[])[], k = 60): Scored[] {
  const score = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, rank) => score.set(id, (score.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return [...score.entries()].map(([id, s]) => ({ id, score: s })).sort((a, b) => b.score - a.score);
}

// ── Relevance threshold (S12 — harvest of flaw #3, part 2) ─────────────────────────────────────────
/**
 * 🔗 Ledger flaw #3, retrieval half. S10's `vectorTopK` ALWAYS returns k — even for a query with nothing
 * relevant in the corpus, it returns the k least-bad matches, and a generator fed those confidently answers an
 * out-of-scope question from irrelevant context. That's confident nonsense, the worst RAG failure.
 *
 * The fix is a RELEVANCE THRESHOLD: below a minimum similarity, retrieval reports "no good sources" instead of
 * pretending. This is the single most important guardrail — it's the precondition for the bot's "I don't know."
 * The exact threshold is tuned by the eval, not guessed (that's why S09 exists).
 */
export const DEFAULT_RELEVANCE_THRESHOLD = 0.12;

export interface RetrievalResult {
  chunks: Scored[];
  /** false ⇒ nothing cleared the bar ⇒ the bot should refuse rather than answer from weak context. */
  sufficient: boolean;
  topScore: number;
}

export function retrieveRelevant(query: readonly number[], corpus: readonly VectorDoc[], opts: { k?: number; minScore?: number } = {}): RetrievalResult {
  const minScore = opts.minScore ?? DEFAULT_RELEVANCE_THRESHOLD;
  const top = vectorTopK(query, corpus, opts.k ?? 5);
  const chunks = top.filter((s) => s.score >= minScore);
  return { chunks, sufficient: chunks.length > 0, topScore: top[0]?.score ?? 0 };
}

// ── Retrieval metrics (the graders the S09 harness plugs into) ─────────────────────────────────────
/**
 * 📘 recall@k: of the chunks that ARE relevant, how many did we fetch in the top k? You tune to recall@k where
 * k = how many chunks fit in the generation context — fetching the right chunk at rank 50 is useless if only 5
 * fit. This is the number the chunker showdown is decided on.
 */
export function recallAtK(retrieved: readonly string[], relevant: ReadonlySet<string>, k: number): number {
  if (relevant.size === 0) return 1; // nothing to find → trivially satisfied
  const topK = retrieved.slice(0, k);
  const hit = topK.filter((id) => relevant.has(id)).length;
  return hit / relevant.size;
}

/** Reciprocal rank of the FIRST relevant result (1/rank), 0 if none retrieved. */
export function reciprocalRank(retrieved: readonly string[], relevant: ReadonlySet<string>): number {
  const idx = retrieved.findIndex((id) => relevant.has(id));
  return idx === -1 ? 0 : 1 / (idx + 1);
}

/** Mean reciprocal rank over many queries — how high, on average, the first right answer ranks. */
export function meanReciprocalRank(queries: ReadonlyArray<{ retrieved: readonly string[]; relevant: ReadonlySet<string> }>): number {
  if (queries.length === 0) return 0;
  return queries.reduce((s, q) => s + reciprocalRank(q.retrieved, q.relevant), 0) / queries.length;
}
