# Harbor — Sprint Execution Workflow

Same ritual as prior courses; restated so this folder is self-contained when split into its own repo.

## Roles
- **Author (AI):** all code, commits, PR bodies, teaching comments, debate threads.
- **Learner (junior):** predict-before-reading, review-before-reveal, prescribed reading order, labs. Co-authors the junior side of S8; from S9 onward, **the learner curates eval cases** (writing test cases for AI behavior is a core skill this course teaches by doing).

## Lifecycle (Phases A–G)
- **A — Setup:** milestone, 3–6 issues, branch `sprint-NN/<slug>`.
- **B — Build:** ordered conventional commits. `[flaw]` logged in `flaw-ledger.md`; `[fix-later-in-PR]` = broken → failing test → fix as a visible story.
- **C — Draft PR:** template body incl. **How to review** order. CI green unless scripted.
- **D — Teaching comments:** 8–20 inline, after the learner's review pass. Prefixes: `📘 concept` · `🔍 review-lens` · `⚠️ pitfall` · `🔗 connects`.
- **E — Planted debate:** question → options → resolution (+ ADR/commit as called for).
- **F — Finalize:** curriculum note with exercises; squash-merge `feat(sprint-NN): … (closes #…)`.
- **G — Post-merge:** deploy check (S5+), deferred issues, milestone close, Sprint Recap, lab branch if scheduled, tags at S5/S15.

## Harbor-specific rules
1. **Eval-before-feature:** no LLM feature merges without an eval dataset, graders, and a committed baseline score in `docs/evals/`. Demos don't count.
2. **CI is deterministic:** LLM calls in tests use the mock model + recorded fixtures. Live-model runs are a separate nightly job with a hard cost cap, non-blocking.
3. **Cost is a reviewed metric:** LLM-touching PRs report tokens + $/action; cost regressions get the same scrutiny as latency.
4. **Consult the `claude-api` skill** before writing any LLM code — model IDs, structured/tool outputs, prompt caching, token counting. Never hardcode model behavior from memory.
5. **Grounding rule:** from S12, any user-facing AI answer must cite its sources or refuse; ungrounded generation is a bug, tested for.
6. **Labs:** after S3, S7, S10, S12, S13 — including an eval-writing lab (S10) and a prompt-injection lab (S13).
7. Conventions otherwise identical: squash-only linear `main`, Conventional Commits, no red merges, TODOs need issues, flaw harvests quote the ledger.
