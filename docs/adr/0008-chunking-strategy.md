# ADR-0008 — Document chunking strategy (a hypothesis, unvalidated until S10's eval)

**Status:** provisional (S08) — *decisions here are hypotheses, not settled answers* · **Deciders:** Harbor course

## Context

RAG (S10) retrieves *chunks* of articles, not whole articles, and embeds each chunk. How we split documents
into chunks is the single largest lever on retrieval quality — and it happens entirely in preprocessing, before
any model runs. The uncomfortable truth this ADR records: **we are choosing a chunking strategy before we have
any way to measure it.** The eval harness doesn't exist until S09; measured retrieval doesn't exist until S10.
So this is a decision made under acknowledged uncertainty, written down as such.

## Decisions

### 1. Structure-aware chunking over fixed-size (the debate)

- **Fixed-size (e.g. 500 chars):** trivial, uniform, and *wrong in a specific way* — it cuts mid-sentence and
  mid-word ("...reset your pass" | "word by..."), and separates a heading from its body. The meaning of a
  chunk is sheared at arbitrary byte offsets. This is the `[J]` learner implementation, kept deliberately.
- **Structure-aware (chosen, `[S]`):** split by section, pack paragraphs up to a `maxChars` cap without
  breaking a paragraph that fits, carry a small `overlap` tail so cross-boundary context survives, and tag
  every chunk with its heading + position (the raw material of a citation in S12).

**Resolution: structure-aware, with a max-size cap and overlap** — **but flagged as a hypothesis to be tested
by S10's retrieval eval.** We believe it's better; we have not *measured* that it's better, and saying so is the
discipline.

### 2. Weighted full-text search (title > body)

FTS ranks title matches above body matches (`setweight` A/B) and returns highlighted `ts_headline` snippets for
scannability. 🔗 Pulse S11: a document's title is the strongest signal of what it's *about*. (The `[J]` naive
version ranked a flat body tsvector; the `[S]` review added weighting + snippets.)

### 3. Search misses are logged as content-gap signals

Every query is recorded with its result count; zero-result queries roll up into a content-gap report. *What
people search for and don't find is the content roadmap.*

## The unvalidated part, stated plainly

> ⚠️ **We cannot yet grade any of this.** "Structure-aware chunks retrieve better than fixed-size" and "overlap
> of 80 chars is right" and "800 is a good max" are **guesses**. Worse, chunking is only *half* the RAG quality
> story: the other half is retrieval — *how many* chunks to return and *whether to return any at all*. That
> retrieval logic (built S10) currently has **no relevance threshold**, so it will return top-k even when
> nothing matches. We are shipping these choices unmeasured because there is no alternative until the eval
> harness exists — which is exactly why S09 builds one before any AI feature. **This ADR will be revisited with
> eval evidence in S10/S12.**

## Consequences

- `packages/rag` (normalize + chunk) is pure and snapshot-tested; `ArticleChunk` persists chunk text + metadata
  + position (pgvector `embedding` added S10).
- **Foreshadow (ledger):** the fixed chunker and the threshold-free retrieval assumption are *seeds* — the
  measured indictment lands in S12, with numbers.
- **Links:** the S08 fixed-vs-structural debate; ADR-0002 (pgvector when RAG arrives); S09 (the eval harness
  that makes this ADR gradable).
