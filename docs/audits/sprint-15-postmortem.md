# Postmortem — Retrieval regression (drill, staging) — *blameless*

**Date:** S15 incident drill · **Severity:** SEV-2 (simulated) · **Status:** resolved · **Author:** on-call (learner)

## Summary

During the S15 readiness drill we **intentionally injected a retrieval regression** on staging under synthetic
traffic — the embedding index was corrupted so retrieval returned nothing relevant. As designed, the answer-bot
began refusing answerable questions (grounding + relevance threshold working correctly), the production drift
monitor detected the refusal-rate spike and groundedness drop, paged on-call, and the runbook restored the index
via re-embed. **The eval harness was the smoke detector**, exactly as intended.

## Timeline (relative)

- **T+0** — index corruption injected on staging; synthetic answerable traffic running.
- **T+0** — bot behavior changed immediately: refusal rate went 0.15 → ~1.0 (it correctly refused rather than
  answering from empty context — the S12 threshold doing its job).
- **T+40m** — drift alert fired (groundedness drop + refusal spike) and paged on-call.
- **T+45m** — runbook §4 (re-embed) run; index rebuilt.
- **T+50m** — bot eval green again; refusal rate back to baseline; alert cleared.

## What went right

- The failure was **safe**: the bot refused and handed off; it never fabricated answers from broken retrieval.
  The grounding + relevance-threshold design (S12) turned a retrieval outage into graceful refusals, not
  confident nonsense.
- The **eval harness caught it in production** — the graders sampling live traffic did their job.
- The **runbook worked**: re-embed restored service without a code change.

## What went wrong

- **The alert fired 40 minutes late.** The refusal rate spiked at T+0 but the sampling window + threshold meant
  the alert didn't page until T+40m. In a real incident that's 40 minutes of degraded self-serve. *A monitor
  that alerts after the damage is half a monitor — drills validate thresholds and latency, not just existence.*

## Action items (filed as issues)

1. **Tune the drift sampling rate + window** so a refusal-rate spike of this magnitude pages within ~5 minutes,
   not 40. (owner: obs) — *the finding that made the drill worth running.*
2. Add an index-health check to `/health/ai` so a broken index surfaces directly, not only via the quality
   proxy.
3. Add the drill's regressed cases to the bot eval dataset as permanent regression tests.

## Lesson

Drills validate the *timing* of your monitoring, not just its existence. The system degraded safely and the
detector worked — but "worked eventually" isn't "worked." Ship the threshold tuning.
