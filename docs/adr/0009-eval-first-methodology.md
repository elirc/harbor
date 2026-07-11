# ADR-0009 — Eval-first: build the measure before the feature

**Status:** accepted (S09) · **Deciders:** Harbor course

## Context

Harbor is about to build AI features — RAG (S10), triage (S11), an answer-bot (S12). The default industry
pattern is to build the feature, demo it, ship it, and *then* discover in production whether it's any good. That
pattern has no way to answer "did this prompt change help or hurt?" except opinion. This ADR commits Harbor to
the opposite: **build the evaluation harness before any AI feature**, so every AI change from here on carries a
number.

## Decisions

### 1. No AI feature merges without an eval
From S10 on, an AI feature ships with: an eval **dataset** (version-controlled cases), **graders**, and a
committed **baseline score** in `docs/evals/`. The CI **regression gate** fails a PR that drops a baseline
beyond tolerance — AI quality is a CI check, exactly like a unit test. *An LLM feature without an eval is a
demo, not a product.*

### 2. A grader taxonomy — cheapest first
- **exact** — one right answer (a label, a value).
- **heuristic** — contains / regex / JSON-shape: cheap, deterministic, perfect for gate-able properties
  ("is the JSON valid," "did it cite a source").
- **LLM-as-judge** — open-ended quality, but biased and costs money.

Pick the cheapest grader that captures the property you care about.

### 3. The evaluator is code, and code has bugs — grade the grader (the debate)

**LLM-as-judge vs human eval vs heuristics-only?**
- **Human** — the gold standard, but doesn't scale and is slow.
- **Heuristics** — cheap and deterministic, but miss nuance.
- **LLM-judge** — scalable nuance, but carries documented biases: **length** (longer looks more thorough),
  **position** (the first of two looks better), **self-preference** (a model rates its own style higher).

**Resolution: layered.** Heuristics gate the objective properties (JSON valid, contains citation); a
**calibrated, rubric-based** LLM-judge scores quality; periodic **human spot-checks** keep the judge honest. And
the judge is itself evaluated — the **meta-eval** grades the grader against gold labels. Our first holistic
"rate 0–10" judge silently preferred a verbose-but-wrong answer over a terse-but-correct one; a **rubric** judge
that decomposes the verdict into per-criterion yes/no checks can't be gamed by length, and the meta-eval proves
it. *No single grader is trustworthy alone; triangulate, and always keep a human anchor.*

### 4. Determinism in CI; live-model runs are a separate nightly
A live model is non-deterministic and costs money — neither belongs in the PR gate. CI runs the mock model
(recorded fixtures keyed by prompt hash), so the same prompt always yields the same answer and the *feature's*
logic is what's under test. Live-Claude runs against the real API are a separate, **cost-capped, non-blocking
nightly** job whose trends are committed. (Real token counting uses the Claude `count_tokens` endpoint; the
harness's `estimateTokens` is a documented CI-only approximation, never a billing source.)

### 5. Cost is a first-class metric from the first eval
Every run reports tokens as **$/case** and **p95 latency**. A quality win that triples cost is a tradeoff to
review — like a latency regression — not a silent victory. The gate can fail a cost blow-up even when quality
holds.

## Consequences

- `packages/eval`: dataset schema + loader, graders (exact/heuristic/judge), a target-agnostic runner,
  cost/latency reporting, deterministic replay, and the regression gate — all pure or mock-backed, DB-less and
  LLM-less in CI.
- `docs/evals/` holds datasets and baselines; datasets grow like the S03 corpus.
- **Foreshadow:** S10's chunking hypotheses (ADR-0008) finally become gradable here; S12 harvests flaw #3 with
  eval evidence.
- **Links:** the S09 judge-vs-human-vs-heuristics debate; the meta-eval (`graders.meta.test.ts`); ADR-0008
  (the unvalidated chunking choices this makes measurable).
