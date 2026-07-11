# Sprint 12 — Answer-Bot: Guardrails, Citations & Cost

**Branch:** `sprint-12/answer-bot` · **Size:** L · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** The user-facing AI: an answer-bot that drafts grounded replies from RAG (S10), **cites its sources or refuses**, resists answering outside its knowledge, and does it within measured cost and latency budgets. Guardrails and grounding are treated as correctness, gated by the eval. Harvests the retrieval-threshold half of flaw #3.

## A — Issues
1. `Grounded generation: answer strictly from retrieved chunks, with inline citations`
2. `Guardrails: refuse when retrieval is weak / out of scope / sensitive; no hallucinated facts`
3. `Cost/latency: token budgets, prompt caching, model selection, streaming`
4. `Bot eval: groundedness, citation-accuracy, refusal-correctness, cost per answer`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(rag): retrieval relevance threshold — below-score → "no good sources" signal` | **harvests flaw #3 (part 2)**, ledger quoted: S10 always returned top-k even when irrelevant; now weak retrieval is detectable — the precondition for refusal |
| 2 | `feat(llm): grounded-answer prompt — answer only from provided chunks, cite chunk ids, say "I don't know" if unsupported` | the grounding contract in the prompt; consult `claude-api` for citation/system-prompt patterns |
| 3 | `feat(bot): citation extraction + verification — every claim maps to a cited chunk; drop/flag uncited claims` | citations aren't decoration: post-generation, verify the answer's claims are supported; ungrounded → refuse (🔗 grounding rule from 00-workflow) |
| 4 | `feat(bot): refusal paths — weak retrieval, out-of-scope, sensitive-topic → graceful "let me get a human"` | refusal is a *feature*, and correct refusal is eval-scored |
| 5 | `feat(eval): bot dataset — answerable (expect grounded answer+citation), unanswerable (expect refusal), adversarial; graders for groundedness + citation accuracy + refusal` | the learner curates the unanswerable/adversarial cases — teaching that *when not to answer* is half the eval |
| 6 | `feat(llm): cost controls — prompt caching for the system/context, model selection by task, max-token caps` | 🔗 `claude-api` skill for prompt caching + pricing; cache the stable system prompt + retrieved context; the cost delta is measured |
| 7 | `feat(llm): streaming responses to the agent/widget; latency budget (first-token, full-answer)` | |
| 8 | `feat(web): bot draft in composer — agent reviews/edits/sends (assistive mode; autonomy is S14)` | the bot drafts, the human sends — supervised by default |
| 9 | `test(eval): bot eval gate — groundedness ≥ target, citation accuracy ≥ target, refusal correctness ≥ target, $/answer ≤ budget` | quality *and* cost are both gates |
| 10 | `docs: ADR-0011 grounded-generation + refusal policy + cost budget; curriculum note` | |

## C — Review order
The relevance threshold (1, flaw harvest) → grounding prompt (2) → **citation verification + refusal (3–4)** → the bot eval with its unanswerable cases (5) → cost controls (6).

## D — Teaching comments (~12)
- relevance threshold — 🔗 flaw #3 fully closed: retrieval that always returns top-k forces the model to answer from irrelevant context (confident nonsense); a score threshold enables "I don't know" — the single most important guardrail
- grounding as correctness — 📘 an ungrounded answer isn't a lower-quality answer, it's a *bug*; citation verification treats "every claim supported by a source" as an assertion, tested like any invariant
- citation verification — ⚠️ models cite plausibly but sometimes wrongly; verifying claims map to cited chunks (not just that citations exist) is the difference between real grounding and citation theater
- refusal is a feature — 📘 the hardest thing to teach a bot is *when not to answer*; unanswerable and adversarial eval cases are as important as answerable ones; a bot that always answers is a liability
- cost engineering — 📘 prompt caching the stable prefix (system + retrieved context) is the biggest $/answer lever; model selection by task (cheap model for easy classification, stronger for generation); every choice measured against the budget gate (consult `claude-api` for caching + pricing)
- streaming + latency budget — 🔗 perceived latency (first token) vs total; the Tracer/Pulse latency-budget discipline, LLM-shaped
- assistive by default — 📘 the bot drafts, the human sends; autonomy is earned via confidence + eval (S14), never assumed; supervised AI is the safe default stance

## E — Debate
**"Refuse-when-uncertain vs always-attempt-with-disclaimer?"** Always-attempt: higher coverage, but confident wrong answers destroy trust and can be dangerous (billing, security topics). Refuse: safer, lower coverage, some frustration. **Resolution:** refuse below the retrieval/confidence threshold and hand to a human; a wrong answer in support costs more than an "I'll get someone" — measured by the refusal-correctness eval. Lesson: *for user-facing AI, the cost of a confident wrong answer sets the refusal threshold — and only the eval tells you where it is.*

## F/G — Close
- Squash: `feat(sprint-12): answer-bot — grounding, citations, refusal, cost (closes #…)`
- **Lab (break-it):** the learner tries to make the bot hallucinate or answer out of scope; documents which guardrail catches each attempt and files any that slip (feeding S13).
- Ledger: flaw #3 fully closed.
- Recap idea: *a trustworthy bot cites or refuses, and proves both in an eval — grounding and knowing-when-to-stop are the whole game.*
