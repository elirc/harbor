# Sprint 11 — AI Triage + Structured Outputs

**Branch:** `sprint-11/ai-triage` · **Size:** L · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** The first AI feature that *acts*: triage incoming conversations — classify intent, urgency, and suggested routing — using schema-validated structured outputs (tool use), with validation, fallback, and an eval gate. The LLM proposes; the S6 routing engine and humans dispose. A planted prompt-injection flaw sets up S13.

## A — Issues
1. `Triage: classify intent/topic, urgency, sentiment, suggested team — structured output`
2. `Structured outputs via tool use: schema-validated, with fallback on invalid output`
3. `Triage eval dataset + CI gate (accuracy per field)`
4. `Wire triage into routing (suggestion, not automation) + agent-visible reasoning`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(shared): triage output schema (zod) — intent enum, urgency, sentiment, suggestedTeam, confidence` | schema is the contract; consult the `claude-api` skill for structured tool-use shape |
| 2 | `feat(llm): structured-output call — tool/JSON mode, parse against schema` | **[in-PR arc]** v1 assumes the model always returns valid schema |
| 3 | `test(llm): model returns prose / extra field / missing field → handler crashes, FAILS` | the reality: models don't always obey schemas |
| 4 | `fix(llm): validate → on invalid, one reprompt-with-error, then deterministic fallback (unclassified)` | never crash on model output; the validate/retry/fallback triad — a reusable LLM-robustness pattern |
| 5 | `feat(api): triage prompt build — [naive concatenation of the user message into instructions]` | **[flaw #4]** raw user text inlined into the prompt with no delimiting; injection can steer routing (harvest S13) |
| 6 | `feat(worker): triage on conversation create — async, result stored as AIAction with reasoning + LLMCall link` | triage is a suggestion attached to the conversation, never an auto-action |
| 7 | `feat(eval): triage dataset — labeled conversations; per-field accuracy graders; baseline committed` | the learner curates hard/ambiguous cases |
| 8 | `feat(api+web): triage feeds routing as a suggested rule input; agents see the classification + why` | 🔗 S6 routing consumes triage as one signal among rules — human-overridable |
| 9 | `feat(web): agents can correct triage → corrections become eval cases (the data flywheel)` | mislabeled triage becomes tomorrow's test case |
| 10 | `test: structured-output robustness; triage eval gate; injection placeholder (xfail, wired in S13)` | an injection case is added now but marked expected-fail with a pointer — honesty about the known hole |
| 11 | `docs: ADR-0010 structured outputs + fallback; curriculum note` | |

## C — Review order
The schema (1) → **the invalid-output arc (2→3→4): models disobey schemas** → the prompt build (5, note the raw concatenation) → triage-as-suggestion wiring (8).

## D — Teaching comments (~11)
- structured output ≠ guaranteed — ⚠️ tool/JSON mode makes valid output *likely*, not certain; the validate→reprompt→fallback triad is mandatory; a handler that assumes valid JSON crashes in production (consult `claude-api` for the current structured-output guarantees)
- fallback to unclassified — 📘 the safe default: an uncertain triage is "unclassified, route normally," never a wrong-but-confident action; degradation over failure
- prompt injection seed — *(the flaw: a `📘 concept` note explains that user text enters the prompt, without flagging that it's undefended; S13's injection eval will make it undeniable)*
- triage as suggestion — 📘 the course's AI stance: the model *proposes*, routing rules and humans *dispose*; auto-acting on classification is deferred until S14's confidence gate, and even then bounded
- confidence field — 🔍 review-lens: ask the model for confidence *and* calibrate it against the eval (models are often overconfident); confidence gates autonomy later
- correction flywheel — 📘 agent corrections are free labeled data; piping them into the eval dataset is how the system improves — the data flywheel, built deliberately
- xfail injection case — 🔍 review-lens: adding a known-failing test now (marked xfail, linked to S13) documents the hole honestly instead of hiding it

## E — Debate
**"On invalid structured output: reprompt vs fallback immediately vs fail the conversation?"** Reprompt: often recovers, costs latency + tokens. Immediate fallback: fast, loses the classification. Fail: never acceptable for a support tool. **Resolution:** one reprompt (with the validation error as feedback), then fallback to unclassified — bounded cost, graceful degradation, never a crash or a block. Lesson: *LLM outputs are untrusted inputs; wrap every one in validate-retry-fallback, and bound the retry.*

## F/G — Close
- Squash: `feat(sprint-11): AI triage with structured outputs (closes #…)`
- Deferred: multi-label triage, auto-tagging, language detection.
- Ledger: flaw #4 recorded (prompt injection).
- Recap idea: *treat model output like user input — validate it, bound your retries, and always have a safe fallback.*
