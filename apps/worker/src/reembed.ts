/**
 * Re-embedding migration (S10). 📘 Embeddings are MODEL-SPECIFIC: a vector from model A is meaningless to model
 * B, and mixing them in one index silently wrecks retrieval (you're comparing distances in incompatible
 * spaces). So changing the embedding model is a DATA MIGRATION — every chunk must be re-embedded. This is the
 * pure decision the background job runs: given the current model, which chunks are stale?
 *
 * 🔗 The expand/backfill instinct: never do an in-place swap. Add the new column, backfill in batches, cut over
 * when complete. Here the "stale set" is exactly the backlog to work through.
 */
export interface EmbeddedChunk {
  id: string;
  embeddingModel: string | null;
}

/** Chunks whose stored embedding model isn't the current one (or is missing) — the re-embed backlog. */
export function chunksToReEmbed(chunks: readonly EmbeddedChunk[], currentModel: string): string[] {
  return chunks.filter((c) => c.embeddingModel !== currentModel).map((c) => c.id);
}

/** Split a backlog into batches so a re-embed migration is incremental, not one giant transaction. */
export function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
