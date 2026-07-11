# Sprint 01 — Foundation: Message → Inbox Skeleton

**Branch:** `sprint-01/foundation` · **Size:** S · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** Fast-forward scaffold; the walking skeleton is one conversation: an API-posted message creates a conversation that appears in an agent inbox. The LLM abstraction layer exists as a stub from day one so AI is architecturally present, not bolted on at S9.

## A — Issues
1. `Monorepo scaffold: apps/{web,api,worker}, packages/{llm,db,shared,config}`
2. `Walking skeleton: POST message → Conversation + Message → inbox list`
3. `packages/llm: provider abstraction with a mock model (no live calls yet)`
4. `CI + governance (fast-forward); ADR-0001 LLM abstraction; ADR-0002 pgvector-later plan`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `chore: monorepo scaffold (fast-forward, compressed)` | |
| 2 | `feat(db): Conversation, Message, Contact (minimal)` | Message stores raw + parsed (parsed==raw for now; S3 fills it) |
| 3 | `feat(api): POST /conversations/:id/messages + GET /inbox` | |
| 4 | `feat(llm): provider interface — complete(), the mock model, LLMCall logging table` | interface designed against the `claude-api` skill's Messages shape; mock returns fixtures; **every** call logged (tokens/cost/latency) from message one |
| 5 | `feat(web): inbox shell — conversation list + thread view` | |
| 6 | `test: skeleton integration + mock-llm unit test` | |
| 7 | `ci: pipelines + branch protection (fast-forward)` | |
| 8 | `docs: ADR-0001 LLM provider abstraction + mock-in-CI; ADR-0002 pgvector when RAG arrives` | |
| 9 | `docs: curriculum note sprint 01` | |

## C — Review order
ADR-0001 → the llm interface + LLMCall table (4) → skeleton.

## D — Teaching comments (~8)
- LLM abstraction from day one — 📘 wrapping the model behind an interface *before* you use it: swap models, mock in CI, and log every call for cost accounting — retrofitting this later means untangling calls from a dozen features
- LLMCall table — 📘 append-only cost ledger: you will be asked "why is the AI bill $4k" and only per-call logs answer; 🔗 Pulse's "count everything" instinct, dollar-shaped
- mock model — 📘 deterministic CI is non-negotiable for AI features (S9 makes this rigorous); the mock returns recorded fixtures keyed by prompt hash
- raw + parsed message — 🔗 S3's email parsing needs both the original bytes and the cleaned text; storing raw always is a debugging lifeline
- consult claude-api skill — 🔗 the interface mirrors the real Messages API so S10+ is a config change, not a rewrite

## E — Debate
**"Design the LLM interface now vs add it when S9 needs it?"** Later: YAGNI. Now: the LLMCall logging, the mock-in-CI discipline, and the swap-seam are all cheaper to establish empty than to retrofit across features. **Resolution:** now, as a stub — the interface and the cost ledger cost an afternoon and shape every AI sprint. Lesson: *the seams you'll depend on are cheapest to cut before there's anything to cut through.*

## F/G — Close
- Squash: `feat(sprint-01): foundation — inbox skeleton, llm abstraction (closes #…)`
- Recap idea: *AI features are still software — give them an interface, a mock, and a cost ledger before you give them a prompt.*
