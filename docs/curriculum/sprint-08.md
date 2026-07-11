# Curriculum Note — Sprint 8: Knowledge Base + Search (Learner Retro)

> **Format:** dialogue. You (`[J]`) authored the naive full-text search and the naive chunker; the review
> (`[S]`) rebuilt them. You built the thing that later fails — on purpose — because feeling S10's retrieval
> degrade because of an S08 choice is the most durable way to learn why chunking matters.

## Learning objectives
- Internalize that **RAG quality is decided in preprocessing**, before any model.
- Weight full-text search by where meaning lives (title > body) and make results scannable.
- Sit with the discomfort of **making decisions you cannot yet measure** — and name it.
- Read search misses as **product signal**.

## Key concepts
- **🔗 Weighted FTS: titles outrank bodies.** `setweight(title, 'A') || setweight(body, 'B')` plus `ts_headline`
  snippets. Your `[J]` flat-body tsvector worked but ranked a passing body mention above a dead-on title match.
  🔗 Pulse S11 — what a document is *about* is in its title.
- **📘 Chunking is the hidden RAG variable.** Too big → retrieval returns noise around the answer. Too small →
  the answer loses its context. Mid-sentence → the chunk means something different from the document. Your
  `[J]` fixed 500-char splitter does all three, silently. It passes a snapshot test and looks totally fine —
  which is exactly why it's dangerous. Most RAG systems that "just don't work well" fail *here*, in the boring
  preprocessing nobody reviews.
- **🔍 The honest ADR: "unvalidated until eval."** ADR-0008 says, in writing, that "structure-aware is better"
  is a *hypothesis* — because the eval harness (S09) doesn't exist, so we literally cannot grade it. Naming the
  uncertainty is the senior move. The junior instinct is to assert the rebuild is better and move on; the
  discipline is to say "we believe this, we haven't measured it, here's when we will."
- **📘 Overlap + per-chunk metadata.** The overlap tail keeps context that straddles a boundary from vanishing.
  The metadata (article, heading, position) is what lets S12 produce a *citation* — "this answer came from the
  'Resetting your password' section." Chunk now with citations in mind, or retrofit them painfully later.
- **📘 Search misses are a to-do list.** A zero-result query isn't a dead end — it's a customer telling you
  what to write next. The content-gap report turns support pain into a content roadmap.
- **📘 Why you built the naive version.** The dialogue's whole point: you'll *feel* S10's retrieval get worse
  because of the fixed chunker, and that felt experience will teach you more than any lecture on chunking. The
  flaw is planted in your hands so the harvest, when it comes with eval numbers in S12, lands.

## The debate, cashed
**Fixed-size vs structural chunking?** Resolved: **structural, with a max cap + overlap** — *flagged as a
hypothesis to test in S10's retrieval eval.* Lesson: *preprocessing choices for ML systems are hypotheses;
without an eval you're guessing, so build the eval before you trust the guess.* (The thesis of S09.)

## Learner retro prompts
1. Your fixed chunker passed its snapshot test. In what sense was the test *lying* to you about quality? What
   could a snapshot test never catch here?
2. The review kept your fixed chunker in the file (deprecated). Why keep the thing we're replacing?
3. ADR-0008 refuses to claim the structured chunker is "better." Argue *for* that refusal to a PM who wants a
   confident answer this sprint.
4. Name the *second* half of flaw #3 — the part that isn't about chunk quality at all. Why can't S08 fix it?
5. You have no eval harness. Design the *smallest* experiment that would tell you whether your chunk size is
   roughly right. (You're sketching S09.)

## Further reading
- Postgres FTS (`setweight`, `ts_rank`, `ts_headline`) · chunking strategies (fixed / recursive / semantic) ·
  "why your RAG doesn't work" post-mortems · ADR-0008, ADR-0002 · S09 (the eval harness).
