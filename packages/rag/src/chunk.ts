/**
 * Chunking (S08). Splitting documents into the units that get embedded and retrieved (S10). This is the hidden
 * variable of every RAG system: chunk too big and retrieval returns noise; too small and it loses context;
 * mid-sentence and it returns broken meaning. There is NO model here — and that's the point. Retrieval quality
 * is mostly decided in this un-glamorous preprocessing, before any embedding runs.
 */

export interface Chunk {
  text: string;
  index: number;
  metadata: {
    /** Which article + section this came from — the raw material of a citation later (S12). */
    articleSlug?: string;
    heading?: string;
    /** Character offset of this chunk within its source, for stable ordering. */
    position: number;
  };
}

/**
 * [J] — the learner's first chunker: fixed-size character windows. Trivial and uniform.
 *
 * ⚠️ [flaw #3 seed] It splits on a raw character count, so it cuts mid-sentence and even mid-word — "...reset
 * your pass" | "word by clicking..." — producing chunks whose meaning is sheared in half. It also ignores
 * document structure entirely (a heading and its body land in different chunks). This *works* and looks fine
 * in a snapshot; it will quietly degrade S10's retrieval, and we harvest it at S12 WITH EVAL EVIDENCE rather
 * than asserting it's bad now. Kept as the baseline the eval will indict.
 */
export function chunkFixed(text: string, size = 500): Chunk[] {
  const chunks: Chunk[] = [];
  for (let i = 0, index = 0; i < text.length; i += size, index++) {
    chunks.push({ text: text.slice(i, i + size), index, metadata: { position: i } });
  }
  return chunks;
}
