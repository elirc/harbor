# ADR-0011 — Structured outputs: validate → reprompt → fallback; triage as a suggestion

**Status:** accepted (S11) · **Deciders:** Harbor course

## Context

Triage is Harbor's first AI feature that *acts*: it classifies an incoming conversation (intent, urgency,
sentiment, suggested team) so routing and agents have a signal. To act on a classification, the code needs a
*structured* output it can rely on. But a language model's output is not a guaranteed shape — tool/JSON mode
makes a valid schema *likely*, never certain. This ADR records how we get reliability out of an unreliable
producer, and the stance that the model proposes while humans and rules dispose.

## Decisions

### 1. Treat model output like untrusted user input (the debate)

**On invalid structured output: reprompt, fall back immediately, or fail the conversation?**
- **Reprompt:** often recovers; costs latency + tokens.
- **Immediate fallback:** fast; loses the classification.
- **Fail the conversation:** never acceptable for a support tool.

**Resolution: validate → ONE reprompt (with the validation error as feedback) → deterministic fallback.**
`structuredComplete` parses the reply against the Zod schema; on failure it hands the model its own bad output
plus the specific error and asks once more; if that also fails, it returns a safe default (`UNCLASSIFIED`) — it
never throws, never blocks, and never reprompts unbounded. *LLM outputs are untrusted inputs; wrap every one in
validate-retry-fallback, and bound the retry.* A handler that does `schema.parse(text)` and trusts it crashes
in production the first time the model wraps its JSON in prose.

### 2. The safe fallback is "unclassified, route normally"
Degradation over failure. An uncertain triage (`confidence: 0`, route to `general`) costs nothing — a human
routes it. A confident-*wrong* triage sends an angry billing dispute to the sales team. So when validation
fails, we degrade to a harmless default, never to a plausible-but-wrong action.

### 3. Triage is a SUGGESTION, never an auto-action
The course's AI stance, made concrete: the model *proposes* (stored as an `AIAction` with its reasoning + a
`LLMCall` link), and the S06 routing engine + humans *dispose*. Auto-acting on a classification waits for
S14's confidence gate, and even then is bounded. `confidence` is asked of the model *and* calibrated against
the eval (models are overconfident) — it's what gates autonomy later.

### 4. Corrections are labeled data (the flywheel)
An agent overriding a triage isn't just a fix; it's a free labeled example. The correction is stored and feeds
the eval dataset, so today's mistake becomes tomorrow's regression test. This is deliberate: the most valuable
training data a support-AI has is the classifications its humans corrected.

## Consequences

- `packages/llm/structured.ts` (validate/reprompt/fallback, JSON extraction) and `packages/shared/triage.ts`
  (schema, `UNCLASSIFIED`, prompt build) are pure and unit-tested; every AI feature reuses the triad.
- Schema: `LLMCall` (persisted cost ledger) and `AIAction` (suggestion + reasoning + correction).
- **Planted (ledger flaw #4):** the triage prompt inlines the customer's raw message with **no delimiting or
  defense**, so an instruction-shaped message can steer the classification (prompt injection). An eval case for
  it exists now, marked expected-fail with a pointer to S13, which hardens the trust boundary. Honesty about a
  known hole beats hiding it.
- **Links:** the S11 reprompt-vs-fallback debate; the structured-output arc (`structured.test.ts`); the S09
  eval (triage ships with a per-field accuracy gate); S06 routing (consumes triage as one signal).
