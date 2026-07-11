# Harbor Sprint Playbooks

Execution scripts for the 15-sprint build of **Harbor** (customer messaging & AI support — see [SPEC.md](../../SPEC.md)). Course 5; assumes Meridian, Tracer, Pulse, Relay.

**Start here:** [00-workflow.md](00-workflow.md) — the ritual plus Harbor rules (eval-before-feature, deterministic CI, cost-as-metric, the grounding rule, `claude-api` skill).

| Sprint | Playbook | Headline |
|--------|----------|----------|
| 01 | [sprint-01.md](sprint-01.md) | Foundation: message → inbox skeleton |
| 02 | [sprint-02.md](sprint-02.md) | Workspaces, agents, contacts & identity |
| 03 | [sprint-03.md](sprint-03.md) | Inbound email: MIME, threading, reply stripping |
| 04 | [sprint-04.md](sprint-04.md) | Shared inbox: conversations, assignment, real-time |
| 05 | [sprint-05.md](sprint-05.md) | Messenger widget + help center → `v0.5.0` |
| 06 | [sprint-06.md](sprint-06.md) | Routing & assignment engine |
| 07 | [sprint-07.md](sprint-07.md) | SLAs, escalation, reporting v1 |
| 08 | [sprint-08.md](sprint-08.md) | Knowledge base + search (dialogue format) |
| 09 | [sprint-09.md](sprint-09.md) | The eval harness (before any AI feature) |
| 10 | [sprint-10.md](sprint-10.md) | RAG: retrieval over help docs (flagship) |
| 11 | [sprint-11.md](sprint-11.md) | AI triage + structured outputs |
| 12 | [sprint-12.md](sprint-12.md) | Answer-bot: guardrails, citations, cost |
| 13 | [sprint-13.md](sprint-13.md) | Hardening: prompt injection, PII, abuse |
| 14 | [sprint-14.md](sprint-14.md) | Bot autonomy, handoff & polish |
| 15 | [sprint-15.md](sprint-15.md) | Production readiness → `v1.0.0` |

**Arcs to watch:** eval-before-feature (S9 harness → every AI sprint gated by it); the email threading flaw aging S3→S13; the LLM-as-supervised-participant stance (triage suggests, bot cites-or-refuses, human always in the loop until S14's confidence gate). Ledger: [flaw-ledger.md](flaw-ledger.md).
