# Sprint 08 — Knowledge Base + Help-Center Search (Dialogue Format)

**Branch:** `sprint-08/knowledge-search` · **Size:** M/L · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** Build the knowledge foundation the RAG sprints will stand on: structured articles, full-text search, and — critically — the **document chunking and normalization** that S10's retrieval depends on. Dialogue format: **the learner authors the naive chunker/search**; the AI reviews and rebuilds. No LLM yet — this is the un-glamorous groundwork that determines whether RAG works.

## A — Issues
1. `Article structure: sections, metadata, versioning, publish state`
2. `Full-text search (Postgres FTS) over articles for agents + help center`
3. `Document normalization + chunking pipeline (feeds S10 embeddings)`
4. `Article analytics: views, search-no-results (content gaps)`

## B — Commits (J = learner, S = AI review)
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(db): Article sections + versioning + publish state` | |
| 2 | `feat(api): FTS — [J] tsvector over whole article body` | works; ranking is crude, no section awareness |
| 3 | `refactor(api): FTS — [S] weighted tsvector (title>headings>body), snippet headlines` | 🔗 Pulse S11 FTS lessons applied; body reviews J's ranking gaps |
| 4 | `feat(rag): chunker — [J] fixed 500-char splits` | **[flaw #3 seed]** splits mid-sentence, ignores structure; *this naive chunker will hurt S10's retrieval and gets harvested at S12* — the dialogue makes the learner build the thing that later fails |
| 5 | `refactor(rag): chunker — [S] structure-aware (by section/paragraph), overlap, metadata per chunk` | S improves it but deliberately *keeps the no-score-threshold retrieval assumption* for S10 to expose — the flaw is retrieval-side, not just chunk-side; commit body is explicit that chunking quality is an eval question we can't answer yet (no eval harness until S9!) |
| 6 | `feat(db): ArticleChunk table (text, metadata, position) — ready for embeddings (pgvector added S10)` | |
| 7 | `feat(web): help-center search UI + agent article search in composer` | |
| 8 | `feat(api): search analytics — no-result queries logged as content-gap signals` | 📘 what people search and *don't* find is your content roadmap |
| 9 | `test: FTS ranking fixtures; chunker output snapshots` | |
| 10 | `docs: ADR-0007 chunking strategy (marked "unvalidated until S10 eval"); curriculum note (learner retro)` | |

## C — Review order
J's FTS (2) → S's weighted version (3) → **J's chunker (4) → S's chunker (5)** — and note the ADR admits chunking is unproven until there's an eval.

## D — Teaching comments (~9)
- weighted FTS — 🔗 Pulse S11: titles matter more than body; setweight and why; snippets for scannability
- chunking is the hidden RAG variable — 📘 retrieval quality is decided here, before any model: chunk too big (noise), too small (lost context), mid-sentence (broken meaning); this un-glamorous preprocessing is where most RAG systems silently fail
- "unvalidated until eval" — 🔍 review-lens: the honest ADR — we're making chunking decisions we *cannot yet measure* because the eval harness (S9) doesn't exist; naming that uncertainty is the discipline; S10 will hold these choices to account
- overlap + metadata — 📘 chunk overlap preserves cross-boundary context; per-chunk metadata (article, section, url) is what makes citations possible later (S12)
- no-result analytics — 📘 search misses are product signal; a content-gap report turns support pain into a writing to-do list
- the dialogue's point — 📘 the learner builds the naive chunker *on purpose*; feeling S10's retrieval degrade because of S8's choices is the most durable way to learn why chunking matters

## E — Debate
**"Chunk by fixed size vs by document structure?"** Fixed: trivial, uniform, but shreds meaning across boundaries. Structural: respects sections/paragraphs, variable size, more code. **Resolution:** structural with a max-size cap and overlap — but the ADR flags this as a *hypothesis to be tested in S10's retrieval eval*, not a settled answer. Lesson: *preprocessing choices for ML systems are hypotheses; without an eval you're guessing, so build the eval before you trust the guess* (the thesis of S9).

## F/G — Close
- Squash: `feat(sprint-08): knowledge base, FTS, chunking pipeline (closes #…)`
- Deferred: article suggestions in composer (needs S10), multilingual articles.
- Ledger: flaw #3 seeded (chunking + retrieval-threshold; harvested S12 with eval evidence).
- Recap idea: *RAG lives or dies on chunking and retrieval — the boring preprocessing you can't even grade until you've built an eval.*
