# ADR-0010 — RAG: retrieval-first, on pgvector, chosen by the eval

**Status:** accepted (S10) · **Deciders:** Harbor course

## Context

Harbor answers customer questions from its own help center. The instinct is to reach for a big generation
model; the reality is that **RAG is 80% retrieval**. A perfect model over the wrong chunks produces a confident
wrong answer — the most dangerous failure mode in support. So this sprint spends its budget on retrieval, and
uses the S09 eval to make every retrieval decision by measurement, not intuition.

## Decisions

### 1. pgvector, not a dedicated vector DB (the debate)

**Dedicated vector store (Pinecone/Weaviate/Qdrant) vs pgvector?**
- **Dedicated:** purpose-built indexing (HNSW tuning), scales to billions of vectors.
- **pgvector:** one datastore, transactional consistency with the articles the chunks came from, and — the
  decisive point — **sufficient at our corpus size, provable by the eval's latency numbers.**

**Resolution: pgvector.** 🔍 Contrast Pulse S7, where columnar was *necessary* and we proved it with numbers;
here PG + pgvector is *sufficient* and we prove *that* with numbers. Same lesson (decide datastores on measured
evidence at your real corpus size), opposite answer — that's the point. The ADR records the triggers that would
justify a dedicated store: corpus beyond ~1M chunks, or p95 retrieval latency exceeding budget at that size.
*"Do I need a vector DB?" is answered by measured latency, not blog posts — and often the answer is no.*

### 2. Retrieval-first, generation-thin
The value ships in retrieval; generation is a placeholder the eval already covers. Concretely:
- **Vector retrieval** — cosine top-k over pgvector (`embedding <=> $q`).
- **Hybrid** — fuse vector (semantic) with FTS (lexical) via **reciprocal rank fusion**. They fail differently
  (vector misses exact terms like error codes; FTS misses paraphrase), so fusing them beats either — shown by
  the eval, not asserted.
- **Reranking** — a rerank on the fused top-N is a quality/cost/latency knob; the eval quantifies all three so
  the decision is informed, not cargo-culted.

### 3. The chunker choice is now decided by the eval (harvest of flaw #3, part 1)
S08 shipped fixed-size and structure-aware chunkers, and ADR-0008 flagged "structure-aware is better" as an
**unvalidated hypothesis**. S10 grades it: chunk the same corpus both ways, embed, retrieve, and measure whether
the top-1 chunk contains the answer. The naive **fixed chunker scores measurably worse** — it shears answers
across boundaries. The hypothesis is now a *result*. This is the whole plant-then-harvest arc closing with a
number the S09 harness was built to produce.

### 4. Embeddings are versioned; re-embedding is a migration
A vector is only comparable to others from the *same* model. Each chunk records its `embeddingModel` +
`embeddingDim`; changing the model orphans every vector, so re-embedding is a batched **data migration** (the
S10 worker job), done expand/backfill-style — never an in-place swap.

## Consequences

- `packages/rag`: `MockEmbedder` (deterministic feature-hashing for CI), `vectorTopK`, `reciprocalRankFusion`,
  and recall@k / MRR metrics — all pure and unit-tested; the pgvector query is the same math in SQL.
- Schema: `ArticleChunk.embedding` (Unsupported `vector(96)`) + `embeddingModel`/`embeddingDim`.
- **Planted (ledger):** retrieval has **no relevance threshold** — it always returns top-k, even when nothing is
  relevant, so the thin generator will confidently answer an out-of-scope question. This is the *retrieval half*
  of flaw #3, harvested in S12 (threshold → refusal, with eval evidence).
- **Links:** the S10 pgvector-vs-dedicated debate; ADR-0008 (the chunking hypothesis this grades); ADR-0002
  (pgvector, now realized); the chunker showdown (`showdown.test.ts`).
