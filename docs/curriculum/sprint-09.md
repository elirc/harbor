# Curriculum Note — Sprint 9: The Eval Harness (Before Any AI Feature)

> **The most important AI code you write has no model in it — it's the harness that tells you whether the model
> is helping.** This sprint builds that harness *before* the first AI feature, on purpose.

## Learning objectives
- Internalize the course's central thesis: **you cannot improve what you cannot measure.**
- Choose graders by cost and by what they actually capture.
- Grade the grader — treat the evaluator as fallible code.
- Make AI quality a **CI citizen**, and make **cost a first-class metric**.

## Key concepts
- **📘 Eval-before-feature.** The counter-cultural move. Everyone builds the feature and eyeballs a demo;
  "it looked good" is measurement theater. The harness exists first so every AI change from S10 on gets a
  number, and "did this prompt help or hurt?" is answerable instead of a debate.
- **📘 The grader taxonomy — cheapest first.** exact (one right answer) → heuristic (contains/regex/JSON-shape)
  → LLM-as-judge (open-ended quality). Reach for the judge last: it's the priciest and least trustworthy. A
  regex that checks "did it cite a source" beats a judge rating "helpfulness" when citation is the property you
  gate on.
- **🔍 The meta-eval: the evaluator is code, and code has bugs.** Our first holistic "rate 0–10" judge
  *silently preferred a verbose, wrong answer to a terse, correct one* — pure length bias. You catch that only
  by grading the grader against gold labels. A rubric judge (decompose into per-criterion yes/no) can't be
  gamed by length, and the meta-eval proves the difference. Fly with a broken instrument and you'll optimize
  confidently in the wrong direction.
- **⚠️ LLM-judge biases are documented, not hypothetical.** Length (longer looks thorough), position (first of
  two looks better), self-preference (a model likes its own style). Rubric-based prompts + calibration + a human
  spot-check anchor reduce them. No single grader is trustworthy alone — triangulate.
- **📘 Determinism in CI; live is nightly.** A live model is non-deterministic and costs money; neither belongs
  in the PR gate. Record real outputs once (keyed by prompt hash), replay forever. Live-Claude is a separate,
  cost-capped, non-blocking nightly. This is *how you test AI features* — pin the model so the feature's logic
  is what's under test.
- **🔗 The regression gate makes quality permanent.** Each course makes its crown property a CI citizen —
  Tracer's convergence, Pulse's loss-accounting, and here, answer quality. A committed baseline + a tolerance is
  the only thing that turns "seems worse?" into a red check.
- **📘 Cost is a metric from the first eval.** $/case and p95 latency on every run. A quality win that triples
  cost is a tradeoff to review, not a victory to merge.

## The debate, cashed
**LLM-as-judge vs human eval vs heuristics-only?** Resolved: **layered** — heuristics gate objective
properties, a calibrated rubric-based judge scores quality, human spot-checks keep the judge honest, and the
meta-eval grades the judge. *No single grader is trustworthy alone; triangulate, and always keep a human
anchor.* (ADR-0009.)

## Your job from here (learner role shift)
From S09 you **curate the eval cases** — see `docs/evals/AUTHORING.md`. Writing test cases for AI behavior is a
taught-by-doing skill; every AI sprint from here asks you to grow the dataset, especially with the hard and
ambiguous inputs an easy dataset would let the model dodge.

## Exercise questions
1. You have a judge that rates "helpfulness 0–10." Design three gold-labeled pairs that would expose a length
   bias, a position bias, and a self-preference bias respectively.
2. Rewrite a holistic "rate this support reply" judge as a rubric. What criteria? Why is each one a *yes/no*?
3. A prompt change lifts mean score from 0.81 → 0.83 and raises $/case from $0.002 → $0.006. Does your gate
   pass it? Should a human? Argue both.
4. Explain why a replay *miss* in CI should be loud rather than silently falling back to a live call.
5. The chunking choices from S08 (ADR-0008) were "unvalidated." Sketch the dataset + grader you'd use in S10 to
   finally grade fixed-size vs structure-aware chunking.

## Further reading
- "LLM-as-a-judge" bias literature (length/position/self-preference) · eval frameworks (datasets + graders +
  regression) · `count_tokens` for real token accounting · ADR-0009, ADR-0008 · the S03 corpus (datasets grow).
