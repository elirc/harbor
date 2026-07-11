# Curriculum Note — Sprint 1: Foundation (message → inbox)

## Learning objectives
- Stand up the walking skeleton: a message posted to the API lands in a conversation and shows in the inbox.
- Build the **LLM provider abstraction on day one** — mock-in-CI, cost-metered — before any AI feature exists.
- Internalize Harbor's thesis early: *an LLM feature without an eval is a demo, not a product* (evals: S9).

## Key concepts
- **Abstraction before use.** We define `LlmProvider` and the `LlmClient` + cost ledger now, months before the
  answer-bot. 🔗 Seams are cheapest to cut before there's anything to cut through — retrofitting a provider
  seam and a cost ledger across an existing codebase is far more churn than a stub today. And the interface
  *mirrors the Claude Messages API*, so adopting the real SDK (S10+) is config, not a rewrite.
- **Deterministic CI via a mock model.** A real model is non-deterministic and costs money; neither belongs in
  CI. The `MockModel` returns a fixture keyed by a hash of the request, so the same prompt always yields the
  same output — tests assert *behavior*, not vibes. Live-Claude runs are a separate, cost-capped nightly (S9).
  **CI never makes a live LLM call.**
- **Cost is a metric you design in.** Every call flows through `LlmClient`, which logs an `LlmCall` (tokens,
  cost, latency, purpose). 🔗 "Why is the AI bill $4k?" is a query over that ledger, grouped by purpose — not
  a forensic reconstruction after a surprise invoice. The default model is a *cost* decision.
- **Store the original, derive the view.** A `Message` carries `raw` and `parsed`, identical today. By S03
  (inbound email), `raw` is the untouched MIME and `parsed` is stripped + threaded. Naming for that future now
  makes S03 a fill-in, not a migration — and encodes the email lesson early: never mutate the original.

## The debate, cashed
**Design the LLM interface now vs. at S9 (YAGNI)?** Resolved: **now, as a stub.** The stub costs almost
nothing and buys deterministic CI, a cost ledger, and swap-ability from day one; deferring it would scatter
un-metered SDK calls and make the mock impossible. *Seams are cheapest before there's anything to cut through.*

## Exercise questions
1. Why must CI use a mock model instead of the real one? Name two distinct problems it solves.
2. The cost ledger is wired before there's a bill. What question does it make answerable that would otherwise
   require a forensic investigation?
3. Why does a `Message` store both `raw` and `parsed` when they're identical in S01? What future does that
   protect?
4. The LLM interface mirrors the Claude Messages API. What does that buy you in S10 when you adopt the real SDK?

## Further reading
- The Anthropic Messages API · "eval-driven development" · event-sourced cost ledgers · ADR-0001, ADR-0002.
