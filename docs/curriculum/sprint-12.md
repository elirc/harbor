# Curriculum Note — Sprint 12: Answer-Bot — Grounding, Citations, Refusal & Cost

> **A trustworthy bot cites or refuses — and proves both in an eval.** Grounding and knowing-when-to-stop are
> the whole game.

## Learning objectives
- Treat **grounding as correctness** — an ungrounded answer is a bug, not a lower-quality answer.
- Build the **relevance threshold** that makes "I don't know" possible (the flaw-#3 harvest).
- Verify citations, not just require them.
- Set the **refusal threshold** by the cost of a confident wrong answer — and locate it with the eval.
- Engineer **cost** as a first-class gate.

## Key concepts
- **🔗 The relevance threshold closes flaw #3.** S10's retrieval always returned top-k, so even an out-of-scope
  query got the k least-bad chunks, and the generator answered from irrelevant context — confident nonsense.
  A score threshold lets retrieval say "no good sources," which is the *precondition* for refusal. This is the
  single most important guardrail, and its exact value is **tuned by the eval, not guessed** (that's why S09
  came first).
- **📘 Grounding is a tested invariant.** The prompt says "answer only from the context and cite it," but a
  prompt is a request, not a guarantee. So we verify after generation: every `[n]` must map to a real provided
  chunk, and an answer with claims but no valid citation is *ungrounded* — suppressed to a refusal. Test it like
  any assertion.
- **⚠️ Citation theater vs real grounding.** Models cite *plausibly* and sometimes *wrongly* — a `[3]` when only
  two chunks were given is a fabricated source. Checking that citations *exist* proves nothing; checking they
  *map to actual chunks* is the difference between grounding and decoration.
- **📘 Refusal is a feature, and the hardest thing to teach.** A bot that always answers is a liability. So the
  eval dataset weights unanswerable and adversarial cases as heavily as answerable ones — "when not to answer"
  is half the eval. A refusal is always an acceptable output; a confident guess often isn't.
- **📘 The cost of a wrong answer sets the refusal threshold — and only the eval finds it.** Refuse too eagerly
  and you frustrate users; refuse too rarely and you ship confident errors. Where exactly to draw the line is an
  empirical question the refusal-correctness eval answers, not a taste call.
- **📘 Cost engineering: model selection + prompt caching.** Don't pay generation prices to classify. Route
  cheap+fast models to high-volume/low-nuance tasks and a stronger model to the customer-facing answer;
  prompt-cache the stable prefix (system + retrieved context) for the biggest $/answer win; cap output tokens.
  Every choice is measured against the budget gate — a quality win that triples cost is a tradeoff, not a win.
- **📘 Assistive by default.** The bot drafts; the human sends. Autonomy is earned in S14 via a confidence gate
  and the eval, never assumed. Supervised AI is the safe stance for anything customer-facing.

## The debate, cashed
**Refuse-when-uncertain vs always-attempt-with-a-disclaimer?** Resolved: **refuse below the
retrieval/confidence threshold (and on sensitive topics), hand to a human** — because a confident wrong answer
costs more than "let me get someone," and the refusal-correctness eval measures where the line is. (ADR-0012.)

## ⚗️ Lab (`lab/sprint-12`, break-it)
Try to make the bot **hallucinate** or **answer out of scope**. Document which guardrail catches each attempt
(the relevance threshold? the grounding prompt? citation verification?) and file any that slip through — those
feed S13's hardening. The most valuable thing you can do to a user-facing bot is attack it.

## Exercise questions
1. Retrieval returns 5 chunks all scoring 0.05 for a query. Trace the bot's path to a refusal. Which line
   decides it, and what would happen without the threshold?
2. The model returns "Reset it in Settings [4]" but only 3 chunks were provided. What does citation verification
   do, and why is "the answer has a citation" not good enough?
3. Your eval shows refusal-correctness 0.98 but answerable-coverage 0.60 (the bot refuses a lot). Is the
   threshold too high or too low? What number decides it?
4. Give a support scenario where an *always-attempt-with-a-disclaimer* bot causes real harm that a refusing bot
   avoids. Then give one where refusal is the frustrating wrong call.
5. Compute the $/answer for (a) generating on the strong model with an uncached 2k-token context vs (b) the same
   with the prefix cached. Which lever matters more, model choice or caching?

## Further reading
- Grounded generation / faithfulness · citation verification & attribution · refusal / abstention in QA ·
  prompt caching + pricing (`claude-api` skill) · ADR-0012, ADR-0010, ADR-0009 · the break-it lab → S13.
