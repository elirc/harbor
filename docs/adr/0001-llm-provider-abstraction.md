# ADR-0001 — LLM provider abstraction + mock-in-CI

**Status:** accepted (S01) · **Deciders:** Harbor course

## Context

Harbor's AI features (triage S11, answer-bot S12) are months away, but the *shape* of how we call a model —
and how we account for its cost — is a decision worth making now, before there's code to cut through.

## Decision

Define an `LlmProvider` interface (`complete(request)`) on day one, mirroring the **Claude Messages API**:
role/content messages, an optional system prompt, `maxTokens`, token `usage`, a `stopReason`. Every call goes
through an `LlmClient` that wraps a provider and **logs an `LlmCall`** (model, tokens, cost, latency, purpose)
to an append-only ledger. In CI, the provider is a **`MockModel`** returning fixtures keyed by a hash of the
request.

- **Determinism:** the same prompt yields the same output, so tests assert behavior, not vibes. **CI never
  makes a live LLM call.** Live-Claude runs are a separate, cost-capped nightly (S09).
- **Cost as a metric:** the ledger is wired before there's a bill to explain. "Why is the AI spend $4k?" is a
  query over `LlmCall`, grouped by purpose and model.
- **Adoption is config, not rewrite:** because the interface mirrors the real Messages API, swapping the mock
  for the real Claude client in S10+ is a wiring change. (Consult the `claude-api` skill before writing real
  LLM code — model IDs, structured outputs, token accounting.)

## Alternatives considered

- **Design the interface at S9 (YAGNI).** Rejected: seams are cheapest to cut before there's anything to cut
  through. Retrofitting a provider seam + cost ledger across an existing codebase is far more churn than a
  stub now. **Revisit trigger:** none — this is the cheap-insurance direction.
- **Call the SDK directly where needed.** Rejected: it scatters un-metered LLM calls and couples every
  feature to the SDK, making the mock (and thus deterministic CI) impossible.

## Consequences

- Every LLM call in Harbor is metered and swappable from day one.
- The default model (`claude-haiku-4-5`) is a cost-conscious choice for high-volume support; harder tasks opt
  into a bigger model, and the $/action delta is visible in the PR.
- **Links:** the S01 debate thread (interface-now-vs-later).
