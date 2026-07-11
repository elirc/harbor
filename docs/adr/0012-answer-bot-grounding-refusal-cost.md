# ADR-0012 — Answer-bot: grounding as correctness, refusal as a feature, cost as a gate

**Status:** accepted (S12) · **Deciders:** Harbor course

## Context

The answer-bot is Harbor's user-facing AI: it drafts replies to customers from the help center. For a
support bot, a confident *wrong* answer is worse than no answer — it destroys trust and, on billing or security
topics, can do real harm. So this sprint treats **grounding and knowing-when-to-stop as correctness**, gated by
the eval, and holds the bot to a measured cost budget. It also closes the second half of flaw #3.

## Decisions

### 1. A relevance threshold — the precondition for "I don't know" (harvest of flaw #3, part 2)
S10's retrieval always returned top-k, even for an out-of-scope query — which forced the generator to answer
from irrelevant context (confident nonsense). We add a **relevance threshold**: below a minimum similarity,
retrieval reports "no good sources." This is the single most important guardrail, because it's the precondition
for refusal. The threshold is **tuned by the eval, not guessed** — which is why S09 was built first. Flaw #3 is
now fully closed.

### 2. Grounding is a tested invariant, not a vibe
The prompt contract: *answer ONLY from the numbered context, cite the [n] you used, say "I don't know" if
unsupported, never use outside knowledge.* But a prompt is a request, not a guarantee — so we **verify** after
generation: every `[n]` must map to a provided chunk (an out-of-range citation is a *fabricated source*), and an
answer with claims but no valid citation is **ungrounded and suppressed to a refusal**. ⚠️ Models cite plausibly
but sometimes wrongly; checking that citations *exist* is citation theater — checking they *map to real chunks*
is grounding. An ungrounded answer is a bug, tested like any invariant.

### 3. Refusal is a feature, and correct refusal is eval-scored (the debate)

**Refuse-when-uncertain vs always-attempt-with-a-disclaimer?**
- **Always attempt:** higher coverage, but confident wrong answers destroy trust and can be dangerous.
- **Refuse:** safer, lower coverage, some user frustration ("just tell me!").

**Resolution: refuse below the retrieval/confidence threshold (and on sensitive topics), and hand to a human.**
A wrong answer in support costs more than an honest "let me get someone" — and *how much more* sets the
threshold, which **only the eval tells you.** The bot dataset scores refusal-correctness on unanswerable and
adversarial cases as seriously as it scores answers on answerable ones. *For user-facing AI, the cost of a
confident wrong answer sets the refusal threshold, and only the eval locates it.*

### 4. Cost is a gate, and assistive is the default
- **Model selection by task** — cheap+fast for classification/rerank, a stronger model for the customer-facing
  answer; every choice measured against the $/answer budget. **Prompt-cache the stable prefix** (system +
  retrieved context) for the biggest $/answer win (a `claude-api` `cache_control` concern at the real client).
  A hard `MAX_ANSWER_TOKENS` cap bounds runaway generations.
- **Assistive by default** — the bot *drafts*; the agent reviews/edits/sends. Autonomy (auto-send) is earned via
  a confidence gate + eval in S14, never assumed. Supervised AI is the safe stance.

## Consequences

- `packages/rag` gains `retrieveRelevant` (the threshold); `packages/shared/answerbot.ts` holds the pure
  grounding/refusal/citation logic; `packages/llm/selection.ts` holds model selection + cost estimation — all
  unit-tested. The bot eval scores groundedness, citation accuracy, refusal correctness, and $/answer.
- **Ledger: flaw #3 fully closed** (chunking S10 + retrieval threshold S12).
- **Foreshadow:** the injection case from S11 (flaw #4) still isn't defended — the grounding prompt reduces its
  blast radius but the trust boundary is hardened in S13.
- **Links:** the S12 refuse-vs-attempt debate; ADR-0010 (retrieval this thresholds); ADR-0009 (the eval that
  locates the threshold); the break-it lab feeding S13.
