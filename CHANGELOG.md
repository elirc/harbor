# Changelog

All notable changes to Harbor. This is a teaching repo: each version is a phase boundary in the 15-sprint arc.

## v1.0.0 — Production readiness (S15)

The full product, AI in the loop, operable and observable.

- **Observability** — LLM cost/latency/quality/refusal dashboards from the S01 cost ledger; AI-health endpoint.
- **Cost governance** — per-workspace budgets (soft alert + hard cap → degrade to human-only); per-contact caps.
- **Production quality monitoring** — the S09 eval graders sample live traffic; drift alerts page on-call.
- **Graceful degradation** — provider outage / capped budget → the bot disables, conversations route to humans.
- **Incident drill + runbooks** — a retrieval regression caught by the eval; blameless postmortem; runbooks for
  outage / cost spike / drift / index rebuild / restore / rollback.
- **Course retrospective** — the eval-first arc, the flaw ledger, the cost tally.

### The AI back half (S09–S14)

- **S14** — bot autonomy: confidence-gated auto-reply (three gates in series, earned by a safety eval, off by
  default), the trust ladder, context-carrying handoff, agent assists.
- **S13** — AI hardening: prompt-injection defenses (delimit + classifier + architectural containment + CI
  gate), scope-in-cache-key, PII redaction, per-contact cost caps, messenger origin allowlist, threading
  forwarded-chain guard. Harvested flaws #1 (pt.2), #2, #4, cache-leak.
- **S12** — answer-bot: grounding as a tested invariant, citation verification, refusal, cost. Closed flaw #3.
- **S11** — AI triage: structured outputs (validate→reprompt→fallback), correction flywheel. Planted flaw #4.
- **S10** — RAG: pgvector, hybrid retrieval, the chunker showdown (harvested flaw #3 pt.1). Planted retrieval
  threshold.
- **S09** — the eval harness: datasets, graders, the meta-eval, regression gate. The spine.

## v0.5.0 — MVP (S05)

A support team could run on this.

- **S05** — embeddable messenger widget (iframe, postMessage bridge, planted flaw #2) + public help center.
- **S04** — shared inbox: state machine, atomic assignment claim, real-time (SSE), presence.
- **S03** — inbound email: MIME parsing, reply/signature stripping, subject threading (planted flaw #1) + corpus.
- **S02** — workspaces, agents, contacts & identity resolution + merge.
- **S01** — foundation: the walking skeleton + the LLM provider abstraction & cost ledger, built day one.
