/**
 * Embeddings (S10). An embedding turns text into a vector so "similar meaning" becomes "small distance."
 * Retrieval then finds the chunks whose vectors are nearest the query's.
 *
 * 📘 CI can't call a real embedding API (non-deterministic, costs money, needs a key). So we ship a MOCK
 * embedder — deterministic **feature-hashing bag-of-words**: hash each token into a fixed-dim vector and
 * L2-normalize. Cosine similarity of two such vectors is (normalized) lexical overlap. It's crude next to a
 * neural embedding, but it's real, stable, and — crucially — good enough to make retrieval quality *measurable*
 * in CI: a chunk that shares the query's meaningful words scores higher. The real neural embedder (a Claude /
 * embedding-API call) is swapped in behind the same `Embedder` interface for the nightly + prod.
 */
export interface Embedder {
  readonly model: string;
  readonly dim: number;
  embed(text: string): number[];
}

const STOP = new Set(["the", "a", "an", "to", "of", "and", "or", "is", "are", "in", "on", "for", "you", "your", "we", "it", "this", "that", "how", "do", "i", "my"]);

/** Tokenize to lowercase alphanumeric words, dropping stopwords (they're noise for lexical overlap). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** FNV-1a hash of a token → a bucket in [0, dim). Deterministic, dependency-free. */
function bucket(token: string, dim: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % dim;
}

export class MockEmbedder implements Embedder {
  readonly model = "mock-hash-v1";
  constructor(readonly dim = 64) {}
  embed(text: string): number[] {
    const v = new Array<number>(this.dim).fill(0);
    for (const tok of tokenize(text)) v[bucket(tok, this.dim)] += 1;
    return l2normalize(v);
  }
}

export function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

/** Cosine similarity of two vectors. For L2-normalized vectors this is just the dot product. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}
