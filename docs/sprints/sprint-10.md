# Sprint 10 — RAG: Retrieval Over Help Docs (Flagship)

**Branch:** `sprint-10/rag-retrieval` · **Size:** XL · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** The flagship AI sprint, and it's mostly *not* about generation — it's about retrieval. Embeddings in pgvector, the S8 chunker held to account by the S9 eval, retrieval-quality measurement, hybrid (vector + FTS) search, and re-ranking. The generation is a thin final step; the retrieval is the product.

## A — Issues
1. `Embeddings: embed ArticleChunks, store in pgvector, similarity search`
2. `Retrieval eval dataset: queries → expected relevant chunks; measure recall/precision`
3. `Hybrid retrieval: vector + FTS fusion; re-ranking`
4. `Chunking revisited: A/B chunk strategies via the eval (harvest groundwork from S8)`
5. `Thin RAG generation: retrieved context → grounded answer (guardrails come S12)`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(db): pgvector extension + embedding column on ArticleChunk (ADR-0002 realized)` | 🔗 deliberate: no new datastore; PG + pgvector suffices at this scale (contrast Pulse's ClickHouse necessity — *this* course proves the opposite call) |
| 2 | `feat(rag): embedding pipeline — embed chunks on publish, backfill job, model+dim recorded` | embeddings are versioned by model; re-embedding on model change is a migration |
| 3 | `feat(eval): retrieval dataset — 50 queries with labeled relevant chunks; recall@k / MRR graders` | the learner curates many of these cases (the eval-curation skill in practice) |
| 4 | `feat(rag): vector retrieval — cosine top-k over pgvector` | baseline retrieval score committed — **the first number for the S8 chunker** |
| 5 | `test(eval): baseline retrieval — the S8 fixed-then-structural chunkers scored head to head` | **harvests flaw #3 (part 1)**: the naive fixed chunker scores measurably worse; the eval *proves* what S8 could only assert; ledger quoted |
| 6 | `feat(rag): chunking A/B — re-chunk strategies, re-run retrieval eval, pick the winner by score` | data-driven chunking: the ADR-0007 hypothesis is now tested, not guessed |
| 7 | `feat(rag): hybrid retrieval — fuse vector + FTS (reciprocal rank fusion); eval shows the lift` | vector misses exact-term matches, FTS misses semantics; fusion beats both — with numbers |
| 8 | `feat(rag): re-ranking — a cross-encoder-style rerank (or LLM rerank) on the fused top-N; eval the cost/quality tradeoff` | reranking improves precision but costs latency/$$ — the tradeoff is measured, not assumed |
| 9 | `feat(rag): thin generation — top chunks → grounded answer draft (raw; guardrails/citations are S12)` | deliberately minimal: this sprint's value is retrieval; generation is a placeholder the eval already covers |
| 10 | `feat(worker): re-embed migration when the embedding model changes` | |
| 11 | `test(eval): full RAG eval — retrieval + answer-groundedness graders; committed scores + cost` | |
| 12 | `docs: ADR-0009 RAG architecture + retrieval-first philosophy; curriculum note` | |

## C — Review order
pgvector choice (1, with ADR) → retrieval dataset (3) → **the chunker showdown (5): S8's flaw, now measured** → hybrid fusion (7) → the cost/quality of reranking (8).

## D — Teaching comments (~13)
- retrieval-first — 📘 RAG is 80% retrieval, 20% generation: a perfect model over wrong context produces confident wrong answers; this sprint spends its budget where the quality actually lives
- pgvector suffices — 🔍 review-lens: contrast Pulse S7 — there, columnar was *necessary* and measured; here, PG + pgvector is *sufficient* and measured; the lesson is identical (decide datastores on evidence), the answer opposite — that's the point
- the chunker showdown — 🔗 flaw #3 harvested with *numbers*: S8's naive chunker isn't "worse" by assertion, it's worse by recall@5; this is what the S9 eval was built to enable — feel the whole arc close
- recall@k / MRR — 📘 retrieval metrics from first principles: recall (did we fetch the right chunk), MRR (how high did it rank); why you tune to recall@k where k = what fits in context
- hybrid fusion — 📘 vector and lexical retrieval fail differently; reciprocal rank fusion is ~15 lines and reliably beats either; the eval shows the exact lift
- rerank tradeoff — ⚠️ reranking is a quality/cost/latency knob; the eval quantifies all three so the decision is informed, not cargo-culted
- embedding versioning — 📘 embeddings are model-specific; changing models orphans your vectors; treat re-embedding as a data migration (🔗 expand/backfill instincts)
- thin generation on purpose — 🔍 review-lens: resist building the exciting part; the eval already tells us retrieval is the bottleneck — discipline is spending effort where the numbers point

## E — Debate
**"Dedicated vector DB (Pinecone/Weaviate/Qdrant) vs pgvector?"** Dedicated: scale, advanced indexing (HNSW tuning). pgvector: one datastore, transactional consistency with articles, sufficient at our corpus size — *and we can prove sufficiency with the eval's latency numbers*. **Resolution:** pgvector, with the ADR stating the corpus-size and latency triggers that would justify a dedicated store. Lesson: *"do I need a vector DB?" is answered by measured latency at your real corpus size, not by blog posts — and often the answer is no.*

## F/G — Close
- Squash: `feat(sprint-10): RAG retrieval — embeddings, hybrid search, reranking (closes #…)`
- **Lab (eval-writing):** the learner writes 20 new retrieval eval cases (including adversarial/ambiguous queries) and reports how the current system scores on them — practicing the most important AI-engineering skill: authoring the test set.
- Ledger: flaw #3 part 1 harvested (chunking proven); retrieval-threshold half remains → S12.
- Recap idea: *RAG is a retrieval problem wearing a generation costume — measure retrieval first, and let the eval, not intuition, choose your chunker.*
