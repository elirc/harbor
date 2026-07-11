# Harbor — Customer Messaging & Support Platform (Intercom Lite)

## Project Spec & 15-Sprint Upskilling Curriculum (Course 5)

**Version:** 1.0 · **Date:** 2026-07-09 · **Folder:** `harbor/` (splits into its own repo later)

---

## 1. Purpose

Fifth course. Same model (AI authors everything; junior predicts, reviews-before-reveal, runs labs, co-authors from S8).

**What this course uniquely teaches:**

- **Inbound email parsing & threading** — MIME, reply stripping, conversation reconstruction from messy mail
- **Routing & assignment engines** — rules, round-robin, load-aware assignment, SLAs, escalation
- **LLM features done properly** — this is the flagship: **RAG over help docs with an evaluation harness**, AI triage with structured outputs, an answer-bot with guardrails and citations, and cost/latency engineering. Not "call the API and hope" — measured, evaluated, safe.

**Signature teaching arc:** the LLM sprints (S9–S12) are built the way a serious team ships AI: an **eval harness before the feature** (S9), retrieval quality measured (S10), structured outputs with schema-validation and fallback (S11), and guardrails + cost controls treated as correctness (S12). The recurring lesson: *an LLM feature without an eval is a demo, not a product.*

> Functional clone of the Intercom category (shared inbox, messenger, help center, AI support) — no branding or assets. Product name: **Harbor**. Uses the Claude API for LLM features (see the `claude-api` skill for model IDs, structured outputs, pricing, and token/cost accounting — consult it before writing any LLM code).

## 2. Product Overview

**Personas:** Agent (answers conversations) · Admin (routing rules, team, knowledge base) · End-user (writes in via email or messenger) · **the AI** (triage + answer-bot, a supervised participant, never unsupervised).

**Core domains:** conversations & shared inbox → channels (inbound email, embeddable web messenger) → contacts & identity → routing/assignment & SLAs → help center (public articles) → knowledge base + RAG → AI triage → answer-bot with guardrails → reporting → cost/latency governance for LLM calls.

## 3. Tech Stack

