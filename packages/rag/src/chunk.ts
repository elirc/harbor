/**
 * Chunking (S08). Splitting documents into the units that get embedded and retrieved (S10). This is the hidden
 * variable of every RAG system: chunk too big and retrieval returns noise; too small and it loses context;
 * mid-sentence and it returns broken meaning. There is NO model here — and that's the point. Retrieval quality
 * is mostly decided in this un-glamorous preprocessing, before any embedding runs.
 *
 * ⚠️ We cannot actually *grade* these choices yet: the eval harness doesn't exist until S09. So this file ships
 * two chunkers — a naive one [J] and a structure-aware one [S] — and the ADR is explicit that "structure-aware
 * is better" is a HYPOTHESIS to be tested by S10's retrieval eval, not a proven fact. (S09's whole thesis.)
 */
import { parseSections, type ParsedDoc } from "./normalize";

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

export interface StructuredOptions {
  maxChars?: number;
  overlap?: number;
  articleSlug?: string;
}

/**
 * [S] — the review's rebuild: structure-aware chunking. Split by section, then pack paragraphs into chunks up
 * to `maxChars`, never breaking a paragraph across a boundary if it fits, and carry a small `overlap` tail so
 * context that straddles a boundary isn't lost. Every chunk carries its heading + position as metadata — which
 * is what makes grounded citations possible in S12.
 *
 * 🔍 Note what this deliberately does NOT fix: the RETRIEVAL side (how many chunks to return, and whether to
 * return any) is untouched — there is still no relevance threshold, because retrieval doesn't exist yet. Flaw
 * #3 is half chunk-quality and half "always return top-k even when nothing is relevant"; this addresses the
 * first half and leaves the second for S10 to build and S12 to indict. Better chunks, same unproven retrieval.
 */
export function chunkStructured(doc: ParsedDoc | string, opts: StructuredOptions = {}): Chunk[] {
  const parsed = typeof doc === "string" ? parseSections(doc) : doc;
  const maxChars = opts.maxChars ?? 800;
  const overlap = opts.overlap ?? 80;
  const chunks: Chunk[] = [];
  let index = 0;
  let position = 0;

  for (const section of parsed.sections) {
    const paragraphs = section.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let buffer = "";
    const emit = (): void => {
      const text = buffer.trim();
      if (!text) return;
      chunks.push({ text, index: index++, metadata: { articleSlug: opts.articleSlug, heading: section.heading, position } });
      position += text.length;
      // Carry an overlap tail (the last `overlap` chars) into the next chunk to preserve cross-boundary context.
      buffer = overlap > 0 ? text.slice(Math.max(0, text.length - overlap)) : "";
    };
    for (const para of paragraphs) {
      if (buffer && buffer.length + para.length + 1 > maxChars) emit();
      buffer += (buffer ? "\n\n" : "") + para;
    }
    emit();
  }
  return chunks;
}
