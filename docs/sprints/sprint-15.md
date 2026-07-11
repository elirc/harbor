# Sprint 15 — Production Readiness → v1.0.0

**Branch:** `sprint-15/production-readiness` · **Size:** L · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** Operate a support platform with AI in the loop: conversation + LLM observability (quality, cost, latency, drift), cost governance and budgets, an AI-incident drill (a model/retrieval regression caught by monitoring), runbooks, backup/restore, and the v1.0 release with course retrospective.

## A — Issues
1. `Observability: request tracing, LLM call dashboards (cost/latency/quality/refusal-rate), conversation metrics`
2. `Cost governance: per-workspace LLM budgets, alerts, degradation modes`
3. `AI drift/quality monitoring: production eval sampling; alert on quality/refusal-rate shifts`
4. `Ops: graceful shutdown, backup/restore drill, provider-outage degradation`
5. `Incident drill: a retrieval/model regression in production; runbooks; v1.0.0`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(obs): request tracing web→api→worker→LLM, correlated; LLM spans carry model, tokens, cost, latency` | 🔗 the LLMCall ledger from S1 becomes queryable spans; "why did this answer cost $0.40 and take 6s" is answerable |
| 2 | `feat(obs): LLM dashboards — $/day by feature, p95 latency, token trends, refusal rate, cache hit rate` | refusal rate is a *product-health* metric: a spike means retrieval broke or content is missing |
| 3 | `feat(obs): production quality monitoring — sample live conversations, run graders (the S9 harness in prod), trend the scores` | the eval harness runs on production traffic, not just CI — drift detection |
| 4 | `feat(api): cost governance — per-workspace LLM budgets, soft-alert + hard-cap (fall back to human-only when capped)` | 🔗 Relay/Pulse quota lessons; hitting the cap degrades to human support, never to a crash or a surprise bill |
| 5 | `feat(obs): drift alerts — groundedness/refusal-rate/latency deviations page on-call` | a silent model or retrieval regression is caught by the graders, not by an angry customer tweet |
| 6 | `feat(api): provider-outage degradation — Claude API down → bot disables cleanly, conversations route to humans, banner to admins` | AI is an enhancement; its outage degrades to the S4 human inbox, which still works |
| 7 | `feat(worker): graceful shutdown — drain in-flight LLM calls + jobs; deploy-safe (fast-forward)` | |
| 8 | `feat(ops): backup + tested restore — conversations, articles, embeddings, contacts; restore drill on staging` | embeddings restore + re-embed-if-stale procedure documented |
| 9 | `test(drill): incident — inject a retrieval regression (break the embedding index) on staging under traffic` | executed for real: groundedness score drops, refusal rate spikes, drift alert fires, runbook restores the index — **the eval harness is the smoke detector** |
| 10 | `docs: postmortem — retrieval regression (blameless); action items as issues` | finding: the drift alert worked but fired 40 min late; sampling rate tuned |
| 11 | `docs: runbooks — LLM provider outage, cost spike, quality/drift regression, retrieval index rebuild, restore, rollback` | |
| 12 | `chore(release): changelog; staging/prod docs; README refresh` | |
| 13 | `docs: course retrospective — the eval-first arc, the AI-as-supervised-participant stance, cost tally, flaw ledger story, v2 ideas (multilingual, voice, proactive outreach)` | |

## C — Review order
LLM tracing (1) → production quality monitoring (3, the harness in prod) → cost governance + degradation (4, 6) → **the drill: the eval catches a regression (9→10)**.

## D — Teaching comments (~10)
- LLM cost as first-class ops — 📘 the S1 LLMCall ledger pays off: cost/latency/quality dashboards from real spans; AI features have a *runtime bill* that ops must watch like error rate
- refusal rate as health — 🔍 review-lens: a rising refusal rate isn't the bot misbehaving — it's usually retrieval breaking or a content gap; the metric points at the real cause
- eval-in-production — 📘 the S9 harness was built for CI, but its highest value is sampling *live* traffic to catch drift; models and data shift under you; the graders are your production smoke detector
- degrade to humans — 📘 AI is an enhancement over a working human system (S4); when the model is down, over budget, or regressed, falling back to human support is graceful — a support tool whose *core* depends on an LLM being up is mis-architected
- drift alert timing — 📘 the drill found the alert fired late; drills validate *thresholds and latency*, not just existence; a monitor that alerts after the damage is half a monitor
- restore + re-embed — 🔗 embeddings are derived data; restore must include a staleness check and re-embed path (the S10 migration muscle)
- the whole arc — 📘 trace the eval thread: built empty (S9), proved RAG (S10), gated triage (S11) and the bot (S12), quantified injection defense (S13), authorized autonomy (S14), and now guards production (S15) — *the eval harness is the spine of every AI decision in the course*

## E — Debate
**"Quality monitoring: sample-and-grade in production vs rely on user feedback (thumbs)?"** Thumbs: real signal, but sparse and biased (angry users click more). Sample-and-grade: consistent, proactive, costs grading $$. **Resolution:** both — automated grading on a traffic sample for drift detection (proactive), user feedback as ground-truth to recalibrate graders (keeps the judge honest). Lesson: *automated eval catches drift early; human feedback keeps the automated eval trustworthy — you need both loops.*

## F/G — Close & Release
- Squash: `feat(sprint-15): LLM observability, cost governance, incident readiness (closes #…)`
- **Release sequence:** merge → deploy → smoke (email→inbox→bot-draft→reply E2E vs prod) → tag **`v1.0.0`** → GitHub Release → recorded demo (a customer question answered with citations by the bot, live) → close milestone.
- Final discussion: **course retro** — the eval-first methodology reviewed end to end; the "AI proposes, humans dispose (until eval-proven)" stance; the cost tally; learner's curated eval datasets celebrated as a real deliverable; pointer to the capstone (Folio) or Bazaar.
- Recap idea: *shipping AI responsibly means the eval never stops running — it gates your PRs, guards production, and is the first thing to tell you the model changed under you.*