| Layer | Choice | Teaching rationale |
|---|---|---|
| Language / repo | TypeScript strict · pnpm + Turborepo | carried |
| Agent app | Next.js (inbox UI, real-time) | carried; SSE for live conversations (🔗 Tracer/Pulse SSE lessons) |
| Messenger SDK | `packages/messenger` — embeddable widget, <30KB, iframe-isolated | shipping to strangers' sites again (🔗 Pulse SDK discipline) |
| API | Fastify | carried |
| Inbound email | **`packages/mailin`** — MIME parsing (`mailparser`-style), reply/signature stripping, threading; a **mock SMTP/inbound provider** in the farm | email is a swamp; parsing it is the S3 lesson |
| DB | PostgreSQL + Prisma; **pgvector** for embeddings | vector search without a new datastore — deliberate (contrast Pulse's ClickHouse; here PG suffices, and we prove it) |
| Queue/jobs | BullMQ + Redis | carried |
| LLM | **Claude API** (Messages, structured tool use, streaming); an abstraction layer with a **mock model** for deterministic eval/CI | never hit a live model in CI; determinism via recorded fixtures |
| Eval | `packages/eval` — a from-scratch eval harness (datasets, graders, regression gates) | the course's crown jewel |
| Testing / CI / observability | carried; plus LLM cost/latency/quality dashboards | |

**Layout:** `apps/{web,api,worker}`, `packages/{messenger,mailin,llm,eval,rag,db,shared,config}`, `docs/{adr,curriculum,sprints,runbooks,audits,evals}`.

## 4. Curriculum deltas

1. **Eval-before-feature rule:** no LLM feature merges without an eval dataset + graders + a committed baseline score. "It looked good in the demo" is not a merge criterion.
2. **Determinism in CI:** LLM calls in tests go through the mock model with recorded fixtures; live-model runs are a separate, non-blocking nightly job with cost caps.
3. **Cost is a metric:** every LLM feature reports tokens + $/action; cost regressions are reviewed like latency regressions.
4. **Consult the `claude-api` skill** before writing LLM code (models, structured outputs, caching, token counting).
5. Labs after S3, S7, S10, S12, S13.

### Competency additions

| Competency | Taught in |
|---|---|
| MIME/email parsing, threading, reply stripping | S3 |
| Embeddable widgets, iframe isolation, postMessage | S5 |
| Real-time inbox, presence, typing (fast-forward SSE) | S4 |
| Routing/assignment algorithms, SLAs, escalation | S6, S7 |
| Vector search, chunking, retrieval quality | S10 |
| LLM eval harness design | S9 |
| Structured outputs, schema validation, fallback | S11 |
| Prompt-injection & jailbreak defense | S11, S12, S13 |
| LLM cost/latency/caching engineering | S12 |
| PII handling in support data | S13 |

## 5. Domain Model (reference)

```
Workspace ─┬─ Agent (User) · Team (routing target)
           ├─ Contact ── Identity (email(s), messenger id, external id)
           ├─ Conversation ─┬─ Message (inbound/outbound, channel, author, raw + parsed)
           │                ├─ Assignment (agent/team, history) · SLAWindow
           │                └─ AIAction (triage result | bot draft | bot reply, with citations + eval trace)
           ├─ RoutingRule (condition → assignment) · Escalation policy
           ├─ Article (help center, public) ─ ArticleChunk (embedded, pgvector)
           ├─ EvalDataset ── EvalCase · EvalRun (scores over time)
           └─ LLMCall (append-only: prompt ref, model, tokens, cost, latency, outcome)
```

## 6. Sprint map

| # | Sprint | Phase | Size | Headline |
|---|---|---|---|---|
| 1 | Foundation & walking skeleton (message → inbox) | MVP | S | Fast-forward; LLM abstraction stub from day one |
| 2 | Workspaces, agents, contacts & identity | MVP | M | Contact identity resolution (echoes Pulse S6) |
| 3 | Inbound email: MIME, threading, reply stripping | MVP | L | The email swamp; mock inbound provider |
| 4 | Shared inbox: conversations, assignment, real-time | MVP | L | SSE inbox, states, notes, canned replies |
| 5 | Web messenger widget + help center → `v0.5.0` | MVP | M/L | Embeddable widget, public articles, deploy |
| 6 | Routing & assignment engine | Full | L | Rules, round-robin, load-aware, SLAs |
| 7 | SLAs, escalation & reporting v1 | Full | M/L | Time-based escalation, breach alerts, metrics |
| 8 | Knowledge base + help-center search (dialogue) | Full | M/L | FTS + chunking prep; learner co-authors |
| 9 | The eval harness (flagship prep) | Full | L | Datasets, graders, CI gates — before any AI feature |
| 10 | RAG: retrieval over help docs | Full | XL | Embeddings, pgvector, chunking, retrieval eval |
| 11 | AI triage + structured outputs | Full | L | Classify/route with schema-validated tool use |
| 12 | Answer-bot: guardrails, citations, cost | Full | L | Grounded generation, refusal, $/latency budgets |
| 13 | Hardening: prompt injection, PII & abuse | Full | L | Audit format; injection defense, PII redaction |
| 14 | Bot autonomy, handoff & polish | Full | M/L | Confidence-gated auto-reply, human handoff, a11y |
| 15 | Production readiness → `v1.0.0` | Full | L | LLM observability, cost governance, incident drill |

## 7. Open questions (decide before Sprint 1)

1. Live Claude API budget for the nightly eval job (cost cap per run)?
2. Inbound email in prod: a real provider (Postmark/SES inbound) or keep the mock through v1?
3. Messenger widget: iframe (safer) confirmed over inline (lighter)? Spec assumes iframe.
