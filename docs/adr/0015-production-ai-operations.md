# ADR-0015 — Operating AI in production: observe, govern, degrade, and never stop the eval

**Status:** accepted (S15) · **Deciders:** Harbor course

## Context

Harbor is going to v1.0 with AI in the loop. An AI feature isn't done when it ships — it has a **runtime bill**
and a **quality that drifts under you** as models and data change. Production operations for AI need things a
CRUD app doesn't: LLM cost/latency/quality observability, cost governance with graceful degradation, and a way
to catch a *silent* quality regression before customers do. This ADR records the operating stance.

## Decisions

### 1. LLM calls are first-class ops telemetry
The S01 `LLMCall` ledger pays off as queryable spans: **$/day by feature, p95 latency, token trends, refusal
rate, cache hit rate.** AI features have a bill ops must watch like error rate. 🔍 **Refusal rate is a
product-health metric** — a spike almost never means "the bot got shy," it means retrieval broke or content is
missing; the metric points at the real cause.

### 2. Cost is governed, and the cap degrades to humans
Per-workspace **budgets**: a soft alert warns, a hard cap stops spend. Hitting the cap degrades to **human-only**
support — never a crash, never a surprise invoice. 🔗 Relay/Pulse quota discipline.

### 3. AI is an enhancement over a working human system — its outage degrades gracefully
When the provider is down or the budget is capped, the bot disables cleanly and conversations route to the S04
human inbox, which still works, with an admin banner. *A support tool whose core depends on an LLM being up is
mis-architected.* The eval-first, human-fallback stance from day one is what makes this a config flip, not a
rewrite.

### 4. The eval never stops running — it guards production, not just CI (the debate)

**Quality monitoring: sample-and-grade in production vs rely on user feedback (thumbs)?**
- **Thumbs:** real signal, but sparse and biased (angry users click more).
- **Sample-and-grade:** consistent and proactive, but costs grading $.

**Resolution: both loops.** Automated grading on a traffic sample detects **drift** proactively (the S09
graders, now watching production); user feedback is the **ground truth that recalibrates the graders** (keeps
the LLM-judge honest — 🔗 the S09 meta-eval, ongoing). *Automated eval catches drift early; human feedback keeps
the automated eval trustworthy — you need both.* A drift alert (groundedness drop / refusal spike / latency
blowup) pages on-call.

## Consequences

- `packages/shared/observability.ts` (spend aggregation, budget state, degradation, drift detection) is pure and
  tested; the incident drill (`packages/eval/drill.test.ts`) proves the harness catches a retrieval regression.
- Runbooks (`docs/runbooks/`), a blameless postmortem, backup/restore with an embedding-staleness re-embed path
  (🔗 the S10 migration muscle), and the v1.0.0 release.
- **The whole arc:** the eval harness was built empty (S09), proved RAG (S10), gated triage (S11) and the bot
  (S12), quantified injection defense (S13), authorized autonomy (S14), and now guards production (S15). *The
  eval harness is the spine of every AI decision in the course.*
- **Links:** the S15 sample-vs-thumbs debate; the ledger (S01); the eval harness (S09); the postmortem + course
  retrospective.
