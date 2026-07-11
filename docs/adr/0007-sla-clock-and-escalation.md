# ADR-0007 — SLA clock on a business calendar; tiered, fire-once escalation

**Status:** accepted (S07) · **Deciders:** Harbor course

## Context

Support promises are time-based: "first response within 4 hours," "resolved within a business day." Measuring
that naively (wall-clock `now - createdAt`) is wrong in ways that matter to the humans being measured: it
counts nights, weekends, and the hours a ticket sits *waiting on the customer* against the agent. We need a
clock that reflects the promise actually made, plus a way to act before a breach without crying wolf.

## Decisions

### 1. The clock runs on a business calendar, and it pauses
Elapsed SLA time is **business-time**, not wall-clock: only minutes inside the schedule's daily windows count
(`businessMillisBetween`, a pure function walking day-by-day and summing in-hours overlap). The clock also
**pauses while awaiting the customer**. This is a *fairness* decision, stated openly: an SLA that ticks during
customer latency punishes agents for something they don't control. Consumed = gross business-time − paused
business-time. 🔗 Meridian S6's working-days math, restated.

### 2. Escalation is tiered, and fires exactly once (the debate)

**Auto-reassign vs alert-and-hold on breach?**
- **Auto-reassign:** keeps things moving, but churns ownership (losing context) and may dump the ticket on an
  equally-swamped agent.
- **Alert-and-hold:** preserves context and the owner's knowledge, but leans on a human to respond.

**Resolution: tiered.** Pre-breach thresholds (75%, 90%) warn the *owner*; a breach (100%) escalates to the
*team lead* (notify — not auto-reassign); ownership only changes automatically when the owner is **offline**.
The rule: *escalation should add attention before it changes ownership.*

Crucially, every alert fires **once** per (window, threshold). The monitor runs on a cadence; without a
sent-marker it re-alerts every tick, and an escalation channel that cries wolf gets muted — after which it
escalates *nothing*. `EscalationLog` models the marker; production persists it. 🔗 Meridian S10 fire-once.

### 3. Reporting uses percentiles, not averages
First-response and resolution times are reported as **p50/p90/p95**. The average is actively misleading: nine
one-minute replies and one three-hour reply average to ~18 minutes, describing no real customer — the p95 is
the one about to churn. 🔗 Pulse's percentile lessons.

### 4. Threading now follows the reply chain (harvest of flaw #1, part 1)
Inbound email threads on the **Message-ID chain** (`In-Reply-To` / `References`) — the correct signal, which
S03 parsed but ignored in favor of subject similarity. Subject remains a *fallback*, now **scoped to the
sender's contact**, so two different customers' "Invoice" emails can never merge (the exact bug the S03 flaw
caused; a regression test pins it). *Migrating a heuristic to a robust signal: demote the old signal to a
constrained fallback rather than deleting it.*

## Consequences

- `packages/shared/src/sla.ts` (clock, status, thresholds, `EscalationLog`) and `reporting.ts` (percentiles)
  are pure and property-tested; `apps/worker/src/sla-monitor.ts` decides escalations from them.
- Schema: `SLAPolicy`, `SLAWindow` (pauses as JSON), and `Message.messageId` for header threading.
- **Deferred to S13 (flaw #1, part 2):** forwarded-chain edge cases — replies that drop `References`, clients
  that rewrite `Message-ID`s, subject-only clients. The lab constructs these.
- **Links:** the S07 auto-reassign-vs-alert debate; the S03 threading flaw & ADR-0003; Meridian S6/S10.
