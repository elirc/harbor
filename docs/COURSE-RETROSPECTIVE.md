# Harbor — Course Retrospective

**Course 5 of the git-connected curriculum. 15 sprints, v0.5.0 (MVP) → v1.0.0. An Intercom-style support
platform with AI as a supervised participant.**

Harbor's one sentence: *an LLM feature without an eval is a demo, not a product.* Everything below is that
sentence, unpacked across fifteen sprints.

## The spine: the eval-first arc

The single most important thread in the course is the evaluation harness. Trace it:

| Sprint | The eval's role |
|--------|-----------------|
| **S09** | Built **empty**, before any AI feature — the counter-cultural move. Datasets, graders (exact/heuristic/LLM-judge), a runner, a regression gate. The **meta-eval** caught the judge itself rewarding verbosity. |
| **S10** | **Proved RAG.** The chunker showdown harvested flaw #3 with a *number* — the naive chunker was worse by recall, not by assertion. |
| **S11** | **Gated triage.** Structured outputs wrapped in validate→reprompt→fallback; per-field accuracy graders. |
| **S12** | **Gated the bot.** Grounding as a tested invariant, refusal scored on unanswerable cases, the relevance threshold set by the eval. |
| **S13** | **Quantified injection defense.** Injection resistance became a permanent CI gate — a defense you can't measure is theater. |
| **S14** | **Authorized autonomy.** The bot acts only on a subset the safety eval proves near-zero-wrong. |
| **S15** | **Guards production.** The graders sample live traffic; the incident drill proved they're the smoke detector. |

*The eval harness is the spine of every AI decision in the course.* You couldn't have shipped autonomy (S14)
responsibly at S03 — not because the code was harder, but because you had no instrument to prove it safe.

## The stance: AI proposes, humans dispose (until eval-proven)

Every AI output was supervised by default — triage *suggests*, the bot *drafts*, a human *sends* — and that
supervision doubled as the **security containment** that made prompt injection harmless (S13). Autonomy (S14)
relaxed it only where an eval proved it safe, narrowly, reversibly. The lesson: *the strongest defense against a
model doing the wrong thing is architectural — never let it do more than suggest, until you can measure that
more is safe.*

## The flaw ledger, closed

Five planted flaws, none fixed silently — each harvested with evidence:

| # | Planted | Flaw | Harvested |
|---|---------|------|-----------|
| 1 | S03 | Subject-only email threading merges unrelated conversations | S07 (headers) + S13 (forwarded chains) — **three sprints**, realistic |
| 2 | S05 | Messenger bridge trusts any postMessage origin | S13 (origin allowlist + forgery probe) |
| 3 | S08/S10 | Fixed-size chunking + threshold-free retrieval | S10 (chunking, measured) + S12 (threshold → refusal) |
| 4 | S11 | Triage prompt inlines raw user text (injection) | S13 (delimit + classifier + architectural containment + CI gate) |
| — | S12 | LLM answer cache keyed on prompt-hash alone (cross-contact leak) | S13 (scope in the key) |

The ledger's meta-lesson: *plant-then-harvest teaches more than a clean fix — a flaw you can reproduce is a flaw
you can prove you closed, and some (flaw #1) take multiple passes because real systems harden in layers.*

## Cost as a metric, from day one

The S01 `LLMCall` ledger — wired before there was a bill — became S15's cost dashboards. Every AI-touching PR
reported $/action; model selection (S12) and per-contact + per-workspace budgets (S13/S15) made cost a
first-class correctness axis. *A quality win that triples cost is a tradeoff, not a victory.*

## What the learner built

The learner's **curated eval datasets** are a real deliverable — from S09 on, writing the test cases for AI
behavior (especially the unanswerable, adversarial, and ambiguous ones) is the taught-by-doing skill that
separates shipping trustworthy AI from shipping a demo. The correction flywheel (S11) turns every agent fix into
tomorrow's eval case.

## By the numbers

- **15 sprints**, all as squash-merged PRs with inline teaching comments + planted design debates + ADRs 0001–0015.
- **v0.5.0** (MVP: email → inbox → real-time → messenger → help center) after S05; **v1.0.0** after S15.
- Packages: `llm`, `mailin`, `messenger`, `rag`, `eval`, `shared`, `db`, `config` + `api`/`web`/`worker`.
- CI is **deterministic, DB-less, and LLM-less** end to end — pure cores + in-memory fakes + the mock model.

## v2 ideas

Multilingual triage + bot, voice channel, proactive outreach (the bot starts conversations), per-brand
tone/voice, a learner-facing eval-authoring UI, live-eval A/B prompt comparison.

## The one thing to remember

*Shipping AI responsibly means the eval never stops running — it gates your PRs, guards production, and is the
first thing to tell you the model changed under you.*
