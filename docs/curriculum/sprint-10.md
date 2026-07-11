# Curriculum Note — Sprint 10: RAG — Retrieval Over Help Docs (Flagship)

> **RAG is a retrieval problem wearing a generation costume.** Measure retrieval first, and let the eval — not
> intuition — choose your chunker.

## Learning objectives
- Internalize that **retrieval, not generation, decides RAG quality.**
- Read retrieval metrics (recall@k, MRR) and tune to the k that fits your context.
- Decide a datastore (**pgvector vs a dedicated vector DB**) on measured evidence.
- Feel the **plant-then-harvest arc close with a number** (the chunker showdown).

## Key concepts
- **📘 RAG is 80% retrieval, 20% generation.** A perfect model over the wrong chunks gives a *confident wrong
  answer* — the worst failure in support, because it's plausible. So the budget goes to retrieval; generation is
  a thin final step the eval already covers. The discipline is spending effort where the numbers point, not
  where the demo is exciting.
- **🔍 pgvector is *sufficient* here — and we prove it.** 🔗 Pulse S7 proved columnar was *necessary* with
  numbers; this sprint proves PG + pgvector is *enough* with numbers. Same method (decide on measured latency at
  your real corpus size), opposite conclusion. "Do I need a vector DB?" is a measurement question, and the
  answer is often no. The ADR records the exact triggers (corpus size, p95 latency) that would flip it.
- **📘 recall@k and MRR from first principles.** recall@k: of the chunks that *are* relevant, how many did we
  fetch in the top k? MRR: how high did the first right answer rank? Tune to recall@k where **k = how many
  chunks fit in the generation context** — the right chunk at rank 50 is useless if only 5 fit.
- **🔗 The chunker showdown — flaw #3 harvested with numbers.** S08's fixed chunker isn't "worse" by assertion
  anymore; it's worse by top-1 answer-containment. The naive chunker shears "exactly one hour" across a
  boundary, so retrieval surfaces a chunk that doesn't contain the answer. *This is what the S09 eval was built
  to enable* — feel the whole arc (plant S08 → build the measure S09 → grade S10) close.
- **📘 Hybrid retrieval: fuse the two failure modes.** Vector search finds paraphrase but misses exact terms
  (error codes, product names); FTS finds exact terms but misses paraphrase. **Reciprocal rank fusion** — ten
  lines, rank-based so it needs no score calibration — reliably beats either, and the eval shows the exact lift.
- **⚠️ Reranking is a knob, not a default.** It lifts precision but costs latency and $. The eval quantifies all
  three axes so the choice is informed, not cargo-culted.
- **📘 Embeddings are versioned; re-embedding is a migration.** A vector only means anything relative to others
  from the *same* model. Change the model and every vector is orphaned — treat re-embedding as a batched,
  expand/backfill data migration, never an in-place swap.

## The debate, cashed
**Dedicated vector DB vs pgvector?** Resolved: **pgvector**, with the ADR stating the corpus-size and latency
triggers that would justify a dedicated store. *Answer datastore questions with measured latency at your real
corpus size, not blog posts.* (ADR-0010.)

## ⚗️ Lab (`lab/sprint-10`, eval-writing)
Write **20 new retrieval eval cases** — including adversarial and *ambiguous* queries — and report how the
current system scores. Include out-of-scope questions (the airspeed of a swallow): the system has **no
relevance threshold** yet, so it will confidently retrieve *something* and the thin generator will answer. Note
that. (You're building the S12 case file.) Authoring the test set is the single most important AI-engineering
skill; this lab is that skill.

## Exercise questions
1. Construct a query where vector retrieval wins and one where FTS wins. Then show RRF getting both right.
2. Your context fits 4 chunks. Which matters more for *this* system, recall@4 or MRR? Argue it.
3. The chunker showdown measures top-1 answer-containment. Why is that a fair proxy for "did retrieval work,"
   and where would it mislead you?
4. You switch embedding models. Walk through the migration without a single moment where retrieval is broken.
5. Ask the demo an out-of-scope question. What does it do, and *why* is that a bug even though the answer reads
   fine? (Name the missing mechanism. It's harvested in S12.)

## Further reading
- pgvector (HNSW/IVFFlat, `<=>` operators) · reciprocal rank fusion · recall@k / MRR / nDCG · cross-encoder
  reranking · embedding model versioning · ADR-0010, ADR-0008, ADR-0002 · the S09 eval harness.
