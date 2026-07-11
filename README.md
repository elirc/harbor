# Harbor

**Status: v1.0.0 — all 15 sprints shipped.** See [`docs/COURSE-RETROSPECTIVE.md`](docs/COURSE-RETROSPECTIVE.md)
for the eval-first arc, the flaw ledger, and the cost tally.

**Harbor is a course, not just a codebase.** It builds an Intercom-style customer messaging & support
platform — shared team inbox, inbound email, an embeddable web messenger, routing/SLAs, a help center, and an
AI answer-bot — as a git-connected sequence of 15 teaching-rich sprints. Each sprint is a Pull Request loaded
with annotated code, ADRs, design-debate threads, and planted-then-harvested flaws, designed to take a junior
engineer to mid/senior.

Harbor is **Course 5** of a six-course curriculum (Meridian → Tracer → Pulse → Relay → **Harbor** → Folio).

## The thesis

> **An LLM feature without an eval is a demo, not a product.**

Harbor's signature arc is **eval-before-feature**: from Sprint 9 no AI feature merges without an eval dataset,
graders, and a committed baseline score. AI is a *supervised* participant — suggest → draft → gated auto-reply
— never unsupervised until a confidence gate earns it. Tests are **deterministic** (a mock model + recorded
fixtures; live-Claude runs are a separate, cost-capped nightly), and **cost is a reviewed metric** like
latency.

## What it teaches

- **Email is not a solved problem** — MIME parsing, threading, reply/signature stripping against a corpus of
  genuinely nasty real-world emails.
- **Identity resolution** — one human across email/messenger/external ids, with merge races.
- **Shared real-time state** — a team inbox, assignment without double-claims, presence.
- **Embeddable widgets** — a <30KB iframe-isolated messenger with a postMessage bridge (a guest on strangers'
  pages).
- **Routing engines** — assignment, SLAs, escalation.
- **LLM done right** — a from-scratch **eval harness**, RAG with grounding (cite or refuse), structured
  outputs with validation + fallback, prompt-injection defense, and LLM cost engineering.

## Stack (planned)

pnpm + Turborepo · TypeScript strict · `apps/web` (Next.js) · `apps/api` (Fastify) · `apps/worker` (BullMQ) ·
`packages/{messenger, mailin, llm, eval, rag, db (Prisma + pgvector), shared, config}` · PostgreSQL + Redis.

CI runs **without live infra and without live LLM calls** — pure cores + in-memory fakes + a mock model.

## Docs
- `SPEC.md` — the product spec.
- `docs/sprints/` — the 15 sprint playbooks + the ritual (`00-workflow.md`).
- `docs/adr/` — architecture decisions (0001–0015). `docs/curriculum/` — per-sprint learning notes.
- `docs/LEARNER-GUIDE.md` — how to work through the course.
- `docs/runbooks/`, `docs/audits/` — AI-operations runbooks, the S13 security audit, the S15 postmortem.
- `CHANGELOG.md` · `docs/COURSE-RETROSPECTIVE.md`.
