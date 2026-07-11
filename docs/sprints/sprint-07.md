# Sprint 07 — SLAs, Escalation & Reporting v1

**Branch:** `sprint-07/slas-reporting` · **Size:** M/L · Ritual: [00-workflow.md](00-workflow.md)

**Goal:** Time-based promises: SLA windows (first-response, resolution) that respect business hours, escalation when they're about to breach, breach alerting, and reporting v1 (volume, response times, agent load). Also robust email threading lands here, partially harvesting the S3 flaw.

## A — Issues
1. `SLA policies: targets per priority/channel, business-hours-aware clocks`
2. `Escalation: pre-breach warnings, reassignment/notify on breach`
3. `Reporting v1: volume, first-response/resolution times (percentiles), agent workload`
4. `Threading hardening: use References/In-Reply-To headers (harvest S3 flaw, part 1)`

## B — Commits
| # | Commit | Notes |
|---|--------|------|
| 1 | `feat(db): SLAPolicy + SLAWindow per conversation (target, started, paused, breachedAt)` | the clock pauses off-hours and while pending-on-customer — SLA math is a business-calendar problem (🔗 Meridian S6 working-days, restated) |
| 2 | `feat(shared): pure SLA clock — elapsed business-time between two instants given a calendar` | pure, property-tested (functional core, again) |
| 3 | `feat(worker): SLA monitor job — pre-breach thresholds emit warnings, breach triggers escalation` | 🔗 Meridian S10 catch-up semantics; the job is idempotent per (window, threshold) |
| 4 | `feat(api): escalation policy — notify/reassign/raise-priority on threshold` | |
| 5 | `refactor(mailin): threading uses References/In-Reply-To headers, Subject as fallback` | **harvests flaw #1 (part 1)**, ledger quoted; the header-based threader + a cross-contact misthread regression test; full robustness (edge cases) finished in S13 |
| 6 | `feat(api): reporting v1 — aggregate queries (volume, response percentiles, workload)` | 🔗 Pulse/Meridian aggregation lessons; percentiles not averages |
| 7 | `feat(web): SLA badges on conversations (time remaining, at-risk, breached) + reporting dashboard` | |
| 8 | `test: SLA clock business-hours cases; escalation firing once; threading regression corpus` | |
| 9 | `docs: ADR-0006 SLA clock design; curriculum note` | |

## C — Review order
The pure SLA clock (2) + its tests → monitor job (3) → the threading harvest (5, note the header approach) → reporting.

## D — Teaching comments (~9)
- SLA clock as pure fn — 🔗 functional-core discipline, fourth course running: business-time-between is pure and property-tested; pausing rules (off-hours, awaiting-customer) are where SLAs get subtle
- clock pauses — ⚠️ an SLA that ticks while you wait on the *customer* punishes agents for customer latency; the pause rules are a fairness decision, documented
- escalation idempotency — 🔗 fire-once semantics via a sent-marker (Meridian S10); a monitor that double-escalates cries wolf
- header threading — 📘 References/In-Reply-To is the *correct* signal (S3 shipped the wrong one); the harvest shows how to migrate a heuristic to a robust approach without breaking existing threads; part 2 (forwarded-chain edge cases) waits for S13
- percentiles in reporting — 📘 average response time hides the angry tail; p50/p90/p95 tell the real story (🔗 Pulse's percentile lessons)
- misthread regression test — 🔍 review-lens: the test asserts two different contacts' same-subject emails stay separate — the exact failure the S3 flaw caused

## E — Debate
**"SLA breach: auto-reassign vs alert-and-hold?"** Auto-reassign: keeps things moving, but churns ownership and may dump on an equally-busy agent. Alert-and-hold: preserves context, relies on human response. **Resolution:** tiered — pre-breach alerts to the owner, breach escalates to the team lead (notify, not auto-reassign); reassignment only on agent-offline. Lesson: *escalation should add attention before it changes ownership.*

## F/G — Close
- Squash: `feat(sprint-07): SLAs, escalation, reporting v1 (closes #…)`
- **Lab (break-it):** learner constructs conversations that expose SLA-clock edge cases (holidays, timezone flips, rapid pending↔open toggles) and the remaining threading edge cases (foreshadowing S13 part 2).
- Ledger: flaw #1 marked *partially harvested* (headers in; edge cases → S13).
- Recap idea: *an SLA is a promise measured on a business calendar — and the calendar is where the bugs live.*
