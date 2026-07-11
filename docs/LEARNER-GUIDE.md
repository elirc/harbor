# Learner Guide — Harbor (Course 5)

Harbor is the fifth of six courses. By now you've built durable workflows (Meridian), real-time sync
(Tracer), data pipelines (Pulse), and orchestration (Relay). Harbor adds the discipline of **shipping LLM
features that are products, not demos** — on top of a real support platform (email, inbox, widget, routing).

## How to work through a sprint
1. **Read the playbook** (`docs/sprints/sprint-NN.md`) and the linked ADRs *before* the code.
2. **Predict**, then review the PR: open the "How to review this PR" order and read in that sequence. Form an
   opinion on each teaching comment (`📘 concept` / `🔍 review-lens` / `⚠️ pitfall` / `🔗 connects`) before
   reading it.
3. **Do the labs** (after S3, S7, S10, S12, S13). They're where the learning sticks — especially the
   eval-writing lab (S10) and the prompt-injection lab (S13).
4. **From S8 you co-author** the junior side of PRs (`[J]`/`[L]`); the AI reviews (`[S]`/`[A]`).
5. **From S9 you curate eval cases.** Writing test cases for AI behavior is a taught-by-doing skill and the
   heart of this course — an eval you didn't write is one you don't trust.

## The four Harbor rules (in force from the sprint noted)
1. **Eval-before-feature (S9+):** no LLM feature merges without an eval dataset + graders + a committed
   baseline in `docs/evals/`. *An LLM feature without an eval is a demo, not a product.*
2. **Deterministic CI:** tests use a mock model + recorded fixtures. Live-Claude runs are a separate,
   non-blocking, cost-capped nightly. CI never makes a live LLM call.
3. **Cost is a reviewed metric:** every LLM-touching PR reports tokens + $/action; cost regressions are
   reviewed like latency regressions.
4. **Grounding rule (S12+):** user-facing AI answers cite sources or refuse. Ungrounded generation is a bug
   the evals test for.

Before writing any LLM code (including S1's stub interface), consult the **claude-api skill** for the Messages
shape, model IDs, structured outputs, and token/cost accounting.

## The planted-flaw method
Some PRs ship a realistic flaw on purpose (logged author-private in `docs/sprints/flaw-ledger.md`, revealed
in the S13 recap). A later sprint *harvests* it with a permanent test that quotes the ledger. Watch for the
oblique teaching comment at the plant site — the lesson lands when it bites. The longest-lived flaw (email
threading) is planted in S3 and harvested in S13.

## The journey
You start by predicting and reviewing; by S8 you co-author; by S9 you own the evals; by the S13 hardening lab
you're attacking your own system. Observer → author → peer. That's the point.
