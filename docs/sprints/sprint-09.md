# Sprint 09 — The Eval Harness (Before Any AI Feature)

**Branch:** `sprint-09/eval-harness` · **Size:** L · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** The course's crown jewel, and its most counter-cultural move: **build the evaluation harness before building a single AI feature.** Datasets, graders (exact/heuristic/LLM-as-judge), a runner, regression gates in CI, and cost/latency accounting. When S10–S12 arrive, they'll be *measurable* from commit one.

## A — Issues
1. `packages/eval: dataset format, case schema, runner`
2. `Graders: exact-match, heuristic (contains/regex/JSON-shape), LLM-as-judge (with the mock in CI)`
3. `EvalRun storage + score trends; regression gate in CI`
4. `Cost/latency reporting per eval run; the mock model + fixture recording`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(eval): dataset + case schema — input, expected/rubric, tags; JSON files in docs/evals` | cases are version-controlled data; datasets grow like the S3 email corpus |
| 2 | `feat(eval): runner — executes cases against a target fn, collects outputs + graders' scores + cost/latency` | target-agnostic: works for triage (S11), RAG (S10), bot (S12) |
| 3 | `feat(eval): graders — exact, heuristic, and LLM-as-judge` | **[in-PR arc]** the first judge grader rewards verbosity (longer==better-looking) |
| 4 | `test(eval): meta-eval — the judge scores a known-bad verbose answer above a known-good terse one, FAILS` | **evaluating the evaluator**: the judge has bugs too; caught by testing graders against gold labels |
| 5 | `fix(eval): judge rubric + calibration — score against a rubric, not vibes; position/verbosity bias mitigations` | rubric-based judging; the commit body covers known LLM-judge biases (position, length, self-preference) |
| 6 | `feat(eval): fixture recorder — record live-model outputs → replay deterministically in CI` | the mock model plays back recordings keyed by prompt hash; live calls only in the nightly job |
| 7 | `feat(ci): eval regression gate — datasets run on the mock; score drop beyond tolerance fails the PR` | AI quality becomes a CI check, exactly like tests |
| 8 | `feat(ci): nightly live-eval job — runs against the real Claude API with a hard cost cap, non-blocking, trends committed` | 🔗 consult the `claude-api` skill for token counting + pricing |
| 9 | `feat(eval): cost/latency report per run — tokens, $/case, p95 latency` | |
| 10 | `docs: ADR-0008 eval-first methodology; the eval authoring guide; curriculum note` | |

## C — Review order
Dataset/case schema (1) → runner (2) → **the meta-eval arc (3→4→5): the evaluator has bugs too** → the CI gate (7) → deterministic replay (6).

## D — Teaching comments (~11)
- eval-before-feature — 📘 the whole course's thesis in one sprint: you cannot improve what you cannot measure, and "it looked good" is measurement theater; the harness exists *before* the features so every AI change has a number
- graders taxonomy — 📘 exact (when there's a right answer), heuristic (shape/contains), LLM-judge (open-ended quality) — pick the cheapest grader that captures what you care about
- meta-eval — 🔍 review-lens: **the evaluator is code and code has bugs**; a verbosity-biased judge silently rewards worse answers; grade your graders against gold labels or you're flying blind with a broken instrument
- judge biases — ⚠️ LLM judges have position bias, length bias, self-preference; rubric-based prompts + calibration reduce them; cite the `claude-api` skill patterns
- deterministic replay — 📘 non-determinism is poison for CI; record real outputs once, replay forever; live calls are a separate, capped, nightly signal
- CI regression gate — 🔗 this is the analog of Pulse's loss-accounting and Tracer's convergence tests: each course makes its crown property a permanent CI citizen; here it's answer quality
- cost per case — 📘 $/action is a first-class metric from the first eval; a quality win that triples cost is a tradeoff, not a victory

## E — Debate
**"LLM-as-judge vs human eval vs heuristics only?"** Human: gold standard, doesn't scale, slow. Heuristics: cheap, deterministic, miss nuance. LLM-judge: scalable nuance, but biased and costs money. **Resolution:** layered — heuristics for gate-able properties (JSON valid, contains citation), LLM-judge (calibrated, rubric-based) for quality, periodic human spot-checks to keep the judge honest. Lesson: *no single grader is trustworthy alone; triangulate, and always keep a human anchor.*

## F/G — Close
- Squash: `feat(sprint-09): eval harness, graders, CI gates (closes #…)`
- Deferred: eval dataset versioning UI, A/B prompt comparison reports (S12 uses).
- Recap idea: *the most important AI code you write has no model in it — it's the harness that tells you whether the model is helping.*
